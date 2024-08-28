'use strict';

var _ = require('lodash'),
  colormap = require('colormap'),
  nodeSchedule = require('node-schedule'),
  requestPromise = require('request-promise'),
  moment = require('moment'),
  Jenkins = require('jenkins'),
  logger = require('../../../../config/lib/logger'),
  bookingColors = colormap({ colormap: 'phase', nshades: 20 }),
  Booking = require('../models/bookings.server.model').Schema,
  Deployment = require('../../../deployments/server/models/deployments.server.model').Schema,
  Area = require('../../../areas/server/models/areas.server.model').Schema,
  Program = require('../../../programs/server/models/programs.server.model').Schema,
  User = require('../../../users/server/models/user.server.model').Schema,
  Team = require('../../../teams/server/models/teams.server.model').Schema,
  HistoryModel = require('../../../history/server/models/history.server.model'),
  BookingsHistory = require('../../../history/server/models/history.server.model').getSchema('bookings'),
  commonController = require('../../../core/server/controllers/common.server.controller'),
  helperHandler = require('../../../core/server/controllers/helpers.server.controller'),
  jiraHandler = require('../../../core/server/controllers/jira.server.controller'),
  errorHandler = require('../../../core/server/controllers/errors.server.controller'),
  bookingValidation = require('../../../bookings/server/controllers/validation.bookings.server.controller'),
  dependentModelsDetails = [{ modelObject: Booking, modelKey: 'sharingWithBooking_id' }],
  dttUrl = (process.env.NODE_ENV === 'secure' ? 'https://' : 'http://') + process.env.DTT_URL,
  sortOrder = 'name',
  currentColorIndex,
  expiryDaysToSendEmails = ['1', '3', '7'];
commonController = commonController(Booking, dependentModelsDetails, sortOrder);

var triggerJiraUpdate = Symbol.for('triggerJiraUpdate');
var dateTimeFormat = 'YYYY-MM-DD';
exports.read = commonController.read;
exports.list = commonController.list;
exports.findById = commonController.findById;
exports.delete = commonController.delete;

exports.create = async function (req, res) {
  try {
    commonController.setLoggedInUser(req.user);
    var booking = new Booking(req.body);
    if (booking.endTime) booking.endTime = moment(booking.endTime).add(1, 'days').format(dateTimeFormat);
    await booking.validate();
    await isBookable(booking);
    await isSelectedDateTimesValid(booking, true);
    await bookingValidation.verifyBookingTimeBasedOnRAmaxLimts(booking);

    // validate jenkins url
    var bookingDeployment = await Deployment.findById(booking.deployment_id);
    if (bookingDeployment && bookingDeployment.products[0]) {
      var bookedProduct = bookingDeployment.products.find(product => product._id.toString() === booking.product_id.toString());
      if (booking.automaticJenkinsIITrigger && bookedProduct && bookedProduct.jenkinsJob) {
        await validateJenkinsURL(bookedProduct, bookingDeployment.name);
      }
    }
    booking[triggerJiraUpdate] = true;
    await booking.save();
    // Send Email
    await prepareAndSendMail(booking, 'CREATED', { user: req.user });
    // Send Response
    res.location(`/api/bookings/${booking._id}`).status(201).json(booking);
  } catch (err) {
    var statusCode = (err.name === 'ValidationError' || err.name === 'StrictModeError') ? 400 : 422;
    return res.status(statusCode).send({
      message: errorHandler.getErrorMessage(err)
    });
  }
};

exports.update = async function (req, res) {
  try {
    commonController.setLoggedInUser(req.user);
    var booking = _.extend(req.Booking, req.body);
    if (moment(req.body.endTime).isValid() && booking.endTime) booking.endTime = moment(booking.endTime).add(1, 'days').format(dateTimeFormat);
    await booking.validate();
    var extraMessageToMail = await isBookable(booking, req.user);
    await isSelectedDateTimesValid(booking, false);
    await bookingValidation.verifyBookingTimeBasedOnRAmaxLimts(booking);
    booking[triggerJiraUpdate] = true;
    await booking.save();
    // Trigger Cascade Update on Child Bookings
    if (booking.bookingType === 'Shareable') {
      var childBookings = await Booking.find({ sharingWithBooking_id: booking._id });
      await helperHandler.asyncForEach(childBookings, async function (childBooking) {
        try {
          await childBooking.save();
        } catch (childBookErr) { /* Do Nothing */ }
      });
    }
    // Send Email
    await prepareAndSendMail(booking, 'UPDATED', { user: req.user });
    // Send Response
    return res.json(booking);
  } catch (err) {
    var statusCode = (err.name === 'ValidationError' || err.name === 'StrictModeError') ? 400 : 422;
    return res.status(statusCode).send({
      message: errorHandler.getErrorMessage(err)
    });
  }
};

async function isBookable(booking, user) {
  // Checks the Booking Deployment's Program/RA
  var foundDeployment = await Deployment.findById(booking.deployment_id);
  if (foundDeployment) {
    var foundProgram = await Program.findById(foundDeployment.program_id);
    var foundArea = await Area.findById(foundDeployment.area_id);
    if (foundProgram.name === 'Unassigned' || foundArea.name === 'Unassigned') {
      throw new Error('This Deployment is not assigned to Program/RA therefore can not be booked, please select a different Deployment or assign a valid Program/RA.');
    }
  }
}

exports.handleUpdateExpiredBookings = function (req, res) {
  updateExpiredBookings(function (resVerify) {
    var resStatus = (resVerify.error) ? 500 : 200;
    return res.status(resStatus).json(resVerify);
  });
};

exports.handleUpdateStartedBookings = function (req, res) {
  updateStartedBookings(function (resVerify) {
    var resStatus = (resVerify.error) ? 500 : 200;
    return res.status(resStatus).json(resVerify);
  });
};

exports.handleUpdateDeploymentStatus = function (req, res) {
  updateDeploymentStatus(function (resVerify) {
    var resStatus = (resVerify.error) ? 500 : 200;
    return res.status(resStatus).json(resVerify);
  });
};

function generateBookingColor() {
  // Generate random background color for new bookings
  var newColor = bookingColors[currentColorIndex];
  currentColorIndex = (currentColorIndex < bookingColors.length - 2) ? currentColorIndex + 1 : 0;
  return newColor;
}

async function singleBookingHandler(booking, sameDeploymentBookings, crudIsCreate) {
  await bookingValidation.findShareableStartEndTimes(booking, sameDeploymentBookings, crudIsCreate);
  await bookingValidation.verifyStartEndTimes(booking, sameDeploymentBookings, crudIsCreate);
  if (crudIsCreate) booking.backgroundColor = generateBookingColor();
}

async function shareableBookingHandler(booking, sameDeploymentBookings, crudIsCreate) {
  if (crudIsCreate) {
    var shareableBookingFound = await bookingValidation.findShareableStartEndTimes(booking, sameDeploymentBookings, crudIsCreate);
    if (shareableBookingFound) {
      // Throw Error if both Bookings are for the same Team
      if (!booking.customTeamName && booking.team_id.equals(shareableBookingFound.team_id)) {
        throw new Error('The selected team already has a Parent-Booking for this Deployment and time-range. Change team or remove this Booking.');
      }
      // Convert Booking to 'Sharing' if another Booking is set to 'Shareable' for selected times
      booking.sharingWithBooking_id = shareableBookingFound._id;
      booking.bookingType = 'Sharing';
      // Keep same color as Shareable Booking
      booking.backgroundColor = shareableBookingFound.backgroundColor;
    } else {
      await bookingValidation.verifyStartEndTimes(booking, sameDeploymentBookings, crudIsCreate);
      booking.backgroundColor = generateBookingColor();
    }
  } else {
    // Check that times for booking are still compatible with child 'sharing' bookings
    var sharingBookings = sameDeploymentBookings.filter(x => (x.bookingType === 'Sharing' && x.sharingWithBooking_id.equals(booking._id)));
    await helperHandler.asyncForEach(sharingBookings, async function (childBooking) {
      if (!booking.customTeamName && booking.team_id.equals(childBooking.team_id)) {
        throw new Error('The selected team already has a Child-Booking that is sharing with this Booking. Change team or remove Child Booking.');
      }
      await bookingValidation.verifyChildStartEndTimes(booking, childBooking, crudIsCreate);
    });

    // Check that times dont collide with any other 'unrelated' bookings
    var unrelatedBookings = sameDeploymentBookings.filter(x => x.bookingType !== 'Sharing');
    await bookingValidation.verifyStartEndTimes(booking, unrelatedBookings);
  }
}

async function sharingBookingHandler(booking, crudIsCreate) {
  var parentBooking = await Booking.findById(booking.sharingWithBooking_id);
  // Throw Error if both Bookings are for the same Team
  if (!booking.customTeamName && booking.team_id.equals(parentBooking.team_id)) {
    throw new Error('The selected team already has a Parent-Booking for this Deployment and time-range. Change team or remove this Booking.');
  }
  await bookingValidation.verifyChildStartEndTimes(parentBooking, booking, crudIsCreate);
}

async function isSelectedDateTimesValid(booking, crudIsCreate) {
  // Validator for Booking Start and End Times
  if (booking.endTime <= booking.startTime) {
    throw new Error(`Start-Time '${booking.startTime}' must come before End-Time '${booking.endTime}'.`);
  }

  var sameDeploymentBookings = await Booking.find({ _id: { $ne: booking._id }, deployment_id: booking.deployment_id });
  switch (booking.bookingType) {
    case 'Single': await singleBookingHandler(booking, sameDeploymentBookings, crudIsCreate); break;
    case 'Shareable': await shareableBookingHandler(booking, sameDeploymentBookings, crudIsCreate); break;
    case 'Sharing': await sharingBookingHandler(booking, crudIsCreate); break;
    default: // Do Nothing
  }
}

async function updateExpiredBookings(callBack) {
  var currentTime = new Date();
  // Set Expired Bookings
  var expiredBookings = [];
  try {
    expiredBookings = await Booking.find({
      isExpired: false,
      endTime: { $lt: currentTime }
    });
  } catch (findExpiredError) {
    return callBack({ message: 'Error whilst finding expired bookings', error: findExpiredError });
  }
  var errorsOccured = [];
  await HistoryModel.setLoggedInUser('', true);
  await helperHandler.asyncForEach(expiredBookings, async function (booking) {
    try {
      booking[triggerJiraUpdate] = true;
      var jiraComment = await prepareJiraComment(booking, 'Booking has expired. This ticket is now Closed.');
      await jiraHandler.addJiraComment(booking, jiraComment, 'update');
      // Transition to closed status
      await jiraHandler.transitionIssue(booking, 'closed');
      booking.isExpired = true;
      booking[triggerJiraUpdate] = false;
      await booking.save();
      // Send Email
      await prepareAndSendMail(booking, 'EXPIRED', { bookingExpired: true });
    } catch (updateExpiredError) {
      errorsOccured.push(`Booking ${booking._id}: ${updateExpiredError.message}`);
    }
  });
  if (errorsOccured.length > 0) {
    return callBack({ message: 'Errors occured whilst updating expired bookings', error: errorsOccured });
  }
  return callBack({ message: 'Expired Bookings Updated Successfully.' });
}

async function updateStartedBookings(callBack) {
  var currentTime = new Date();
  currentTime.setHours(currentTime.getHours() + 7);
  // Set Started Bookings
  var currentlyStartedBookings = [];
  try {
    currentlyStartedBookings = await Booking.find({
      isStarted: false,
      startTime: { $lt: currentTime }
    });
  } catch (findStartedError) {
    return callBack({ message: 'Error whilst finding started bookings', error: findStartedError });
  }
  var errorsOccured = [];
  await HistoryModel.setLoggedInUser('', true);
  await helperHandler.asyncForEach(currentlyStartedBookings, async function (booking) {
    try {
      var associatedDeployment = await Deployment.findById(booking.deployment_id);
      if (booking.automaticJenkinsIITrigger && booking.bookingType !== 'Sharing' && booking.enmProductSetDrop) {
        var enmProductSetVersionForJenkins = await prepareProductSetVersionForTriggering(booking);
        associatedDeployment.products.forEach(async function (product) {
          if (product._id.toString() === booking.product_id.toString()) {
            if (product.jenkinsJob) {
              await triggerJenkinsJob(enmProductSetVersionForJenkins, associatedDeployment, product.jenkinsJob, booking);
              // Update Deployment with jenkins StartTime
              associatedDeployment.jenkinsJobStartTime = currentTime;
              await associatedDeployment.save();
            }
          }
        });
      }

      booking[triggerJiraUpdate] = true;
      var productDetails = await getProductDetails(booking.product_id, booking.deployment_id);
      await jiraHandler.addJiraComment(booking, await prepareJiraComment(booking, productDetails), 'update');
      // Transition to in progress status
      await jiraHandler.transitionIssue(booking, 'inProgress');
      booking.isStarted = true;
      booking[triggerJiraUpdate] = false;
      await booking.save();
    } catch (updateStartedError) {
      errorsOccured.push(`Booking ${booking._id}: ${updateStartedError.message}`);
    }
  });
  if (errorsOccured.length > 0) {
    return callBack({ message: 'Errors occured whilst updating started bookings', error: errorsOccured });
  }
  return callBack({ message: 'Started Bookings Updated Successfully.' });
}

async function prepareJiraComment(booking, text) {
  var associatedBookingLog = await BookingsHistory.findOne({ associated_id: booking._id });
  var associatedDeployment = await Deployment.findOne({ _id: booking.deployment_id });
  var fyiSpocs = '';

  if (associatedDeployment.spocUser_ids.length > 1) {
    fyiSpocs += 'FYI: ';
    for (var i = 1; i < associatedDeployment.spocUser_ids.length; i += 1) {
      var user = await User.findOne({ _id: associatedDeployment.spocUser_ids[i] }); // eslint-disable-line no-await-in-loop
      fyiSpocs += `[~${user.username}] `;
    }
  }
  return `Hi [~${(associatedBookingLog.createdBy.username) ? associatedBookingLog.createdBy.username : ''}],
          ${text}
          Best Regards,
          [~dttadm100]
          ${fyiSpocs}
          *NOTE*: This is an automated message.`;
}

async function updateDeploymentStatus(callBack) {
  var now = new Date();
  try {
    var deploymentsNeedUpdateStatus = await Deployment.aggregate([
      {
        $match: { status: { $in: ['Free', 'In Use'] } } // Only get 'Free' and 'In Use' Deployments
      },
      {
        $lookup: { // Join Booking with Deployment collections
          from: 'bookings',
          localField: '_id',
          foreignField: 'deployment_id',
          as: 'bookings'
        }
      },
      {
        $addFields: { // add field currentBooking, if its greater than 0 theres Booking in progress
          currentBooking: {
            $filter: {
              input: '$bookings',
              as: 'booking',
              cond: {
                $and: [
                  { $lte: ['$$booking.startTime', now] },
                  { $gte: ['$$booking.endTime', now] }
                ]
              }
            }
          }
        }
      },
      {
        $addFields: {
          newStatus: { // add field newStatus, if currentBooking > 0 Booking in progress, set In Use, else Free
            $cond: [
              { $gt: [{ $size: '$currentBooking' }, 0] },
              'In Use',
              'Free'
            ]
          }
        }
      },
      {
        $match: { // Only keep Deployments whos status needs to change in array deploymentsNeedUpdateStatus
          $expr: { $ne: ['$status', '$newStatus'] }
        }
      },
      {
        $project: { // how object looks like
          name: 1,
          _id: 1,
          status: 1,
          newStatus: 1
        }
      }
    ]);
    await helperHandler.asyncForEach(deploymentsNeedUpdateStatus, async function (deployment) {
      if (deployment.status !== deployment.newStatus) {
        await Deployment.updateOne(
          { _id: deployment._id },
          { $set: { status: deployment.newStatus } }
        );
        logger.info(`${deployment.name} current status ${deployment.status} changed to ${deployment.newStatus}.`);
      }
    });
  } catch (deploymentStatusUpdateError) {
    return callBack({ message: `Error during update of Deployment status: ${deploymentStatusUpdateError}` });
  }
  return callBack({ message: 'Deployments Updated' });
}

async function getProductDetails(productId, deploymentId) {
  var deployment = await Deployment.findOne({ _id: deploymentId });
  if (deployment) {
    var elements = [];
    var productFound = deployment.products.find(product => product.id.toString() === productId.toString());
    if (productFound) {
      if (productFound.jenkinsJob) {
        var splitJobURL = productFound.jenkinsJob.split('/');
        elements.push({ key: 'Project Name', val: `${splitJobURL.slice(-2)[0]}` });
        elements.push({ key: 'Jenkins Job Url', val: `[${productFound.jenkinsJob}]` });
      }
      productFound.links.forEach(function (link) {
        elements.push({ key: link.link_name, val: `[${link.url}]` });
      });
    }
    var baseTable = `Booking has started.
                      ${(elements.length > 0) ? 'Here are the booking details:' : ''}`;
    baseTable += `\n|Deployment Name:|${deployment.name}||`;
    elements.forEach(function (tableElem) {
      baseTable += `\n|${tableElem.key}:|${tableElem.val}||`;
    });

    return baseTable;
  }
}

async function prepareProductSetVersionForTriggering(booking) {
  if (booking.enmProductSetDrop === 'LATEST GREEN' || booking.enmProductSetDrop === 'DON\'T CARE') return 'GREEN::';
  if (booking.enmProductSetVersion === 'LATEST GREEN' || booking.enmProductSetVersion === 'DON\'T CARE') return `${booking.enmProductSetDrop.slice(4)}::GREEN`;
  return `${booking.enmProductSetDrop.slice(4)}::${booking.enmProductSetVersion}`;
}

async function prepareBookingEmail(booking, actionType, emailOptions) {
  try {
    var associatedBookingLog = await BookingsHistory.findOne({ associated_id: booking._id });
    var associatedDeployment = await Deployment.findById(booking.deployment_id);
    var associatedDeploymentRA = await Area.findById(associatedDeployment.area_id);
    var associatedTeam = await Team.findById(booking.team_id);
    var associatedTeamRA;
    var differentRAWarning;
    if (!booking.customTeamName) {
      associatedTeamRA = await Area.findById(associatedTeam.area_id);
      differentRAWarning = (associatedDeployment.area_id.toString() !== associatedTeamRA._id.toString());
    }

    // EMAIL RECIPIENT INFO
    var emailRecipients = [];
    if (emailOptions && emailOptions.user) emailRecipients.push(emailOptions.user.email);
    if (process.env.NODE_ENV === 'production') {
      if (associatedDeployment.spocUser_ids.length) {
        await helperHandler.asyncForEach(associatedDeployment.spocUser_ids, async function (spocUserId) {
          var spocUser = await User.findById(spocUserId);
          if (spocUser) {
            if (!emailRecipients.includes(spocUser.email)) emailRecipients.push(spocUser.email);
          }
        });
      }
      if (associatedBookingLog && associatedBookingLog.createdBy) emailRecipients.push(associatedBookingLog.createdBy.email);
      if (associatedTeam) emailRecipients.push(associatedTeam.email);
    }

    // EMAIL SUBJECT INFO
    var emailSubject = `${associatedDeployment.name} Booking ${actionType}`;
    var extraDetails = '';
    switch (actionType) {
      case 'CREATED':
      case 'UPDATED': {
        var userDetails = `${emailOptions.user.displayName} ${emailOptions.user.email} (${emailOptions.user.username})`;
        extraDetails = `<h3>${actionType} BY: ${userDetails}</h3><hr>`;
        break;
      }
      case 'EXPIRING': {
        emailSubject += ` in ${emailOptions.expiresInDays} day(s)`;
        break;
      }
      case 'JENKINS TRIGGERED': {
        emailSubject = `Jenkins ${booking.jenkinsJobType} for ${associatedDeployment.name} ${emailOptions.triggerStatus}`;
        extraDetails = `<h3>Job URL: ${emailOptions.linkUrl}</h3><hr>`;
        break;
      }
      default: // Do Nothing
    }
    // BOOKING DETAILS
    var bookingDetails = `<h2>Booking Details:</h2>
        <b>Booking ID:</b> ${booking._id}
        <br><b>Deployment:</b> ${associatedDeployment.name} (${booking.deployment_id}) (Cross RA Sharing is: ${associatedDeployment.crossRASharing ? '<b>Enabled</b>' : '<b>Disabled</b>'})
        <br><b>Deployment RA:</b> ${associatedDeploymentRA.name}
        <br><b>Team:</b> ${(associatedTeam) ? `${associatedTeam.name} (${booking.team_id})` : `${booking.customTeamName} (Manually entered)`}
        <br><b>Team RA:</b> ${(associatedTeam) ? associatedTeamRA.name : 'N/A: Custom Team was used.'}
        <br><b>Start Time:</b> ${booking.startTime}
        <br><b>End Time:</b> ${booking.endTime}
        <br><b>Booking Type:</b> ${booking.bookingType}
        <br><b>Infrastructure:</b> ${booking.infrastructure}`;

    if (booking.infrastructure !== 'vCenter') {
      bookingDetails += `<br><b>Jenkins Job Trigger:</b> ${booking.automaticJenkinsIITrigger ? 'Automatic' : 'Manual'}
      <br><b>Jenkins Job Type:</b> ${booking.jenkinsJobType}`;
      if (emailOptions && emailOptions.expiresInDays === '1' && booking.jenkinsJobType === 'UG' && actionType === 'EXPIRING') {
        bookingDetails += '<br><b>NOTE: Job Type was Upgrade.</b> Please cleanup any changes made to the Deployment.';
      }
    }
    if (booking.description) bookingDetails += `<br><b>Additional Requirements:</b> ${booking.description}`;
    bookingDetails += '<br><br><hr>';
    if (booking.infrastructure !== 'vCenter' && booking.automaticJenkinsIITrigger && actionType === 'EXPIRING') {
      bookingDetails += '<h4>IMPORTANT NOTE:</h4> Booking will become unavailable from 7pm (GMT), on the last day of the booking.<br><br><hr>';
    }
    if (differentRAWarning) {
      bookingDetails += '<br><b>NOTE:</b> This is a Booking for a Team that is not part of RA that Deployment belongs to.';
    }
    // EMAIL BODY
    var bookingLink = `<h4>View Booking: ${dttUrl}/bookings?bookingFocus=${booking._id}</h4>
    <br><b>NOTE:<b> If you have any queries regarding this Booking, please contact person who created/updated it.`;
    var emailBody = `${extraDetails}${bookingDetails}${bookingLink}`;
    var emailObject = {
      from: `"DTT Booking Service" <${process.env.DTT_EMAIL_ADDRESS}>`,
      to: [emailRecipients],
      subject: emailSubject,
      html: emailBody,
      actionType: actionType,
      booking_id: booking._id
    };
    return emailObject;
  } catch (bookingEmailPreparationError) {
    // Do Nothing -> Email preparation failure should not affect CRUD operation
    logger.info(`Error whilst preparing booking email: ${bookingEmailPreparationError}`);
  }
}

async function triggerJenkinsJob(productSetVersion, deployment, linkUrl, booking) {
  var jenkinsJobIIUrl = (linkUrl.startsWith('https://')) ? linkUrl.slice(8).slice(0, -1) : linkUrl.slice(0, -1);
  var jenkinsJobUrlClean = jenkinsJobIIUrl.split('/job/');
  var parameters = {};
  var jenkinsConnection = new Jenkins({ baseUrl: `https://${process.env.DTT_USERNAME}:${process.env.DTT_PASSWORD}@${jenkinsJobUrlClean[0]}`, crumbIssuer: true, promosify: true }); // eslint-disable-line max-len
  var versionSplit = productSetVersion.split('::');
  var isCloud = booking.infrastructure === 'Cloud';
  var clusterIdSubstring = jenkinsJobIIUrl.substring(jenkinsJobIIUrl.indexOf('/job/'));

  parameters.jenkinsJobName = jenkinsJobUrlClean[1].replace('/', '');

  // deploymentId/clusterId, jobType
  if (isCloud) {
    parameters.deploymentId = deployment.name;
    parameters.jobType = (booking.jenkinsJobType === 'II') ? 'install' : 'upgrade';
  } else {
    parameters.clusterId = clusterIdSubstring.substring(5, 8);
    parameters.installType = (booking.jenkinsJobType === 'II') ? 'initial_install' : 'upgrade_install';
  }
  // Physical UG
  if (booking.jenkinsJobType === 'UG' && !isCloud) {
    parameters.skipLitpInstall = 'NO';
    parameters.skipPatchInstall = 'NO';
  }
  if (versionSplit[0] === 'GREEN') { // GREEN
    await getLatestGreenAndTriggerJenkins(jenkinsConnection, parameters, isCloud, booking, linkUrl);
    return;
  } else if (versionSplit[1] === 'GREEN' && isCloud) { // Version::GREEN and Cloud
    await getLatestGreenForDropAndTriggerJenkins(jenkinsConnection, versionSplit[0], parameters, booking, linkUrl);
    return;
  }
  // Version::Version
  parameters.productSet = (isCloud) ? versionSplit[1] : `${versionSplit[0]}::${versionSplit[1]}`;
  await finalJenkinsJobCall(jenkinsConnection, parameters, booking, linkUrl);
}

async function getLatestGreenAndTriggerJenkins(jenkinsConnection, parameters, isCloud, booking, linkUrl) {
  var optionsLatestGreenENM = {
    method: 'GET',
    uri: `https://${process.env.CI_PORTAL_URL}/getLastGoodProductSetVersion/?productSet=ENM`,
    json: true, // Automatically stringifies the body to JSON
    strictSSL: false
  };
  await requestPromise(optionsLatestGreenENM)
    .then(async function (latestGreenENM) {
      // Cloud 22.22.22  Phys 22.22::22.22.22
      parameters.productSet = (isCloud) ? latestGreenENM : `${latestGreenENM.substring(0, 5)}::${latestGreenENM}`;
      await finalJenkinsJobCall(jenkinsConnection, parameters, booking, linkUrl);
    }).catch(function (error) {
      throw new Error(`Get Jenkins Latest Green Error: ${error.message}`);
    });
}

async function getLatestGreenForDropAndTriggerJenkins(jenkinsConnection, dropVersion, parameters, booking, linkUrl) {
  var optionsLatestDrop = {
    method: 'GET',
    uri: `https://${process.env.CI_PORTAL_URL}/getLastGoodProductSetVersion/?drop=${dropVersion}&productSet=ENM`,
    json: true, // Automatically stringifies the body to JSON
    strictSSL: false
  };
  await requestPromise(optionsLatestDrop)
    .then(async function (enmLatestGreenForDrop) {
      parameters.productSet = enmLatestGreenForDrop;
      await finalJenkinsJobCall(jenkinsConnection, parameters, booking, linkUrl);
    }).catch(function (error) {
      throw new Error(`Get Jenkins Latest Green for Drop Error: ${error.message}`);
    });
}

async function finalJenkinsJobCall(jenkinsConnection, parameters, booking, linkUrl) {
  // Trigger only on production
  if (process.env.NODE_ENV === 'production') {
    await jenkinsConnection.job.build({ name: parameters.jenkinsJobName, parameters: parameters }, async function (err, data) {
      booking.jenkinsIIWasTriggered = true;
      booking.triggerJiraUpdate = false;
      await HistoryModel.setLoggedInUser('', true);
      await booking.save();
      logger.info(`Jenkins Job was successfully triggered! \n ${data}`);
      // Send success email
      await prepareAndSendMail(booking, 'JENKINS TRIGGERED', { linkUrl: linkUrl, triggerStatus: 'was triggered successfully' });
      if (err) {
        await prepareAndSendMail(booking, 'JENKINS TRIGGERED', { linkUrl: linkUrl, triggerStatus: 'failed to trigger' });
        throw new Error(`Final Jenkins Job Call Error: ${err}`);
      }
    });
  }
}

async function prepareAndSendMail(booking, actionType, emailOptions) {
  var emailObject = await prepareBookingEmail(booking, actionType, emailOptions);
  if (emailObject) helperHandler.sendMail(emailObject);
}

async function validateJenkinsURL(bookedProduct, deploymentName) {
  await new Promise((resolve, reject) => {
    var url = bookedProduct.jenkinsJob;
    var jenkinsJobIIUrl = (url.startsWith('https://')) ? url.slice(8).slice(0, -1) : url.slice(0, -1);
    var jenkinsJobUrlClean = jenkinsJobIIUrl.split('/job/');
    var jenkinsConnection = new Jenkins({ baseUrl: `https://${process.env.DTT_USERNAME}:${process.env.DTT_PASSWORD}@${jenkinsJobUrlClean[0]}`, crumbIssuer: true, promosify: true }); // eslint-disable-line max-len
    var jobName = jenkinsJobUrlClean[1].replace('/', '');
    jenkinsConnection.job.get(jobName, function (err, data) {
      if (err || !data) {
        reject(new Error(`Jenkins URL is invalid for Product ${bookedProduct.product_type_name}, please set \
'automaticJenkinsIITrigger' to 'false' or ensure Jenkins URL is valid for Product ${bookedProduct.product_type_name} \
which is part of Deployment ${deploymentName}.`));
      } else {
        resolve(data);
      }
    });
  });
}

// Send Emails for Expiring Bookings - Runs daily at 7AM
nodeSchedule.scheduleJob('00 00 07 * * *', async function () {
  var currentTime = new Date();
  var liveBookings = await Booking.find({
    startTime: { $lt: currentTime },
    endTime: { $gt: currentTime }
  });

  helperHandler.asyncForEach(liveBookings, async function (liveBooking) {
    var startDate = moment(currentTime);
    var endDate = moment(liveBooking.endTime);
    var numberOfDaystoExpiry = Math.abs(startDate.diff(endDate, 'days')).toString();

    if (expiryDaysToSendEmails.includes(numberOfDaystoExpiry)) {
      // Send Email
      await prepareAndSendMail(liveBooking, 'EXPIRING', { expiresInDays: numberOfDaystoExpiry });
    }
  });
});

// Update Expired Bookings, send Expired Emails - Runs Every 30 minutes
setInterval((function intervalUpdateExpiredBookings() {
  updateExpiredBookings(res => logger.info(res));
  return intervalUpdateExpiredBookings;
}()), 1800000);

// Update Started Bookings, trigger Jenkins jobs - Runs Every 60 minutes
setInterval((function intervalUpdateStartedBookings() {
  updateStartedBookings(res => logger.info(res));
  return intervalUpdateStartedBookings;
}()), 3600000);

// Update Status of Deployments Free/In Use - Runs every 45 minutes
setInterval((function intervalUpdateDeploymentStatus() {
  updateDeploymentStatus(res => logger.info(res));
  return intervalUpdateDeploymentStatus;
}()), 2700000);

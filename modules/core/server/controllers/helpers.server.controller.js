
var nodemailer = require('nodemailer'),
  _ = require('lodash'),
  logger = require('../../../../config/lib/logger'),
  BookingLogSchema = require('../../../history/server/models/history.server.model').getSchema('bookings');
var mailTransporter = nodemailer.createTransport({
  host: 'smtp-central.internal.ericsson.com',
  port: 25,
  secure: false, // true for 465, false for other ports
  tls: { rejectUnauthorized: false } // dont check certificate trust
});

module.exports.asyncForEach = async function (array, callBack) {
  for (var i = 0; i < array.length; i += 1) {
    await callBack(array[i], i, array); //eslint-disable-line
  }
};

module.exports.isValidSearch = function (query) {
  for (var key in query) {
    if (key !== 'fields' && key !== 'q') {
      return false;
    } else if (!query[key]) {
      return false;
    }
  }
  return true;
};

module.exports.sendMail = async function (email) {
  var bookingId = email.booking_id;
  var emailObject = {
    subject: email.subject,
    body: email.html,
    recipients: email.to,
    sendTime: new Date(),
    actionType: email.actionType,
    sentSuccessfully: false
  };

  delete email.booking_id;
  delete email.actionType;

  try {
    // Send email
    await mailTransporter.sendMail(email);
    emailObject.sentSuccessfully = true;
  } catch (emailError) {
    // Do Nothing -> Email failure should not affect CRUD operation
    logger.info(`Error whilst sending Email: ${emailError}`);
  }

  // Update Booking Log with Email information
  try {
    var bookingLog = await BookingLogSchema.findOne({ associated_id: bookingId }).exec();
    if (bookingLog) {
      if (!bookingLog.emails) bookingLog.emails = [];
      bookingLog.emails = bookingLog.emails.concat(emailObject);
      await bookingLog.save();
    }
  } catch (bookingLogError) {
    // Do Nothing -> Email Log failure should not affect CRUD operation
    logger.info(`Error whilst saving Email log: ${bookingLogError}`);
  }
};

module.exports.sendMonthlyCleanupMail = async function (result, error) {
  var emailSubject = 'DTT Monthly Logs Cleanup Result';
  var emailBody = `<a>Result: ${(error) ? 'Fail' : 'Success'}</a><br>
  <br>${(error) ? `${error}` : generateEmailBodyMonthlyCleanup(result)}`;
  var emailObject = {
    from: process.env.DTT_EMAIL_ADDRESS,
    to: process.env.TEAM_EMAIL,
    subject: emailSubject,
    html: emailBody
  };
  try {
    // Send email
    await mailTransporter.sendMail(emailObject);
  } catch (emailError) {
    logger.info(`Error whilst sending Monthly Cleanup Email: ${emailError}`);
  }
};

module.exports.sendUpdateAreasAndTeamsMail = async function (result, error) {
  var emailSubject = 'DTT Teams & RAs Update Result';
  var emailBody = `<a>Result: ${(error) ? 'Fail' : 'Success'}</a><br>
  <br>${(error) ? `${error}` : `${result}`}`;
  var emailObject = {
    from: process.env.DTT_EMAIL_ADDRESS,
    to: process.env.TEAM_EMAIL,
    subject: emailSubject,
    html: emailBody
  };
  try {
    // Send email
    await mailTransporter.sendMail(emailObject);
  } catch (emailError) {
    logger.info(`Error whilst sending Update RAs & Teams Email: ${emailError}`);
  }
};

module.exports.arrayOfObjectsEqual = function (array1, array2) {
  return _(array1).differenceWith(array2, _.isEqual).isEmpty();
};

function generateEmailBodyMonthlyCleanup(results) {
  var body = '';
  for (var artifact in results) {
    if (results[artifact]) {
      var data = results[artifact];
      body += `<a>${artifact}:</a><hr>
      <a>Before: ${data.before} | After: ${data.after} | Deleted: ${data.deleted}</a><hr><br>`;
    }
  }
  return body;
}

'use strict';

var fs = require('fs'),
  validator = require('validator'),
  requestPromise = require('request-promise'),
  nodeSchedule = require('node-schedule'),
  Jenkins = require('jenkins'),
  config = require('../../../../config/config'),
  jiraHandler = require('../../../core/server/controllers/jira.server.controller'),
  errorHandler = require('../../server/controllers/errors.server.controller'),
  helperHandler = require('../../server/controllers/helpers.server.controller'),
  Booking = require('../../../bookings/server/models/bookings.server.model').Schema,
  Program = require('../../../programs/server/models/programs.server.model').Schema,
  Area = require('../../../areas/server/models/areas.server.model').Schema,
  Team = require('../../../teams/server/models/teams.server.model').Schema,
  User = require('../../../users/server/models/user.server.model').Schema,
  adminUser,
  HistoryLog = require('../../../history/server/models/history.server.model.js'),
  HistoryLogBooking = require('../../../history/server/models/history.server.model.js').getSchema('bookings');
var deleteLogsOfArtifacts = [
  'booking', 'label', 'deployment', 'productflavour', 'producttype',
  'program', 'area', 'team', 'hardware'
];
/**
 * Render the main application page
 */
exports.renderIndex = async function (req, res) {
  var safeUserObject = null;
  if (req.user) {
    var userObject = await User.findById(req.user._id).populate('userRoles');
    safeUserObject = {
      displayName: validator.escape(req.user.displayName),
      username: validator.escape(req.user.username),
      created: req.user.created.toString(),
      userRoles: userObject.userRoles,
      email: validator.escape(req.user.email),
      lastName: validator.escape(req.user.lastName),
      firstName: validator.escape(req.user.firstName),
      permissions: req.user.permissions
    };
  }

  res.render('modules/core/server/views/index', {
    user: JSON.stringify(safeUserObject),
    sharedConfig: JSON.stringify(config.shared)
  });
};

exports.loginTest = async function (req, res) {
  res.send({ message: 'success' });
};

exports.getVersion = async function (req, res) {
  var version = await readFileAsync('VERSION');
  res.send(version);
};

exports.jenkinsURLValidation = async function (req, res) {
  var returnObject = { isURLValid: true };
  try {
    var url = req.params.url.trim();
    var jenkinsJobIIUrl = (url.startsWith('https://')) ? url.slice(8).slice(0, -1) : url.slice(0, -1);
    var jenkinsJobUrlClean = jenkinsJobIIUrl.split('/job/');
    var jenkinsConnection = new Jenkins({ baseUrl: `https://${process.env.DTT_USERNAME}:${process.env.DTT_PASSWORD}@${jenkinsJobUrlClean[0]}`, crumbIssuer: true, promosify: true }); // eslint-disable-line max-len
    var jobName = jenkinsJobUrlClean[1].replace('/', '');
    await jenkinsConnection.job.get(jobName, function (err, data) {
      if (err || !data) returnObject.isURLValid = false;
      res.send(returnObject);
    });
  } catch (error) {
    returnObject.isURLValid = false;
    res.send(returnObject);
  }
};

function readFileAsync(path) {
  return new Promise(function (resolve, reject) {
    fs.readFile(path, 'utf8', function (error, result) {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}

/**
 * Render the server not found responses
 * Performs content-negotiation on the Accept HTTP header
 */
exports.renderNotFound = function (req, res) {
  res.status(404).format({
    'text/html': function () {
      res.render('modules/core/server/views/404', {
        url: req.originalUrl
      });
    },
    'application/json': function () {
      res.json({
        error: 'Path not found'
      });
    },
    default: function () {
      res.send('Path not found');
    }
  });
};

exports.jiraIssueValidation = async function (req, res) {
  var jiraIssue = req.params.issue.trim();
  var eTeamsPrefixes = process.env.JIRA_PREFIX_ETEAMS.split(',');
  var currentPrefix = jiraIssue.split('-')[0];
  var eTeamsJira = eTeamsPrefixes.includes(currentPrefix);
  var jiraClient = jiraHandler.getJiraClient(eTeamsJira);


  if (process.env.ISTEST) {
    var objectToReturn = {
      summary: 'Testing Summary',
      status: 'Testing CI Infra Team',
      team: 'Testing Team',
      viewUrl: 'https://confluence-oss.seli.wh.rnd.internal.ericsson.com/display/TST/Tools+Team'
    };
    objectToReturn.valid = !jiraIssue.includes('INVALID');
    if (!objectToReturn.valid) objectToReturn.errorMessages = ['Error Message Testing'];
    return res.send(objectToReturn);
  }
  await jiraClient.issue.getIssue(
    {
      issueKey: jiraIssue
    },
    function (error, issue) {
      if (error) {
        if (error.errorMessages) {
          // Ignore you have no permissions error (issue is valid)
          if (!error.errorMessages[0].startsWith('You do not have the permission')) res.send({ valid: false, errorMessages: error.errorMessages });
        } else {
          res.send({ errorMessage: error });
        }
        return;
      }

      var viewUrl = `https://${(eTeamsJira) ? process.env.JIRA_URL_ETEAMS : process.env.JIRA_URL}/browse/${jiraIssue}`;
      var team = 'None';

      // eTeams Jira Team field
      if (issue.fields.customfield_12613) {
        team = '';
        issue.fields.customfield_12613.forEach(function (teamInIssue) {
          team += teamInIssue.value;
        });
      }
      // Sub-Area or Your Team
      if (issue.fields.customfield_15706) team = issue.fields.customfield_15706;

      // DE Team-Name
      if (issue.fields.customfield_20012) team = issue.fields.customfield_20012.value;

      res.send({
        valid: true,
        summary: issue.fields.summary,
        status: issue.fields.status.name,
        team: team,
        viewUrl: viewUrl
      });
    }
  );
};

exports.updateAreasAndTeamsData = async function (req, res) {
  var teamInventoryToolResponse;
  try {
    // Smoketest return 200
    if (process.env.ISTEST) return res.status(200).send({ message: 'Successfully updated RAs and Teams data' });

    teamInventoryToolResponse = await requestPromise.get({
      uri: `${process.env.TEAM_INVENTORY_TOOL_URL}/api/teams`,
      json: true,
      strictSSL: false
    });
    adminUser = await User.findOne({ username: 'dttadm100' });
  } catch (requestErr) {
    if (process.env.NODE_ENV === 'production') await helperHandler.sendUpdateAreasAndTeamsMail(false, requestErr);
    return res.status(422).send({
      message: `Team Inventory Tool Request Error: ${requestErr.message}`
    });
  }
  if (typeof teamInventoryToolResponse === 'string' && teamInventoryToolResponse.startsWith('<!DOCTYPE html>')) {
    var errorMessage = 'Team Inventory Tool Authorization Error.';
    if (process.env.NODE_ENV === 'production') await helperHandler.sendUpdateAreasAndTeamsMail(false, errorMessage);
    return res.status(401).send({
      message: errorMessage
    });
  }
  var updateErrors = await addOrUpdateAreasAndTeams(teamInventoryToolResponse);
  var message = 'Successfully updated RAs and Teams data';
  var extraMsg = (updateErrors && updateErrors.length) ? ` with errors: ${updateErrors.join(', ')}` : '';
  message += extraMsg;
  if (process.env.NODE_ENV === 'production') await helperHandler.sendUpdateAreasAndTeamsMail(message);
  res.send({ message: `${message}` });
};

// Update Teams and RA daily at 1 a.m
nodeSchedule.scheduleJob('00 00 01 * * *', async function () {
  if (process.env.NODE_ENV === 'production') await exports.updateAreasAndTeamsData(false, false);
});

async function addOrUpdateAreasAndTeams(data) {
  var updateErrors = [];
  // Update RAs & Teams
  await helperHandler.asyncForEach(data, async function (dataObj) {
    // Only Handle the Team if it exists in a DTT-Handled Program
    var currentArtifact;
    var crudType;

    try {
      var program = await Program.findOne({ name: dataObj.program });
      if (program) {
        var areaName = getAreaName(program, dataObj.programArea);
        currentArtifact = `RA '${areaName}'`;
        var foundArea = await Area.findOne({ name: areaName });

        // Create / Update Area
        if (!foundArea) {
          crudType = 'creation';
          var newArea = { name: areaName, program_id: program._id };
          var newAreaObj = new Area(newArea);
          foundArea = await newAreaObj.save();
        } else if (dataObj.state === 'active') {
          crudType = 'update';
          foundArea.program_id = program._id;
          foundArea.updateReason = 'Team Inventory Tool - Automatic Update';
          await foundArea.save();
        }

        var teamObject = {
          tit_ref_id: dataObj.id,
          name: dataObj.name.trim(),
          area_id: foundArea._id,
          state: dataObj.state
        };

        currentArtifact = `Team '${teamObject.name}'`;

        if (dataObj.teamEmail) {
          var teamEmail = dataObj.teamEmail.trim();
          teamEmail = (teamEmail.includes('@') && !teamEmail.includes(' ')) ? teamEmail : undefined;
          teamObject.email = teamEmail;
        }

        var foundTeam = await Team.findOne({
          $or: [{ tit_ref_id: teamObject.tit_ref_id }, { name: teamObject.name }]
        });

        // Create or Update a Team
        if (!foundTeam && dataObj.state === 'active') {
          crudType = 'creation';
          teamObject.admin_IDs = (adminUser) ? [adminUser._id] : [];
          var newTeamObj = new Team(teamObject);
          await newTeamObj.save();
        } else if (foundTeam) {
          crudType = 'update';
          Object.assign(foundTeam, teamObject);
          await foundTeam.save();
        }
      }
    } catch (updateErr) {
      updateErrors.push(`Error for ${currentArtifact} ${crudType} - ${errorHandler.getErrorMessage(updateErr)}`);
    }
  });
  return updateErrors;
}

function getAreaName(program, areaName) {
  if (areaName) areaName = areaName.trim();
  var ProgramNameAreaName = (areaName && !(areaName.includes('No RA') || areaName.includes('N/A')));

  return ProgramNameAreaName ? `${program.name}-${areaName}` : `${program.name}-No RA`;
}

// eslint-disable-next-line no-extend-native
Object.defineProperty(Array.prototype, 'flat', {
  // Keep until Node is updated as 8.16 doesn't natively support Array.flat()
  value: function (d = 1) {
    return this.reduce(function (flat, toFlatten) {
      return flat.concat((Array.isArray(toFlatten) && (d > 1)) ? toFlatten.flat(d - 1) : toFlatten);
    }, []);
  }
});

// Tool's upgrade email
exports.getUpgradeEmail = async function (req, res) {
  try {
    var toolResponse = await requestPromise.get({
      uri: `${process.env.UPGRADE_TOOL_URL}/api/upgradeCheck?q=toolName=booking-tool`,
      json: true,
      strictSSL: false
    });
    res.send(toolResponse);
  } catch (requestErr) {
    // 200 = Error in this api should not impact the tool itself
    return res.status(200).send({
      message: `Upgrade Tool Request Error: ${requestErr.message}`
    });
  }
};

exports.getToolNotifications = async function (req, res) {
  var options = {
    uri: `${process.env.UPGRADE_TOOL_URL}/api/toolnotifications/booking-tool`,
    json: true
  };

  try {
    var toolResponse = await requestPromise.get(options);
    res.send(toolResponse);
  } catch (requestErr) {
    // 200 = Error in this api should not impact the tool itself
    return res.status(200).send({
      message: `Upgrade tool request error: ${requestErr.message}`
    });
  }
};

// Monthly Artifacts/Logs Cleanup  sec/min/hrs/days/months/day of the week
nodeSchedule.scheduleJob('00 00 00 1 * *', async function () {
  if (process.env.NODE_ENV === 'production') {
    var clearResult = await exports.clearOldDeletedArtifactLogs(false, false);
    clearResult.Bookings = await exports.clearOldBookings(false, false);
    await helperHandler.sendMonthlyCleanupMail(clearResult);
  }
});

exports.clearOldBookings = async function (req, res) {
  try {
    var twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    var before = await Booking.count();
    await Booking.deleteMany({
      isExpired: true,
      endTime: { $lt: twoMonthsAgo }
    });
    var after = await Booking.count();
    var result = { before: before, after: after, deleted: before - after };
    if (req) {
      result.message = 'Bookings cleared successfully';
      res.status(200).send(result);
    } else {
      return result;
    }
  } catch (clearError) {
    if (req) {
      res.status(422).send({
        message: `Error Whilst clearing Bookings: ${clearError.message}`
      });
    } else {
      await helperHandler.sendMonthlyCleanupMail(false, clearError);
    }
  }
};

exports.clearOldDeletedArtifactLogs = async function (req, res) {
  try {
    var result = {};
    var sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    var before,
      after,
      HistoryLogArtifact;

    await helperHandler.asyncForEach(deleteLogsOfArtifacts, async function (artifact) {
      HistoryLogArtifact = HistoryLog.getSchema(`${artifact}s`);
      before = await HistoryLogArtifact.count();
      await HistoryLogArtifact.deleteMany({
        deletedAt: { $lt: sixMonthsAgo }
      });
      if (artifact === 'booking') await deleteBookingLogsWithoutdeletedAtAttr(sixMonthsAgo);
      after = await HistoryLogArtifact.count();
      result[`${artifact}Logs`] = {
        before: before, after: after, deleted: before - after
      };
    });
    if (req) {
      result.message = 'Logs cleared successfully';
      res.status(200).send(result);
    } else {
      return result;
    }
  } catch (clearError) {
    if (req) {
      res.status(422).send({
        message: `Error Whilst clearing Logs: ${clearError.message}`
      });
    } else {
      await helperHandler.sendMonthlyCleanupMail(false, clearError);
    }
  }
};

async function deleteBookingLogsWithoutdeletedAtAttr(sixMonthsAgo) {
  var bookingsLogs = await HistoryLogBooking.find({
    'originalData.endTime': { $lt: sixMonthsAgo }
  });
  await helperHandler.asyncForEach(bookingsLogs, async function (log) {
    // only delete if Booking object doesnt exist anymore
    var exists = await Booking.findOne({ _id: log.associated_id });
    if (!exists) log.remove();
  });
}

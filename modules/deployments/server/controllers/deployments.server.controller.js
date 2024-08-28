'use strict';

var _ = require('lodash');
var moment = require('moment');
var logger = require('../../../../config/lib/logger');
var Deployment = require('../models/deployments.server.model').Schema;
var Hardware = require('../../../hardware/server/models/hardware.server.model').Schema;
var Booking = require('../../../bookings/server/models/bookings.server.model').Schema;
var User = require('../../../users/server/models/user.server.model').Schema;
var Label = require('../../../labels/server/models/labels.server.model').Schema;
var commonController = require('../../../core/server/controllers/common.server.controller');
var helperHandler = require('../../../core/server/controllers/helpers.server.controller');
var jiraHandler = require('../../../core/server/controllers/jira.server.controller');
var errorHandler = require('../../../core/server/controllers/errors.server.controller');

var dependentModelsDetails = [{ modelObject: Booking, modelKey: 'deployment_id' }];
var sortOrder = 'name';
commonController = commonController(Deployment, dependentModelsDetails, sortOrder);
exports.read = commonController.read;
exports.list = commonController.list;
exports.findById = commonController.findById;
exports.delete = commonController.delete;

exports.create = async function (req, res) {
  try {
    commonController.setLoggedInUser(req.user);
    var deployment = await handleNewLabelCreations(req.body);
    deployment = new Deployment(deployment);
    await deployment.validate();
    deployment = await exports.jiraIssuesValidationAndUpdateTimebox(deployment);
    await deployment.save();
    res.location(`/api/deployments/${deployment._id}`).status(201).json(deployment);
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
    var user = await User.findOne({ _id: req.user._id }).populate('userRoles');
    var userIsAdmin = user.userRoles.some((role) => ['superAdmin', 'admin'].includes(role.name));
    if (!userIsAdmin) {
      var noFaults = await nonAdminProductConfigurationUpdateHandler(req.url, req.body);
      if (!noFaults) throw new Error('You are not allowed to edit Product Configuration as User, that is for \'Admins Only\'. Please include them in your request unchanged.');
    }
    var deployment = await handleNewLabelCreations(req.body);
    deployment = _.extend(req.Deployment, deployment);
    await deployment.validate();
    var originalDeployment = await Deployment.findById(req.Deployment._id).exec();
    deployment.timebox_data = {};
    deployment = await exports.jiraIssuesValidationAndUpdateTimebox(deployment);
    await deployment.save();
    updateHardwareAssociations(originalDeployment.products, deployment.products);
    return res.json(deployment);
  } catch (err) {
    var statusCode = (err.name === 'ValidationError' || err.name === 'StrictModeError') ? 400 : 422;
    return res.status(statusCode).send({
      message: errorHandler.getErrorMessage(err)
    });
  }
};

async function nonAdminProductConfigurationUpdateHandler(url, reqBody) {
  var deplId = url.split('/')[3];
  var currentDeployment = await Deployment.findOne({ _id: deplId }).lean();
  // get all product configurations that are admins_only from current deployment
  var currentAdminsOnlyProductsConfigurations = [];
  currentDeployment.products.forEach(function (product) {
    if (product.admins_only) currentAdminsOnlyProductsConfigurations.push(product.configuration);
  });

  var foundProtectedConfigurations = (currentAdminsOnlyProductsConfigurations.length !== 0);
  if (!foundProtectedConfigurations) return true;
  // get all product configurations that are admins_only from body
  var bodyAdminsOnlyProductsConfigurations = [];
  reqBody.products.forEach(function (product) {
    if (product.admins_only) bodyAdminsOnlyProductsConfigurations.push(product.configuration);
  });
  // every admins_only product configurations must be in the body
  var numOfConfigurationsExpected = currentAdminsOnlyProductsConfigurations.length;
  currentAdminsOnlyProductsConfigurations.forEach(function (currentProductConfig) {
    bodyAdminsOnlyProductsConfigurations.forEach(function (bodyProductConfig) {
      if (helperHandler.arrayOfObjectsEqual(currentProductConfig, bodyProductConfig)
        && (currentProductConfig.length === bodyProductConfig.length)) numOfConfigurationsExpected -= 1;
    });
  });
  return (numOfConfigurationsExpected === 0);
}

async function handleNewLabelCreations(deployment) {
  try {
    var newLabels = deployment.newLabels;
    delete deployment.newLabels;
    if (!newLabels || newLabels.trim().length === 0) return deployment;
    var newLabelNames = newLabels.split(',');
    await helperHandler.asyncForEach(newLabelNames, async function (labelName) {
      var labelFound = await Label.findOne({ name: labelName.trim().toUpperCase() }).exec();
      if (!labelFound) {
        labelFound = new Label({ name: labelName });
        await labelFound.save();
      }
      var labelIdNotInList = deployment.label_ids.every(labelId => labelId.toString() !== labelFound._id.toString());
      if (labelIdNotInList) deployment.label_ids.push(labelFound._id);
    });
    return deployment;
  } catch (labelCreationsError) {
    throw new Error(`Error whilst handling new label creations: ${labelCreationsError}`);
  }
}

exports.jiraIssuesValidationAndUpdateTimebox = async function (deployment) {
  if (deployment.jira_issues.length) {
    deployment.jira_issues = deployment.jira_issues.map(jira => jira.toUpperCase());
    if (_.uniq(deployment.jira_issues).length !== deployment.jira_issues.length) {
      var jiraDuplicateList = [];
      deployment.jira_issues.forEach(function (jiraIssue) {
        if (deployment.jira_issues.filter((issue) => (issue === jiraIssue)).length !== 1) {
          jiraDuplicateList.push(jiraIssue);
        }
      });
      jiraDuplicateList = _.uniq(jiraDuplicateList);
      throw new Error(`You cannot add the same JIRA Issue multiple times. Please remove the duplicates: ${jiraDuplicateList.join(', ')} and try again.`);
    }

    await helperHandler.asyncForEach(deployment.jira_issues, async function (jiraIssue) {
      jiraIssue = jiraIssue.trim();
      var eTeamsPrefixes = process.env.JIRA_PREFIX_ETEAMS.split(',');
      var currentPrefix = jiraIssue.split('-')[0];
      var eTeamsJira = eTeamsPrefixes.includes(currentPrefix);
      var jiraClient = jiraHandler.getJiraClient(eTeamsJira);

      try {
        var issueData = {};
        if (process.env.ISTEST) { // Used during Jenkins test, to not be reliant on Jira to be online
          if (jiraIssue.includes('TIMEBOXDATE')) { // Custom timebox date for test e.g. CIP-123TIMEBOXDATE2022-01-01
            var date = jiraIssue.split('TIMEBOXDATE');
            issueData = { fields: { customfield_26300: date[1] } };
          } else if (jiraIssue.includes('INVALID')) { // Throw Error if Invalid JIRA test
            throw new Error('Issue Does Not Exist Testing ENV Error');
          }
        } else {
          issueData = await jiraClient.issue.getIssue({ issueKey: jiraIssue });
        }

        if (issueData.fields.customfield_26300) {
          var timebox = moment(issueData.fields.customfield_26300).format('YYYY-MM-DD');
          deployment = await updateTimeboxData(deployment, jiraIssue, timebox);
        }
      } catch (error) {
        if (String(error).includes('Issue Does Not Exist')) {
          throw new Error(`JIRA Issue: ${jiraIssue} is invalid, please enter a valid Issue and try again.`);
        }
      }
    });
  }
  return deployment;
};

async function updateTimeboxData(deployment, jiraIssue, timebox) {
  var currentTimebox = '';
  if (deployment.timebox_data.issue) {
    currentTimebox = moment(deployment.timebox_data.timebox).format('YYYY-MM-DD');
  }
  if (!deployment.timebox_data.issue || !deployment.jira_issues.includes(deployment.timebox_data.issue)) {
    deployment.timebox_data.issue = jiraIssue;
    deployment.timebox_data.timebox = timebox;
  } else if (moment(timebox).isBefore(currentTimebox) || deployment.jira_issues.length === 1) {
    deployment.timebox_data.issue = jiraIssue;
    deployment.timebox_data.timebox = timebox;
  }
  return deployment;
}

async function updateHardwareAssociations(originalProducts, updatedProducts) {
  var originalHardwareIds = originalProducts.map(product => product.hardware_ids).flat().map(String),
    updatedHardwareIds = updatedProducts.map(product => product.hardware_ids).flat().map(String);
  var freeHardware = originalHardwareIds.filter(hwId => !updatedHardwareIds.includes(hwId));
  await helperHandler.asyncForEach(freeHardware, async function (hardwareId) {
    try {
      var foundHardware = await Hardware.findById(hardwareId).exec();
      if (foundHardware) {
        foundHardware.freeStartDate = Date.now();
        await foundHardware.save();
      }
    } catch (hwError) {
      logger.error(`Failed to update associated Hardware: ${hwError}`);
    }
  });
}

'use strict';

var _ = require('lodash'),
  moment = require('moment'),
  mongoose = require('mongoose'),
  MongooseSchema = mongoose.Schema,
  uniqueValidator = require('mongoose-unique-validator'),
  logger = require('../../../../config/lib/logger'),
  commonValidators = require('../../../core/server/controllers/validators.server.controller'),
  helperHandler = require('../../../core/server/controllers/helpers.server.controller'),
  jiraHandler = require('../../../core/server/controllers/jira.server.controller'),
  MongooseHistory = require('../../../history/server/plugins/history.server.plugin'),
  History = require('../../../history/server/models/history.server.model'),
  // Require Reference Schemas
  Deployment = require('../../../deployments/server/models/deployments.server.model').Schema,
  Team = require('../../../teams/server/models/teams.server.model').Schema,
  Area = require('../../../areas/server/models/areas.server.model').Schema,
  User = require('../../../users/server/models/user.server.model').Schema,
  Label = require('../../../labels/server/models/labels.server.model').Schema,
  enmRequiredFields = ['jenkinsJobType', 'enmProductSetDrop'],
  enmSpecificFields = [
    'jenkinsJobType', 'jenkinsIIWasTriggered', 'additionalJenkinsUsers', 'automaticJenkinsIITrigger',
    'enmProductSetDrop', 'enmProductSetVersion', 'nssVersion', 'jiraMRBugReferenceIssue'
  ];

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

var ConfigurationSchema = new MongooseSchema({
  _id: false,
  key_name: {
    type: String,
    trim: true,
    required: true,
    minlength: 2,
    maxlength: 50,
    validate: commonValidators.normalNameValidator
  },
  key_value: {
    type: String,
    trim: true,
    required: false
  }
}, { strict: 'throw' });

var customFieldSchema = new MongooseSchema({
  _id: false,
  key_name: {
    type: String
  },
  key_value: {
    type: String
  }
}, { strict: 'throw' });

var Booking = new MongooseSchema({
  name: {
    type: String
  },
  deployment_id: {
    type: MongooseSchema.ObjectId,
    ref: 'Deployment',
    required: true
  },
  product_id: {
    type: MongooseSchema.ObjectId
  },
  team_id: {
    type: MongooseSchema.ObjectId,
    ref: 'Team'
  },
  customTeamName: {
    type: String
  },
  startTime: {
    type: Date,
    trim: true,
    required: true
  },
  endTime: {
    type: Date,
    trim: true,
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  bookingType: {
    type: String,
    trim: true,
    required: true,
    enum: ['Single', 'Shareable', 'Sharing'],
    default: 'Single'
  },
  sharingWithBooking_id: {
    type: MongooseSchema.ObjectId,
    ref: 'Booking'
  },
  testingType: {
    type: String,
    trim: true,
    enum: [
      'Not Applicable',
      'Functional',
      'Exploratory',
      'Performance / Characteristics',
      'Rollback',
      'Scalability',
      'Stability',
      'High Availability / Robustness',
      'Upgrade',
      'Initial Install',
      'Maintenance'
    ]
  },
  jiraMRBugReferenceIssue: {
    type: String,
    trim: true,
    maxlength: 60
  },
  backgroundColor: {
    type: String,
    trim: true,
    default: ''
  },
  infrastructure: {
    type: String,
    enum: ['Cloud', 'Physical', 'vCenter', 'None'],
    required: true
  },
  isStarted: {
    type: Boolean,
    default: false
  },
  isExpired: {
    type: Boolean,
    default: false
  },
  jenkinsIIWasTriggered: {
    type: Boolean,
    default: false
  },
  enmProductSetDrop: {
    type: String
  },
  enmProductSetVersion: {
    type: String
  },
  additionalJenkinsUsers: {
    type: String,
    validate: commonValidators.usersListValidator
  },
  automaticJenkinsIITrigger: {
    type: Boolean,
    default: false
  },
  jenkinsJobType: {
    type: String,
    enum: ['II', 'UG']
  },
  jiraIssue: {
    type: String,
    trim: true,
    minlength: 3,
    maxlength: 60
  },
  nssVersion: {
    type: String,
    default: 'undefined'
  },
  configurationType: {
    type: String,
    enum: ['Inherited', 'Custom'],
    default: 'Inherited'
  },
  configuration: {
    type: [ConfigurationSchema],
    default: []
  },
  jiraTemplate: {
    jiraBoard: {
      type: String
    },
    issueType: {
      type: String
    },
    project: {
      type: String
    },
    components: [{
      type: String
    }],
    custom_fields: [{
      type: customFieldSchema
    }]
  },
  useCustomJiraTemplate: {
    type: Boolean,
    default: false
  }
}, { strict: 'throw' });

Booking.plugin(uniqueValidator, { message: 'Error, provided name is not unique.' });

Booking.pre('save', async function (next) {
  var bookingNotAllowedStatuses = ['In Review', 'Blocked/In Maintenance', 'Booking Disabled'];
  var booking = this;
  var crudType = (booking.isNew) ? 'create' : 'update';
  var isENM;
  booking.name = booking._id.toString();
  if (booking.jiraMRBugReferenceIssue === '') booking.jiraMRBugReferenceIssue = undefined;
  if (booking.customTeamName) booking.team_id = undefined;
  if (booking.jiraMRBugReferenceIssue) booking.jiraMRBugReferenceIssue = booking.jiraMRBugReferenceIssue.toUpperCase();
  try {
    var associatedDeployment = await Deployment.findOne({ _id: booking.deployment_id });
    if (!associatedDeployment) throw new Error(`A Deployment with the given id '${booking.deployment_id}' could not be found.`);
    if (crudType === 'create' && bookingNotAllowedStatuses.includes(associatedDeployment.status)) throw new Error(`A Booking cannot be created for '${associatedDeployment.name}' as its status is '${associatedDeployment.status}'.`);
    if (crudType === 'create' && !booking.customTeamName && !associatedDeployment.crossRASharing) {
      // check if team is valid/belongs to deployment
      var team = await Team.findOne({ _id: booking.team_id });
      if (!team) throw new Error(`A Team with the given id '${booking.team_id}' could not be found.`);
      if (associatedDeployment.area_id.toString() !== team.area_id.toString()) throw new Error('Selected Team does not belong to Deployment RA and Deployment has cross RA disabled');
    }
    // Product validation
    var productIds = [];
    if (associatedDeployment.products[0]) {
      associatedDeployment.products.forEach(function (product) {
        productIds.push(product._id.toString());
        if (product._id.toString() === booking.product_id.toString() && booking.infrastructure !== product.infrastructure) {
          throw new Error(`Ìnrastructure of product '${product.infrastructure}' is not equal to the one passed '${booking.infrastructure}'`);
        }
      });
      if (!productIds.includes(booking.product_id.toString())) throw new Error('Selected Product is not part of chosen Deployment, check Product ID passed');
    }
  } catch (preValidationError) {
    return next(preValidationError);
  }

  try {
    await commonValidators.validateModelId(Deployment, booking.deployment_id);
    await commonValidators.validateModelId(Deployment, booking.product_id, 'product');
    if (booking.team_id) await commonValidators.validateModelId(Team, booking.team_id);
    await commonValidators.validateModelId(booking.constructor, booking.sharingWithBooking_id);

    booking.startTime = moment(booking.startTime).startOf('day').toDate();
    booking.endTime = moment(booking.endTime).startOf('day').toDate();

    isENM = await isBookingENM(booking);
    if (isENM) {
      // Validate ENM Specific Fields
      enmRequiredFields.forEach(function (enmRequiredField) {
        if (!booking[enmRequiredField]) throw new ValidationError(`Path \`${enmRequiredField}\` is required.`);
      });

      // Jenkins Related Validators
      if (!booking.enmProductSetDrop.startsWith('ENM:')) {
        booking.enmProductSetVersion = undefined;
      } else if (!booking.enmProductSetVersion) {
        throw new Error('Product Set Version must be defined if Product Set Drop is \'ENM:XXX\'.');
      } else if (booking.enmProductSetVersion.match(/^\d/)) { // if set version starts with number
        var dropVersion = booking.enmProductSetDrop.split(':')[1];
        var setVersionParts = booking.enmProductSetVersion.split('.');
        var setVersion = `${setVersionParts[0]}.${setVersionParts[1]}`;
        if (dropVersion !== setVersion) {
          throw new Error(`Product Set Drop '${booking.enmProductSetDrop}' and Version '${booking.enmProductSetVersion}' are not compatible.`);
        }
      }
    }
  } catch (validationError) {
    return next(validationError);
  }
  try {
    if (booking.bookingType === 'Sharing') {
      // Inherit Relevant Parent Booking Attributes and add Comment to Parent Bookings JIRA
      await inheritParentBookingAttributes(booking);
      await jiraHandler.addJiraCommentToParentBooking(booking, crudType);
    } else {
      // Get Associated Booking Artifacts
      var associatedArtifacts = await getAssociatedArtifacts(booking);
      // Prepare JIRA description field
      var jiraDescription;
      if (booking.isNew) {
        jiraDescription = await getJiraDescription(booking, associatedArtifacts, undefined, undefined, isENM);
      } else {
        // If modifying an existing Booking, include changes made to Booking in the description
        var originalBooking = await booking.constructor.findById(booking._id);
        var originalArtifacts = await getAssociatedArtifacts(originalBooking);
        jiraDescription = await getJiraDescription(originalBooking, originalArtifacts, booking, associatedArtifacts, isENM);
      }

      // Prepare Issue Fields
      var jiraIssueFields = await getJiraIssueFields(booking, associatedArtifacts, jiraDescription);
      if (!booking.jiraIssue) {
        // For Bookings without a JIRA Issue - create JIRA issue
        await jiraHandler.createJiraIssue(booking, jiraIssueFields);
      } else {
        await jiraHandler.addJiraComment(booking, jiraDescription, crudType, jiraIssueFields);
      }
    }
  } catch (error) {
    var errorObject = jiraHandler.processJiraError(error, crudType);
    return next(errorObject);
  }

  if (!isENM) {
    // Strip ENM Specific Fields
    enmSpecificFields.forEach(function (enmSpecificField) {
      delete booking[enmSpecificField];
    });
  }
  return next();
});

Booking.pre('remove', async function (next) {
  var booking = this;
  try {
    // Handle JIRA Issue
    if (booking.bookingType === 'Sharing') {
      // Update JIRA Issue with comment about removed 'sharing' Booking
      booking[Symbol.for('triggerJiraUpdate')] = true;
      await jiraHandler.addJiraCommentToParentBooking(booking, 'delete');
    } else if (booking.jiraIssue) {
      await jiraHandler.deleteJiraIssue(booking);
    }
    return next();
  } catch (error) {
    var errorObject = jiraHandler.processJiraError(error, 'delete');
    return next(errorObject);
  }
});

Booking.plugin(MongooseHistory);

module.exports.Schema = mongoose.model('Booking', Booking);

async function isBookingENM(booking) {
  var bookingIsENM = false;
  try {
    if (booking.product_id) {
      var associatedProduct = await Deployment.aggregate(
        { $match: { 'products._id': booking.product_id } },
        { $unwind: '$products' },
        { $match: { 'products._id': booking.product_id } },
        { $project: { _id: '$products._id', name: '$products.product_type_name' } }
      );
      bookingIsENM = (associatedProduct[0].name.includes('ENM'));
    }
  } catch (checkError) {
    throw new ValidationError('Error whilst checking if Booking is ENM based: ' + checkError.message);
  }
  return bookingIsENM;
}

async function inheritParentBookingAttributes(booking) {
  // modify select attributes to be same as parent Bookings
  var attributesToInherit = [
    'jiraIssue', 'jiraMRBugReferenceIssue', 'testingType', 'enmProductSetDrop',
    'enmProductSetVersion', 'additionalJenkinsUsers', 'automaticJenkinsIITrigger', 'jenkinsJobType',
    'nssVersion', 'configurationType', 'configuration', 'infrastructure'
  ];
  var parentBooking = await booking.constructor.findById(booking.sharingWithBooking_id);
  attributesToInherit.forEach((attribute) => { booking[attribute] = parentBooking[attribute]; });
}

async function getAssociatedArtifacts(booking) {
  var associatedArtifacts = {};
  var allLabelsNames = [];
  associatedArtifacts.deployment = await Deployment.findById(booking.deployment_id);
  associatedArtifacts.team = (booking.team_id) ? await Team.findById(booking.team_id) : { _id: null, name: 'customTeamName' };
  associatedArtifacts.area = await Area.findById(associatedArtifacts.deployment.area_id);
  associatedArtifacts.assignee = await User.findById(associatedArtifacts.area.bookingAssigneeUser_id);
  associatedArtifacts.deploymentSpoc = await User.findById(associatedArtifacts.deployment.spocUser_ids[0]) || {};
  associatedArtifacts.modifiedBy = History.getLoggedInUser();

  await helperHandler.asyncForEach(associatedArtifacts.deployment.label_ids, async function (labelId) {
    var label = await Label.findById(labelId);
    if (label) allLabelsNames.push(label.name);
  });
  associatedArtifacts.labels = allLabelsNames;
  return associatedArtifacts;
}

async function getJiraDescription(origBooking, origArtifacts, newBooking, newArtifacts, isENM) {
  var baseTable = await getBaseTable(origBooking, origArtifacts, newBooking, newArtifacts, isENM);
  var configurationTable = await getConfigurationTable(origBooking, newBooking);
  var additionalRequirementsField = getAdditionalRequirements(origBooking, newBooking);

  var jiraDescription = `
    ${baseTable}

    ${configurationTable}

    ${additionalRequirementsField}`;

  return jiraDescription;
}

async function getBaseTable(origBooking, origArtifacts, newBooking, newArtifacts, isENM) {
  newBooking = newBooking || {};
  newArtifacts = newArtifacts || {};

  var tableElements = [
    { key: 'Can be shared with another Team?', origVal: (origBooking.bookingType === 'Shareable') ? 'Yes' : 'No', newVal: (newBooking.bookingType === 'Shareable') ? 'Yes' : 'No' },
    { key: 'Start Date', origVal: moment(origBooking.startTime).format('YYYY-MM-DD'), newVal: (newBooking.startTime) ? moment(newBooking.startTime).format('YYYY-MM-DD') : '' },
    { key: 'Duration', origVal: getBookingDuration(origBooking), newVal: getBookingDuration(newBooking) },
    { key: 'Deployment Type', origVal: origBooking.infrastructure, newVal: newBooking.infrastructure },
    { key: 'Testing Type', origVal: origBooking.testingType, newVal: newBooking.testingType },
    { key: 'RA', origVal: origArtifacts.area.name, newVal: _.isEmpty(newArtifacts) ? '' : newArtifacts.area.name },
    { key: 'Team', origVal: (origBooking.customTeamName) ? origBooking.customTeamName : origArtifacts.team.name, newVal: getTeamNewVal(newArtifacts, (newBooking.customTeamName) ? 'customTeamName' : 'team.name', newBooking) },
    { key: 'User', origVal: origArtifacts.modifiedBy.displayName, newVal: _.isEmpty(newArtifacts) ? '' : newArtifacts.modifiedBy.displayName },
    { key: 'Deployment SPOC', origVal: origArtifacts.deploymentSpoc.displayName, newVal: _.isEmpty(newArtifacts) ? '' : newArtifacts.deploymentSpoc.displayName }
  ];

  if (isENM) {
    tableElements.push({ key: 'MR/BUG link', origVal: origBooking.jiraMRBugReferenceIssue, newVal: newBooking.jiraMRBugReferenceIssue });
    tableElements.push({ key: 'Additional Jenkins users', origVal: origBooking.additionalJenkinsUsers || 'None', newVal: newBooking.additionalJenkinsUsers || 'None' });
    tableElements.push({ key: 'NSS', origVal: origBooking.nssVersion, newVal: newBooking.nssVersion });
    tableElements.push({ key: 'Jenkins Job Trigger', origVal: origBooking.automaticJenkinsIITrigger, newVal: newBooking.automaticJenkinsIITrigger });
    tableElements.push({ key: 'Jenkins Job Type', origVal: origBooking.jenkinsJobType, newVal: newBooking.jenkinsJobType });
    tableElements.push({ key: 'ENM Product Set Drop', origVal: origBooking.enmProductSetDrop, newVal: newBooking.enmProductSetDrop });
    tableElements.push({ key: 'ENM Product Set Version', origVal: origBooking.enmProductSetVersion, newVal: newBooking.enmProductSetVersion });
  }

  var baseTable = `h4. Booking Info:
    ||Option||${_.isEmpty(newBooking) ? 'Value' : 'Original||Updated'}||`;

  tableElements.forEach(function (tableElem) {
    baseTable += `\n|${tableElem.key}:|${tableElem.origVal}|${_.isEmpty(newBooking) ? '' : tableElem.newVal + '|'}`;
  });

  return baseTable;
}

function getTeamNewVal(newArtifacts, field, newBooking) {
  if (_.isEmpty(newArtifacts)) return '';
  if (field === 'customTeamName') return newBooking[field];
  return newArtifacts.team.name;
}

async function getConfigurationTable(origBooking, newBooking) {
  var origConfig = origBooking.configuration;
  var newConfig = (newBooking) ? newBooking.configuration : [];
  var configTable = 'h4. This Booking has no Configuration Specified.';

  if (origConfig.length || newConfig.length) {
    configTable = `h4. Configuration Info (${newBooking ? newBooking.configurationType : origBooking.configurationType}):
                   ||Option||${newBooking ? 'Original||Updated' : 'Value'}||`;

    if (!newBooking) {
      origConfig.forEach(function (config) {
        configTable += `\n|${config.key_name}:|${config.key_value}|`;
      });
    } else {
      // Find and print all differences in config between orig and new booking
      var origKeyNames = origConfig.map(config => config.key_name);
      var newKeyNames = newConfig.map(config => config.key_name);
      var allKeyNames = Array.from(new Set(origKeyNames.concat(newKeyNames)));
      await helperHandler.asyncForEach(allKeyNames, async function (keyName) {
        var origKeyValue = await origConfig.find(config => config.key_name === keyName);
        var newKeyValue = await newConfig.find(config => config.key_name === keyName);
        configTable += `\n|${keyName}:|${origKeyValue ? origKeyValue.key_value : 'UNDEFINED'}|${newKeyValue ? newKeyValue.key_value : 'REMOVED'}|`;
      });
    }
  }
  return configTable;
}

function getAdditionalRequirements(origBooking, newBooking) {
  var additionalRequirementsField = `
    h4. Additional Requirements ${newBooking ? '(original)' : ''}:
    bq. ${origBooking.description}`;

  if (newBooking) {
    additionalRequirementsField += `
    h4. Additional Requirements (updated):
    bq. ${newBooking.description}`;
  }

  return additionalRequirementsField;
}

async function getJiraIssueFields(booking, associatedArtifacts, issueDescription) {
  var deplSpoc = associatedArtifacts.deploymentSpoc;
  var raAssignee = associatedArtifacts.assignee ? { name: associatedArtifacts.assignee.username } : undefined;
  var jiraAssignee = deplSpoc.username ? { name: deplSpoc.username } : raAssignee;
  var issueFields = {
    summary: `${booking.infrastructure} Deployment Booking`,
    issuetype: booking.useCustomJiraTemplate ? { name: booking.jiraTemplate.issueType } : { name: 'Task' },
    duedate: booking.startTime,
    assignee: jiraAssignee,
    description: issueDescription
  };

  var additionalIssueFields = {};
  if (booking.infrastructure === 'Cloud') {
    associatedArtifacts.labels.push('Booking_Tool_vENM_Deployment');
  } else { // Physical
    associatedArtifacts.labels.push('TEaaS-AutoBooking');
  }
  if (booking.useCustomJiraTemplate) {
    additionalIssueFields.components = [];

    if (booking.jiraTemplate.components && booking.jiraTemplate.components.length !== 0) {
      booking.jiraTemplate.components.forEach(function (component) {
        additionalIssueFields.components.push({ name: component });
      });
    }
    if (booking.jiraTemplate.custom_fields && booking.jiraTemplate.custom_fields.length !== 0) {
      booking.jiraTemplate.custom_fields.forEach(function (customField) {
        var key = customField.key_name;
        additionalIssueFields[key] = { value: customField.key_value };
      });
    }
    additionalIssueFields.project = { key: booking.jiraTemplate.project };
    additionalIssueFields.labels = associatedArtifacts.labels;
  } else if (booking.infrastructure === 'Cloud') {
    additionalIssueFields = {
      project: { key: 'EESS' },
      components: [{ name: 'DTT_Booking' }],
      customfield_12328: 'Other',
      customfield_28418: { value: 'Other' },
      customfield_19034: { value: 'Other' },
      labels: associatedArtifacts.labels
    };
  } else {
    additionalIssueFields = {
      project: { key: 'EEDS' },
      components: [{ name: 'TEaaS' }],
      labels: associatedArtifacts.labels,
      customfield_12818: 'N/A' // required field 'Acceptance Criteria'
    };
  }
  return _.merge(issueFields, additionalIssueFields);
}

function getBookingDuration(booking) {
  var startDate = moment(booking.startTime);
  var endDate = moment(booking.endTime);
  var bookingDuration = endDate.diff(startDate, 'days');
  return bookingDuration;
}

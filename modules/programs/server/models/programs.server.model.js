'use strict';

var mongoose = require('mongoose');
var MongooseSchema = mongoose.Schema;
var uniqueValidator = require('mongoose-unique-validator');
var commonValidators = require('../../../core/server/controllers/validators.server.controller');
var MongooseHistory = require('../../../history/server/plugins/history.server.plugin');


var customFieldSchema = new MongooseSchema({
  _id: false,
  key_name: {
    type: String
  },
  key_value: {
    type: String
  }
}, { strict: 'throw' });

var jiraTemplatesSchema = new MongooseSchema({
  _id: false,
  infrastructure: {
    type: String
  },
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
}, { strict: 'throw' });

var Program = new MongooseSchema({
  name: {
    type: String,
    trim: true,
    required: true,
    unique: true,
    minlength: 2,
    maxlength: 50,
    validate: {
      validator: function (name) {
        return /^[a-z0-9\-_. ]*$/i.test(name);
      },
      message: '{PATH} is not valid; \'{VALUE}\' can only contain letters, numbers, dots, spaces, dashes and underscores.'
    }
  },
  jira_templates: [{
    type: jiraTemplatesSchema
  }]
}, { strict: 'throw' });

Program.plugin(uniqueValidator, { message: 'Error, provided name is not unique.' });

Program.plugin(MongooseHistory);

module.exports.Schema = mongoose.model('Program', Program);

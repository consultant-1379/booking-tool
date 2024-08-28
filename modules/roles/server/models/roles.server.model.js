'use strict';

var mongoose = require('mongoose');
var MongooseSchema = mongoose.Schema;
var uniqueValidator = require('mongoose-unique-validator');
var commonValidators = require('../../../core/server/controllers/validators.server.controller');
var MongooseHistory = require('../../../history/server/plugins/history.server.plugin');

var permissionSchema = new MongooseSchema({
  _id: false,
  resources: {
    type: String,
    trim: true,
    required: false
  },
  allResourceMethods: {
    type: String,
    required: false
  },
  userCreatedResourceMethods: {
    type: String,
    required: false
  }
});

var Role = new MongooseSchema({
  name: {
    type: String,
    trim: true,
    required: true,
    unique: true,
    minlength: 2,
    maxlength: 50,
    validate: commonValidators.objectNameValidator
  },
  pathsPermissions: {
    type: [permissionSchema]
  }
}, { strict: 'throw' });

Role.plugin(uniqueValidator, { message: 'Error, provided name is not unique.' });

Role.plugin(MongooseHistory);

module.exports.Schema = mongoose.model('Role', Role);

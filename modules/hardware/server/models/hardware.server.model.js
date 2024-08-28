'use strict';

var mongoose = require('mongoose');
var MongooseSchema = mongoose.Schema;
var uniqueValidator = require('mongoose-unique-validator');
var commonValidators = require('../../../core/server/controllers/validators.server.controller');
var MongooseHistory = require('../../../history/server/plugins/history.server.plugin');
var Program = require('../../../programs/server/models/programs.server.model').Schema;

var Hardware = new MongooseSchema({
  name: {
    type: String,
    trim: true,
    required: true,
    unique: true,
    minlength: 2,
    maxlength: 50,
    validate: commonValidators.objectNameValidator
  },
  hw_deployment_id: {
    type: String,
    trim: true,
    maxlength: 50,
    validate: commonValidators.objectNameValidator
  },
  url: {
    type: String,
    trim: true,
    validate: commonValidators.urlLinkValidator
  },
  program_id: {
    type: MongooseSchema.ObjectId,
    ref: 'Program',
    required: true
  },
  freeStartDate: {
    type: Date,
    default: undefined
  }
}, { strict: 'throw' });

Hardware.plugin(uniqueValidator, { message: 'Error, provided name is not unique.' });

Hardware.pre('save', async function (next) {
  try {
    var hardware = this;
    await commonValidators.validateModelId(Program, hardware.program_id);
    return next();
  } catch (error) {
    return next(error);
  }
});

Hardware.plugin(MongooseHistory);

module.exports.Schema = mongoose.model('Hardware', Hardware);

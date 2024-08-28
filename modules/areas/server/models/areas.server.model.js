'use strict';

var mongoose = require('mongoose');
var MongooseSchema = mongoose.Schema;
var uniqueValidator = require('mongoose-unique-validator');
var commonValidators = require('../../../core/server/controllers/validators.server.controller');
var User = require('../../../users/server/models/user.server.model.js').Schema;
var MongooseValidation = require('../../../core/server/plugins/validation.server.plugin');
var MongooseHistory = require('../../../history/server/plugins/history.server.plugin');
// Require Reference Schemas
var Program = require('../../../programs/server/models/programs.server.model').Schema;

var Area = new MongooseSchema({
  name: {
    type: String,
    trim: true,
    required: true,
    unique: true,
    minlength: 2,
    maxlength: 50
  },
  program_id: {
    type: MongooseSchema.ObjectId,
    ref: 'Program',
    required: true
  },
  bookingAssigneeUser_id: {
    type: MongooseSchema.ObjectId,
    ref: 'User'
  },
  maxBookingDurationDays: {
    type: Number,
    min: 1
  },
  maxBookingAdvanceWeeks: {
    type: Number,
    min: 1
  }
}, { validateBeforeSave: false, strict: false });

Area.plugin(MongooseValidation);

Area.plugin(uniqueValidator, { message: 'Error, provided name is not unique.' });

Area.pre('save', async function (next) {
  try {
    var area = this;
    if (area.maxBookingAdvanceWeeks === null) area.maxBookingAdvanceWeeks = undefined;
    if (area.maxBookingDurationDays === null) area.maxBookingDurationDays = undefined;
    if (area.bookingAssigneeUser_id === null) area.bookingAssigneeUser_id = undefined;

    await commonValidators.validateModelId(Program, area.program_id);
    await commonValidators.validateModelId(User, area.bookingAssigneeUser_id);
    return next();
  } catch (error) {
    return next(error);
  }
});

Area.plugin(MongooseHistory);

module.exports.Schema = mongoose.model('Area', Area);

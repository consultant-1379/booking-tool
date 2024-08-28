'use strict';

var mongoose = require('mongoose');
var MongooseSchema = mongoose.Schema;
var uniqueValidator = require('mongoose-unique-validator');
var commonValidators = require('../../../core/server/controllers/validators.server.controller');
var MongooseHistory = require('../../../history/server/plugins/history.server.plugin');

var ProductFlavour = new MongooseSchema({
  name: {
    type: String,
    trim: true,
    required: true,
    unique: true,
    minlength: 2,
    maxlength: 50,
    validate: commonValidators.objectNameValidator
  }
}, { strict: 'throw' });

ProductFlavour.plugin(uniqueValidator, { message: 'Error, provided name is not unique.' });

ProductFlavour.plugin(MongooseHistory);

module.exports.Schema = mongoose.model('ProductFlavour', ProductFlavour);

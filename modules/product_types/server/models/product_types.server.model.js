'use strict';

var _ = require('lodash');
var mongoose = require('mongoose');
var MongooseSchema = mongoose.Schema;
var uniqueValidator = require('mongoose-unique-validator');
var helpers = require('../../../core/server/controllers/helpers.server.controller');
var commonValidators = require('../../../core/server/controllers/validators.server.controller');
var ProductFlavour = require('../../../product_flavours/server/models/product_flavours.server.model.js').Schema;
var MongooseHistory = require('../../../history/server/plugins/history.server.plugin');

var MandatoryKeySchema = new MongooseSchema({
  _id: false,
  name: {
    type: String,
    trim: true,
    required: true,
    minlength: 2,
    maxlength: 50,
    validate: commonValidators.objectNameValidator
  },
  infrastructure: {
    type: String,
    enum: ['Cloud', 'Physical', 'Both'],
    required: true
  }
}, { strict: 'throw' });

var ProductType = new MongooseSchema({
  name: {
    type: String,
    trim: true,
    required: true,
    unique: true,
    minlength: 2,
    maxlength: 50,
    validate: commonValidators.objectNameValidator
  },
  flavours: {
    type: [String],
    trim: true,
    validate: {
      validator: function (v) {
        return v.length > 0;
      },
      message: 'You must provide at least one flavour.'
    }
  },
  configKeysAreStrict: {
    type: Boolean,
    default: false
  },
  mandatoryConfigKeys: {
    type: [MandatoryKeySchema],
    default: []
  }
}, { strict: 'throw' });

ProductType.plugin(uniqueValidator, { message: 'Error, provided name is not unique.' });

ProductType.pre('save', async function (next) {
  try {
    var flavours = this.flavours;
    if (flavours.length > 0) {
      if (_.uniq(flavours).length !== flavours.length) {
        return await Promise.reject(new Error('Error, There are duplicate flavours assigned to this product-type.'));
      }
      var flavourList = (await ProductFlavour.find({}).exec()).map(flavour => flavour.name);
      await helpers.asyncForEach(flavours, async function (flavour) {
        if (flavourList.indexOf(flavour) === -1) {
          return Promise.reject(new Error(`Error, Flavour '${flavour}' does not exist!`));
        }
      });
    }
    return next();
  } catch (error) {
    return next(error);
  }
});

ProductType.plugin(MongooseHistory);

module.exports.Schema = mongoose.model('ProductType', ProductType);

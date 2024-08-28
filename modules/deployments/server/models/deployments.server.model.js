'use strict';

var mongoose = require('mongoose');
var MongooseSchema = mongoose.Schema;
var uniqueValidator = require('mongoose-unique-validator');
var helpers = require('../../../core/server/controllers/helpers.server.controller');
var commonValidators = require('../../../core/server/controllers/validators.server.controller');
var MongooseHistory = require('../../../history/server/plugins/history.server.plugin');
// Require Reference Schemas
var Area = require('../../../areas/server/models/areas.server.model').Schema;
var Program = require('../../../programs/server/models/programs.server.model').Schema;
var Team = require('../../../teams/server/models/teams.server.model').Schema;
var ProductType = require('../../../product_types/server/models/product_types.server.model.js').Schema;
var Hardware = require('../../../hardware/server/models/hardware.server.model').Schema;
var User = require('../../../users/server/models/user.server.model').Schema;
var Label = require('../../../labels/server/models/labels.server.model').Schema;

var TimeboxJiraSchema = new MongooseSchema({
  _id: false,
  issue: {
    type: String
  },
  timebox: {
    type: Date,
    trim: true
  }
}, { strict: 'throw' });

var LinkSchema = new MongooseSchema({
  _id: false,
  link_name: {
    type: String,
    trim: true,
    required: true,
    minlength: 2,
    maxlength: 50,
    validate: commonValidators.normalNameValidator
  },
  url: {
    type: String,
    default: 'https://www.urlnotentered.se',
    trim: true,
    required: false,
    validate: commonValidators.urlLinkValidator
  }
}, { strict: 'throw' });

var ConfigurationSchema = new MongooseSchema({
  _id: false,
  key_name: {
    type: String,
    trim: true,
    required: true,
    minlength: 2,
    maxlength: 50,
    validate: commonValidators.objectNameValidator
  },
  key_value: {
    type: String,
    trim: true,
    required: true
  }
}, { strict: 'throw' });

var ProductSchema = new MongooseSchema({
  product_type_name: {
    type: String,
    trim: true,
    required: true
  },
  flavour_name: {
    type: String,
    trim: true,
    required: true
  },
  location: {
    type: String,
    trim: true,
    minlength: 2,
    maxlength: 50,
    validate: commonValidators.normalNameValidator
  },
  infrastructure: {
    type: String,
    enum: ['Cloud', 'Physical', 'vCenter'],
    required: true
  },
  purpose: {
    type: String,
    trim: true
  },
  hardware_ids: [{
    type: MongooseSchema.ObjectId,
    ref: 'Hardware'
  }],
  links: {
    type: [LinkSchema],
    default: []
  },
  configuration: {
    type: [ConfigurationSchema],
    default: []
  },
  jenkinsJob: {
    type: String,
    trim: true,
    required: false,
    validate: commonValidators.urlLinkValidator
  },
  admins_only: {
    type: Boolean,
    required: true
  }
}, { strict: 'throw' });

var Deployment = new MongooseSchema({
  name: {
    type: String,
    trim: true,
    required: true,
    unique: true,
    minlength: 2,
    maxlength: 50,
    validate: commonValidators.objectNameValidator
  },
  area_id: {
    type: MongooseSchema.ObjectId,
    ref: 'Area',
    required: true
  },
  program_id: {
    type: MongooseSchema.ObjectId,
    ref: 'Program',
    required: true
  },
  team_id: {
    type: MongooseSchema.ObjectId,
    ref: 'Team'
  },
  spocUser_ids: [{
    type: MongooseSchema.ObjectId,
    ref: 'User'
  }],
  status: {
    type: String,
    required: true,
    enum: ['Free', 'In Review', 'Blocked/In Maintenance', 'In Use', 'Booking Disabled']
  },
  purpose: {
    type: String,
    trim: true
  },
  label_ids: [{
    type: MongooseSchema.ObjectId,
    ref: 'Label'
  }],
  timebox_data: {
    type: TimeboxJiraSchema,
    default: {}
  },
  jira_issues: [{
    type: String,
    trim: true,
    minlength: 3,
    maxlength: 60
  }],
  products: {
    type: [ProductSchema]
  },
  jenkinsJobStartTime: {
    type: Date
  },
  crossRASharing: {
    type: Boolean,
    default: false
  }
}, { strict: 'throw' });

Deployment.plugin(uniqueValidator, { message: 'Error, provided name is not unique.' });

Deployment.pre('save', async function (next) {
  try {
    var deployment = this;
    await commonValidators.validateModelId(Area, deployment.area_id);
    await commonValidators.validateModelId(Program, deployment.program_id);
    await commonValidators.validateModelId(Team, deployment.team_id);
    await helpers.asyncForEach(deployment.spocUser_ids, async function (userId) {
      await commonValidators.validateModelId(User, userId);
    });
    await helpers.asyncForEach(deployment.label_ids, async function (labelId) {
      await commonValidators.validateModelId(Label, labelId);
    });
    var products = deployment.products;
    var otherUsedHardwareIds = [];
    if (products && products.length > 0) {
      var otherDeployments = await deployment.constructor.find({ _id: { $ne: deployment._id }, program_id: deployment.program_id });
      // Get all hardware in use by other Deployments for this Program
      otherUsedHardwareIds = otherDeployments.map(depl => depl.products.map(product => product.hardware_ids)).flat(2);
    }
    var hardwareUsedInOtherProducts = [];
    await helpers.asyncForEach(products, async function (product) {
      var foundProduct = await ProductType.findOne({ name: product.product_type_name });
      if (!foundProduct) {
        return Promise.reject(new Error(`Error, Product-Type '${product.product_type_name}' does not exist.`));
      }
      if (foundProduct.flavours.indexOf(product.flavour_name) === -1) {
        return Promise
          .reject(new Error(`Error, Product-Flavour '${product.flavour_name}' is not valid for Product-Type '${product.product_type_name}'.`));
      }

      // Verify that no hardware ID is being used multiple times in the one product
      var hardwareIdDuplicates = product.hardware_ids.filter((hwId, hwIndex) => product.hardware_ids.indexOf(hwId) !== hwIndex);
      if (hardwareIdDuplicates && hardwareIdDuplicates.length > 0) {
        var hardwareIdDuplicatesUnique = [...new Set(hardwareIdDuplicates.map(hwId => hwId.toString()))];
        throw new Error(`Hardware ${hardwareIdDuplicatesUnique.join(', ')} cannot be assigned multiple times to product ${product.product_type_name}`);
      }

      await helpers.asyncForEach(product.hardware_ids, async function (hardwareId) {
        var foundHardware = await Hardware.findById(hardwareId).exec();
        if (!foundHardware) {
          throw new Error(`A Hardware with the given id '${hardwareId}' could not be found.`);
        }
        if (!foundHardware.program_id.equals(deployment.program_id)) {
          throw new Error(`Hardware '${foundHardware.name}' cannot be assigned as it is associated to Program with ID '${foundHardware.program_id}`);
        }
        if (otherUsedHardwareIds.some(hwId => hwId.equals(hardwareId))) {
          throw new Error(`Hardware '${foundHardware.name}' cannot be assigned as it is already assigned to another Deployment`);
        }
        if (hardwareUsedInOtherProducts.some(hwId => hwId.equals(hardwareId))) {
          throw new Error(`Hardware '${foundHardware.name}' cannot be assigned to multiple products within the same Deployment`);
        }
        if (foundHardware.freeStartDate) {
          foundHardware.freeStartDate = undefined;
          await foundHardware.save();
        }
      });
      hardwareUsedInOtherProducts.push(...product.hardware_ids);
    });
    return next();
  } catch (error) {
    return next(error);
  }
});

Deployment.plugin(MongooseHistory);

module.exports.Schema = mongoose.model('Deployment', Deployment);

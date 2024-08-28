'use strict';

var Label = require('../models/labels.server.model').Schema;
var Deployment = require('../../../deployments/server/models/deployments.server.model').Schema;
var commonController = require('../../../core/server/controllers/common.server.controller');

var dependentModelsDetails = [
  { modelObject: Deployment, modelKey: 'label_ids' }
];

var sortOrder = 'name';
commonController = commonController(Label, dependentModelsDetails, sortOrder);

exports.create = commonController.create;
exports.read = commonController.read;
exports.list = commonController.list;
exports.findById = commonController.findById;
exports.delete = commonController.delete;
exports.update = commonController.update;

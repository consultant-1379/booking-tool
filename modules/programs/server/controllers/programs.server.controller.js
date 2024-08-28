'use strict';

var Program = require('../models/programs.server.model').Schema;
var Area = require('../../../areas/server/models/areas.server.model').Schema;
var Deployment = require('../../../deployments/server/models/deployments.server.model').Schema;
var Hardware = require('../../../hardware/server/models/hardware.server.model').Schema;
var commonController = require('../../../core/server/controllers/common.server.controller');

var dependentModelsDetails = [
  { modelObject: Area, modelKey: 'program_id' },
  { modelObject: Deployment, modelKey: 'program_id' },
  { modelObject: Hardware, modelKey: 'program_id' }
];
var sortOrder = 'name';
commonController = commonController(Program, dependentModelsDetails, sortOrder);

exports.create = commonController.create;
exports.update = commonController.update;
exports.read = commonController.read;
exports.list = commonController.list;
exports.findById = commonController.findById;
exports.delete = commonController.delete;

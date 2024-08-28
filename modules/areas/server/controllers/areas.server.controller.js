'use strict';

var Area = require('../models/areas.server.model').Schema;
var Deployment = require('../../../deployments/server/models/deployments.server.model').Schema;
var Team = require('../../../teams/server/models/teams.server.model').Schema;
var commonController = require('../../../core/server/controllers/common.server.controller');
var dependentModelsDetails = [
  { modelObject: Deployment, modelKey: 'area_id' },
  { modelObject: Team, modelKey: 'area_id' }
];
var sortOrder = 'name';
commonController = commonController(Area, dependentModelsDetails, sortOrder);

exports.create = commonController.create;
exports.read = commonController.read;
exports.list = commonController.list;
exports.findById = commonController.findById;
exports.update = commonController.update;
exports.delete = commonController.delete;

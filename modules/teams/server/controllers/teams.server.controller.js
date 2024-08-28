'use strict';

var _ = require('lodash');
var Team = require('../models/teams.server.model').Schema;
var Deployment = require('../../../deployments/server/models/deployments.server.model').Schema;
var commonController = require('../../../core/server/controllers/common.server.controller');
var errorHandler = require('../../../core/server/controllers/errors.server.controller');

var dependentModelsDetails = [{ modelObject: Deployment, modelKey: 'team_id' }];
var sortOrder = 'name';
commonController = commonController(Team, dependentModelsDetails, sortOrder);

exports.create = commonController.create;
exports.read = commonController.read;
exports.list = commonController.list;
exports.findById = commonController.findById;
exports.delete = commonController.delete;

exports.update = async function (req, res) {
  try {
    commonController.setLoggedInUser(req.user);
    var team = _.extend(req.Team, req.body);
    await team.save();
    return res.json(team);
  } catch (err) {
    var statusCode = (err.name === 'ValidationError' || err.name === 'StrictModeError') ? 400 : 422;
    return res.status(statusCode).send({ message: errorHandler.getErrorMessage(err) });
  }
};

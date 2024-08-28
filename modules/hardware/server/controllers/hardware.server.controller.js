'use strict';

var Hardware = require('../models/hardware.server.model').Schema;
var Deployment = require('../../../deployments/server/models/deployments.server.model').Schema;
var commonController = require('../../../core/server/controllers/common.server.controller');
var errorHandler = require('../../../core/server/controllers/errors.server.controller');
var dependentModelsDetails = [{ modelObject: Deployment, modelKey: 'products.hardware_ids' }];
var sortOrder = 'name';
commonController = commonController(Hardware, dependentModelsDetails, sortOrder);

exports.read = commonController.read;
exports.list = commonController.list;
exports.findById = commonController.findById;
exports.update = commonController.update;
exports.delete = commonController.delete;

exports.create = async function (req, res) {
  try {
    commonController.setLoggedInUser(req.user);
    var hardware = new Hardware(req.body);
    hardware.freeStartDate = Date.now();
    await hardware.validate();
    await hardware.save();
    res.location(`/api/hardware/${hardware._id}`).status(201).json(hardware);
  } catch (err) {
    var statusCode = (err.name === 'ValidationError' || err.name === 'StrictModeError') ? 400 : 422;
    return res.status(statusCode).send({
      message: errorHandler.getErrorMessage(err)
    });
  }
};

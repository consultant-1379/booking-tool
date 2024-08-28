'use strict';

var querystring = require('querystring');
var mongoose = require('mongoose');
var _ = require('lodash');
var mongoMask = require('mongo-mask');
var errorHandler = require('../../server/controllers/errors.server.controller');
var helperHandler = require('../../server/controllers/helpers.server.controller');
var HistoryModel = require('../../../history/server/models/history.server.model');
var Deployment = require('../../../deployments/server/models/deployments.server.model').Schema;
var User = require('../../../users/server/models/user.server.model').Schema;

module.exports = function (Model, dependentModelsDetails, sortOrder) {
  var module = {};
  var modelName = Model.modelName;

  // Common interface for setting the logged-in user that is performing
  // CRUD operations on objects; it is necessary for logging info.
  module.setLoggedInUser = (user) => HistoryModel.setLoggedInUser(user);

  module.create = async function (req, res) {
    try {
      module.setLoggedInUser(req.user);
      var modelInstance = new Model(req.body);
      await modelInstance.save();
      res.location(`/api/${modelName}s/${modelInstance._id}`).status(201).json(modelInstance);
    } catch (err) {
      var statusCode = (err.name === 'ValidationError' || err.name === 'StrictModeError') ? 400 : 422;
      return res.status(statusCode).send({ message: errorHandler.getErrorMessage(err) });
    }
  };

  module.delete = async function (req, res) {
    var modelInstance = req[modelName];
    var dependentInstancesPromises = [];
    var dependentModelNames = [];
    try {
      module.setLoggedInUser(req.user);
      for (var i = 0; i < dependentModelsDetails.length; i += 1) {
        var dependentModelDetails = dependentModelsDetails[i];
        var dependentModelKey = dependentModelDetails.modelKey;
        var dependentModelName = dependentModelDetails.modelObject.modelName;
        var DependentModel = dependentModelDetails.modelObject;
        dependentModelNames.push(dependentModelName.toLowerCase());
        var findObject = {};
        findObject[dependentModelKey] = modelInstance._id;
        dependentInstancesPromises.push(DependentModel.find(findObject).exec());
      }
      var dependentInstances = await Promise.all(dependentInstancesPromises);
      for (var x = 0; x < dependentInstances.length; x += 1) {
        if (dependentInstances[x].length > 0) {
          return res.status(422).send({
            message: `Can't delete ${modelName}, it has ${dependentInstances[x].length} dependent ${dependentModelNames[x]}(s).`
          });
        }
      }

      var user = await User.findOne({ _id: req.user._id }).populate('userRoles');
      var userIsAdmin = user.userRoles.some((role) => ['superAdmin', 'admin'].includes(role.name));
      // non admin deleting deployment
      if (!userIsAdmin && modelName === 'Deployment') {
        // check if any Product Configuration is admins only
        var deployment = await Deployment.findOne({ _id: modelInstance._id });
        deployment.products.forEach(function (product) {
          if (product.admins_only) throw new Error('Only Admin can delete this Deployment as it contains Product Configuration that can only be edited by an Admin.');
        });
      }
      await modelInstance.remove();
      res.json(modelInstance);
    } catch (err) {
      return res.status(422).send({
        message: errorHandler.getErrorMessage(err)
      });
    }
  };

  module.list = async function (req, res) {
    var query;
    if (!helperHandler.isValidSearch(req.query)) {
      return res.status(422).send({
        message: 'Improperly structured query. Make sure to use ?q=<key>=<value> syntax'
      });
    }

    if (req.query.q) {
      query = querystring.parse(req.query.q);
    }

    var fields;
    if (req.query.fields) {
      fields = mongoMask(req.query.fields, {});
    } else {
      fields = null;
    }

    Model.find(query).select(fields).sort(sortOrder).exec(async function (err, modelInstances) {
      if (err) {
        return res.status(422).send({
          message: errorHandler.getErrorMessage(err)
        });
      }
      res.json(modelInstances);
    });
  };

  module.read = function (req, res) {
    var modelInstance = req[modelName] ? req[modelName].toJSON() : {};
    res.json(modelInstance);
  };

  module.update = async function (req, res) {
    try {
      module.setLoggedInUser(req.user);
      var modelInstance = _.extend(req[modelName], req.body);
      await modelInstance.save();
      return res.json(modelInstance);
    } catch (err) {
      var statusCode = (err.name === 'ValidationError' || err.name === 'StrictModeError') ? 400 : 422;
      return res.status(statusCode).send({ message: errorHandler.getErrorMessage(err) });
    }
  };

  module.findById = function (req, res, next, id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).send({
        message: `A ${modelName} with that id does not exist`
      });
    }
    var fields;
    if (req.query.fields) {
      fields = mongoMask(req.query.fields, {});
    } else {
      fields = null;
    }
    Model.findById(id).select(fields).exec(function (err, modelInstance) {
      if (err) {
        return next(err);
      }
      if (!modelInstance) {
        return res.status(404).send({
          message: `A ${modelName} with that id does not exist`
        });
      }
      req[modelName] = modelInstance;
      return next();
    });
  };

  return module;
};

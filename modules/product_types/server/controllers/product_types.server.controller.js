'use strict';

var _ = require('lodash');
var ProductType = require('../models/product_types.server.model').Schema;
var Deployment = require('../../../deployments/server/models/deployments.server.model').Schema;
var commonController = require('../../../core/server/controllers/common.server.controller');
var errorHandler = require('../../../core/server/controllers/errors.server.controller');

var dependentModelsDetails = [];
var sortOrder = 'name';
commonController = commonController(ProductType, dependentModelsDetails, sortOrder);

exports.create = commonController.create;
exports.read = commonController.read;
exports.list = commonController.list;
exports.findById = commonController.findById;

exports.delete = async function (req, res) {
  try {
    commonController.setLoggedInUser(req.user);
    var productType = req.ProductType;
    var deployments = await Deployment.find().exec();
    var dependentDeployments = getDependentDeployments(deployments, req.ProductType.name);
    if (dependentDeployments.length > 0) {
      throw new Error(`Can't delete Product-Type, it has ${dependentDeployments.length} dependent deployment(s).`);
    }
    await productType.remove();
    res.json(productType);
  } catch (err) {
    return res.status(422).send({
      message: errorHandler.getErrorMessage(err)
    });
  }
};

exports.update = async function (req, res) {
  try {
    commonController.setLoggedInUser(req.user);
    var deployments = await Deployment.find().exec();
    var dependentDeployments = getDependentDeployments(deployments, req.ProductType.name);

    if (dependentDeployments.length > 0 && req.ProductType.name !== req.body.name) {
      throw new Error(`Can't update Product-Type name, it has ${dependentDeployments.length} dependent deployment(s).`);
    }

    var dependentFlavours = [];
    deployments.forEach(function (deployment) {
      deployment.products.forEach(function (product) {
        if (req.ProductType.name === product.product_type_name) {
          dependentFlavours.push(product.flavour_name);
        }
      });
    });

    dependentFlavours = [...new Set(dependentFlavours)]; // Remove Duplicate Flavours for error message.
    if (!dependentFlavours.every(dependentFlavour => req.body.flavours.includes(dependentFlavour))) {
      throw new Error(`Can't update Product-Type flavours, they have ${dependentDeployments.length} dependent deployment(s).\nEnsure the following flavours are included: ${dependentFlavours.join(', ')}`);
    }

    var productType = _.extend(req.ProductType, req.body);
    await productType.save();
    res.json(productType);
  } catch (err) {
    var statusCode = (err.name === 'ValidationError' || err.name === 'StrictModeError') ? 400 : 422;
    return res.status(statusCode).send({
      message: errorHandler.getErrorMessage(err)
    });
  }
};

function getDependentDeployments(deployments, productTypeName) {
  var dependentDeployments = deployments.filter(function (deployment) {
    var relevantProducts = deployment.products.filter(product => productTypeName === product.product_type_name);
    return (relevantProducts.length > 0);
  });
  return dependentDeployments;
}

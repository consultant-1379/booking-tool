'use strict';

var ProductFlavour = require('../models/product_flavours.server.model').Schema;
var ProductType = require('../../../product_types/server/models/product_types.server.model').Schema;
var commonController = require('../../../core/server/controllers/common.server.controller');
var errorHandler = require('../../../core/server/controllers/errors.server.controller');

var dependentModelsDetails = [];
var sortOrder = 'name';
commonController = commonController(ProductFlavour, dependentModelsDetails, sortOrder);

exports.create = commonController.create;
exports.read = commonController.read;
exports.list = commonController.list;
exports.findById = commonController.findById;

exports.delete = async function (req, res) {
  try {
    commonController.setLoggedInUser(req.user);
    var productFlavour = req.ProductFlavour;
    var dependentInstances = await ProductType.find({ flavours: productFlavour.name }).exec();
    if (dependentInstances.length > 0) {
      throw new Error(`Can't delete Product-Flavour, it has ${dependentInstances.length} dependent product-type(s).`);
    }
    await productFlavour.remove();
    res.json(productFlavour);
  } catch (err) {
    return res.status(422).send({
      message: errorHandler.getErrorMessage(err)
    });
  }
};

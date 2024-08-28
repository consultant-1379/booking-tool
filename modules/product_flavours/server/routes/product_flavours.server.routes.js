'use strict';

var productFlavours = require('../controllers/product_flavours.server.controller');
var adminPolicy = require('../../../../config/lib/policy');

module.exports = function (app) {
  app.route('/api/productFlavours')
    .get(productFlavours.list)
    .post(adminPolicy.isAllowed, productFlavours.create);

  app.route('/api/productFlavours/:productFlavourId')
    .get(productFlavours.read)
    .delete(adminPolicy.isAllowed, productFlavours.delete);

  app.param('productFlavourId', productFlavours.findById);
};

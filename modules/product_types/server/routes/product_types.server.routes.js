'use strict';

var productTypes = require('../controllers/product_types.server.controller');
var adminPolicy = require('../../../../config/lib/policy');

module.exports = function (app) {
  app.route('/api/productTypes')
    .get(productTypes.list)
    .post(adminPolicy.isAllowed, productTypes.create);

  app.route('/api/productTypes/:productTypeId')
    .get(productTypes.read)
    .put(adminPolicy.isAllowed, productTypes.update)
    .delete(adminPolicy.isAllowed, productTypes.delete);

  app.param('productTypeId', productTypes.findById);
};

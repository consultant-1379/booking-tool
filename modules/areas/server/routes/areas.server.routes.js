'use strict';

var areas = require('../controllers/areas.server.controller');
var adminPolicy = require('../../../../config/lib/policy');

module.exports = function (app) {
  app.route('/api/areas')
    .get(areas.list)
    .post(adminPolicy.isAllowed, areas.create);

  app.route('/api/areas/:areaId')
    .get(areas.read)
    .put(adminPolicy.isAllowed, areas.update)
    .delete(adminPolicy.isAllowed, areas.delete);

  app.param('areaId', areas.findById);
};

'use strict';

var hardware = require('../controllers/hardware.server.controller');
var adminPolicy = require('../../../../config/lib/policy');

module.exports = function (app) {
  app.route('/api/hardware')
    .get(hardware.list)
    .post(adminPolicy.isAllowed, hardware.create);

  app.route('/api/hardware/:hardwareId')
    .get(hardware.read)
    .put(adminPolicy.isAllowed, hardware.update)
    .delete(adminPolicy.isAllowed, hardware.delete);

  app.param('hardwareId', hardware.findById);
};

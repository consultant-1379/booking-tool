'use strict';

var deployments = require('../controllers/deployments.server.controller');
var adminPolicy = require('../../../../config/lib/policy');

module.exports = function (app) {
  app.route('/api/deployments')
    .get(deployments.list)
    .post(adminPolicy.isAllowed, deployments.create);

  app.route('/api/deployments/:deploymentId')
    .get(deployments.read)
    .put(adminPolicy.isAllowed, deployments.update)
    .delete(adminPolicy.isAllowed, deployments.delete);

  app.param('deploymentId', deployments.findById);
};

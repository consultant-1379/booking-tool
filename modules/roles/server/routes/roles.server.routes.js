'use strict';

var roles = require('../controllers/roles.server.controller');
var adminPolicy = require('../../../../config/lib/policy');

module.exports = function (app) {
  app.route('/api/roles')
    .get(roles.list)
    .post(adminPolicy.isAllowed, roles.create);

  app.route('/api/roles/:roleId')
    .get(roles.read)
    .put(adminPolicy.isAllowed, roles.verifyPermissions, roles.update)
    .delete(adminPolicy.isAllowed, roles.verifyPermissions, roles.delete);

  app.param('roleId', roles.findById);
};

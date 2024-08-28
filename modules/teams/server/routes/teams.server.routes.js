'use strict';

var teams = require('../controllers/teams.server.controller');
var adminPolicy = require('../../../../config/lib/policy');

module.exports = function (app) {
  app.route('/api/teams')
    .get(teams.list)
    .post(adminPolicy.isAllowed, teams.create);

  app.route('/api/teams/:teamId')
    .get(teams.read)
    .put(adminPolicy.isAllowed, teams.update)
    .delete(adminPolicy.isAllowed, teams.delete);

  app.param('teamId', teams.findById);
};

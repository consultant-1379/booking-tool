'use strict';

// Root routing
var core = require('../controllers/core.server.controller');
var adminPolicy = require('../../../../config/lib/policy');

function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) next();
  else res.sendStatus(401);
}

module.exports = function (app) {
  app.route('/api/logintest')
    .get(checkAuthenticated, core.loginTest);

  app.route('/api/version')
    .get(core.getVersion);

  app.route('/api/jiraIssueValidation/:issue')
    .get(core.jiraIssueValidation);

  app.route('/api/updateAreasAndTeamsData')
    .post(adminPolicy.isAllowed, core.updateAreasAndTeamsData);

  app.route('/api/upgradeEmail')
    .get(core.getUpgradeEmail);

  app.route('/api/toolnotifications')
    .get(core.getToolNotifications);

  app.route('/api/clearOldBookings')
    .get(core.clearOldBookings);

  app.route('/api/clearOldDeletedLogs')
    .get(core.clearOldDeletedArtifactLogs);

  app.route('/api/jenkinsURLValidation/:url')
    .get(core.jenkinsURLValidation);

  // Return a 404 for all undefined api, module or lib routes
  app.route('/:url(api|modules|lib)/*')
    .get(core.renderNotFound);

  // Define application route
  app.route('/*')
    .get(core.renderIndex);
};

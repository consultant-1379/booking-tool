'use strict';

/**
 * Module dependencies
 */
var users = require('../controllers/users.server.controller');
var adminPolicy = require('../../../../config/lib/policy');


module.exports = function (app) {
  // Setting up the users authentication api
  app.route('/api/auth/signin').post(users.signin);

  app.route('/api/auth/signout').get(users.signout);

  app.route('/api/users').get(users.list);

  app.route('/api/users/:userId')
    .get(users.read)
    .put(adminPolicy.isAllowed, users.update);

  app.route('/api/users/filters/:userId')
    .put(adminPolicy.isAllowed, users.updateFilters);

  app.param('userId', users.findById);
};

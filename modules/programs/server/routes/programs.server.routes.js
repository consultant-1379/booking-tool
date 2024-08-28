'use strict';

var programs = require('../controllers/programs.server.controller');
var adminPolicy = require('../../../../config/lib/policy');

module.exports = function (app) {
  app.route('/api/programs')
    .get(programs.list)
    .post(adminPolicy.isAllowed, programs.create);

  app.route('/api/programs/:programId')
    .get(programs.read)
    .put(adminPolicy.isAllowed, programs.update)
    .delete(adminPolicy.isAllowed, programs.delete);

  app.param('programId', programs.findById);
};

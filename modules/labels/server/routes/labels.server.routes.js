'use strict';

var labels = require('../controllers/labels.server.controller');
var adminPolicy = require('../../../../config/lib/policy');

module.exports = function (app) {
  app.route('/api/labels')
    .get(labels.list)
    .post(adminPolicy.isAllowed, labels.create);

  app.route('/api/labels/:labelId')
    .get(labels.read)
    .put(adminPolicy.isAllowed, labels.update)
    .delete(adminPolicy.isAllowed, labels.delete);

  app.param('labelId', labels.findById);
};

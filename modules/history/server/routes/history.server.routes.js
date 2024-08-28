'use strict';

var history = require('../controllers/history.server.controller');

module.exports = function (app) {
  app.route('/api/logs/:objectType')
    .get(history.list)
    .delete(history.deleteAll);

  app.route('/api/logs/:objectType/:associatedId')
    .get(history.read)
    .delete(history.delete);

  app.route('/api/logs/:objectType')
    .post(history.aggregate);

  app.route('/api/logs/clearBookingEmailLogs')
    .post(history.clearBookingEmailLogs);

  app.param('objectType', history.getObjectType);
  app.param('associatedId', history.findByAssociatedId);
};

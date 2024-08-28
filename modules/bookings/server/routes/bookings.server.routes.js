'use strict';

var bookings = require('../controllers/bookings.server.controller');
var adminPolicy = require('../../../../config/lib/policy');

module.exports = function (app) {
  app.route('/api/bookings')
    .get(bookings.list)
    .post(adminPolicy.isAllowed, bookings.create);

  app.route('/api/bookings/:bookingId')
    .get(bookings.read)
    .put(adminPolicy.isAllowed, bookings.update)
    .delete(adminPolicy.isAllowed, bookings.delete);

  app.route('/api/updateExpiredBookings')
    .post(adminPolicy.isAllowed, bookings.handleUpdateExpiredBookings);

  app.route('/api/updateStartedBookings')
    .post(adminPolicy.isAllowed, bookings.handleUpdateStartedBookings);

  app.route('/api/updateDeploymentStatus')
    .post(adminPolicy.isAllowed, bookings.handleUpdateDeploymentStatus);

  app.param('bookingId', bookings.findById);
};

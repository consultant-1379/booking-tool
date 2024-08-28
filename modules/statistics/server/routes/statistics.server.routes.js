'use strict';

var statistics = require('../controllers/statistics.server.controller');

module.exports = function (app) {
  app.route('/api/statistics/bookings')
    .get(statistics.bookingStatistics);
  app.route('/api/statistics/bookingsExport')
    .get(statistics.bookingStatisticsExport);
};

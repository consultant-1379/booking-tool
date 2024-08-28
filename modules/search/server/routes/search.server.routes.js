'use strict';

var searchController = require('../controllers/search.server.controller');

module.exports = function (app) {
  app.route('/api/search').get(searchController.search);
};

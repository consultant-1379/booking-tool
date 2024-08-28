var logRoutes = require('../../modules/history/server/routes/history.server.routes.js');
var authRoutes = require('../../modules/users/server/routes/auth.server.routes.js');
var searchRoutes = require('../../modules/search/server/routes/search.server.routes.js');
var areasRoutes = require('../../modules/areas/server/routes/areas.server.routes.js');
var programsRoutes = require('../../modules/programs/server/routes/programs.server.routes.js');
var productFlavoursRoutes = require('../../modules/product_flavours/server/routes/product_flavours.server.routes.js');
var productTypesRoutes = require('../../modules/product_types/server/routes/product_types.server.routes.js');
var labelsRoutes = require('../../modules/labels/server/routes/labels.server.routes.js');
var rolesRoutes = require('../../modules/roles/server/routes/roles.server.routes.js');
var hardwareRoutes = require('../../modules/hardware/server/routes/hardware.server.routes.js');
var deploymentsRoutes = require('../../modules/deployments/server/routes/deployments.server.routes.js');
var bookingsRoutes = require('../../modules/bookings/server/routes/bookings.server.routes.js');
var teamsRoutes = require('../../modules/teams/server/routes/teams.server.routes.js');
var statisticsRoutes = require('../../modules/statistics/server/routes/statistics.server.routes.js');
var coreRoutes = require('../../modules/core/server/routes/core.server.routes.js');

module.exports = [
  logRoutes,
  authRoutes,
  searchRoutes,
  areasRoutes,
  programsRoutes,
  productFlavoursRoutes,
  productTypesRoutes,
  labelsRoutes,
  rolesRoutes,
  hardwareRoutes,
  deploymentsRoutes,
  bookingsRoutes,
  teamsRoutes,
  statisticsRoutes,
  coreRoutes
];

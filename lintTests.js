var coreClientIntTests = require('./modules/core/tests/client/interceptors/auth-interceptor.client.tests.js');
var coreClientTests = require('./modules/core/tests/client/core.client.tests.js');
var coreClientHeaderTests = require('./modules/core/tests/client/header.client.controller.tests.js');
var coreClientHomeTests = require('./modules/core/tests/client/home.client.controller.tests.js');
var coreClientMenuTests = require('./modules/core/tests/client/menus.client.service.tests.js');
var coreServerTests = require('./modules/core/tests/server/core.server.config.tests.js');
var teamsClientTests = require('./modules/teams/tests/client/teams.client.routes.tests.js');
var teamsServerTests = require('./modules/teams/tests/server/teams.server.routes.tests.js');
var usersAuthClientTests = require('./modules/users/tests/client/users.client.routes.tests.js');
var usersClientTests = require('./modules/users/tests/client/authentication.client.controller.tests.js');
var usersModelServerTests = require('./modules/users/tests/server/user.server.model.tests.js');
var usersRoutesServerTests = require('./modules/users/tests/server/user.server.routes.tests.js');
var smokeTests = require('./SmokeTests/smoke_test.js');


module.exports = [
  coreClientIntTests,
  coreClientTests,
  coreClientHeaderTests,
  coreClientHomeTests,
  coreClientMenuTests,
  coreServerTests,
  teamsClientTests,
  teamsServerTests,
  usersAuthClientTests,
  usersClientTests,
  usersModelServerTests,
  usersRoutesServerTests,
  smokeTests
];

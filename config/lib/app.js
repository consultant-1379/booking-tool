'use strict';

/**
 * Module dependencies.
 */
var checkenv = require('checkenv'),
  chalk = require('chalk'),
  config = require('../config'),
  mongoose = require('./mongoose'),
  seed = require('./seed'),
  express = require('./express'),
  logger = require('./logger'),
  envJson = require('./env.json');

checkenv.setConfig(envJson);
checkenv.check();
function seedDB() {
  if (config.seedDB && config.seedDB.seed) {
    logger.warn(chalk.bold.red('Warning:  Database seeding is turned on'));
    seed.start();
  }
}

seedDB();

module.exports.init = async function init(callback) {
  var dbMean;

  await mongoose.connect(config.dbMean, function (db) { dbMean = db; });

  // Initialize express
  var app = express.init(dbMean);
  if (callback) callback(app, dbMean, config);
};

module.exports.start = function start(callback) {
  var _this = this;

  _this.init(function (app, dbMean, config) {
    // Start the app by listening on <port> at <host>
    app.listen(config.port, config.host, function () {
      // Create server URL
      var server = (process.env.NODE_ENV === 'secure' ? 'https://' : 'http://') + config.host + ':' + config.port;
      // Logging initialization
      logger.info(chalk.green('Environment:     ' + process.env.NODE_ENV));
      logger.info(chalk.green('Server:          ' + server));
      logger.info(chalk.green('Database (Logs): ' + config.dbLogging.uri));
      logger.info(chalk.green('Database (Mean): ' + config.dbMean.uri));
      if (callback) callback(app, dbMean, config);
    });
  });
};

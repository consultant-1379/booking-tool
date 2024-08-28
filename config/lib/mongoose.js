'use strict';

/**
 * Module dependencies.
 */
var chalk = require('chalk');
var mongoose = require('mongoose');
var logger = require('./logger');

// Initialize Mongoose
module.exports.connect = function (database, cb) {
  mongoose.Promise = database.promise;

  mongoose.connect(database.uri, database.options, function (err, db) {
    // Log Error
    if (err) {
      logger.error(chalk.red('Could not connect to MongoDB!'));
      logger.error(err);
    } else {
      // Enabling mongoose debug mode if required
      mongoose.set('debug', database.debug);
      // Call callback FN
      if (cb) cb(db);
    }
  });
};

module.exports.disconnect = function (cb) {
  mongoose.disconnect(function (err) {
    logger.info(chalk.yellow('Disconnected from MongoDB.'));
    cb(err);
  });
};

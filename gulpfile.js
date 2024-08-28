'use strict';

/**
 * Module dependencies.
 */
var testAssets = require('./config/assets/test'),
  config = require('./config/config.js'),
  mongoose = require('./config/lib/mongoose.js'),
  gulp = require('gulp'),
  gulpLoadPlugins = require('gulp-load-plugins'),
  plugins = gulpLoadPlugins(),
  path = require('path'),
  jsonMerger = require('gulp-merge-json'),
  KarmaServer = require('karma').Server,
  logger = require(path.resolve('./config/lib/logger'));

// Set NODE_ENV to 'test'
gulp.task('env:test', function (done) {
  process.env.NODE_ENV = 'test';
  done();
});

// Set NODE_ENV to 'development'
gulp.task('env:dev', function (done) {
  process.env.NODE_ENV = 'development';
  done();
});

// Set NODE_ENV to 'production'
gulp.task('env:prod', function (done) {
  process.env.NODE_ENV = 'production';
  done();
});

// Swagger concatenation task
gulp.task('buildSwaggerJSON', function () {
  return gulp.src('modules/*/swagger/*.json')
    .pipe(jsonMerger({
      fileName: 'swagger.json',
      concatArrays: true
    }))
    .pipe(gulp.dest('./'));
});

// Mocha tests task
gulp.task('mocha', function (done) {
  var error;
  // Connect mongoose
  mongoose.connect(config.dbMean, function () {
    // Run the tests
    gulp.src(testAssets.tests.server)
      .pipe(plugins.mocha( {
        reporter: 'mocha-multi-reporters',
        reporterOptions: { configFile: 'config/mocha-config.json'},
        timeout: 10000
      }))
      .on('error', function (err) {
        // If an error occurs, save it
        error = err;
        logger.error(err);
      })
      .on('end', function () {
        // When the tests are done, connect to & clear the logging Db,
        // then disconnect from mongoose & pass any error state back to gulp
        mongoose.connect(config.dbLogging, function (dbLogging) {
          dbLogging.db.dropDatabase(function () {
            mongoose.disconnect(function () {
              done(error);
              if (error) process.exit(1);
              process.exit(0);
            });
          });
        });
      });
  });
});

// Karma test runner task
gulp.task('karma', function (done) {
  new KarmaServer({
    configFile: path.join(__dirname, '/karma.conf.js')
  }, done).start();
});

// Drops the MongoDB Mean database, used in e2e testing
gulp.task('dropMeanDb', function (done) {
  // Use mongoose configuration
  mongoose.connect(config.dbMean, function (dbMean) {
    dbMean.db.dropDatabase(function (err) {
      if (err) logger.error(err);
      else logger.info('Successfully dropped db: ', dbMean.db.databaseName);
      dbMean.db.close(done);
    });
  });
});

// Drops the MongoDB Logging database, used in e2e testing
gulp.task('dropLoggingDb', function (done) {
  // Use mongoose configuration
  mongoose.connect(config.dbLogging, function (dbLogging) {
    dbLogging.db.dropDatabase(function (err) {
      if (err) logger.error(err);
      else logger.info('Successfully dropped db: ', dbLogging.db.databaseName);
      dbLogging.db.close(done);
    });
  });
});

gulp.task('test:server', gulp.series('env:test', 'dropMeanDb', 'dropLoggingDb', 'mocha'));

gulp.task('test:client', gulp.series('env:test', 'dropMeanDb', 'dropLoggingDb', 'karma'));

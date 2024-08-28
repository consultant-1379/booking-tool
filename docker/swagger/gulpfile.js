'use strict';

var gulp = require('gulp'),
  jsonMerger = require('gulp-merge-json'),
  jsonModify = require('gulp-json-modify'),
  readFileSync = require('fs').readFileSync;

gulp.task('setVersion', function (done) {
  var version = readFileSync('VERSION', 'utf8');
  process.env.VERSION = version.toString().trim();
  done();
});

gulp.task('buildSwaggerJSON', function () {
  return gulp.src('swagger/*.json')
    .pipe(jsonMerger({
      fileName: 'swagger.json',
      concatArrays: true
    }))
    .pipe(gulp.dest('/usr/share/nginx/html/'));
});

gulp.task('versionSwagger', function () {
  return gulp.src(['./swagger.json'], { allowEmpty: true })
    .pipe(jsonModify({
      key: 'info.version',
      value: process.env.VERSION
    }))
    .pipe(gulp.dest('/usr/share/nginx/html/'));
});

gulp.task('default', gulp.series('setVersion', 'buildSwaggerJSON', 'versionSwagger'));

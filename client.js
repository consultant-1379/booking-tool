import angular from 'angular';
import ngSanitize from 'angular-sanitize';
import ngAnimate from 'angular-animate';
import ngMessages from 'angular-messages';
import uiBootstrap from 'angular-ui-bootstrap';
import ngResource from 'angular-resource';
import ngInfiniteScroll from 'ng-infinite-scroll';
import uiRouter from '@uirouter/angularjs';

// Modules
import allClientModules from './config/lib/all.client.modules';

// Main app module configuration and startup
angular
  .module('myapp', [ngResource, ngAnimate, ngMessages, ngSanitize, ngInfiniteScroll, uiRouter, uiBootstrap, ...allClientModules])
  .config(bootstrapConfig);

angular.element(document).ready(init);

bootstrapConfig.$inject = ['$compileProvider', '$locationProvider', '$httpProvider', '$logProvider'];
function bootstrapConfig($compileProvider, $locationProvider, $httpProvider, $logProvider) {
  $locationProvider.html5Mode({
    enabled: true,
    requireBase: false
  }).hashPrefix('!');

  $httpProvider.interceptors.push('authInterceptor');

  // Disable debug data for production environment
  // @link https://docs.angularjs.org/guide/production
  $compileProvider.debugInfoEnabled(window.env !== 'production');
  $logProvider.debugEnabled(window.env !== 'production');
}

function init() {
  angular.bootstrap(document, ['myapp'], {
    strictDi: true
  });
}

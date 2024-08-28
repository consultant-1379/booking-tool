import uiNotification from 'angular-ui-notification';
import routes from './config/core.client.routes';
import menus from './config/core.client.menus';
import routeFilter from './config/core.client.route-filter';
import headerCtrl from './controllers/header.client.controller';
import errorCtrl from './controllers/error.client.controller';
import menuService from './services/menu.client.service.js';
import authInterceptor from './services/interceptors/auth-interceptor.client.service';
import jsonText from './directives/json-text.client.directive';
import yamlText from './directives/yaml-text.client.directive';
import versionValidator from './directives/version-validator.client.directive';
import httpLoading from './directives/http-loading.client.directive';
import stopPropagation from './directives/stop-propagation.client.directive';
import autofocus from './directives/autofocus.client.directive';
import uiNotificationConfig from './config/ui.notification.js';
import headerView from './directives/header-view.client.directive';
import searchService from './services/search.client.service';
import 'expose-loader?tv4!tv4'; // Workaround for https://github.com/json-schema-form/angular-schema-form/issues/914
import 'angular-schema-form';
import 'angular-schema-form-bootstrap';
import 'angular-bootstrap-toggle';
import 'angular-bootstrap-toggle/dist/angular-bootstrap-toggle.min.css';
import '../../../node_modules/angular-ui-notification/dist/angular-ui-notification.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './css/assets.css';
import './css/bootstrap.css';
import './css/core.css';
import './css/systemBar.css';
import './img/brand/favicon.ico';
import '../../../node_modules/select2/dist/css/select2.min.css';

export const core = angular
  .module('core', ['ui-notification'])
  .config(routes)
  .config(uiNotificationConfig)
  .run(menus)
  .run(routeFilter)
  .factory('SearchService', searchService)
  .controller('HeaderController', headerCtrl)
  .controller('ErrorController', errorCtrl)
  .factory('menuService', menuService)
  .factory('authInterceptor', authInterceptor)
  .directive('jsonText', jsonText)
  .directive('yamlText', yamlText)
  .directive('versionValidator', versionValidator)
  .directive('httpLoading', httpLoading)
  .directive('stopPropagation', stopPropagation)
  .directive('autofocus', autofocus)
  .directive('headerView', headerView)
  .name;

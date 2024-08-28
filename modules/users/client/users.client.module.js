import routes from './config/users.client.routes';
import service from './services/users.client.service';
import Authentication from './services/authentication.client.service';
import AuthenticationController from './controllers/authentication.client.controller.js';
import lowercase from './directives/lowercase.client.directive';

export const users = angular
  .module('users', [])
  .config(routes)
  .factory('UsersService', service)
  .factory('Authentication', Authentication)
  .controller('AuthenticationController', AuthenticationController)
  .directive('lowercase', lowercase)
  .name;

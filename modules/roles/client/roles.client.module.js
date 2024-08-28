import routes from './config/roles.client.routes';
import menus from './config/roles.client.menus';
import service from './services/roles.client.service';

export const roles = angular
  .module('roles', [])
  .config(routes)
  .run(menus)
  .factory('RolesService', service)
  .name;

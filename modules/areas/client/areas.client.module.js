import routes from './config/areas.client.routes';
import menus from './config/areas.client.menus';
import service from './services/areas.client.service';

export const areas = angular
  .module('areas', [])
  .config(routes)
  .run(menus)
  .factory('AreasService', service)
  .name;

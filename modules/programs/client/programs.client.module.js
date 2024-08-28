import routes from './config/programs.client.routes';
import menus from './config/programs.client.menus';
import service from './services/programs.client.service';

export const programs = angular
  .module('programs', [])
  .config(routes)
  .run(menus)
  .factory('ProgramsService', service)
  .name;

import routes from './config/teams.client.routes';
import menus from './config/teams.client.menus';
import service from './services/teams.client.service';

export const teams = angular
  .module('teams', [])
  .config(routes)
  .run(menus)
  .factory('TeamsService', service)
  .name;

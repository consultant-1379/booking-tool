import routes from './config/statistics.client.routes';
import menus from './config/statistics.client.menus';

export const statistics = angular
  .module('statistics', [])
  .config(routes)
  .run(menus)
  .name;

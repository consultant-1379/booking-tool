import routes from './config/labels.client.routes';
import menus from './config/labels.client.menus';
import service from './services/labels.client.service';

export const labels = angular
  .module('labels', [])
  .config(routes)
  .run(menus)
  .factory('LabelsService', service)
  .name;

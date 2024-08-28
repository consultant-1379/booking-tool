import routes from './config/hardware.client.routes';
import menus from './config/hardware.client.menus';
import service from './services/hardware.client.service';

export const hardware = angular
  .module('hardwares', [])
  .config(routes)
  .run(menus)
  .factory('HardwareService', service)
  .name;

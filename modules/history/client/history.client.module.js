import routes from './config/history.client.routes';
import menus from './config/history.client.menus';
import HistoryService from './services/history.client.service';
import './css/history.css';

export const history = angular
  .module('history', [])
  .config(routes)
  .run(menus)
  .factory('DeploymentsHistoryService', HistoryService.getService('deployments'))
  .factory('ProductTypesHistoryService', HistoryService.getService('productTypes'))
  .factory('AreasHistoryService', HistoryService.getService('areas'))
  .factory('ProgramsHistoryService', HistoryService.getService('programs'))
  .factory('FlavoursHistoryService', HistoryService.getService('productFlavours'))
  .factory('TeamsHistoryService', HistoryService.getService('teams'))
  .factory('HardwaresHistoryService', HistoryService.getService('hardwares'))
  .factory('BookingsHistoryService', HistoryService.getService('bookings'))
  .factory('LabelsHistoryService', HistoryService.getService('labels'))
  .factory('RolesHistoryService', HistoryService.getService('roles'))
  .name;

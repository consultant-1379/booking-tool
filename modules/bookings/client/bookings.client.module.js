import HistoryService from '../../history/client/services/history.client.service';
import routes from './config/bookings.client.routes';
import menus from './config/bookings.client.menus';
import service from './services/bookings.client.service';
import '../../core/client/css/bootstrap-datetimepicker.css';
import './css/fullcalendar.css';
import './css/qtip2.css';
import './css/bookings.css';

export const bookings = angular
  .module('bookings', [])
  .config(routes)
  .run(menus)
  .factory('BookingsService', service)
  .factory('BookingsHistoryService', HistoryService.getService('bookings'))
  .name;

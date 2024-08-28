import routes from './config/product_types.client.routes';
import menus from './config/product_types.client.menus';
import service from './services/product_types.client.service';

export const productTypes = angular
  .module('productTypes', ['schemaForm', 'btorfs.multiselect', 'ui.toggle'])
  .config(routes)
  .run(menus)
  .factory('ProductTypesService', service)
  .name;

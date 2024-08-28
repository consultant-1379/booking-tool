import routes from './config/product_flavours.client.routes';
import menus from './config/product_flavours.client.menus';
import service from './services/product_flavours.client.service';

export const productFlavours = angular
  .module('productFlavours', [])
  .config(routes)
  .run(menus)
  .factory('ProductFlavoursService', service)
  .name;

import routes from './config/products.client.routes';
import menus from './config/products.client.menus';

export const products = angular
  .module('products', [])
  .config(routes)
  .run(menus)
  .name;

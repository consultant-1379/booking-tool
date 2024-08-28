menuConfig.$inject = ['menuService'];
export default function menuConfig(menuService) {
  menuService.addMenuItem('topbar', {
    title: 'Product Section',
    state: 'product',
    position: 3,
    type: 'dropdown'
  });

  menuService.addSubMenuItem('topbar', 'product', {
    title: 'Product-Flavours',
    state: 'productFlavours.list',
    position: 0
  });

  menuService.addSubMenuItem('topbar', 'product', {
    title: 'Product-Types',
    state: 'productTypes.list',
    position: 1
  });

  menuService.addSubMenuItem('topbar', 'product', {
    title: 'Products',
    state: 'products.list',
    position: 2
  });
}

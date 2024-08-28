menuConfig.$inject = ['menuService'];
export default function menuConfig(menuService) {
  menuService.addMenu('account', {
  });

  menuService.addMenuItem('account', {
    title: '',
    state: 'settings',
    type: 'dropdown'
  });
}

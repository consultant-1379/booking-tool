menuConfig.$inject = ['menuService'];
export default function menuConfig(menuService) {
  menuService.addMenuItem('topbar', {
    title: 'Hardware',
    state: 'hardware.list',
    position: 4
  });
}

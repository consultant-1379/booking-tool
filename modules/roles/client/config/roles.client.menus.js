menuConfig.$inject = ['menuService'];
export default function menuConfig(menuService) {
  menuService.addMenuItem('topbar', {
    title: 'Roles',
    state: 'roles.list',
    position: 5
  });
}

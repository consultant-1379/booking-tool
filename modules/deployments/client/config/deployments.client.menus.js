menuConfig.$inject = ['menuService'];
export default function menuConfig(menuService) {
  menuService.addMenuItem('topbar', {
    title: 'Deployments',
    state: 'deployments.list',
    position: 2
  });
}

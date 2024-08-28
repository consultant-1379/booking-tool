menuConfig.$inject = ['menuService'];
export default function menuConfig(menuService) {
  menuService.addMenuItem('topbar', {
    title: 'Labels',
    state: 'labels.list',
    position: 5
  });
}

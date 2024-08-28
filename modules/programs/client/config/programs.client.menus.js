menuConfig.$inject = ['menuService'];
export default function menuConfig(menuService) {
  menuService.addMenuItem('topbar', {
    title: 'Organisation',
    state: 'organisation',
    position: 0,
    type: 'dropdown'
  });

  menuService.addSubMenuItem('topbar', 'organisation', {
    title: 'Programs',
    state: 'programs.list',
    position: 0
  });

  menuService.addSubMenuItem('topbar', 'organisation', {
    title: 'RAs',
    state: 'areas.list',
    position: 1
  });

  menuService.addSubMenuItem('topbar', 'organisation', {
    title: 'Teams',
    state: 'teams.list',
    position: 2
  });
}

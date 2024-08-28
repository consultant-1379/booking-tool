menuConfig.$inject = ['menuService'];
export default function menuConfig(menuService) {
  menuService.addMenuItem('topbar', {
    title: 'Statistics',
    state: 'statistics',
    position: 6,
    type: 'dropdown'
  });
  menuService.addSubMenuItem('topbar', 'statistics', {
    title: 'Bookings',
    state: 'statistics.bookings',
    position: 0
  });
}

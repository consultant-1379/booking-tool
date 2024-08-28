menuConfig.$inject = ['menuService'];
export default function menuConfig(menuService) {
  menuService.addMenuItem('topbar', {
    title: 'Bookings',
    state: 'bookings.calendar',
    position: 1
  });
}

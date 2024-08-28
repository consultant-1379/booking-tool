menuConfig.$inject = ['menuService'];
export default function menuConfig(menuService) {
  menuService.addMenuItem('topbar', {
    title: 'Logs',
    state: 'logs',
    position: 7,
    type: 'dropdown'
  });

  var logObjects = ['Booking', 'Deployment', 'ProductType', 'ProductFlavour', 'Program', 'Area', 'Team', 'Hardware', 'Label', 'Role'];

  logObjects.forEach(function (logObject, logObjectIndex) {
    var hrefName = logObject.charAt(0).toLowerCase() + logObject.slice(1) + 's';
    var menuTitle = logObject.replace(/([a-z])([A-Z])/g, '$1-$2') + ' Logs';
    if (logObject === 'Area') menuTitle = 'Requirement Area Logs';
    menuService.addSubMenuItem('topbar', 'logs', {
      title: menuTitle,
      state: 'logs.list',
      params: { objType: hrefName },
      position: logObjectIndex + 1
    });
  });
}

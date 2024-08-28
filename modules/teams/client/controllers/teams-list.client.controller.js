var commonController = require('../../../core/client/controllers/common-list.client.controller');

TeamsListController.$inject = [
  '$scope', '$compile', '$window',
  'Notification', 'Authentication', 'allTeams', 'allUsers',
  'allAreas'
];

export default function TeamsListController(
  $scope, $compile, $window,
  Notification, Authentication, allTeams, allUsers,
  allAreas
) {
  var vm = this;
  vm.artifactType = 'Team';
  vm.artifactTypeLower = vm.artifactType.toLowerCase() + 's';
  vm.resourcePath = `/${vm.artifactTypeLower}`;
  vm.createButtonMessage = 'Please add any new Teams to the Team Inventory Tool, this is the only source for DTT data on Teams';

  allTeams = allTeams.map(function (team) {
    team.area = allAreas.find(area => area._id === team.area_id);
    return team;
  });
  vm.visibleArtifacts = allTeams;

  function getNameFromId(userId) {
    return allUsers.filter(user => user._id === userId)[0].displayName;
  }

  vm.dataTableColumns = [
    {
      title: 'Name',
      data: null,
      render: function (data) {
        var htmlElement = `<a ui-sref="teams.view({ teamId: '${data._id}' })">${data.name}</a>`;
        return $compile(htmlElement)($scope)[0].outerHTML;
      }
    },
    {
      title: 'State',
      data: 'state'
    },
    {
      title: 'RA',
      data: null,
      render: function (data) {
        if (data.area) {
          var htmlElement = `<a class="area-column" ui-sref="areas.view({ areaId: '${data.area_id}' })">${data.area.name}</a>`;
          return $compile(htmlElement)($scope)[0].outerHTML;
        }
      }
    },
    {
      title: 'Admins',
      data: null,
      render: function (data) {
        var adminNames = [];
        data.admin_IDs.forEach(adminId => { adminNames.push(getNameFromId(adminId)); });
        return adminNames.join(', ');
      }
    },
    {
      title: 'Actions',
      orderable: false,
      searchable: false,
      width: '245px',
      data: null,
      render: function (data) {
        var bookingElement = (Authentication.isAllowed('/bookings', 'view-page', true)) ? `<a class="btn btn-sm btn-book" ui-sref="bookings.calendar({ areaFilter: '${data.area_id}', teamFilter: '${data._id}' })">Bookings</a>` : '<a></a>'; // eslint-disable-line max-len
        var compiledBooking = $compile(bookingElement)($scope)[0].outerHTML;

        var viewElement = (Authentication.isAllowed(vm.resourcePath, 'view-page', false)) ? `<a class="btn btn-sm btn-info" ui-sref="teams.view({ teamId: '${data._id}' })">View</a>` : '<a></a>';
        var compiledView = $compile(viewElement)($scope)[0].outerHTML;

        var editElement = (Authentication.isAllowed(vm.resourcePath, 'put', false)) ? `<a class="btn btn-sm btn-primary" ui-sref="teams.edit({ teamId: '${data._id}' })">Edit</a>` : '<a></a>';
        var compiledEdit = $compile(editElement)($scope)[0].outerHTML;

        var deleteElement = (Authentication.isAllowed(vm.resourcePath, 'delete', false)) ? '<a class="delete-button btn btn-sm btn-danger">Delete</a>' : ''; // No compile needed on a non-angular element

        return `${compiledBooking}&nbsp;${compiledView}&nbsp;${compiledEdit}&nbsp;${deleteElement}`;
      }
    }
  ];
  commonController($scope, $window, Authentication, Notification, vm);
}

var commonController = require('../../../core/client/controllers/common-list.client.controller');

AreasListController.$inject = [
  '$scope', '$compile', '$window', 'Notification', 'Authentication', 'allAreas', 'allPrograms', 'allUsers'
];
export default function AreasListController(
  $scope, $compile, $window,
  Notification, Authentication, allAreas, allPrograms, allUsers
) {
  var vm = this;
  vm.artifactType = 'Requirement Area';
  vm.artifactTypeLower = 'areas';
  vm.resourcePath = `/${vm.artifactTypeLower}`;
  vm.createButtonMessage = 'Please add any new Requirement Areas to Team Inventory Tool, this is the only source for DTT data on Requirement Areas';

  allAreas = allAreas.map(function (area) {
    area.program = allPrograms.find(program => program._id === area.program_id);
    // Mapping dependant Artifacts to a Deployment
    area.bookingAssigneeUser = allUsers.find(user => user._id === area.bookingAssigneeUser_id);
    return area;
  });
  vm.visibleArtifacts = allAreas;

  vm.dataTableColumns = [
    {
      title: 'Name',
      width: '20%',
      data: null,
      render: function (data) {
        var htmlElement = `<a ui-sref="areas.view({ areaId: '${data._id}' })">${data.name}</a>`;
        return $compile(htmlElement)($scope)[0].outerHTML;
      }
    },
    {
      title: 'Program',
      width: '10%',
      data: null,
      render: function (data) {
        if (data.program) {
          var htmlElement = `<a ui-sref="programs.view({ programId: '${data.program._id}' })">${data.program.name}</a>`;
          return $compile(htmlElement)($scope)[0].outerHTML;
        }
      }
    },
    {
      title: 'Booking Assignee User',
      width: '18%',
      data: null,
      render: function (data) {
        if (data.bookingAssigneeUser) {
          return `${data.bookingAssigneeUser.displayName} (${data.bookingAssigneeUser.username})`;
        }
      }
    },
    {
      title: 'Max Booking Duration (Days)',
      data: null,
      width: '16%',
      render: function (data) {
        return (data.maxBookingDurationDays) ? data.maxBookingDurationDays : 'Unlimited';
      }
    },
    {
      title: 'Max Booking Advance (Weeks)',
      width: '17%',
      data: null,
      render: function (data) {
        return (data.maxBookingAdvanceWeeks) ? data.maxBookingAdvanceWeeks : 'Unlimited';
      }
    },
    {
      title: 'Actions',
      orderable: false,
      searchable: false,
      width: '230px',
      data: null,
      render: function (data) {
        var isCreator = (data.history && (data.history.createdBy.username === Authentication.user.username));

        var bookingElement = (Authentication.isAllowed('/bookings', 'view-page', isCreator)) ? `<a class="btn btn-sm btn-book" ui-sref="bookings.calendar({ areaFilter: '${data._id}' })">Bookings</a>` : '<a></a>';
        var compiledBooking = $compile(bookingElement)($scope)[0].outerHTML;

        var viewElement = (Authentication.isAllowed(vm.resourcePath, 'view-page', isCreator)) ? `<a class="btn btn-sm btn-info" ui-sref="areas.view({ areaId: '${data._id}' })">View</a>` : '<a></a>';
        var compiledView = $compile(viewElement)($scope)[0].outerHTML;

        var editElement = (Authentication.isAllowed(vm.resourcePath, 'put', isCreator)) ? `<a class="btn btn-sm btn-primary" ui-sref="areas.edit({ areaId: '${data._id}' })">Edit</a>` : '<a></a>';
        var compiledEdit = $compile(editElement)($scope)[0].outerHTML;

        var deleteElement = (Authentication.isAllowed(vm.resourcePath, 'delete', isCreator)) ? '<a class="delete-button btn btn-sm btn-danger">Delete</a>' : '<a></a>'; // No compile needed on a non-angular element

        return `${compiledBooking}&nbsp;${compiledView}&nbsp;${compiledEdit}&nbsp;${deleteElement}`;
      }
    }
  ];
  commonController($scope, $window, Authentication, Notification, vm);
}

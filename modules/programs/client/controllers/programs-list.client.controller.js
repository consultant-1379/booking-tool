var commonController = require('../../../core/client/controllers/common-list.client.controller');

ProgramsListController.$inject = [
  '$scope', '$compile', '$window', 'Notification', 'allPrograms', 'allProgramLogs', 'Authentication'
];
export default function ProgramsListController($scope, $compile, $window, Notification, allPrograms, allProgramLogs, Authentication) {
  var vm = this;
  vm.artifactType = 'Program';
  vm.artifactTypeLower = vm.artifactType.toLowerCase() + 's';
  vm.resourcePath = `/${vm.artifactTypeLower}`;

  allPrograms.forEach(function (program) {
    program.history = allProgramLogs.find(log => log.associated_id === program._id);
  });

  vm.visibleArtifacts = allPrograms;
  vm.dataTableColumns = [
    {
      title: 'Name',
      data: null,
      render: function (data) {
        var htmlElement = `<a ui-sref="programs.view({ programId: '${data._id}' })">${data.name}</a>`;
        return $compile(htmlElement)($scope)[0].outerHTML;
      }
    },
    {
      title: 'Actions',
      orderable: false,
      searchable: false,
      width: '175px',
      data: null,
      render: function (data) {
        var isCreator = (data.history && (data.history.createdBy.username === Authentication.user.username));

        var viewElement = (Authentication.isAllowed(vm.resourcePath, 'view-page', isCreator)) ? `<a class="btn btn-sm btn-info" ui-sref="programs.view({ programId: '${data._id}' })">View</a>` : '<a></a>';
        var compiledView = $compile(viewElement)($scope)[0].outerHTML;

        var deleteElement = (Authentication.isAllowed(vm.resourcePath, 'delete', isCreator)) ? '<a class="delete-button btn btn-sm btn-danger">Delete</a>' : '<a></a>'; // No compile needed on a non-angular element

        return `${compiledView}&nbsp;${deleteElement}`;
      }
    }
  ];
  commonController($scope, $window, Authentication, Notification, vm);
}

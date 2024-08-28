var commonController = require('../../../core/client/controllers/common-list.client.controller');

LabelsListController.$inject = [
  '$scope', '$compile', '$window', 'Notification', 'allLabels', 'Authentication', 'allLabelLogs'
];
export default function LabelsListController($scope, $compile, $window, Notification, allLabels, Authentication, allLabelLogs) {
  var vm = this;
  vm.artifactType = 'Label';
  vm.artifactTypeLower = vm.artifactType.toLowerCase() + 's';
  vm.resourcePath = `/${vm.artifactTypeLower}`;

  allLabels.forEach(function (label) {
    label.history = allLabelLogs.find(log => log.associated_id === label._id);
  });

  vm.visibleArtifacts = allLabels;
  vm.dataTableColumns = [
    {
      title: 'Name',
      data: null,
      render: function (data) {
        var htmlElement = `<a ui-sref="labels.view({ labelId: '${data._id}' })">${data.name}</a>`;
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
        var viewElement = `<a class="btn btn-sm btn-info" ui-sref="labels.view({ labelId: '${data._id}' })">View</a>`;
        var compiledView = $compile(viewElement)($scope)[0].outerHTML;
        var editElement = (Authentication.isAllowed(vm.resourcePath, 'put', isCreator)) ? `<a class="btn btn-sm btn-primary" ui-sref="labels.edit({ labelId: '${data._id}' })">Edit</a>` : '<a></a>';
        var compiledEdit = $compile(editElement)($scope)[0].outerHTML;
        var deleteElement = (Authentication.isAllowed(vm.resourcePath, 'delete', isCreator)) ? '<a class="delete-button btn btn-sm btn-danger">Delete</a>' : '<a></a>'; // No compile needed on a non-angular element
        return `${compiledView}&nbsp;${compiledEdit}&nbsp;${deleteElement}`;
      }
    }
  ];
  commonController($scope, $window, Authentication, Notification, vm);
}

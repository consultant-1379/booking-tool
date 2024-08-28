var moment = require('moment');
var commonController = require('../../../core/client/controllers/common-list.client.controller');

HardwareListController.$inject = [
  'Authentication', '$scope', '$compile', '$window', 'Notification', 'allHardware', 'allDeployments', 'allPrograms', 'allHardwareLogs'
];
export default function HardwareListController(
  Authentication, $scope, $compile, $window, Notification, allHardware,
  allDeployments, allPrograms, allHardwareLogs
) {
  var vm = this;
  vm.artifactType = 'Hardware';
  vm.artifactTypeLower = vm.artifactType.toLowerCase();
  vm.resourcePath = `/${vm.artifactTypeLower}`;

  allHardware.forEach(function (hardware) {
    hardware.history = allHardwareLogs.find(log => log.associated_id === hardware._id);
  });

  var todaysDate = moment();

  allDeployments.forEach(function (deployment) {
    deployment.products.forEach(function (product) {
      product.hardware_ids.forEach(function (hwId) {
        allHardware.find(function (hardware) {
          if (hardware._id === hwId) {
            hardware.deployment = deployment;
            hardware.product = product;
          }
          return (hardware._id === hwId);
        });
      });
    });
  });

  allHardware.forEach(hardware => {
    hardware.program = allPrograms.find(program => program._id === hardware.program_id);
  });

  vm.visibleArtifacts = allHardware;

  vm.dataTableColumns = [
    {
      title: 'Name',
      width: '15%',
      data: null,
      render: function (data) {
        var htmlElement = `<a ui-sref="hardware.view({ hardwareId: '${data._id}' })">${data.name}</a>`;
        return $compile(htmlElement)($scope)[0].outerHTML;
      }
    },
    {
      title: 'HW Deployment Id',
      data: 'hw_deployment_id',
      width: '12%'
    },
    {
      title: 'URL',
      data: null,
      width: '10%',
      render: function (data) {
        if (data.url) return `<a href="${data.url}">Hardware Link</a>`;
      }
    },
    {
      title: 'Program',
      data: null,
      width: '10%',
      render: function (data) {
        if (data.program_id) {
          var htmlElement = `<a ui-sref="programs.view({ programId: '${data.program._id}' })">${data.program.name}</a>`;
          return $compile(htmlElement)($scope)[0].outerHTML;
        }
      }
    },
    {
      title: 'Deployment (Product)',
      data: null,
      width: '15%',
      render: function (data) {
        if (data.deployment) {
          var htmlElement = `<a ui-sref="deployments.view({ deploymentId: '${data.deployment._id}' })">
                              ${data.deployment.name} (${data.product.product_type_name})
                            </a>`;
          return $compile(htmlElement)($scope)[0].outerHTML;
        }
      }
    },
    {
      title: 'Status',
      width: '100px',
      data: null,
      render: function (data) {
        return (data.freeStartDate) ? 'Free' : 'In Use';
      }
    },
    {
      title: 'Days Free',
      width: '100px',
      data: null,
      render: function (data) {
        if (data.freeStartDate) {
          var freeDate = moment(data.freeStartDate);
          return todaysDate.diff(freeDate, 'days');
        }
      }
    },
    {
      title: 'Actions',
      orderable: false,
      searchable: false,
      width: '150px',
      data: null,
      render: function (data) {
        var isCreator = (data.history && (data.history.createdBy.username === Authentication.user.username));

        var viewElement = `<a class="btn btn-sm btn-info" ui-sref="hardware.view({ hardwareId: '${data._id}' })">View</a>`;
        var compiledView = $compile(viewElement)($scope)[0].outerHTML;

        var editElement = (Authentication.isAllowed('/hardware', 'put', isCreator)) ? `<a class="btn btn-sm btn-primary" ui-sref="hardware.edit({ hardwareId: '${data._id}' })">Edit</a>` : '<a></a>';
        var compiledEdit = $compile(editElement)($scope)[0].outerHTML;

        var deleteElement = (Authentication.isAllowed('/hardware', 'delete', isCreator)) ? '<a class="delete-button btn btn-sm btn-danger">Delete</a>' : '<a></a>'; // No compile needed on a non-angular element

        return `${compiledView}&nbsp;${compiledEdit}&nbsp;${deleteElement}`;
      }
    }
  ];

  commonController($scope, $window, Authentication, Notification, vm);
}

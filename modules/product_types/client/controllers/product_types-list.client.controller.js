var commonController = require('../../../core/client/controllers/common-list.client.controller');

ProductTypesListController.$inject = [
  'Authentication', '$scope', '$compile', '$window', 'Notification', 'allProductTypes', 'allProductTypeLogs'
];
export default function ProductTypesListController(Authentication, $scope, $compile, $window, Notification, allProductTypes, allProductTypeLogs) {
  var vm = this;
  vm.artifactType = 'Product-Type';
  vm.artifactTypeLower = 'productTypes';
  vm.resourcePath = `/${vm.artifactTypeLower}`;
  vm.visibleArtifacts = allProductTypes;

  allProductTypes.forEach(function (productType) {
    productType.history = allProductTypeLogs.find(log => log.associated_id === productType._id);
  });

  vm.dataTableColumns = [
    {
      title: 'Name',
      data: null,
      render: function (data) {
        var htmlElement = `<a ui-sref="productTypes.view({ productTypeId: '${data._id}' })">${data.name}</a>`;
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

        var viewElement = `<a class="btn btn-sm btn-info" ui-sref="productTypes.view({ productTypeId: '${data._id}' })">View</a>`;
        var compiledView = $compile(viewElement)($scope)[0].outerHTML;

        var editElement = (Authentication.isAllowed(vm.resourcePath, 'put', isCreator)) ? `<a class="btn btn-sm btn-primary" ui-sref="productTypes.edit({ productTypeId: '${data._id}' })">Edit</a>` : '<a></a>';
        var compiledEdit = $compile(editElement)($scope)[0].outerHTML;

        var deleteElement = (Authentication.isAllowed(vm.resourcePath, 'delete', isCreator)) ? '<a class="delete-button btn btn-sm btn-danger">Delete</a>' : '<a></a>'; // No compile needed on a non-angular element

        return `${compiledView}&nbsp;${compiledEdit}&nbsp;${deleteElement}`;
      }
    }
  ];

  commonController($scope, $window, Authentication, Notification, vm);
}

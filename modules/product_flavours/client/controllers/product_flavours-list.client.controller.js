var commonController = require('../../../core/client/controllers/common-list.client.controller');

ProductFlavoursListController.$inject = [
  '$scope', '$compile', '$window', 'Notification', 'allProductFlavours', 'allProductFlavourLogs', 'Authentication'
];
export default function ProductFlavoursListController(
  $scope, $compile, $window, Notification, allProductFlavours,
  allProductFlavourLogs, Authentication
) {
  var vm = this;
  vm.artifactType = 'Product-Flavour';
  vm.artifactTypeLower = 'productFlavours';
  vm.resourcePath = `/${vm.artifactTypeLower}`;
  vm.visibleArtifacts = allProductFlavours;

  allProductFlavours.forEach(function (productFlavour) {
    productFlavour.history = allProductFlavourLogs.find(log => log.associated_id === productFlavour._id);
  });

  vm.dataTableColumns = [
    {
      title: 'Name',
      data: null,
      render: function (data) {
        var htmlElement = `<a ui-sref="productFlavours.view({ productFlavourId: '${data._id}' })">${data.name}</a>`;
        return $compile(htmlElement)($scope)[0].outerHTML;
      }
    },
    {
      title: 'Actions',
      orderable: false,
      searchable: false,
      data: null,
      width: '175px',
      render: function (data) {
        var isCreator = (data.history && (data.history.createdBy.username === Authentication.user.username));

        var viewElement = (Authentication.isAllowed('/productFlavours', 'view-page', isCreator)) ? `<a class="btn btn-sm btn-info" ui-sref="productFlavours.view({ productFlavourId: '${data._id}' })">View</a>` : '<a></a>';
        var compiledView = $compile(viewElement)($scope)[0].outerHTML;

        var deleteElement = (Authentication.isAllowed('/productFlavours', 'delete', isCreator)) ? '<a class="delete-button btn btn-sm btn-danger">Delete</a>' : '<a></a>'; // No compile needed on a non-angular element

        return `${compiledView}&nbsp;${deleteElement}`;
      }
    }
  ];
  commonController($scope, $window, Authentication, Notification, vm);
}

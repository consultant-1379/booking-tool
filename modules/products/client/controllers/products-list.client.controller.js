import _ from 'lodash';
import { generateEmailElement } from '../../../core/client/controllers/helpers.client.controller';
var $ = require('jquery');
require('select2')();
var commonController = require('../../../core/client/controllers/common-list.client.controller');
var filtersController = require('../../../core/client/controllers/filters.client.controller');

ProductsListController.$inject = [
  '$window', 'Authentication', '$scope', '$compile', '$timeout', 'Notification',
  'allDeployments', 'allAreas', 'allTeams', 'allUsers', 'allProductTypes',
  'allProductFlavours', '$state', 'allPrograms', 'allDeploymentLogs'
];
export default function ProductsListController(
  $window, Authentication, $scope, $compile, $timeout, Notification,
  allDeployments, allAreas, allTeams, allUsers, allProductTypes,
  allProductFlavours, $state, allPrograms, allDeploymentLogs
) {
  var vm = this;
  vm.artifactType = 'Product';
  vm.artifactTypeLower = vm.artifactType.toLowerCase() + 's';
  vm.resourcePath = `/${vm.artifactTypeLower}`;

  vm.allAreas = _.clone(allAreas);
  vm.allTeams = _.clone(allTeams);
  vm.allDeploymentLogs = _.clone(allDeploymentLogs);
  vm.allProductTypes = _.clone(allProductTypes);
  vm.allProductFlavours = _.clone(allProductFlavours);
  vm.allDeployments = _.clone(allDeployments);
  vm.allPrograms = _.clone(allPrograms);
  vm.allInfraTypes = [{ name: 'Cloud', _id: 'Cloud' }, { name: 'Physical', _id: 'Physical' }];
  vm.allCreatedByUsers = [];
  var allProducts = [];
  var allCreators = [];
  var createProductModal;
  vm.currentUser = allUsers.filter(user => user.username === Authentication.user.username)[0]; // Set Active User
  vm.raPreference = (vm.currentUser.area_id) ? allAreas.filter(area => area._id === vm.currentUser.area_id)[0] : '';
  vm.areaFilter = (vm.raPreference) ? vm.raPreference._id : undefined;

  vm.allDeployments.forEach(function (deployment) {
    deployment.products.forEach(function (product, pIndex) {
      var associatedArtifacts = {
        productIndex: pIndex,
        deployment: { name: deployment.name, _id: deployment._id },
        area: allAreas.find(area => area._id === deployment.area_id),
        team: allTeams.find(team => team._id === deployment.team_id),
        product_type_id: allProductTypes.find(pt => pt.name === product.product_type_name)._id,
        flavour_id: allProductFlavours.find(pf => pf.name === product.flavour_name)._id,
        program: allPrograms.find(program => program._id === deployment.program_id),
        history: allDeploymentLogs.find(log => log.associated_id === deployment._id)
      };
      allProducts.push(_.merge(product, associatedArtifacts));
      var creator = (product.history) ? product.history.createdBy.displayName : null;
      if (creator && !allCreators.includes(creator)) {
        allCreators.push(creator);
      }
    });
  });

  allCreators.forEach(creator => { vm.allCreatedByUsers.push({ _id: creator, name: creator }); });
  vm.allCreatedByUsers.sort();
  vm.visibleArtifacts = _.cloneDeep(allProducts);
  vm.filterOptions = [
    { heading: 'Product-Type', name: 'productTypeFilter', options: vm.allProductTypes },
    { heading: 'Product-Flavour', name: 'productFlavourFilter', options: vm.allProductFlavours },
    { heading: 'Program', name: 'programFilter', options: vm.allPrograms },
    { heading: 'RA', name: 'areaFilter', options: vm.allAreas },
    { heading: 'Team', name: 'teamFilter', options: vm.allTeams },
    { heading: 'Infra-Type', name: 'infraTypeFilter', options: vm.allInfraTypes },
    { heading: 'Created By', name: 'createdByFilter', options: vm.allCreatedByUsers }
  ];

  // Update visible Products based on filters chosen
  vm.setVisibleArtifacts = function () {
    vm.updateFilterOptions();
    var filterAttributes = [
      { value: vm.productTypeFilter, key: 'product_type_id' },
      { value: vm.productFlavourFilter, key: 'flavour_id' },
      { value: vm.areaFilter, key: 'area._id' },
      { value: vm.teamFilter, key: 'team._id' },
      { value: vm.programFilter, key: 'program._id' },
      { value: vm.infraTypeFilter, key: 'infrastructure' },
      { value: vm.createdByFilter, key: 'history.createdBy.displayName' }
    ];
    vm.visibleArtifacts = vm.getFilteredArtifacts(allProducts, filterAttributes);
    $timeout(function () {
      if ($.fn.DataTable.isDataTable('#products-table')) {
        $('#products-table').DataTable().clear().rows.add(vm.visibleArtifacts).draw(); // eslint-disable-line new-cap
      }
      filterAllTables();
    });
  };

  vm.dataTableColumns = [
    {
      title: 'Product-Type',
      width: '10%',
      data: null,
      render: function (data) {
        var htmlElement = `<a ui-sref="productTypes.view({ productTypeId: '${data.product_type_id}' })">${data.product_type_name}</a>`;
        return $compile(htmlElement)($scope)[0].outerHTML;
      }
    },
    {
      title: 'Product-Flavour',
      width: '10%',
      data: null,
      render: function (data) {
        var htmlElement = `<a ui-sref="productFlavours.view({ productFlavourId: '${data.flavour_id}' })">${data.flavour_name}</a>`;
        return $compile(htmlElement)($scope)[0].outerHTML;
      }
    },
    {
      title: 'Deployment',
      width: '10%',
      data: null,
      render: function (data) {
        var htmlElement = `<a ui-sref="deployments.view({ deploymentId: '${data.deployment._id}' })">${data.deployment.name}</a>`;
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
      title: 'RA',
      width: '10%',
      data: null,
      render: function (data) {
        if (data.area) {
          var htmlElement = `<a ui-sref="areas.view({ areaId: '${data.area._id}' })">${data.area.name}</a>`;
          return $compile(htmlElement)($scope)[0].outerHTML;
        }
      }
    },
    {
      title: 'Team',
      width: '7%',
      data: null,
      render: function (data) {
        if (data.team) {
          var htmlElement = `<a ui-sref="teams.view({ teamId: '${data.team._id}' })">
          ${data.team.name}</a>`;
          return $compile(htmlElement)($scope)[0].outerHTML;
        }
      }
    },
    {
      title: 'Infra-Type',
      width: '8%',
      data: 'infrastructure'
    },
    {
      title: 'Created By',
      width: '10%',
      data: null,
      render: function (data) {
        return (data.history) ? generateEmailElement('Document', data.name, data.history.createdBy) : 'UNKNOWN USER';
      }
    },
    {
      title: 'Actions',
      orderable: false,
      searchable: false,
      width: '8%',
      data: null,
      render: function (data) {
        var isCreator = (data.history && (data.history.createdBy.username === Authentication.user.username));

        var viewElement = (Authentication.isAllowed(vm.resourcePath, 'view-page', isCreator)) ? `<a class="btn btn-sm btn-info" ui-sref="deployments.view({ deploymentId: '${data.deployment._id}' })">View</a>` : '<a></a>';
        var compiledView = $compile(viewElement)($scope)[0].outerHTML;

        var editElement = (Authentication.isAllowed(vm.resourcePath, 'put', isCreator)) ? `<a class="btn btn-sm btn-primary" ui-sref="deployments.edit({
          deploymentId: '${data.deployment._id}',
          editProduct: ${data.productIndex}
        })">Edit</a>` : '<a></a>';
        var compiledEdit = $compile(editElement)($scope)[0].outerHTML;

        return `${compiledView}&nbsp;${compiledEdit}`;
      }
    }
  ];

  function filterAllTables() {
    vm.searchFieldFilter = vm.searchFieldFilter || '';
    $('#products-table').DataTable().search(vm.searchFieldFilter).draw(); // eslint-disable-line
  }

  commonController($scope, $window, Authentication, Notification, vm);
  filtersController($scope, $window, $state, $timeout, Notification, vm);

  vm.submitProductCreateForm = function () {
    $state.go('deployments.edit', { deploymentId: vm.deploymentForNewProduct, addProduct: true });
  };

  vm.openProductModal = () => {
    vm.deploymentForNewProduct = undefined;
    createProductModal.style.display = 'block';
    $('#product-deployment-select').select2({
      placeholder: '--Select Deployment--',
      allowClear: true
    });
    $('#product-deployment-select').on('select2:select select2:unselecting', async function () {
      var valueIsEmpty = $(this).val() === null || $(this).val() === '';
      if (valueIsEmpty) $(this).data('unselecting', true);
      vm.deploymentForNewProduct = (valueIsEmpty) ? undefined : $(this).val().replace('string:', '');
      _.defer(() => $scope.$apply());
    });
  };

  vm.closeProductModal = () => { createProductModal.style.display = 'none'; };

  window.onclick = function (event) {
    if (event.target === createProductModal) createProductModal.style.display = 'none';
  };

  $(function () {
    createProductModal = document.getElementById('create-product-modal');
    vm.setFilterSelect2(vm.filterOptions);
    _.defer(() => $scope.$apply());
  });
}

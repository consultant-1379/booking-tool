import ListController from '../controllers/product_types-list.client.controller';
import CreateController from '../controllers/product_types-create.client.controller';
import ViewController from '../controllers/product_types-view.client.controller';
import CommonListTemplate from '../../../core/client/views/common-list.view.html';
import CreateTemplate from '../views/product_types-create.client.view.html';
import ViewTemplate from '../views/product_types-view.client.view.html';

routeConfig.$inject = ['$stateProvider'];
export default function routeConfig($stateProvider) {
  $stateProvider
    .state('productTypes', {
      abstract: true,
      url: '/productTypes',
      template: '<ui-view/>'
    })

    .state('productTypes.list', {
      url: '',
      template: CommonListTemplate,
      controller: ListController,
      controllerAs: 'vm',
      resolve: {
        allProductTypes: getAllProductTypes,
        allProductTypeLogs: allProductTypeLogs
      }
    })
    .state('productTypes.create', {
      url: '/create?{restoreData:json}',
      template: CreateTemplate,
      controller: CreateController,
      controllerAs: 'vm',
      resolve: {
        productType: newProductType,
        restoredata: getRestoreData,
        allFlavours: getAllProductFlavours,
        allDeployments: function () { return null; },
        creatingFromScratch: function () { return true; }
      }
    })
    .state('productTypes.view', {
      url: '/view/{productTypeId}',
      template: ViewTemplate,
      controller: ViewController,
      controllerAs: 'vm',
      resolve: {
        productType: getProductType,
        allFlavours: getAllProductFlavours,
        allDeployments: getAllDeployments,
        allProductTypeLogs: allProductTypeLogs
      }
    })
    .state('productTypes.edit', {
      url: '/edit/{productTypeId}?{restoreData:json}',
      template: CreateTemplate,
      controller: CreateController,
      controllerAs: 'vm',
      resolve: {
        productType: getProductType,
        restoredata: getRestoreData,
        allFlavours: getAllProductFlavours,
        allDeployments: getAllDeployments,
        creatingFromScratch: function () { return false; }
      }
    });
}

getRestoreData.$inject = ['$stateParams'];
function getRestoreData($stateParams) {
  return $stateParams.restoreData;
}

getProductType.$inject = ['$stateParams', 'ProductTypesService'];
function getProductType($stateParams, ProductTypesService) {
  return ProductTypesService.get({
    productTypeId: $stateParams.productTypeId
  }).$promise;
}

getAllProductTypes.$inject = ['ProductTypesService'];
function getAllProductTypes(ProductTypesService) {
  return ProductTypesService.query().$promise;
}

newProductType.$inject = ['ProductTypesService'];
function newProductType(ProductTypesService) {
  return new ProductTypesService();
}

getAllDeployments.$inject = ['DeploymentsService'];
function getAllDeployments(DeploymentsService) {
  return DeploymentsService.query({ fields: '_id,name,products(product_type_name)' }).$promise;
}

getAllProductFlavours.$inject = ['ProductFlavoursService'];
function getAllProductFlavours(ProductFlavoursService) {
  return ProductFlavoursService.query().$promise;
}

allProductTypeLogs.$inject = ['ProductTypesHistoryService'];
function allProductTypeLogs(ProductTypesHistoryService) {
  return ProductTypesHistoryService.query({ fields: 'associated_id,createdBy,updates/(updatedAt,updatedBy)' }).$promise;
}

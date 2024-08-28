import ListController from '../controllers/product_flavours-list.client.controller';
import CreateController from '../controllers/product_flavours-create.client.controller';
import ViewController from '../controllers/product_flavours-view.client.controller';
import CommonListTemplate from '../../../core/client/views/common-list.view.html';
import CreateTemplate from '../views/product_flavours-create.client.view.html';
import ViewTemplate from '../views/product_flavours-view.client.view.html';

routeConfig.$inject = ['$stateProvider'];
export default function routeConfig($stateProvider) {
  $stateProvider
    .state('productFlavours', {
      abstract: true,
      url: '/productFlavours',
      template: '<ui-view/>'
    })

    .state('productFlavours.list', {
      url: '',
      template: CommonListTemplate,
      controller: ListController,
      controllerAs: 'vm',
      resolve: {
        allProductFlavours: getAllProductFlavours,
        allProductFlavourLogs: allProductFlavourLogs
      }
    })
    .state('productFlavours.create', {
      url: '/create?{restoreData:json}',
      template: CreateTemplate,
      controller: CreateController,
      controllerAs: 'vm',
      resolve: {
        productFlavour: newProductFlavour,
        restoredata: getRestoreData,
        creatingFromScratch: function () { return true; }
      }
    })
    .state('productFlavours.view', {
      url: '/view/{productFlavourId}',
      template: ViewTemplate,
      controller: ViewController,
      controllerAs: 'vm',
      resolve: {
        productFlavour: getProductFlavour,
        dependentProductTypes: ['productFlavour', 'ProductTypesService', getDependentProductTypes]
      }
    });
}

getRestoreData.$inject = ['$stateParams'];
function getRestoreData($stateParams) {
  return $stateParams.restoreData;
}

getProductFlavour.$inject = ['$stateParams', 'ProductFlavoursService'];
function getProductFlavour($stateParams, ProductFlavoursService) {
  return ProductFlavoursService.get({
    productFlavourId: $stateParams.productFlavourId
  }).$promise;
}

getAllProductFlavours.$inject = ['ProductFlavoursService'];
function getAllProductFlavours(productFlavoursService) {
  return productFlavoursService.query().$promise;
}

newProductFlavour.$inject = ['ProductFlavoursService'];
function newProductFlavour(ProductFlavoursService) {
  return new ProductFlavoursService();
}

function getDependentProductTypes(productFlavour, ProductTypesService) {
  return ProductTypesService.query({ q: 'flavours=' + productFlavour.name, fields: '_id,name' }).$promise;
}

allProductFlavourLogs.$inject = ['FlavoursHistoryService'];
function allProductFlavourLogs(FlavoursHistoryService) {
  return FlavoursHistoryService.query({ fields: 'associated_id,createdBy,updates/(updatedAt,updatedBy)' }).$promise;
}

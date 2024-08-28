import ListController from '../controllers/products-list.client.controller';
import CommonListTemplate from '../../../core/client/views/common-list.view.html';

routeConfig.$inject = ['$stateProvider'];
export default function routeConfig($stateProvider) {
  $stateProvider
    .state('products', {
      abstract: true,
      url: '/products',
      template: '<ui-view/>'
    })

    .state('products.list', {
      url: '',
      template: CommonListTemplate,
      controller: ListController,
      controllerAs: 'vm',
      resolve: {
        allDeployments: getAllDeployments,
        allUsers: getAllUsers,
        allAreas: getAllAreas,
        allTeams: getAllTeams,
        allProductTypes: getAllProductTypes,
        allProductFlavours: getAllProductFlavours,
        allPrograms: getAllPrograms,
        allDeploymentLogs: getAllDeploymentLogs
      }
    });
}

getAllDeploymentLogs.$inject = ['DeploymentsHistoryService'];
function getAllDeploymentLogs(deploymentsHistoryService) {
  return deploymentsHistoryService.query({ fields: 'associated_id,createdBy,updates/(updatedAt,updatedBy)' }).$promise;
}

getRestoreData.$inject = ['$stateParams'];
function getRestoreData($stateParams) {
  return $stateParams.restoreData;
}

getDeployment.$inject = ['$stateParams', 'DeploymentsService'];
function getDeployment($stateParams, DeploymentsService) {
  return DeploymentsService.get({ deploymentId: $stateParams.deploymentId }).$promise;
}

getAllDeployments.$inject = ['DeploymentsService'];
function getAllDeployments(DeploymentsService) {
  return DeploymentsService.query({ fields: '_id,name,program_id,area_id,team_id,products(product_type_name,flavour_name,infrastructure,links(link_name),hardware_ids)' }).$promise;
}

getAllUsers.$inject = ['UsersService'];
function getAllUsers(UsersService) {
  return UsersService.query().$promise;
}

getAllTeams.$inject = ['TeamsService'];
function getAllTeams(TeamsService) {
  return TeamsService.query({ fields: '_id,name,area_id' }).$promise;
}

getAllAreas.$inject = ['AreasService'];
function getAllAreas(AreasService) {
  return AreasService.query().$promise;
}

getAllProductTypes.$inject = ['ProductTypesService'];
function getAllProductTypes(ProductTypesService) {
  return ProductTypesService.query().$promise;
}

getAllProductFlavours.$inject = ['ProductFlavoursService'];
function getAllProductFlavours(ProductFlavoursService) {
  return ProductFlavoursService.query().$promise;
}

getAllPrograms.$inject = ['ProgramsService'];
function getAllPrograms(ProgramsService) {
  return ProgramsService.query({ fields: '_id,name' }).$promise;
}

function getProgram(deployment, ProgramsService) {
  return ProgramsService.get({ programId: deployment.program_id }).$promise;
}

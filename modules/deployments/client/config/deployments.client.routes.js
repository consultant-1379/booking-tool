import ListController from '../controllers/deployments-list.client.controller';
import CreateController from '../controllers/deployments-create.client.controller';
import ViewController from '../controllers/deployments-view.client.controller';
import CommonListTemplate from '../../../core/client/views/common-list.view.html';
import CreateTemplate from '../views/deployments-create.client.view.html';
import ViewTemplate from '../views/deployments-view.client.view.html';

routeConfig.$inject = ['$stateProvider'];
export default function routeConfig($stateProvider) {
  $stateProvider
    .state('deployments', {
      abstract: true,
      url: '/deployments',
      template: '<ui-view/>'
    })
    .state('deployments.list', {
      url: '?programFilter?areaFilter?teamFilter?statusTypeFilter?deploymentFilter?createdByFilter?labelFilter?productTypeFilter',
      params: { // dynamic params allow param-update without page-reload
        programFilter: { dynamic: true },
        areaFilter: { dynamic: true },
        teamFilter: { dynamic: true },
        statusTypeFilter: { dynamic: true },
        deploymentFilter: { dynamic: true },
        createdByFilter: { dynamic: true },
        labelFilter: { dynamic: true },
        productTypeFilter: { dynamic: true }
      },
      template: CommonListTemplate,
      controller: ListController,
      controllerAs: 'vm',
      resolve: {
        allDeployments: getAllDeployments,
        allAreas: getAllAreas,
        allPrograms: getAllPrograms,
        allTeams: getAllTeams,
        allProductTypes: getAllProductTypes,
        allHardware: getAllHardware,
        allUsers: getAllUsers,
        allLabels: getAllLabels,
        allDeploymentLogs: getAllDeploymentLogs,
        allUserFilters: getAllUserFilters,
        programFilter: getProgramFilter,
        areaFilter: getAreaFilter,
        teamFilter: getTeamFilter,
        statusTypeFilter: getStatusFilter,
        deploymentFilter: getDeploymentNameFilter,
        createdByFilter: getCreatedByFilter,
        labelFilter: getLabelFilter,
        productTypeFilter: getProductTypeFilter
      }
    })
    .state('deployments.create', {
      url: '/create?{restoreData:json}&{cloneData:json}',
      template: CreateTemplate,
      controller: CreateController,
      controllerAs: 'vm',
      resolve: {
        deployment: newDeployment,
        restoredata: getRestoreData,
        clonedata: getCloneData,
        creatingFromScratch: function () { return true; },
        allAreas: getAllAreas,
        allPrograms: getAllPrograms,
        allTeams: getAllTeams,
        allProductTypes: getAllProductTypes,
        allDeployments: getAllDeployments,
        allHardware: getAllHardware,
        allBookings: getAllBookings,
        allUsers: getAllUsers,
        allLabels: getAllLabels
      }
    })
    .state('deployments.view', {
      url: '/view/{deploymentId}',
      template: ViewTemplate,
      controller: ViewController,
      controllerAs: 'vm',
      resolve: {
        deployment: getDeployment,
        area: ['deployment', 'AreasService', getArea],
        program: ['deployment', 'ProgramsService', getProgram],
        team: ['deployment', 'TeamsService', getTeam],
        allUsers: getAllUsers,
        allProductTypes: getAllProductTypes,
        allProductFlavours: getAllProductFlavours,
        allHardware: getAllHardware,
        allLabels: getAllLabels,
        allBookings: getAllBookings,
        allDeploymentLogs: getAllDeploymentLogs
      }
    })
    .state('deployments.edit', {
      url: '/edit/{deploymentId}?{restoreData:json}?addProduct?editProduct',
      template: CreateTemplate,
      controller: CreateController,
      controllerAs: 'vm',
      resolve: {
        deployment: getDeployment,
        restoredata: getRestoreData,
        clonedata: function () { return null; },
        creatingFromScratch: function () { return false; },
        allAreas: getAllAreas,
        allPrograms: getAllPrograms,
        allTeams: getAllTeams,
        allUsers: getAllUsers,
        allProductTypes: getAllProductTypes,
        allDeployments: getAllDeployments,
        allHardware: getAllHardware,
        allLabels: getAllLabels,
        allBookings: getAllBookings
      }
    });
}

getCreatedByFilter.$inject = ['$stateParams'];
function getCreatedByFilter($stateParams) {
  return $stateParams.createdByFilter;
}

getProgramFilter.$inject = ['$stateParams'];
function getProgramFilter($stateParams) {
  return $stateParams.programFilter;
}

getAreaFilter.$inject = ['$stateParams'];
function getAreaFilter($stateParams) {
  return $stateParams.areaFilter;
}

getTeamFilter.$inject = ['$stateParams'];
function getTeamFilter($stateParams) {
  return $stateParams.teamFilter;
}

getLabelFilter.$inject = ['$stateParams'];
function getLabelFilter($stateParams) {
  return $stateParams.labelFilter;
}

getProductTypeFilter.$inject = ['$stateParams'];
function getProductTypeFilter($stateParams) {
  return $stateParams.productTypeFilter;
}

getStatusFilter.$inject = ['$stateParams'];
function getStatusFilter($stateParams) {
  return $stateParams.statusTypeFilter;
}

getDeploymentNameFilter.$inject = ['$stateParams'];
function getDeploymentNameFilter($stateParams) {
  return $stateParams.deploymentFilter;
}

getAllUserFilters.$inject = ['UsersService'];
function getAllUserFilters(UsersService) {
  return UsersService.query({ fields: '_id,username,filters,area_id' }).$promise;
}

getAllHardware.$inject = ['HardwareService'];
function getAllHardware(hardwareService) {
  return hardwareService.query().$promise;
}

getAllBookings.$inject = ['BookingsService'];
function getAllBookings(bookingsService) {
  return bookingsService.query({ fields: '_id,deployment_id,product_id,startTime,endTime,isExpired,isStarted' }).$promise;
}

getCloneData.$inject = ['$stateParams'];
function getCloneData($stateParams) {
  return $stateParams.cloneData;
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
  return DeploymentsService.query({ fields: '_id,name,status,jira_issues,area_id,program_id,team_id,spocUser_ids,label_ids,purpose,timebox_data(timebox),products(_id,product_type_name,flavour_name,location,purpose,links,hardware_ids,infrastructure)' }).$promise;
}

newDeployment.$inject = ['DeploymentsService'];
function newDeployment(DeploymentsService) {
  return new DeploymentsService();
}

getAllTeams.$inject = ['TeamsService'];
function getAllTeams(TeamsService) {
  return TeamsService.query({ fields: '_id,name,area_id' }).$promise;
}

function getTeam(deployment, TeamsService) {
  return (deployment.team_id) ? TeamsService.get({ teamId: deployment.team_id }).$promise : undefined;
}

getAllUsers.$inject = ['UsersService'];
function getAllUsers(UsersService) {
  return UsersService.query({ fields: '_id,username,roles,displayName,email' }).$promise;
}

getAllAreas.$inject = ['AreasService'];
function getAllAreas(AreasService) {
  return AreasService.query({ fields: '_id,name,program_id' }).$promise;
}

function getArea(deployment, AreasService) {
  return AreasService.get({ areaId: deployment.area_id }).$promise;
}

getAllPrograms.$inject = ['ProgramsService'];
function getAllPrograms(ProgramsService) {
  return ProgramsService.query({ fields: '_id,name' }).$promise;
}

function getProgram(deployment, ProgramsService) {
  return ProgramsService.get({ programId: deployment.program_id }).$promise;
}

getAllProductTypes.$inject = ['ProductTypesService'];
function getAllProductTypes(ProductTypesService) {
  return ProductTypesService.query().$promise;
}

getAllProductFlavours.$inject = ['ProductFlavoursService'];
function getAllProductFlavours(ProductFlavoursService) {
  return ProductFlavoursService.query().$promise;
}

getAllLabels.$inject = ['LabelsService'];
function getAllLabels(LabelsService) {
  return LabelsService.query({ fields: '_id,name' }).$promise;
}

getAllDeploymentLogs.$inject = ['DeploymentsHistoryService'];
function getAllDeploymentLogs(deploymentsHistoryService) {
  return deploymentsHistoryService.query({ fields: 'associated_id,createdBy,updates/(updatedAt,updatedBy)' }).$promise;
}

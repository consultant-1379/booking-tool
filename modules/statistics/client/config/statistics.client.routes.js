import StatisticsController from '../controllers/bookings-statistics.client.controller';
import StatisticsTemplate from '../views/bookings-statistics.client.view.html';

routeConfig.$inject = ['$stateProvider'];
export default function routeConfig($stateProvider) {
  $stateProvider
    .state('statistics', {
      abstract: true,
      url: '/statistics',
      template: '<ui-view/>'
    })
    .state('statistics.bookings', {
      url: '/bookings?teamFilter?deploymentFilter?productTypeFilter?areaFilter?programFilter?startTimeAfterFilter?endTimeBeforeFilter?emptyDeploymentsFilter?sharedBookingsFilter?statisticsFocus',
      params: { // dynamic params allow param-update without page-reload
        teamFilter: { dynamic: true },
        deploymentFilter: { dynamic: true },
        productTypeFilter: { dynamic: true },
        areaFilter: { dynamic: true },
        programFilter: { dynamic: true },
        startTimeAfterFilter: { dynamic: true },
        endTimeBeforeFilter: { dynamic: true },
        emptyDeploymentsFilter: { dynamic: true },
        sharedBookingsFilter: { dynamic: true },
        statisticsFocus: { dynamic: true }
      },
      template: StatisticsTemplate,
      controller: StatisticsController,
      controllerAs: 'vm',
      resolve: {
        allDeployments: getAllDeployments,
        allProductTypes: getAllProductTypes,
        allTeams: getAllTeams,
        allAreas: getAllAreas,
        allPrograms: getAllPrograms,
        allUserFilters: getAllUserFilters,
        teamFilter: getTeamFilter,
        deploymentFilter: getDeploymentFilter,
        productTypeFilter: getProductTypeFilter,
        areaFilter: getAreaFilter,
        programFilter: getProgramFilter,
        startTimeAfterFilter: getStartTimeAfterFilter,
        endTimeBeforeFilter: getEndTimeBeforeFilter,
        emptyDeploymentsFilter: getEmptyDeploymentsFilter,
        sharedBookingsFilter: getSharedBookingsFilter,
        statisticsFocus: getStatisticsFocus
      }
    });
}

getAllPrograms.$inject = ['ProgramsService'];
function getAllPrograms(ProgramsService) {
  return ProgramsService.query({ fields: '_id,name' }).$promise;
}

getAllDeployments.$inject = ['DeploymentsService'];
function getAllDeployments(DeploymentsService) {
  return DeploymentsService.query({ fields: '_id,name,area_id,products,program_id,status,spocUser_ids,team_id' }).$promise;
}

getAllTeams.$inject = ['TeamsService'];
function getAllTeams(TeamsService) {
  return TeamsService.query({ fields: '_id,name,admin_IDs,users,area_id' }).$promise;
}

getAllAreas.$inject = ['AreasService'];
function getAllAreas(AreasService) {
  return AreasService.query({ fields: '_id,name,maxBookingDurationDays,maxBookingAdvanceWeeks,program_id' }).$promise;
}

getAllProductTypes.$inject = ['ProductTypesService'];
function getAllProductTypes(ProductTypesService) {
  return ProductTypesService.query({ fields: '_id,name' }).$promise;
}

getAllUserFilters.$inject = ['UsersService'];
function getAllUserFilters(UsersService) {
  return UsersService.query({ fields: '_id,username,roles,filters,area_id' }).$promise;
}

getProgramFilter.$inject = ['$stateParams'];
function getProgramFilter($stateParams) {
  return $stateParams.programFilter;
}

getDeploymentFilter.$inject = ['$stateParams'];
function getDeploymentFilter($stateParams) {
  return $stateParams.deploymentFilter;
}

getTeamFilter.$inject = ['$stateParams'];
function getTeamFilter($stateParams) {
  return $stateParams.teamFilter;
}

getAreaFilter.$inject = ['$stateParams'];
function getAreaFilter($stateParams) {
  return $stateParams.areaFilter;
}

getProductTypeFilter.$inject = ['$stateParams'];
function getProductTypeFilter($stateParams) {
  return $stateParams.productTypeFilter;
}

getUserFilter.$inject = ['$stateParams'];
function getUserFilter($stateParams) {
  return $stateParams.createdByFilter;
}

getStartTimeAfterFilter.$inject = ['$stateParams'];
function getStartTimeAfterFilter($stateParams) {
  return $stateParams.startTimeAfterFilter;
}

getEndTimeBeforeFilter.$inject = ['$stateParams'];
function getEndTimeBeforeFilter($stateParams) {
  return $stateParams.endTimeBeforeFilter;
}

getEmptyDeploymentsFilter.$inject = ['$stateParams'];
function getEmptyDeploymentsFilter($stateParams) {
  return $stateParams.emptyDeploymentsFilter;
}

getSharedBookingsFilter.$inject = ['$stateParams'];
function getSharedBookingsFilter($stateParams) {
  return $stateParams.sharedBookingsFilter;
}

getStatisticsFocus.$inject = ['$stateParams'];
function getStatisticsFocus($stateParams) {
  return $stateParams.statisticsFocus;
}

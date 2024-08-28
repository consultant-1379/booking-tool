import ListController from '../controllers/bookings-calendar.client.controller';
import ListTemplate from '../views/bookings-calendar.client.view.html';

routeConfig.$inject = ['$stateProvider'];
export default function routeConfig($stateProvider) {
  $stateProvider
    .state('bookings', {
      abstract: true,
      url: '/bookings',
      template: '<ui-view/>'
    })
    .state('bookings.calendar', {
      url: '?bookingFocus?programFilter?areaFilter?teamFilter?deploymentFilter?productTypeFilter?createdByFilter?startTimeAfterFilter?endTimeBeforeFilter?labelFilter',
      params: { // dynamic params allow param-update without page-reload
        bookingFocus: { dynamic: true },
        programFilter: { dynamic: true },
        areaFilter: { dynamic: true },
        teamFilter: { dynamic: true },
        deploymentFilter: { dynamic: true },
        productTypeFilter: { dynamic: true },
        createdByFilter: { dynamic: true },
        startTimeAfterFilter: { dynamic: true },
        endTimeBeforeFilter: { dynamic: true },
        labelFilter: { dynamic: true }
      },
      template: ListTemplate,
      controller: ListController,
      controllerAs: 'vm',
      css: 'css/fullCalendar.css',
      resolve: {
        newBooking: getNewBooking,
        allPrograms: getAllPrograms,
        allBookings: getAllBookings,
        allDeployments: getAllDeployments,
        allTeams: getAllTeams,
        allAreas: getAllAreas,
        allProductTypes: getAllProductTypes,
        allLabels: getAllLabels,
        allBookingLogs: getBookingLogs,
        allUserFilters: getAllUserFilters,
        programFilter: getProgramFilter,
        bookingFocus: getBookingFocus,
        deploymentFilter: getDeploymentFilter,
        teamFilter: getTeamFilter,
        areaFilter: getAreaFilter,
        productTypeFilter: getProductTypeFilter,
        createdByFilter: getUserFilter,
        startTimeAfterFilter: getStartTimeAfterFilter,
        endTimeBeforeFilter: getEndTimeBeforeFilter,
        labelFilter: getLabelFilter
      }
    });
}

getNewBooking.$inject = ['BookingsService'];
function getNewBooking(BookingsService) {
  return new BookingsService();
}

getAllBookings.$inject = ['BookingsService'];
function getAllBookings(BookingsService) {
  return BookingsService.query({}).$promise;
}

getAllPrograms.$inject = ['ProgramsService'];
function getAllPrograms(ProgramsService) {
  return ProgramsService.query({ fields: '_id,name,jira_templates' }).$promise;
}

getAllDeployments.$inject = ['DeploymentsService'];
function getAllDeployments(DeploymentsService) {
  return DeploymentsService.query({ fields: '_id,name,area_id,products,program_id,status,spocUser_ids,team_id,crossRASharing,label_ids' }).$promise;
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

getAllLabels.$inject = ['LabelsService'];
function getAllLabels(LabelsService) {
  return LabelsService.query({ fields: '_id,name' }).$promise;
}

getAllUsers.$inject = ['UsersService'];
function getAllUsers(UsersService) {
  return UsersService.query({ fields: '_id,username,roles,displayName,email' }).$promise;
}

getBookingLogs.$inject = ['BookingsHistoryService'];
function getBookingLogs(BookingsHistoryService) {
  return BookingsHistoryService.query({ fields: 'associated_id,createdAt,createdBy,updates/(updatedAt,updatedBy)' }).$promise;
}

getAllUserFilters.$inject = ['UsersService'];
function getAllUserFilters(UsersService) {
  return UsersService.query({ fields: '_id,username,roles,filters,area_id' }).$promise;
}

getBookingFocus.$inject = ['$stateParams'];
function getBookingFocus($stateParams) {
  return $stateParams.bookingFocus;
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

getLabelFilter.$inject = ['$stateParams'];
function getLabelFilter($stateParams) {
  return $stateParams.labelFilter;
}

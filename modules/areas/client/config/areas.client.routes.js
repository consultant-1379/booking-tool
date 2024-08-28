import ListController from '../controllers/areas-list.client.controller';
import CreateController from '../controllers/areas-create.client.controller';
import ViewController from '../controllers/areas-view.client.controller';
import CommonListTemplate from '../../../core/client/views/common-list.view.html';
import CreateTemplate from '../views/areas-create.client.view.html';
import ViewTemplate from '../views/areas-view.client.view.html';

routeConfig.$inject = ['$stateProvider'];
export default function routeConfig($stateProvider) {
  $stateProvider
    .state('areas', {
      abstract: true,
      url: '/areas',
      template: '<ui-view/>'
    })

    .state('areas.list', {
      url: '',
      template: CommonListTemplate,
      controller: ListController,
      controllerAs: 'vm',
      resolve: {
        allAreas: getAllAreas,
        allUsers: getAllUsers,
        allPrograms: getAllPrograms
      }
    })
    .state('areas.create', {
      url: '/create?{restoreData:json}',
      template: CreateTemplate,
      controller: CreateController,
      controllerAs: 'vm',
      resolve: {
        area: newArea,
        allUsers: getAllUsers,
        allPrograms: getAllPrograms,
        restoredata: getRestoreData,
        creatingFromScratch: function () { return true; }
      }
    })
    .state('areas.edit', {
      url: '/edit/{areaId}?{restoreData:json}',
      template: CreateTemplate,
      controller: CreateController,
      controllerAs: 'vm',
      resolve: {
        area: getArea,
        allUsers: getAllUsers,
        allPrograms: getAllPrograms,
        restoredata: getRestoreData,
        creatingFromScratch: function () { return false; }
      }
    })
    .state('areas.view', {
      url: '/view/{areaId}',
      template: ViewTemplate,
      controller: ViewController,
      controllerAs: 'vm',
      resolve: {
        logs: getAreaLogs,
        area: getArea,
        program: ['area', 'ProgramsService', getProgram],
        user: ['area', 'UsersService', getUser],
        dependentTeams: ['area', 'TeamsService', getDependentTeams],
        dependentDeployments: ['area', 'DeploymentsService', getDependentDeployments]
      }
    });
}

getRestoreData.$inject = ['$stateParams'];
function getRestoreData($stateParams) {
  return $stateParams.restoreData;
}

getArea.$inject = ['$stateParams', 'AreasService'];
function getArea($stateParams, AreasService) {
  return AreasService.get({
    areaId: $stateParams.areaId
  }).$promise;
}

getAllAreas.$inject = ['AreasService'];
function getAllAreas(areasService) {
  return areasService.query().$promise;
}

newArea.$inject = ['AreasService'];
function newArea(AreasService) {
  return new AreasService();
}

function getUser(area, UsersService) {
  return (area.bookingAssigneeUser_id) ? UsersService.get({ userId: area.bookingAssigneeUser_id }).$promise : undefined;
}

getAllUsers.$inject = ['UsersService'];
function getAllUsers(UsersService) {
  return UsersService.query().$promise;
}

getAllPrograms.$inject = ['ProgramsService'];
function getAllPrograms(ProgramsService) {
  return ProgramsService.query({ fields: '_id,name' }).$promise;
}

function getProgram(area, ProgramsService) {
  return (area.program_id) ? ProgramsService.get({ programId: area.program_id }).$promise : undefined;
}

function getDependentTeams(area, TeamsService) {
  return TeamsService.query({ q: 'area_id=' + area._id, fields: '_id,name' }).$promise;
}

function getDependentDeployments(area, DeploymentsService) {
  return DeploymentsService.query({ q: 'area_id=' + area._id, fields: '_id,name' }).$promise;
}

getAreaLogs.$inject = ['$stateParams', 'AreasHistoryService'];
function getAreaLogs($stateParams, AreasHistoryService) {
  return AreasHistoryService.query({ q: 'associated_id=' + $stateParams.areaId, fields: 'associated_id,createdBy,updates/(updatedAt,updatedBy)' }).$promise;
}

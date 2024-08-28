import ListController from '../controllers/teams-list.client.controller';
import CreateController from '../controllers/teams-create.client.controller';
import ViewController from '../controllers/teams-view.client.controller';
import CommonListTemplate from '../../../core/client/views/common-list.view.html';
import CreateTemplate from '../views/teams-create.client.view.html';
import ViewTemplate from '../views/teams-view.client.view.html';

routeConfig.$inject = ['$stateProvider'];
export default function routeConfig($stateProvider) {
  $stateProvider
    .state('teams', {
      abstract: true,
      url: '/teams',
      template: '<ui-view/>'
    })
    .state('teams.list', {
      url: '',
      template: CommonListTemplate,
      controller: ListController,
      controllerAs: 'vm',
      resolve: {
        allTeams: getAllTeams,
        allAreas: getAllAreas,
        allUsers: ['UsersService', getAllUsersStripped]
      }
    })
    .state('teams.create', {
      url: '/create?{restoreData:json}',
      template: CreateTemplate,
      controller: CreateController,
      controllerAs: 'vm',
      resolve: {
        team: newTeam,
        allUsers: getAllUsers,
        allRoles: getAllRoles,
        allAreas: getAllAreas,
        restoredata: getRestoreData,
        creatingFromScratch: function () { return true; }
      }
    })
    .state('teams.edit', {
      url: '/edit/{teamId}?{restoreData:json}',
      template: CreateTemplate,
      controller: CreateController,
      controllerAs: 'vm',
      resolve: {
        team: getTeam,
        allUsers: getAllUsers,
        allRoles: getAllRoles,
        allAreas: getAllAreas,
        restoredata: getRestoreData,
        creatingFromScratch: function () { return false; }
      }
    })
    .state('teams.view', {
      url: '/view/{teamId}',
      template: ViewTemplate,
      controller: ViewController,
      controllerAs: 'vm',
      resolve: {
        team: getTeam,
        area: ['team', 'AreasService', getArea],
        allUsers: ['UsersService', getAllUsersStripped],
        dependentDeployments: ['team', 'DeploymentsService', getDependentDeployments]
      }
    });
}

getRestoreData.$inject = ['$stateParams'];
function getRestoreData($stateParams) {
  return $stateParams.restoreData;
}

function getAllUsersStripped(UsersService) {
  return UsersService.query({ fields: '_id,username,displayName,roles' }).$promise;
}

getTeam.$inject = ['$stateParams', 'TeamsService'];
function getTeam($stateParams, TeamsService) {
  return TeamsService.get({ teamId: $stateParams.teamId }).$promise;
}

function getArea(team, AreasService) {
  return (team.area_id) ? AreasService.get({ areaId: team.area_id }).$promise : undefined;
}

getAllTeams.$inject = ['TeamsService'];
function getAllTeams(TeamsService) {
  return TeamsService.query().$promise;
}

newTeam.$inject = ['TeamsService'];
function newTeam(TeamsService) {
  return new TeamsService();
}

getAllUsers.$inject = ['UsersService'];
function getAllUsers(UsersService) {
  return UsersService.query().$promise;
}

getAllAreas.$inject = ['AreasService'];
function getAllAreas(AreasService) {
  return AreasService.query({ fields: '_id,name' }).$promise;
}


getAllRoles.$inject = ['RolesService'];
function getAllRoles(RolesService) {
  return RolesService.query({ fields: '_id,name' }).$promise;
}

function getDependentDeployments(team, DeploymentsService) {
  return DeploymentsService.query({ q: 'team_id=' + team._id, fields: '_id,name' }).$promise;
}

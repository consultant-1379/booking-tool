import ListController from '../controllers/roles-list.client.controller';
import CreateController from '../controllers/roles-create.client.controller';
import ViewController from '../controllers/roles-view.client.controller';
import CommonListTemplate from '../../../core/client/views/common-list.view.html';
import CreateTemplate from '../views/roles-create.client.view.html';
import ViewTemplate from '../views/roles-view.client.view.html';

routeConfig.$inject = ['$stateProvider'];
export default function routeConfig($stateProvider) {
  $stateProvider
    .state('roles', {
      abstract: true,
      url: '/roles',
      template: '<ui-view/>'
    })

    .state('roles.list', {
      url: '',
      template: CommonListTemplate,
      controller: ListController,
      controllerAs: 'vm',
      resolve: {
        allRoles: getAllRoles,
        allRoleLogs: getAllRoleLogs
      }
    })
    .state('roles.create', {
      url: '/create?{restoreData:json}',
      template: CreateTemplate,
      controller: CreateController,
      controllerAs: 'vm',
      resolve: {
        role: newRole,
        restoredata: getRestoreData,
        creatingFromScratch: function () { return true; }
      }
    })
    .state('roles.edit', {
      url: '/edit/{roleId}?{restoreData:json}?',
      template: CreateTemplate,
      controller: CreateController,
      controllerAs: 'vm',
      resolve: {
        role: getRole,
        restoredata: getRestoreData,
        clonedata: function () { return null; },
        creatingFromScratch: function () { return false; },
        allRoles: getAllRoles
      }
    })
    .state('roles.view', {
      url: '/view/{roleId}',
      template: ViewTemplate,
      controller: ViewController,
      controllerAs: 'vm',
      resolve: {
        role: getRole,
        allUsers: getUsers,
        allRoles: getAllRoles,
        allRoleLogs: getAllRoleLogs
      }
    });
}

getRestoreData.$inject = ['$stateParams'];
function getRestoreData($stateParams) {
  return $stateParams.restoreData;
}

getRole.$inject = ['$stateParams', 'RolesService'];
function getRole($stateParams, RolesService) {
  return RolesService.get({
    roleId: $stateParams.roleId
  }).$promise;
}

getAllRoles.$inject = ['RolesService'];
function getAllRoles(rolesService) {
  return rolesService.query().$promise;
}

newRole.$inject = ['RolesService'];
function newRole(RolesService) {
  return new RolesService();
}

getAllRoleLogs.$inject = ['RolesHistoryService'];
function getAllRoleLogs(RolesHistoryService) {
  return RolesHistoryService.query({ fields: 'associated_id,createdBy,updates/(updatedAt,updatedBy)' }).$promise;
}

getUsers.$inject = ['UsersService'];
function getUsers(UsersService) {
  return UsersService.query().$promise;
}

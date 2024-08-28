import UsersService from '../services/users.client.service';
import ListController from '../controllers/users-list.client.controller';
import CommonListTemplate from '../../../core/client/views/common-list.view.html';
import UsersViewController from '../controllers/users-view.client.controller';
import ViewTemplate from '../views/users-view.client.view.html';
import EditController from '../controllers/users-edit.client.controller';
import EditTemplate from '../views/users-edit.client.view.html';
import authenticationController from '../controllers/authentication.client.controller';
import authenticationView from '../views/authentication/authentication.client.view.html';
import signInView from '../views/authentication/signin.client.view.html';
routeConfig.$inject = ['$stateProvider'];

export default function routeConfig($stateProvider) {
  $stateProvider
    .state('authentication', {
      abstract: true,
      url: '/authentication',
      template: authenticationView,
      controller: authenticationController,
      controllerAs: 'vm'
    })
    .state('authentication.signin', {
      url: '/signin?err',
      template: signInView,
      controller: authenticationController,
      controllerAs: 'vm'
    });

  $stateProvider
    .state('users', {
      abstract: true,
      url: '/users',
      template: '<ui-view/>'
    })
    .state('users.list', {
      url: '',
      template: CommonListTemplate,
      controller: ListController,
      controllerAs: 'vm',
      resolve: {
        allUsers: getUsers,
        allRoles: getRoles
      }
    })
    .state('users.view', {
      url: '/view/{userId}',
      template: ViewTemplate,
      controller: UsersViewController,
      controllerAs: 'vm',
      resolve: {
        user: getUser,
        allRoles: getRoles
      }
    })
    .state('users.edit', {
      url: '/edit/{userId}',
      template: EditTemplate,
      controller: EditController,
      controllerAs: 'vm',
      resolve: {
        user: getUser,
        allRoles: getRoles
      }
    });
}

getUsers.$inject = ['UsersService'];
function getUsers(UsersService) {
  return UsersService.query().$promise;
}

getUser.$inject = ['$stateParams', 'UsersService'];
function getUser($stateParams, UsersService) {
  return UsersService.get({
    userId: $stateParams.userId
  }).$promise;
}

getRoles.$inject = ['RolesService'];
function getRoles(RolesService) {
  return RolesService.query().$promise;
}

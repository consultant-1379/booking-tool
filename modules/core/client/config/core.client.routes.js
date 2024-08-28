import homeCtrl from '../controllers/home.client.controller';
import homeClientView from '../views/home.client.view.html';
import view404 from '../views/404.client.view.html';
import view400 from '../views/400.client.view.html';
import view403 from '../views/403.client.view.html';

coreRoutes.$inject = ['$stateProvider', '$urlRouterProvider'];
export default function coreRoutes($stateProvider, $urlRouterProvider) {
  $urlRouterProvider.rule(function ($injector, $location) {
    var path = $location.path();
    var hasTrailingSlash = path.length > 1 && path[path.length - 1] === '/';

    if (hasTrailingSlash) {
      // if last character is a slash, return the same url without the slash
      var newPath = path.substr(0, path.length - 1);
      $location.replace().path(newPath);
    }
  });

  // Redirect to 404 when route not found
  $urlRouterProvider.otherwise(function ($injector) {
    $injector.get('$state').transitionTo('not-found', null, {
      location: false
    });
  });

  $stateProvider
    .state('home', {
      url: '/',
      template: homeClientView,
      controller: homeCtrl,
      controllerAs: 'vm',
      resolve: {
        allLabels: getAllLabels
      }
    })
    .state('not-found', {
      url: '/not-found',
      template: view404,
      controller: 'ErrorController',
      controllerAs: 'vm',
      params: {
        message: function ($stateParams) {
          return $stateParams.message;
        }
      },
      data: {
        ignoreState: true,
        pageTitle: 'Not Found'
      }
    })
    .state('bad-request', {
      url: '/bad-request',
      template: view400,
      controller: 'ErrorController',
      controllerAs: 'vm',
      params: {
        message: function ($stateParams) {
          return $stateParams.message;
        }
      },
      data: {
        ignoreState: true,
        pageTitle: 'Bad Request'
      }
    })
    .state('forbidden', {
      url: '/forbidden',
      template: view403,
      data: {
        ignoreState: true,
        pageTitle: 'Forbidden'
      }
    });
}

getAllLabels.$inject = ['LabelsService'];
function getAllLabels(labelsService) {
  return labelsService.query().$promise;
}

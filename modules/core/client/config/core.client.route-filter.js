routeFilter.$inject = ['$rootScope', '$state', 'Authentication', '$transitions', 'Notification'];
export default function routeFilter($rootScope, $state, Authentication, $transitions, Notification) {
  // Used to indicate to the UI that the page is transitioning so that loading screens can appear
  var pathActionToMethodMap = {
    list: 'view-page',
    view: 'view-page',
    edit: 'put',
    create: 'post'
  };

  $transitions.onError({}, function () {
    $rootScope.transitioning = false;
  });

  function getPathAndMethodFromTrans(trans) {
    var hrefPath = $state.href(trans.to(), trans.params());
    var pathName = trans.to().name;
    var splitPathName = pathName.split('.');
    var methodPath;
    var method;
    var path;
    if (splitPathName.length > 1 && splitPathName[1] in pathActionToMethodMap) {
      method = pathActionToMethodMap[splitPathName[1]];
      methodPath = splitPathName[1];
    }
    path = hrefPath.split('/' + methodPath)[0];
    return {
      path: path,
      method: method || 'view-page'
    };
  }

  $transitions.onBefore({}, function (trans) {
    document.title = window.documentOriginalTitle;
    if (trans.to().name !== 'authentication.signin') {
      if (!Authentication.user) {
        $state.previous = {
          to: Object.assign({}, trans.to()),
          params: Object.assign({}, trans.params())
        };
        return trans.router.stateService.target('authentication.signin');
      }
      var pathAndMethodObj = getPathAndMethodFromTrans(trans);
      var isAllowed = Authentication.isAllowed(pathAndMethodObj.path, pathAndMethodObj.method, true);
      if (!isAllowed) {
        Notification.error({
          title: '<i class="glyphicon glyphicon-remove"></i>Unauthorized!',
          message: 'Invalid Permissions: You must be an Admin to access this page.'
        });
        return trans.router.stateService.target('home');
      }
    }
  });

  $transitions.onStart({}, function (trans) {
    $rootScope.transitioning = true;
  });

  $transitions.onSuccess({}, function (trans) {
    $rootScope.transitioning = false;
  });
}

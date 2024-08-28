Authentication.$inject = ['$window'];
export default function Authentication($window) {
  var auth = {
    user: $window.user
  };
  auth.isAllowed = function (path, reqMethod, userCreatedResource = false, data = undefined) {
    var user = this.user;

    if (!user) return false;

    // A path is replaced with another if the request method matches
    var pathProxy = {
      // A product is a field within deployments so to get a product you need to get a deployment
      '/products': {
        replacementPath: '/deployments',
        methods: 'post put delete'
      }
    };
    if (path in pathProxy && pathProxy[path].methods.includes(reqMethod)) {
      path = pathProxy[path].replacementPath;
    }

    // Logs is removed from start of path so that we simply check for the resource itself
    if (path.startsWith('/logs') && reqMethod === 'view-page') {
      path = path.slice(5);
    }

    // Unless specified otherwise, GET for all paths is enabled by default
    var checkGetPermissionPaths = ['/users', '/roles', '/programs', '/areas', '/teams', '/productFlavours'];
    if (!checkGetPermissionPaths.includes(path) && reqMethod === 'view-page') {
      return true;
    }

    var permissions = user.permissions || [];
    var reqRoute = path.toLowerCase();

    // Check against individual user permissions
    for (var i = 0; i < permissions.length; i += 1) {
      var userPerm = permissions[i];
      if (reqRoute.startsWith(userPerm.resources.toLowerCase())) {
        var isAllowedForAll = 'allResourceMethods' in userPerm && userPerm.allResourceMethods.includes(reqMethod);
        var isAllowedForUser = userCreatedResource && 'userCreatedResourceMethods' in userPerm && userPerm.userCreatedResourceMethods.includes(reqMethod);
        if (isAllowedForAll || isAllowedForUser) {
          return true;
        }
      }
    }

    // Check against user role permissions
    for (var roleIndex = 0; roleIndex < user.userRoles.length; roleIndex += 1) {
      var role = user.userRoles[roleIndex];
      for (var permIndex = 0; permIndex < role.pathsPermissions.length; permIndex += 1) {
        var rolePerm = role.pathsPermissions[permIndex];
        var matchesAllResources = rolePerm.resources === '/*';
        var hasPermissionDefined = reqRoute.startsWith(rolePerm.resources.toLowerCase());
        if (matchesAllResources || hasPermissionDefined) {
          var allowedForAll = rolePerm.allResourceMethods.includes(reqMethod);
          var allowedForUser = userCreatedResource && rolePerm.userCreatedResourceMethods.includes(reqMethod);
          if (allowedForAll || allowedForUser) {
            return true;
          }
        }
      }
    }

    return false;
  };
  return auth;
}

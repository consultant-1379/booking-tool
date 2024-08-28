'use strict';

var mongoose = require('mongoose');
var User = mongoose.model('User');
var Role = mongoose.model('Role');

exports.isAllowed = async function (req, res, next) {
  var user = await getUserFromID(req.user);
  if (!user) return res.status(401).json({ message: 'User must be logged in' });
  var permissions = user.permissions;
  var roles = await getUserRoles(user.userRoles.map(String));
  var reqRoute = req.route.path;
  var reqMethod = req.method.toLowerCase();
  var validPermissions;

  // Check against individual user permissions
  if (permissions) {
    permissions.some(function (perm) {
      var pathMatches = reqRoute.startsWith(`/api${perm.resources}`);
      var hasPermission = perm.allResourceMethods.includes(reqMethod) || perm.userCreatedResourceMethods.includes(reqMethod);
      if (pathMatches && hasPermission) {
        validPermissions = true;
        return next();
      }
      return validPermissions;
    });
  }

  // Check against user role permissions
  roles.forEach(role => {
    if (validPermissions) {
      return;
    }
    role.pathsPermissions.some(perm => {
      if (perm.resources === '/*' || (reqRoute.startsWith(`/api${perm.resources}`) && (perm.allResourceMethods.includes(reqMethod) || perm.userCreatedResourceMethods.includes(reqMethod)))) {
        validPermissions = true;
        return next();
      }
      return validPermissions;
    });
  });

  if (!validPermissions) return res.status(403).json({ message: 'User is not authorized' });
};

async function getUserFromID(userID) {
  return User.findById(userID, '-salt -password -providerData').exec();
}

async function getUserRoles(roleIds) {
  var allRoles = await Role.find();
  return allRoles.filter(role => roleIds.includes(role._id.toString()));
}


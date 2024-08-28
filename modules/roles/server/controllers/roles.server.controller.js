'use strict';

var Role = require('../models/roles.server.model').Schema;
var User = require('../../../users/server/models/user.server.model').Schema;
var errorHandler = require('../../../core/server/controllers/errors.server.controller');
var commonController = require('../../../core/server/controllers/common.server.controller');

var dependentModelsDetails = [
  { modelObject: User, modelKey: 'userRoles' }
];

var sortOrder = 'name';
commonController = commonController(Role, dependentModelsDetails, sortOrder);

exports.create = commonController.create;
exports.read = commonController.read;
exports.list = commonController.list;
exports.findById = commonController.findById;
exports.delete = commonController.delete;
exports.update = commonController.update;

exports.verifyPermissions = async function (req, res, next) {
  try {
    var currentUser = await User.findById(req.user).populate('userRoles');
    var currentUserIsSuperAdmin = currentUser.userRoles.some((role) => role.name === 'superAdmin');
    var roleToUpdate = await Role.findById(req.params.roleId);
    var roleToUpdateIsAdmin = ['admin', 'superAdmin'].includes(roleToUpdate.name);

    // Only a superAdmin can modify superAdmin and admin roles
    if (roleToUpdateIsAdmin && !currentUserIsSuperAdmin) {
      return res.status(403).json({ message: 'User is not authorized' });
    }

    next();
  } catch (err) {
    return res.status(422).send({
      message: errorHandler.getErrorMessage(err)
    });
  }
};

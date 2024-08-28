'use strict';

var mongoose = require('mongoose'),
  User = mongoose.model('User'),
  Role = mongoose.model('Role'),
  _ = require('lodash'),
  errorHandler = require('../../../core/server/controllers/errors.server.controller'),
  ldap = require('../../../../config/lib/ldap'),
  commonController = require('../../../core/server/controllers/common.server.controller');

var dependentModelsDetails = [];
var sortOrder = 'name';
commonController = commonController(User, dependentModelsDetails, sortOrder);

exports.read = function (req, res) {
  var modelInstance = req.User ? req.User.toJSON() : {};
  var strippedModelInstance = {
    _id: modelInstance._id,
    displayName: modelInstance.displayName,
    username: modelInstance.username,
    email: modelInstance.email,
    userRoles: modelInstance.userRoles,
    permissions: modelInstance.permissions
  };
  res.json(strippedModelInstance);
};

exports.signin = async function (req, res) {
  try {
    var user = await ldap.signinFromLoginPage(req, res);
    user.password = undefined;
    user.salt = undefined;
    res.json(user);
  } catch (err) {
    return res.status(422).send({
      message: errorHandler.getErrorMessage(err)
    });
  }
};

exports.signout = function (req, res, next) {
  req.logout(function (err) {
    if (err) { return next(err); }
    res.redirect('/authentication/signin');
  });
};

exports.list = async function (req, res) {
  try {
    var users = await User.find({}, '-salt -password -providerData').sort('-created').populate('user', 'displayName').exec();
    res.json(users);
  } catch (err) {
    return res.status(422).send({
      message: errorHandler.getErrorMessage(err)
    });
  }
};

exports.findById = commonController.findById;

exports.update = async function (req, res) {
  delete req.body.created_at;
  try {
    var user;
    if (req.body.userRoles || req.body.permissions) {
      var currentUser = await User.findById(req.user).populate('userRoles');
      var isSuperAdmin = currentUser.userRoles.some((role) => role.name === 'superAdmin');
      var isAdmin = currentUser.userRoles.some((role) => role.name === 'admin');

      // Only admin and superAdmin can grant permissions
      if (!isAdmin && !isSuperAdmin) {
        return res.status(403).json({ message: 'User is not authorized' });
      }

      var userToUpdate = await User.findById(req.body._id).populate('userRoles');
      var userToUpdateIsAdmin = userToUpdate.userRoles.some(role => ['admin', 'superAdmin'].includes(role.name));
      var allRoles = await Role.find();
      var adminRoleIds = allRoles.filter((role) => ['admin', 'superAdmin'].includes(role.name)).map(role => role._id.toString());
      var isAddingAdminRole = req.body.userRoles.some((role) => adminRoleIds.includes(role));

      // Only a superAdmin can modify superAdmin and admin users, and assign these roles
      if ((userToUpdateIsAdmin || isAddingAdminRole) && !isSuperAdmin) {
        return res.status(403).json({ message: 'User is not authorized' });
      }

      user = await User.findByIdAndUpdate(
        req.body._id,
        {
          userRoles: req.body.userRoles,
          permissions: req.body.permissions
        }
      );
    } else {
      user = await User.findByIdAndUpdate(req.body._id, req.body);
    }
    res.json(user);
  } catch (err) {
    return res.status(422).send({
      message: errorHandler.getErrorMessage(err)
    });
  }
};

exports.updateFilters = async function (req, res) {
  // TODO: check that user for edit is being done by same user.
  var user;
  try {
    if (req.body.removeFilter) {
      user = await User.findByIdAndUpdate(
        req.user._id,
        { $pull: { filters: { _id: req.body.removeFilter } } },
        { new: true, runValidators: true }
      );
    } else if (req.body.newFilter) {
      if (!req.body.newFilter.parameters) {
        throw new Error('\'parameters\' field is missing.');
      } else if (Object.values(req.body.newFilter.parameters).every(param => (!param))) {
        throw new Error('Enter at least one key-value pair for \'parameters\' field.');
      }

      user = await User.findByIdAndUpdate(
        req.user._id,
        { $push: { filters: req.body.newFilter } },
        { new: true, runValidators: true }
      );
    } else {
      throw new Error('Ensure \'removeFilter\' or \'newFilter\' parameter is used');
    }
  } catch (err) {
    return res.status(422).send({
      message: `No user-filter updates made. ${errorHandler.getErrorMessage(err)}`
    });
  }
  res.json(user);
};

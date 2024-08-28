'use strict';

var mongoose = require('mongoose');
var MongooseSchema = mongoose.Schema;
var validator = require('validator');
var uniqueValidator = require('mongoose-unique-validator');
var commonValidators = require('../../../core/server/controllers/validators.server.controller');
var User = require('../../../users/server/models/user.server.model.js').Schema;
var Area = require('../../../areas/server/models/areas.server.model').Schema;
var MongooseHistory = require('../../../history/server/plugins/history.server.plugin');

// A Validation function for local strategy email
var validateEmail = function (email) {
  return (validator.isEmail(email, { require_tld: false }));
};

var Team = new MongooseSchema({
  name: {
    type: 'string',
    trim: true,
    required: true,
    unique: true,
    maxlength: 50
  },
  area_id: {
    type: MongooseSchema.ObjectId,
    ref: 'Area',
    required: true
  },
  state: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  admin_IDs: [{
    type: MongooseSchema.ObjectId,
    ref: 'User'
  }],
  users: [{
    type: MongooseSchema.ObjectId,
    ref: 'User'
  }],
  email: {
    type: String,
    trim: true,
    lowercase: true,
    validate: [validateEmail, 'Please fill in a valid email address']
  },
  tit_ref_id: {
    type: String
  }
}, {
  strict: 'throw'
});

Team.plugin(uniqueValidator, { message: 'Error, provided name is not unique.' });

async function findOneUser(userId) {
  return User.findOne({ _id: userId }).populate('userRoles');
}

async function anyNullElement(arr) {
  for (var index in arr) {
    if (!arr[index]) {
      return true;
    }
  }
  return false;
}

Team.pre('save', async function (next) {
  try {
    var team = this;
    await commonValidators.validateModelId(Area, team.area_id);
    if (team.admin_IDs.length > 2) {
      throw new Error('There can be only a maximium of two admin users per team.');
    }
    if (team.admin_IDs.length !== [...new Set(team.admin_IDs.map(userId => userId.toString()))].length) {
      return await Promise.reject(new Error('Duplicate users added to admin team.'));
    }
    var userPromises = [];
    for (var x = 0; x < team.users.length; x += 1) {
      userPromises.push(findOneUser(team.users[x]));
    }
    var foundUsers = await Promise.all(userPromises);
    if (await anyNullElement(foundUsers)) {
      return await Promise.reject(new Error('An associated user id does not exist.'));
    }
    if (team.users.length !== [...new Set(team.users.map(userId => userId.toString()))].length) {
      return await Promise.reject(new Error('Duplicate users added to team.'));
    }
    return next();
  } catch (error) {
    return next(error);
  }
});

Team.plugin(MongooseHistory);

module.exports.Schema = mongoose.model('Team', Team);

'use strict';

// Module dependencies
var crypto = require('crypto'),
  mongoose = require('mongoose'),
  MongooseSchema = mongoose.Schema,
  uniqueValidator = require('mongoose-unique-validator'),
  validator = require('validator'),
  generatePassword = require('generate-password'),
  owasp = require('owasp-password-strength-test'),
  config = require('../../../../config/config'),
  Role = require('../../../roles/server/models/roles.server.model').Schema,
  commonValidators = require('../../../core/server/controllers/validators.server.controller');

owasp.config(config.shared.owasp);

// A Validation function for local strategy email
var validateEmail = function (email) {
  return (validator.isEmail(email, { require_tld: false }));
};

var validateUsername = function (username) {
  var usernameRegex = /^(?=[\w.-]+$)(?!.*[._-]{2})(?!\.)(?!.*\.$).{3,34}$/;
  return ((username && usernameRegex.test(username)
    && config.illegalUsernames.indexOf(username) < 0)
  );
};

var permissionSchema = new MongooseSchema({
  _id: false,
  resources: {
    type: String,
    trim: true,
    required: false
  },
  allResourceMethods: {
    type: String,
    required: false
  },
  userCreatedResourceMethods: {
    type: String,
    required: false
  }
});

var FilterSchema = new MongooseSchema({
  name: {
    type: String,
    trim: true,
    required: true,
    validate: commonValidators.normalNameValidator
  },
  artifactType: {
    type: String,
    required: true,
    enum: ['deployment', 'booking', 'statistic']
  },
  parameters: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  }
});

var UserSchema = new MongooseSchema({
  firstName: {
    type: String,
    trim: true,
    default: '',
    required: 'Please fill in a first name'
  },
  lastName: {
    type: String,
    trim: true,
    default: '',
    required: 'Please fill in a last name'
  },
  displayName: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    index: {
      unique: true,
      sparse: true // For this to work on a previously indexed field, the index must be dropped & the application restarted.
    },
    lowercase: true,
    trim: true,
    default: '',
    validate: [validateEmail, 'Please fill in a valid email address']
  },
  username: {
    type: String,
    unique: 'Username already exists',
    required: 'Please fill in a username',
    validate: [validateUsername, 'Please enter a valid username: 3+ characters long, non restricted word, characters "_-.", no ' +
    'consecutive dots, does not begin or end with dots, letters a-z and numbers 0-9.'],
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    default: ''
  },
  salt: {
    type: String
  },
  userRoles: {
    type: [{
      type: MongooseSchema.ObjectId,
      ref: 'Role'
    }]
  },
  updated: {
    type: Date
  },
  created: {
    type: Date,
    default: Date.now
  },
  filters: {
    type: [FilterSchema],
    required: false
  },
  area_id: {
    type: MongooseSchema.ObjectId,
    ref: 'Area',
    required: false
  },
  permissions: {
    type: [permissionSchema]
  }
});

UserSchema.plugin(uniqueValidator, { message: 'Error, provided {PATH} is not unique.' });

/**
 * Hook a pre save method to hash the password
 */
UserSchema.pre('save', async function (next) {
  if (this.password && this.isModified('password')) {
    this.salt = crypto.randomBytes(16).toString('base64');
    this.password = this.hashPassword(this.password);
  }
  if (this.userRoles === undefined || this.userRoles.length === 0) {
    var userRole = await Role.findOne({ name: 'user' });
    this.userRoles = [userRole];
  }
  next();
});

/**
 * Create instance method for hashing a password
 */
UserSchema.methods.hashPassword = function (password) {
  if (this.salt && password) {
    return crypto.pbkdf2Sync(password, Buffer.from(this.salt, 'base64'), 10000, 64, 'SHA1').toString('base64');
  }
  return password;
};

/**
 * Create instance method for authenticating user
 */
UserSchema.methods.authenticate = function (password) {
  return this.password === this.hashPassword(password);
};

/**
* Generates a random passphrase that passes the owasp test
* Returns a promise that resolves with the generated passphrase, or rejects with an error if something goes wrong.
* NOTE: Passphrases are only tested against the required owasp strength tests, and not the optional tests.
*/
UserSchema.statics.generateRandomPassphrase = function () {
  return new Promise(function (resolve, reject) {
    var password = '';
    var repeatingCharacters = new RegExp('(.)\\1{2,}', 'g');

    // iterate until the we have a valid passphrase
    // NOTE: Should rarely iterate more than once, but we need this to ensure no repeating characters are present
    while (password.length < 20 || repeatingCharacters.test(password)) {
      // build the random password
      password = generatePassword.generate({
        length: Math.floor(Math.random() * (20)) + 20, // randomize length between 20 and 40 characters
        numbers: true,
        symbols: false,
        uppercase: true,
        excludeSimilarCharacters: true
      });

      // check if we need to remove any repeating characters
      password = password.replace(repeatingCharacters, '');
    }

    // Send the rejection back if the passphrase fails to pass the strength test
    if (owasp.test(password).errors.length) {
      reject(new Error('An unexpected problem occured while generating the random passphrase'));
    } else {
      // resolve with the validated passphrase
      resolve(password);
    }
  });
};

module.exports.Schema = mongoose.model('User', UserSchema);

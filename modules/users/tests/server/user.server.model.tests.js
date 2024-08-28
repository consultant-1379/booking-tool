'use strict';

/**
 * Module dependencies.
 */
var fs = require('fs');
var should = require('should'),
  mongoose = require('mongoose'),
  User = mongoose.model('User'),
  Area = require('../../../areas/server/models/areas.server.model').Schema,
  Program = require('../../../programs/server/models/programs.server.model').Schema,
  Role = require('../../../roles/server/models/roles.server.model').Schema,
  config = require('../../../../config/config');

/**
 * Globals
 */
var user1,
  user2,
  user3,
  validArea,
  areaObject,
  validProgram,
  programObject,
  validUserRole,
  validAdminRole,
  validSuperAdminRole,
  roleSuperAdmObject,
  roleAdminObject,
  roleUserObject;

/**
 * Unit tests
 */
describe('User Model Unit Tests:', function () {
  before(async function () {
    user1 = {
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test@test.com',
      username: 'username',
      password: 'M3@n.jsI$Aw3$0m3',
      provider: 'local'
    };
    // user2 is a clone of user1
    user2 = user1;
    user3 = {
      firstName: 'Different',
      lastName: 'User',
      displayName: 'Full Different Name',
      email: 'test3@test.com',
      username: 'different_username',
      password: 'Different_Password1!',
      provider: 'local'
    };
    validArea = JSON.parse(fs.readFileSync('/opt/mean.js/modules/areas/tests/server/test_files/valid_area.json', 'utf8'));
    validProgram = JSON.parse(fs.readFileSync('/opt/mean.js/modules/programs/tests/server/test_files/valid_program.json', 'utf8'));

    // Create Program Object
    programObject = new Program(validProgram);
    await programObject.save();

    // Create Area Object with valid program_id
    validArea.program_id = programObject._id;
    areaObject = new Area(validArea);
    await areaObject.save();
  });

  beforeEach(async function () {
    validUserRole = JSON.parse(fs.readFileSync('/opt/mean.js/modules/roles/tests/server/test_files/valid_user_role.json', 'utf8'));
    validAdminRole = JSON.parse(fs.readFileSync('/opt/mean.js/modules/roles/tests/server/test_files/valid_admin_role.json', 'utf8'));
    validSuperAdminRole = JSON.parse(fs.readFileSync('/opt/mean.js/modules/roles/tests/server/test_files/valid_super_admin_role.json', 'utf8'));
    roleSuperAdmObject = new Role(validSuperAdminRole);
    roleAdminObject = new Role(validAdminRole);
    roleUserObject = new Role(validUserRole);
    await roleSuperAdmObject.save();
    await roleAdminObject.save();
    await roleUserObject.save();
  });

  describe('Method Save', function () {
    it('should begin with no users', function (done) {
      User.find({}, function (err, users) {
        users.should.have.length(0);
        done();
      });
    });

    it('should be able to save without problems', function (done) {
      var _user1 = new User(user1);

      _user1.save(function (err) {
        should.not.exist(err);
        _user1.remove(function (err) {
          should.not.exist(err);
          done();
        });
      });
    });

    it('should fail to save an existing user again', function (done) {
      var _user1 = new User(user1);
      var _user2 = new User(user2);

      _user1.save(function (err) {
        should.not.exist(err);
        _user2.save(function (err) {
          should.exist(err);
          _user1.remove(function (err) {
            should.not.exist(err);
            done();
          });
        });
      });
    });

    it('should be able to show an error when trying to save without first name', function (done) {
      var _user1 = new User(user1);

      _user1.firstName = '';
      _user1.save(function (err) {
        should.exist(err);
        done();
      });
    });

    it('should update an existing user with valid roles without problems', function (done) {
      var _user1 = new User(user1);

      _user1.save(function (err) {
        should.not.exist(err);
        _user1.userRoles = [roleUserObject._id, roleAdminObject._id];
        _user1.save(function (err) {
          should.not.exist(err);
          _user1.remove(function (err) {
            should.not.exist(err);
            done();
          });
        });
      });
    });

    it('should set user role to user when trying to update an existing user without a role', function (done) {
      var _user1 = new User(user1);

      _user1.save(function (err) {
        should.not.exist(err);
        _user1.userRoles = [];
        _user1.save(function (err) {
          _user1.userRoles.length.should.equal(1);
          _user1.userRoles[0].name.should.equal('user');
          _user1.remove(function (err) {
            should.not.exist(err);
            done();
          });
        });
      });
    });

    it('should be able to show an error when trying to update an existing user with a invalid role', function (done) {
      var _user1 = new User(user1);

      _user1.save(function (err) {
        should.not.exist(err);
        _user1.userRoles = ['invalid-role-object-id'];
        _user1.save(function (err) {
          should.exist(err);
          _user1.remove(function (err) {
            should.not.exist(err);
            done();
          });
        });
      });
    });

    it('should update an existing user with valid area without problems', async function () {
      var _user1 = new User(user1);

      _user1.save(function (err) {
        should.not.exist(err);
        _user1.area_id = areaObject._id;
        _user1.save(function (err) {
          should.not.exist(err);
          _user1.remove(function (err) {
            should.not.exist(err);
          });
        });
      });
      await Area.remove().exec();
      await Program.remove().exec();
    });

    it('should confirm that saving user model doesnt change the password', function (done) {
      var _user1 = new User(user1);

      _user1.save(function (err) {
        should.not.exist(err);
        var passwordBefore = _user1.password;
        _user1.firstName = 'test';
        _user1.save(function () {
          var passwordAfter = _user1.password;
          passwordBefore.should.equal(passwordAfter);
          _user1.remove(function (err) {
            should.not.exist(err);
            done();
          });
        });
      });
    });

    it('should be able to save 2 different users', function (done) {
      var _user1 = new User(user1);
      var _user3 = new User(user3);

      _user1.save(function (err) {
        should.not.exist(err);
        _user3.save(function (err) {
          should.not.exist(err);
          _user3.remove(function (err) {
            should.not.exist(err);
            _user1.remove(function (err) {
              should.not.exist(err);
              done();
            });
          });
        });
      });
    });

    it('should not be able to save another user with the same email address', function (done) {
      // Test may take some time to complete due to db operations
      this.timeout(10000);

      var _user1 = new User(user1);
      var _user3 = new User(user3);

      _user1.save(function (err) {
        should.not.exist(err);
        _user3.email = _user1.email;
        _user3.save(function (err) {
          should.exist(err);
          _user1.remove(function (err) {
            should.not.exist(err);
            done();
          });
        });
      });
    });

    it('should not index missing email field, thus not enforce the model\'s unique index', function (done) {
      var _user1 = new User(user1);
      _user1.email = undefined;

      var _user3 = new User(user3);
      _user3.email = undefined;

      _user1.save(function (err) {
        should.not.exist(err);
        _user3.save(function (err) {
          should.not.exist(err);
          _user3.remove(function (err) {
            should.not.exist(err);
            _user1.remove(function (err) {
              should.not.exist(err);
              done();
            });
          });
        });
      });
    });

    it('should not save the password in plain text', function (done) {
      var _user1 = new User(user1);
      var passwordBeforeSave = _user1.password;
      _user1.save(function (err) {
        should.not.exist(err);
        _user1.password.should.not.equal(passwordBeforeSave);
        _user1.remove(function (err) {
          should.not.exist(err);
          done();
        });
      });
    });

    it('should not save the passphrase in plain text', function (done) {
      var _user1 = new User(user1);
      _user1.password = 'Open-Source Full-Stack Solution for MEAN';
      var passwordBeforeSave = _user1.password;
      _user1.save(function (err) {
        should.not.exist(err);
        _user1.password.should.not.equal(passwordBeforeSave);
        _user1.remove(function (err) {
          should.not.exist(err);
          done();
        });
      });
    });
  });

  describe('User E-mail Validation Tests', function () {
    it('should not allow invalid email address - "123"', function (done) {
      var _user1 = new User(user1);

      _user1.email = '123';
      _user1.save(function (err) {
        if (!err) {
          _user1.remove(function (errRemove) {
            should.exist(err);
            should.not.exist(errRemove);
            done();
          });
        } else {
          should.exist(err);
          done();
        }
      });
    });

    it('should not allow invalid email address - "123@123@123"', function (done) {
      var _user1 = new User(user1);

      _user1.email = '123@123@123';
      _user1.save(function (err) {
        if (!err) {
          _user1.remove(function (errRemove) {
            should.exist(err);
            should.not.exist(errRemove);
            done();
          });
        } else {
          should.exist(err);
          done();
        }
      });
    });

    it('should not allow invalid email address - "123@123"', function (done) {
      var _user1 = new User(user1);

      _user1.email = '123@123';
      _user1.save(function (err) {
        if (!err) {
          _user1.remove(function (errRemove) {
            should.exist(err);
            should.not.exist(errRemove);
            done();
          });
        } else {
          should.exist(err);
          done();
        }
      });
    });

    it('should not allow invalid email address - "123.com"', function (done) {
      var _user1 = new User(user1);

      _user1.email = '123.com';
      _user1.save(function (err) {
        if (!err) {
          _user1.remove(function (errRemove) {
            should.exist(err);
            should.not.exist(errRemove);
            done();
          });
        } else {
          should.exist(err);
          done();
        }
      });
    });

    it('should not allow invalid email address - "@123.com"', function (done) {
      var _user1 = new User(user1);

      _user1.email = '@123.com';
      _user1.save(function (err) {
        if (!err) {
          _user1.remove(function (errRemove) {
            should.exist(err);
            should.not.exist(errRemove);
            done();
          });
        } else {
          should.exist(err);
          done();
        }
      });
    });

    it('should not allow invalid email address - "abc@abc@abc.com"', function (done) {
      var _user1 = new User(user1);

      _user1.email = 'abc@abc@abc.com';
      _user1.save(function (err) {
        if (!err) {
          _user1.remove(function (errRemove) {
            should.exist(err);
            should.not.exist(errRemove);
            done();
          });
        } else {
          should.exist(err);
          done();
        }
      });
    });

    it('should not allow invalid characters in email address - "abc~@#$%^&*()ef=@abc.com"', function (done) {
      var _user1 = new User(user1);

      _user1.email = 'abc~@#$%^&*()ef=@abc.com';
      _user1.save(function (err) {
        if (!err) {
          _user1.remove(function (errRemove) {
            should.exist(err);
            should.not.exist(errRemove);
            done();
          });
        } else {
          should.exist(err);
          done();
        }
      });
    });

    it('should not allow space characters in email address - "abc def@abc.com"', function (done) {
      var _user1 = new User(user1);

      _user1.email = 'abc def@abc.com';
      _user1.save(function (err) {
        if (!err) {
          _user1.remove(function (errRemove) {
            should.exist(err);
            should.not.exist(errRemove);
            done();
          });
        } else {
          should.exist(err);
          done();
        }
      });
    });

    it('should not allow doudble quote characters in email address - "abc"def@abc.com"', function (done) {
      var _user1 = new User(user1);

      _user1.email = 'abc"def@abc.com';
      _user1.save(function (err) {
        if (err) {
          _user1.remove(function (errRemove) {
            should.exist(err);
            should.not.exist(errRemove);
            done();
          });
        } else {
          should.exist(err);
          done();
        }
      });
    });

    it('should not allow double dotted characters in email address - "abcdef@abc..com"', function (done) {
      var _user1 = new User(user1);

      _user1.email = 'abcdef@abc..com';
      _user1.save(function (err) {
        if (err) {
          _user1.remove(function (errRemove) {
            should.exist(err);
            should.not.exist(errRemove);
            done();
          });
        } else {
          should.exist(err);
          done();
        }
      });
    });

    it('should allow single quote characters in email address - "abc\'def@abc.com"', function (done) {
      var _user1 = new User(user1);

      _user1.email = 'abc\'def@abc.com';
      _user1.save(function (err) {
        if (!err) {
          _user1.remove(function (errRemove) {
            should.not.exist(err);
            should.not.exist(errRemove);
            done();
          });
        } else {
          should.not.exist(err);
          done();
        }
      });
    });

    it('should allow valid email address - "abc@abc.com"', function (done) {
      var _user1 = new User(user1);

      _user1.email = 'abc@abc.com';
      _user1.save(function (err) {
        if (!err) {
          _user1.remove(function (errRemove) {
            should.not.exist(err);
            should.not.exist(errRemove);
            done();
          });
        } else {
          should.not.exist(err);
          done();
        }
      });
    });

    it('should allow valid email address - "abc+def@abc.com"', function (done) {
      var _user1 = new User(user1);

      _user1.email = 'abc+def@abc.com';
      _user1.save(function (err) {
        if (!err) {
          _user1.remove(function (errRemove) {
            should.not.exist(err);
            should.not.exist(errRemove);
            done();
          });
        } else {
          should.not.exist(err);
          done();
        }
      });
    });

    it('should allow valid email address - "abc.def@abc.com"', function (done) {
      var _user1 = new User(user1);

      _user1.email = 'abc.def@abc.com';
      _user1.save(function (err) {
        if (!err) {
          _user1.remove(function (errRemove) {
            should.not.exist(err);
            should.not.exist(errRemove);
            done();
          });
        } else {
          should.not.exist(err);
          done();
        }
      });
    });

    it('should allow valid email address - "abc.def@abc.def.com"', function (done) {
      var _user1 = new User(user1);

      _user1.email = 'abc.def@abc.def.com';
      _user1.save(function (err) {
        if (!err) {
          _user1.remove(function (errRemove) {
            should.not.exist(err);
            should.not.exist(errRemove);
            done();
          });
        } else {
          should.not.exist(err);
          done();
        }
      });
    });

    it('should allow valid email address - "abc-def@abc.com"', function (done) {
      var _user1 = new User(user1);

      _user1.email = 'abc-def@abc.com';
      _user1.save(function (err) {
        should.not.exist(err);
        if (!err) {
          _user1.remove(function (errRemove) {
            should.not.exist(errRemove);
            done();
          });
        } else {
          done();
        }
      });
    });
  });

  afterEach(async function () {
    await User.remove().exec();
    await Role.remove().exec();
  });
});

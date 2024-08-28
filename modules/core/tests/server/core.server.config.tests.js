'use strict';

/**
 * Module dependencies.
 */
var fs = require('fs');
var chai = require('chai'),
  chaiHttp = require('chai-http'),
  expect = chai.expect,
  _ = require('lodash'),
  should = require('should'),
  mongoose = require('mongoose'),
  superagentDefaults = require('superagent-defaults'),
  supertest = require('supertest'),
  semver = require('semver'),
  sinon = require('sinon'),
  requestPromise = require('request-promise'),
  Booking = require('../../../bookings/server/models/bookings.server.model').Schema,
  Deployment = require('../../../deployments/server/models/deployments.server.model').Schema,
  User = require('../../../users/server/models/user.server.model').Schema,
  Role = require('../../../roles/server/models/roles.server.model').Schema,
  Program = require('../../../programs/server/models/programs.server.model').Schema,
  ProductFlavour = require('../../../product_flavours/server/models/product_flavours.server.model').Schema,
  ProductType = require('../../../product_types/server/models/product_types.server.model').Schema,
  Area = require('../../../areas/server/models/areas.server.model').Schema,
  Team = require('../../../teams/server/models/teams.server.model').Schema,
  ProgramHistory = require('../../../history/server/models/history.server.model').getSchema('programs'),
  AreaHistory = require('../../../history/server/models/history.server.model').getSchema('areas'),
  TeamHistory = require('../../../history/server/models/history.server.model').getSchema('teams'),
  HistoryDeployments = require('../../../history/server/models/history.server.model.js').getSchema('deployments'),
  config = require('../../../.././config/config'),
  logger = require('../../../../config/lib/logger'),
  seed = require('../../../../config/lib/seed'),
  express = require('../../../../config/lib/express'),
  teamInventoryToolUrl = process.env.TEAM_INVENTORY_TOOL_URL;
require('sinon-mongoose');

var app,
  agent,
  nonAuthAgent,
  area,
  validArea,
  validUser,
  validBooking,
  program,
  validProgram,
  validProductFlavour,
  productFlavour,
  validProductType,
  productType,
  validDeploymentProduct,
  deployment,
  validDeployment,
  validTeam,
  team,
  userObject,
  user1,
  admin1,
  userFromSeedConfig,
  adminFromSeedConfig,
  originalLogConfig,
  validUserRole,
  validAdminRole,
  validSuperAdminRole,
  roleSuperAdmObject,
  roleAdminObject,
  roleUserObject,
  response;

describe('Configuration Tests:', function () {
  describe('Testing default seedDB', function () {
    before(function (done) {
      User.remove(function (err) {
        should.not.exist(err);

        user1 = JSON.parse(fs.readFileSync('/opt/mean.js/modules/core/tests/server/test_files/user1.json', 'utf8'));
        admin1 = JSON.parse(fs.readFileSync('/opt/mean.js/modules/core/tests/server/test_files/admin1.json', 'utf8'));

        userFromSeedConfig = config.seedDB.options.seedUser;
        adminFromSeedConfig = config.seedDB.options.seedAdmin;

        return done();
      });
    });

    after(function (done) {
      User.remove(function (err) {
        should.not.exist(err);
        return done();
      });
    });

    it('should have seedDB configuration set for "regular" user', function () {
      (typeof userFromSeedConfig).should.not.equal('undefined');
      should.exist(userFromSeedConfig.username);
      should.exist(userFromSeedConfig.email);
    });

    it('should have seedDB configuration set for admin user', function () {
      (typeof adminFromSeedConfig).should.not.equal('undefined');
      should.exist(adminFromSeedConfig.username);
      should.exist(adminFromSeedConfig.email);
    });

    it('should not be an admin user to begin with', function (done) {
      User.find({ username: 'seedadmin' }, function (err, users) {
        should.not.exist(err);
        users.should.be.instanceof(Array).and.have.lengthOf(0);
        return done();
      });
    });

    it('should not be a "regular" user to begin with', function (done) {
      User.find({ username: 'seeduser' }, function (err, users) {
        should.not.exist(err);
        users.should.be.instanceof(Array).and.have.lengthOf(0);
        return done();
      });
    });

    it('should seed ONLY the admin user account when NODE_ENV is set to "production"', function (done) {
      // Save original value
      var nodeEnv = process.env.NODE_ENV;
      // Set node env to production environment
      process.env.NODE_ENV = 'production';

      User.find({ username: adminFromSeedConfig.username }, function (err, users) {
        // There shouldn't be any errors
        should.not.exist(err);
        users.should.be.instanceof(Array).and.have.lengthOf(0);

        seed
          .start({ logResults: false })
          .then(function () {
            User.find({ username: adminFromSeedConfig.username }, function (err, users) {
              should.not.exist(err);
              users.should.be.instanceof(Array).and.have.lengthOf(1);

              var _admin = users.pop();
              _admin.username.should.equal(adminFromSeedConfig.username);

              // Restore original NODE_ENV environment variable
              process.env.NODE_ENV = nodeEnv;

              User.remove(function (err) {
                should.not.exist(err);
                return done();
              });
            });
          });
      });
    });

    it('should seed admin, and "regular" user accounts when NODE_ENV is set to "test"', function (done) {
      // Save original value
      var nodeEnv = process.env.NODE_ENV;
      // Set node env ro production environment
      process.env.NODE_ENV = 'test';

      User.find({ username: adminFromSeedConfig.username }, function (err, users) {
        // There shouldn't be any errors
        should.not.exist(err);
        users.should.be.instanceof(Array).and.have.lengthOf(0);

        seed
          .start({ logResults: false })
          .then(function () {
            User.find({ username: adminFromSeedConfig.username }, function (err, users) {
              should.not.exist(err);
              users.should.be.instanceof(Array).and.have.lengthOf(1);

              var _admin = users.pop();
              _admin.username.should.equal(adminFromSeedConfig.username);

              User.find({ username: userFromSeedConfig.username }, function (err, users) {
                should.not.exist(err);
                users.should.be.instanceof(Array).and.have.lengthOf(1);

                var _user = users.pop();
                _user.username.should.equal(userFromSeedConfig.username);

                // Restore original NODE_ENV environment variable
                process.env.NODE_ENV = nodeEnv;

                User.remove(function (err) {
                  should.not.exist(err);
                  return done();
                });
              });
            });
          });
      });
    });

    it('should seed admin, and "regular" user accounts when NODE_ENV is set to "test" when they already exist', function (done) {
      // Save original value
      var nodeEnv = process.env.NODE_ENV;
      // Set node env ro production environment
      process.env.NODE_ENV = 'test';

      var _user = new User(userFromSeedConfig);
      var _admin = new User(adminFromSeedConfig);

      _admin.save(function (err) {
        // There shouldn't be any errors
        should.not.exist(err);
        _user.save(function (err) {
          // There shouldn't be any errors
          should.not.exist(err);

          User.find({ username: { $in: [adminFromSeedConfig.username, userFromSeedConfig.username] } }, function (err, users) {
            // There shouldn't be any errors
            should.not.exist(err);
            users.should.be.instanceof(Array).and.have.lengthOf(2);

            seed
              .start({ logResults: false })
              .then(function () {
                User.find({ username: { $in: [adminFromSeedConfig.username, userFromSeedConfig.username] } }, function (err, users) {
                  should.not.exist(err);
                  users.should.be.instanceof(Array).and.have.lengthOf(2);

                  // Restore original NODE_ENV environment variable
                  process.env.NODE_ENV = nodeEnv;

                  User.remove(function (err) {
                    should.not.exist(err);
                    return done();
                  });
                });
              });
          });
        });
      });
    });

    it('should ONLY seed admin user account when NODE_ENV is set to "production" with custom admin', function (done) {
      // Save original value
      var nodeEnv = process.env.NODE_ENV;
      // Set node env ro production environment
      process.env.NODE_ENV = 'production';

      User.find({ username: admin1.username }, function (err, users) {
        // There shouldn't be any errors
        should.not.exist(err);
        users.should.be.instanceof(Array).and.have.lengthOf(0);

        seed
          .start({ logResults: false, seedAdmin: admin1 })
          .then(function () {
            User.find({ username: admin1.username }, function (err, users) {
              should.not.exist(err);
              users.should.be.instanceof(Array).and.have.lengthOf(1);

              var _admin = users.pop();
              _admin.username.should.equal(admin1.username);

              // Restore original NODE_ENV environment variable
              process.env.NODE_ENV = nodeEnv;

              User.remove(function (err) {
                should.not.exist(err);
                return done();
              });
            });
          });
      });
    });

    it('should seed admin, and "regular" user accounts when NODE_ENV is set to "test" with custom options', function (done) {
      // Save original value
      var nodeEnv = process.env.NODE_ENV;
      // Set node env ro production environment
      process.env.NODE_ENV = 'test';

      User.find({ username: admin1.username }, function (err, users) {
        // There shouldn't be any errors
        should.not.exist(err);
        users.should.be.instanceof(Array).and.have.lengthOf(0);

        seed
          .start({ logResults: false, seedAdmin: admin1, seedUser: user1 })
          .then(function () {
            User.find({ username: admin1.username }, function (err, users) {
              should.not.exist(err);
              users.should.be.instanceof(Array).and.have.lengthOf(1);

              var _admin = users.pop();
              _admin.username.should.equal(admin1.username);

              User.find({ username: user1.username }, function (err, users) {
                should.not.exist(err);
                users.should.be.instanceof(Array).and.have.lengthOf(1);

                var _user = users.pop();
                _user.username.should.equal(user1.username);

                // Restore original NODE_ENV environment variable
                process.env.NODE_ENV = nodeEnv;

                User.remove(function (err) {
                  should.not.exist(err);
                  return done();
                });
              });
            });
          });
      });
    });

    it('should NOT seed admin user account if it already exists when NODE_ENV is set to "production"', function (done) {
      // Save original value
      var nodeEnv = process.env.NODE_ENV;
      // Set node env ro production environment
      process.env.NODE_ENV = 'production';

      var _admin = new User(adminFromSeedConfig);

      _admin.save(function (err, user) {
        // There shouldn't be any errors
        should.not.exist(err);
        user.username.should.equal(adminFromSeedConfig.username);

        seed
          .start({ logResults: false })
          .then(function () {
            // we don't ever expect to make it here but we don't want to timeout
            User.remove(function (err) {
              should.not.exist(err);
              // force this test to fail since we should never be here
              should.exist(undefined);
              // Restore original NODE_ENV environment variable
              process.env.NODE_ENV = nodeEnv;

              return done();
            });
          })
          .catch(function (err) {
            should.exist(err);
            err.message.should.equal('Failed due to local account already exists: ' + adminFromSeedConfig.username);

            // Restore original NODE_ENV environment variable
            process.env.NODE_ENV = nodeEnv;

            User.remove(function (removeErr) {
              should.not.exist(removeErr);

              return done();
            });
          });
      });
    });

    it('should NOT seed "regular" user account if missing email when NODE_ENV set to "test"', function (done) {
      // Save original value
      var nodeEnv = process.env.NODE_ENV;
      // Set node env ro test environment
      process.env.NODE_ENV = 'test';

      var _user = new User(user1);
      _user.email = '';

      seed
        .start({ logResults: false, seedUser: _user })
        .then(function () {
          // we don't ever expect to make it here but we don't want to timeout
          User.remove(function () {
            // force this test to fail since we should never be here
            should.exist(undefined);
            // Restore original NODE_ENV environment variable
            process.env.NODE_ENV = nodeEnv;

            return done();
          });
        })
        .catch(function (err) {
          should.exist(err);
          err.message.should.equal('Failed to add local ' + user1.username);

          // Restore original NODE_ENV environment variable
          process.env.NODE_ENV = nodeEnv;

          User.remove(function (removeErr) {
            should.not.exist(removeErr);

            return done();
          });
        });
    });
  });

  describe('Testing Session Secret Configuration', function () {
    it('should warn if using default session secret when running in production', function (done) {
      var conf = { sessionSecret: 'MEAN' };
      // set env to production for this test
      process.env.NODE_ENV = 'production';
      config.utils.validateSessionSecret(conf, true).should.equal(false);
      // set env back to test
      process.env.NODE_ENV = 'test';
      return done();
    });

    it('should accept non-default session secret when running in production', function () {
      var conf = { sessionSecret: 'super amazing secret' };
      // set env to production for this test
      process.env.NODE_ENV = 'production';
      config.utils.validateSessionSecret(conf, true).should.equal(true);
      // set env back to test
      process.env.NODE_ENV = 'test';
    });

    it('should accept default session secret when running in development', function () {
      var conf = { sessionSecret: 'MEAN' };
      // set env to development for this test
      process.env.NODE_ENV = 'development';
      config.utils.validateSessionSecret(conf, true).should.equal(true);
      // set env back to test
      process.env.NODE_ENV = 'test';
    });

    it('should accept default session secret when running in test', function () {
      var conf = { sessionSecret: 'MEAN' };
      config.utils.validateSessionSecret(conf, true).should.equal(true);
    });
  });

  describe('Testing Logger Configuration', function () {
    beforeEach(function () {
      originalLogConfig = _.clone(config.log, true);
    });

    afterEach(function () {
      config.log = originalLogConfig;
    });

    it('should retrieve the log format from the logger configuration', function () {
      config.log = {
        format: 'tiny'
      };

      var format = logger.getLogFormat();
      format.should.be.equal('tiny');
    });

    it('should retrieve the log options from the logger configuration for a valid stream object', function () {
      var options = logger.getMorganOptions();

      options.should.be.instanceof(Object);
      options.should.have.property('stream');
    });

    it('should verify that a file logger object was created using the logger configuration', function () {
      var _dir = process.cwd();
      var _filename = 'unit-test-access.log';

      config.log = {
        fileLogger: {
          directoryPath: _dir,
          fileName: _filename
        }
      };

      var fileTransport = logger.getLogOptions(config);
      fileTransport.should.be.instanceof(Object);
      fileTransport.filename.should.equal(`${_dir}/${_filename}`);
    });

    it('should use the default log format of "combined" when an invalid format was provided', function () {
      var _logger = require('../../../../config/lib/logger'); // eslint-disable-line global-require

      // manually set the config log format to be invalid
      config.log = {
        format: '_some_invalid_format_'
      };

      var format = _logger.getLogFormat();
      format.should.be.equal('combined');
    });

    it('should not create a file transport object if critical options are missing: filename', function () {
      // manually set the config stream fileName option to an empty string
      config.log = {
        format: 'combined',
        options: {
          stream: {
            directoryPath: process.cwd(),
            fileName: ''
          }
        }
      };

      var fileTransport = logger.getLogOptions(config);
      fileTransport.should.be.false();
    });

    it('should not create a file transport object if critical options are missing: directory', function () {
      // manually set the config stream fileName option to an empty string
      config.log = {
        format: 'combined',
        options: {
          stream: {
            directoryPath: '',
            fileName: 'app.log'
          }
        }
      };

      var fileTransport = logger.getLogOptions(config);
      fileTransport.should.be.false();
    });
  });

  describe('Testing exposing environment as a variable to layout', function () {
    ['development', 'production', 'test'].forEach(function (env) {
      it('should expose environment set to ' + env, function (done) {
        // Set env to development for this test
        process.env.NODE_ENV = env;

        // Get application
        app = express.init(mongoose);
        agent = supertest.agent(app);

        // Get rendered layout
        agent.get('/')
          .expect('Content-Type', 'text/html; charset=utf-8')
          .expect(200)
          .end(function (err, res) {
            // Set env back to test
            process.env.NODE_ENV = 'test';
            // Handle errors
            if (err) {
              return done(err);
            }
            res.text.should.containEql('env = "' + env + '"');
            return done();
          });
      });
    });
  });

  describe('Testing GET /api/clearOldBookings', function () {
    before(async function () {
      validArea = JSON.parse(fs.readFileSync('/opt/mean.js/modules/areas/tests/server/test_files/valid_area.json', 'utf8'));
      validDeployment = JSON.parse(fs.readFileSync('/opt/mean.js/modules/deployments/tests/server/test_files/valid_deployment.json', 'utf8'));
      validBooking = JSON.parse(fs.readFileSync('/opt/mean.js/modules/bookings/tests/server/test_files/valid_booking.json', 'utf8'));
      validProgram = JSON.parse(fs.readFileSync('/opt/mean.js/modules/programs/tests/server/test_files/valid_program.json', 'utf8'));
      validProductFlavour = JSON.parse(fs.readFileSync('/opt/mean.js/modules/product_flavours/tests/server/test_files/valid_product_flavour.json', 'utf8'));
      validProductType = JSON.parse(fs.readFileSync('/opt/mean.js/modules/product_types/tests/server/test_files/valid_product_type.json', 'utf8'));
      validTeam = JSON.parse(fs.readFileSync('/opt/mean.js/modules/teams/tests/server/test_files/valid_team.json', 'utf8'));
      validDeploymentProduct = JSON.parse(fs.readFileSync('/opt/mean.js/modules/deployments/tests/server/test_files/valid_deployment_product.json', 'utf8'));
      validUser = JSON.parse(fs.readFileSync('/opt/mean.js/modules/users/tests/server/test_files/valid_user.json', 'utf8'));

      // Create a Program
      program = new Program(validProgram);
      await program.save();

      // Create an Area
      validArea.program_id = program._id;
      area = new Area(validArea);
      await area.save();

      // Create a Product-Flavour
      productFlavour = new ProductFlavour(validProductFlavour);
      await productFlavour.save();

      // Create a Product-Type and add the Product-Flavour to the list of valid flavours
      validProductType.name = 'uniqueName';
      validProductType.flavours.push(productFlavour.name);
      productType = new ProductType(validProductType);
      await productType.save();

      // Create a User
      userObject = new User(validUser);
      await userObject.save();

      // Create a Team
      validTeam.admin_IDs = [userObject._id];
      validTeam.area_id = area._id;
      team = new Team(validTeam);
      await team.save();

      // Add attributes to Deployment-Product
      validDeploymentProduct.product_type_name = productType.name;
      validDeploymentProduct.flavour_name = productType.flavours[0];
      validDeploymentProduct.admins_only = false;

      // Create Deployment
      validDeployment.name = 'uniqueDeployment';
      validDeployment.area_id = area._id;
      validDeployment.program_id = program._id;
      validDeployment.team_id = team._id;
      validDeployment.products = [validDeploymentProduct];
      deployment = new Deployment(validDeployment);
      await deployment.save();

      // Add attributes to the Booking
      validBooking.name = 'validBookingName';
      validBooking.deployment_id = deployment._id;
      validBooking.team_id = team._id;
      validBooking.startTime = '2020-04-01 00:00:00.000';
      validBooking.endTime = '2020-04-02 00:00:00.000';
      validBooking.isExpired = true;
      validBooking.product_id = deployment.products[0]._id;

      app = express.init(mongoose);
      agent = superagentDefaults(supertest(app));
    });

    it('should return success message when triggering cleanup for old Bookings', async function () {
      var response = await agent.get('/api/clearOldBookings').expect(200);
      expect(response.body.message).to.equal('Bookings cleared successfully');
    });

    it('should remove old Booking when triggering a cleanup', async function () {
      var booking = new Booking(validBooking);
      await booking.save();
      // get number of bookings
      var response = await agent.get('/api/bookings').expect(200);
      var arrayLength = response.body.length;
      response.body[0].deployment_id.should.be.equal(deployment._id.toString());
      response = await agent.get('/api/clearOldBookings').expect(200);
      expect(response.body.message).to.equal('Bookings cleared successfully');
      // wait for booking to be cleared
      response = await agent.get('/api/bookings').expect(200);
      response.body.should.be.instanceof(Array).and.have.lengthOf(arrayLength - 1);
    });
  });

  afterEach(async function () {
    await Role.remove().exec();
    await User.remove().exec();
  });
});

describe('Testing GET /api/clearOldDeletedLogs', function () {
  before(async function () {
    validArea = JSON.parse(fs.readFileSync('/opt/mean.js/modules/areas/tests/server/test_files/valid_area.json', 'utf8'));
    validDeployment = JSON.parse(fs.readFileSync('/opt/mean.js/modules/deployments/tests/server/test_files/valid_deployment.json', 'utf8'));
    validProgram = JSON.parse(fs.readFileSync('/opt/mean.js/modules/programs/tests/server/test_files/valid_program.json', 'utf8'));
    validUser = JSON.parse(fs.readFileSync('/opt/mean.js/modules/users/tests/server/test_files/valid_user.json', 'utf8'));
    validUserRole = JSON.parse(fs.readFileSync('/opt/mean.js/modules/roles/tests/server/test_files/valid_user_role.json', 'utf8'));

    roleUserObject = new Role(validUserRole);
    await roleUserObject.save();

    validUser.userRoles = [roleUserObject._id];
    userObject = new User(validUser);
    await userObject.save();

    // Create a Program
    program = new Program(validProgram);
    program.name = 'uniqueProgram1';
    await program.save();

    // Create an Area
    validArea.program_id = program._id;
    area = new Area(validArea);
    area.name = 'validArea1';
    await area.save();

    // Create Deployment
    validDeployment.name = 'uniqueDeployment1';
    validDeployment.area_id = area._id;
    validDeployment.program_id = program._id;
    deployment = new Deployment(validDeployment);
    await deployment.save();

    app = express.init(mongoose);
    agent = superagentDefaults(supertest(app));
  });

  it('should remove deleted deployment logs older than six months when triggering a cleanup', async function () {
    await agent.delete(`/api/deployments/${deployment._id}`).auth(validUser.username, validUser.password).expect(200);
    response = await agent.get('/api/logs/deployments').expect(200);
    var arrayLength = response.body.length;

    var sevenMonthsAgo = new Date();
    sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7);
    var deploymentLog = await HistoryDeployments.findOne({ associated_id: response.body[0].associated_id }).exec();
    deploymentLog.deletedAt = '2020-04-01 00:00:00.000';
    await deploymentLog.save();

    await agent.get('/api/clearOldDeletedLogs').expect(200);
    response = await agent.get('/api/logs/deployments').expect(200);
    response.body.should.be.instanceof(Array).and.have.lengthOf(arrayLength - 1);
  });

  afterEach(async function () {
    await Role.remove().exec();
    await User.remove().exec();
  });
});

describe('CORE API Functionality:', function () {
  before(async function () {
    app = express.init(mongoose);
    nonAuthAgent = superagentDefaults(supertest(app));
    agent = superagentDefaults(supertest(app));
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

    validUser = JSON.parse(fs.readFileSync('/opt/mean.js/modules/core/tests/server/test_files/dttUser.json', 'utf8'));
    validUser.userRoles = [roleAdminObject._id];
    userObject = new User(validUser);
    await userObject.save();
    agent.auth(validUser.username, validUser.password);
  });

  describe('GET /api/logintest', function () {
    it('should not authorize an non-logged-in user', async function () {
      response = await nonAuthAgent.get('/api/logintest').expect(401);
      var authorization = response.text;
      expect(typeof authorization).to.equal('string');
      expect(authorization).to.equal('Unauthorized');
    });
  });

  describe('GET /api/version', function () {
    it('should return the version of the tool', async function () {
      response = await nonAuthAgent.get('/api/version').expect(200);
      var version = response.text;
      expect(typeof version).to.equal('string');
      expect(semver.gt(version, '0.0.1')).to.equal(true);
    });
  });

  describe('GET /api/jiraIssueValidation', function () {
    it('should return valid true', async function () {
      response = await agent.get('/api/jiraIssueValidation/CIP-29798').expect(200);
      expect(response.body.valid).to.equal(true);
    });

    it(`should return team as ${(process.env.ISTEST) ? 'Testing Team' : 'None'}`, async function () {
      response = await agent.get('/api/jiraIssueValidation/ETTS-5838').expect(200);
      expect(response.body.valid).to.equal(true);
      expect(response.body.team).to.equal((process.env.ISTEST) ? 'Testing Team' : 'None');
    });

    it('should return valid false', async function () {
      response = await agent.get('/api/jiraIssueValidation/INVALID-12345').expect(200);
      expect(response.body.valid).to.equal(false);
    });

    it('should return 404 status when no JIRA Issue is provided', async function () {
      await agent.get('/api/jiraIssueValidation/').expect(404);
    });
  });

  describe('GET /:url(api|modules|lib)/*', function () {
    it('should return a 404 page when an invalid api object is requested', async function () {
      response = await agent.get('/api/invalid_object').expect(404);
      var htmlPage = response.text;
      expect(typeof htmlPage).to.equal('string');
      expect(htmlPage).to.contain('/api/invalid_object is not a valid path.');
    });
    it('should return a 404 page when an invalid modules object is requested', async function () {
      response = await agent.get('/modules/invalid_object').expect(404);
      var htmlPage = response.text;
      expect(typeof htmlPage).to.equal('string');
      expect(htmlPage).to.contain('/modules/invalid_object is not a valid path.');
    });
    it('should return a 404 page when an invalid lib object is requested', async function () {
      response = await agent.get('/lib/invalid_object').expect(404);
      var htmlPage = response.text;
      expect(typeof htmlPage).to.equal('string');
      expect(htmlPage).to.contain('/lib/invalid_object is not a valid path.');
    });
  });

  describe('GET /*', function () {
    it('should render index file', async function () {
      response = await agent.get('/any_string').expect(200);
      var htmlPage = response.text;
      expect(typeof htmlPage).to.equal('string');
      expect(htmlPage).to.contain('PDU OSS DTT</title>');
    });
  });

  describe('POST /api/updateAreasAndTeamsData', function () {
    beforeEach(async function () {
      userObject.userRoles = [roleSuperAdmObject._id];
      await userObject.save();
    });
    // Performed only during development mode
    if (!process.env.ISTEST) {
      it('should return error message when incorrect Team Inventory Tool URL is provided', async function () {
        // Setup
        process.env.TEAM_INVENTORY_TOOL_URL = 'fakeUrl';
        // Update RAs and Teams
        response = await agent.post('/api/updateAreasAndTeamsData').expect(422);
        response.body.message.should.containEql('Team Inventory Tool Request Error:');
        response.body.message.should.containEql('Invalid URI "fakeUrl/api/teams"');
      });

      it('should mock the error message when html is returned instead of JSON', async function () {
        // Setup
        sinon.mock(requestPromise).expects('get').returns('<!DOCTYPE html>');
        // Update RAs and Teams
        response = await agent.post('/api/updateAreasAndTeamsData').expect(401);
        response.body.message.should.equals('Team Inventory Tool Authorization Error.');
      });

      it('should return error message if error occurs during Team / RA Updates', async function () {
        // Setup
        sinon.mock(Program).expects('findOne').throws(new Error('Simulated Error.'));
        // Update RAs and Teams
        response = await agent.post('/api/updateAreasAndTeamsData').expect(200);
        response.body.message.should.containEql('Successfully updated RAs and Teams data with errors: ');
      });

      it('should return successful message and create teams', async function () {
        // Setup
        var newProgram = new Program({ name: 'ENM' });
        await newProgram.save();
        // Update RAs and Teams
        response = await agent.post('/api/updateAreasAndTeamsData').expect(200);
        response.body.message.should.equal('Successfully updated RAs and Teams data');
        // Get Teams
        response = await agent.get('/api/teams').expect(200);
        expect(response.body.length).to.be.above(0);
      });

      it('should successfully rename a team by using the Team Inventory Tool reference ID', async function () {
        this.timeout(15000);
        // Setup
        response = await agent.post('/api/programs').send({ name: 'ENM' }).expect(201);
        // Update RAs and Teams
        response = await agent.post('/api/updateAreasAndTeamsData').expect(200);
        response.body.message.should.equal('Successfully updated RAs and Teams data');
        // Get a Team
        response = await agent.get('/api/teams').expect(200);
        expect(response.body.length).to.be.above(0);
        var teamId = response.body[0]._id;
        var origTeamName = response.body[0].name;
        // Change its name
        var newTeamName = 'newTeamName';
        response = await agent.put(`/api/teams/${teamId}`).send({ name: newTeamName }).expect(200);
        response.body.name.should.equal(newTeamName);
        // Update RAs and Teams
        response = await agent.post('/api/updateAreasAndTeamsData').expect(200);
        response.body.message.should.equal('Successfully updated RAs and Teams data');
        // Check that teams name was set to correct value
        response = await agent.get(`/api/teams/${teamId}`).expect(200);
        response.body.name.should.equal(origTeamName);
        response.body.name.should.not.equal(newTeamName);
      });

      it('should successfully give the team a Team Inventory Tool reference ID if it has the same name', async function () {
        this.timeout(25000);
        // Setup
        response = await agent.post('/api/programs').send({ name: 'ENM' }).expect(201);
        // Update RAs and Teams
        response = await agent.post('/api/updateAreasAndTeamsData').expect(200);
        response.body.message.should.equal('Successfully updated RAs and Teams data');
        // Get a Team
        response = await agent.get('/api/teams').expect(200);
        expect(response.body.length).to.be.above(0);
        var teamId = response.body[0]._id;
        var teamRefId = response.body[0].tit_ref_id;
        // Remove its Reference ID
        response = await agent.put(`/api/teams/${teamId}`).send({ tit_ref_id: '' }).expect(200);
        response.body.tit_ref_id.should.equal('');
        // Update RAs and Teams
        response = await agent.post('/api/updateAreasAndTeamsData').expect(200);
        response.body.message.should.equal('Successfully updated RAs and Teams data');
        // Check that teams name was set to correct value
        response = await agent.get(`/api/teams/${teamId}`).expect(200);
        response.body.tit_ref_id.should.equal(teamRefId);
        response.body.tit_ref_id.should.not.equal(undefined);
      });
    }
    it('should not add any teams when the tool has no Programs', async function () {
      // Update RAs and Teams
      response = await agent.post('/api/updateAreasAndTeamsData').expect(200);
      response.body.message.should.equal('Successfully updated RAs and Teams data');
      // Get Teams
      response = await agent.get('/api/teams').expect(200);
      response.body.length.should.equal(0);
    });

    it('should not update Areas and Teams when user is not authenticated', async function () {
      response = await nonAuthAgent.post('/api/updateAreasAndTeamsData').expect(401);
      response.body.message.should.equal('User must be logged in');
    });

    it('should not update Areas and Teams when user is standard-user', async function () {
      userObject.userRoles = [roleUserObject._id];
      await userObject.save();
      response = await agent.post('/api/updateAreasAndTeamsData').expect(403);
      response.body.message.should.equal('User is not authorized');
    });

    it('should update Areas and Teams when user is standard-user with special permissions', async function () {
      userObject.userRoles = [roleAdminObject._id];
      userObject.permissions = { resources: '/updateAreasAndTeamsData', allResourceMethods: 'post', userCreatedResourceMethods: '' };
      await userObject.save();
      response = await agent.post('/api/updateAreasAndTeamsData').expect(200);
      response.body.message.should.equal('Successfully updated RAs and Teams data');
    });

    it('should update Areas and Teams when user is admin', async function () {
      userObject.userRoles = [roleAdminObject._id];
      await userObject.save();
      response = await agent.post('/api/updateAreasAndTeamsData').expect(200);
      response.body.message.should.equal('Successfully updated RAs and Teams data');
    });

    it('should update Areas and Teams when user is super-admin', async function () {
      userObject.userRoles = [roleSuperAdmObject._id];
      await userObject.save();
      response = await agent.post('/api/updateAreasAndTeamsData').expect(200);
      response.body.message.should.equal('Successfully updated RAs and Teams data');
    });
  });

  describe('GET /api/upgradeEmail', function () {
    it('should return 200', async function () {
      response = await agent.get('/api/upgradeEmail').expect(200);
    });
  });

  // api/toolNotifications for notification Banner
  describe('GET /api/toolnotifications', function () {
    it('should return 200', async function () {
      response = await agent.get('/api/toolnotifications').expect(200);
    });
  });

  afterEach(async function () {
    process.env.TEAM_INVENTORY_TOOL_URL = teamInventoryToolUrl;
    sinon.restore();
    await User.remove().exec();
    await ProgramHistory.remove().exec();
    await AreaHistory.remove().exec();
    await TeamHistory.remove().exec();
    await Program.remove().exec();
    await Area.remove().exec();
    await Team.remove().exec();
    await Role.remove().exec();
  });
});

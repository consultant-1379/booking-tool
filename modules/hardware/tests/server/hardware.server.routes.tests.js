'use strict';

var fs = require('fs');
var should = require('should'),
  superagentDefaults = require('superagent-defaults'),
  supertest = require('supertest'),
  mongoose = require('mongoose'),
  _ = require('lodash'),
  History = require('../../../history/server/models/history.server.model').getSchema('hardwares'),
  Hardware = require('../../server/models/hardware.server.model').Schema,
  Program = require('../../../programs/server/models/programs.server.model').Schema,
  Deployment = require('../../../deployments/server/models/deployments.server.model').Schema,
  User = require('../../../users/server/models/user.server.model').Schema,
  Role = require('../../../roles/server/models/roles.server.model').Schema,
  express = require('../../../../config/lib/express');

var app,
  agent,
  nonAuthAgent,
  validProgram,
  programObject,
  validHardware,
  badHardware,
  hardwareReturned,
  hardwareObject,
  validHardware2,
  hardware2Object,
  count,
  response,
  logReturned,
  validUser,
  userObject,
  validUserRole,
  validAdminRole,
  validSuperAdminRole,
  roleSuperAdmObject,
  roleAdminObject,
  roleUserObject;

describe('Hardware', function () {
  before(async function () {
    app = express.init(mongoose);
    nonAuthAgent = superagentDefaults(supertest(app));
    agent = superagentDefaults(supertest(app));
  });

  beforeEach(async function () {
    validProgram = JSON.parse(fs.readFileSync('/opt/mean.js/modules/programs/tests/server/test_files/valid_program.json', 'utf8'));
    validHardware = JSON.parse(fs.readFileSync('/opt/mean.js/modules/hardware/tests/server/test_files/valid_hardware.json', 'utf8'));
    validUser = JSON.parse(fs.readFileSync('/opt/mean.js/modules/users/tests/server/test_files/valid_user.json', 'utf8'));
    validUserRole = JSON.parse(fs.readFileSync('/opt/mean.js/modules/roles/tests/server/test_files/valid_user_role.json', 'utf8'));
    validAdminRole = JSON.parse(fs.readFileSync('/opt/mean.js/modules/roles/tests/server/test_files/valid_admin_role.json', 'utf8'));
    validSuperAdminRole = JSON.parse(fs.readFileSync('/opt/mean.js/modules/roles/tests/server/test_files/valid_super_admin_role.json', 'utf8'));

    roleSuperAdmObject = new Role(validSuperAdminRole)
    roleAdminObject = new Role(validAdminRole)
    roleUserObject = new Role(validUserRole)
    await roleSuperAdmObject.save();
    await roleAdminObject.save();
    await roleUserObject.save();

    // Create Program and set its ID as Hardware 'program_id' field
    programObject = new Program(validProgram);
    await programObject.save();
    validHardware.program_id = programObject._id;

    userObject = new User(validUser);
    await userObject.save();

    agent.auth(validUser.username, validUser.password); // Setup User Authorization
  });

  describe('POST', function () {
    it('should create a new Hardware and check db', async function () {
      response = await agent.post('/api/hardware').send(validHardware).expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/hardware/${response.body._id}`);
      response.body.name.should.equal(validHardware.name);
      hardwareReturned = await Hardware.findById(response.body._id).exec();
      hardwareReturned.name.should.equal(validHardware.name);
      should.exist(hardwareReturned.freeStartDate);
    });

    it('should not create a new Hardware when user is not authenticated', async function () {
      response = await nonAuthAgent.post('/api/hardware').send(validHardware).expect(401);
      response.body.message.should.equal('User must be logged in');
    });

    it('should create a new Hardware when user is standard-user', async function () {
      userObject.userRoles = [roleUserObject._id];
      await userObject.save();
      response = await agent.post('/api/hardware').auth(validUser.username, validUser.password).send(validHardware).expect(201);
    });

    it('should create a new Hardware when user is admin', async function () {
      userObject.userRoles = [roleAdminObject._id];
      await userObject.save();
      await agent.post('/api/hardware').auth(validUser.username, validUser.password).send(validHardware).expect(201);
    });

    it('should create a new Hardware when user is super-admin', async function () {
      userObject.userRoles = [roleSuperAdmObject._id];
      await userObject.save();
      await agent.post('/api/hardware').auth(validUser.username, validUser.password).send(validHardware).expect(201);
    });

    it('should not post more than one hardware with the same name', async function () {
      hardwareObject = new Hardware(validHardware);
      await hardwareObject.save();
      response = await agent.post('/api/hardware').send(validHardware).expect(400);
      response.body.message.should.equal('Error, provided name is not unique.');
    });

    it('should not post hardware with a name less than 2 characters', async function () {
      badHardware = _.cloneDeep(validHardware);
      badHardware.name = 'x';
      response = await agent.post('/api/hardware').send(badHardware).expect(400);
      response.body.message.should.equal('Path `name` (`' + badHardware.name + '`) is shorter than the minimum allowed length (2).');
    });

    it('should not post hardware with a name more than 50 characters', async function () {
      badHardware = _.cloneDeep(validHardware);
      badHardware.name = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      response = await agent.post('/api/hardware').send(badHardware).expect(400);
      response.body.message.should.equal('Path `name` (`' + badHardware.name + '`) is longer than the maximum allowed length (50).');
    });

    it('should not allow hardware with a non-alphanumeric-underscored name', async function () {
      badHardware = _.cloneDeep(validHardware);
      badHardware.name = '!£$%&';
      response = await agent.post('/api/hardware').send(badHardware).expect(400);
      response.body.message.should.equal('name is not valid; \'!£$%&\' can only contain letters, numbers, dots, dashes and underscores.');
    });

    it('should not post hardware without a name key', async function () {
      badHardware = _.cloneDeep(validHardware);
      delete badHardware.name;
      response = await agent.post('/api/hardware').send(badHardware).expect(400);
      response.body.message.should.equal('Path `name` is required.');
    });

    it('should not post hardware with unknown key', async function () {
      badHardware = _.cloneDeep(validHardware);
      badHardware.rogueKey = 'rogueValue';
      response = await agent.post('/api/hardware').send(badHardware).expect(400);
      response.body.message.should.equal('Field `rogueKey` is not in schema and strict mode is set to throw.');
    });

    it('should respond with bad request with invalid json', async function () {
      badHardware = '{';
      response = await agent.post('/api/hardware').send(badHardware).type('json').expect(400);
      response.body.message.should.equal('There was a syntax error found in your request, please make sure that it is valid and try again');
    });

    it('should post a new log with user-details when hardware is created by a logged-in user', async function () {
      response = await agent.post('/api/hardware').send(validHardware).expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/hardware/${response.body._id}`);
      response.body.name.should.equal(validHardware.name);
      hardwareReturned = await Hardware.findById(response.body._id).exec();
      hardwareReturned.name.should.equal(validHardware.name);

      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      logReturned.originalData.should.not.equal(undefined);
      logReturned.originalData.name.should.equal(validHardware.name);
      logReturned.createdAt.should.not.equal(undefined);
      logReturned.createdBy.should.not.equal(undefined);
      logReturned.createdBy.username.should.equal(validUser.username);
      logReturned.createdBy.email.should.equal(validUser.email);
      logReturned.updates.should.be.instanceof(Array).and.have.lengthOf(0);
    });
  });

  describe('GET', function () {
    beforeEach(async function () {
      hardwareObject = new Hardware(validHardware);
      await hardwareObject.save();
    });

    it('should be able to get empty hardware list', async function () {
      await hardwareObject.remove();
      response = await agent.get('/api/hardware').expect(200);
      response.body.should.be.instanceof(Array).and.have.lengthOf(0);
    });

    it('should be able to get hardware list when user not authenticated', async function () {
      await nonAuthAgent.get('/api/hardware').expect(200);
    });

    it('should be able to get hardware list when user is authenticated', async function () {
      await agent.get('/api/hardware').expect(200);
    });

    it('should be able to get hardware list with one element', async function () {
      response = await agent.get('/api/hardware').expect(200);
      response.body.should.be.instanceof(Array).and.have.lengthOf(1);
      response.body[0].name.should.equal(validHardware.name);
    });

    it('should be able to get hardware list with more than one element', async function () {
      validHardware2 = _.cloneDeep(validHardware);
      validHardware2.name = 'anotherHardwareName';
      hardware2Object = new Hardware(validHardware2);
      await hardware2Object.save();
      response = await agent.get('/api/hardware').expect(200);
      response.body.should.be.instanceof(Array).and.have.lengthOf(2);
      response.body[0].name.should.equal(validHardware2.name);
      response.body[1].name.should.deepEqual(validHardware.name);
    });

    it('should be able to get a single hardware', async function () {
      response = await agent.get(`/api/hardware/${hardwareObject._id}`).expect(200);
      response.body.name.should.equal(validHardware.name);
    });

    it('should be able to get single hardware when user not authenticated', async function () {
      await nonAuthAgent.get(`/api/hardware/${hardwareObject._id}`).expect(200);
    });

    it('should be able to get single hardware when user is authenticated', async function () {
      await agent.get(`/api/hardware/${hardwareObject._id}`).expect(200);
    });

    it('should throw 404 when id is not in database', async function () {
      response = await agent.get('/api/hardware/000000000000000000000000').expect(404);
      response.body.message.should.equal('A Hardware with that id does not exist');
    });

    it('should throw 404 when id is invalid in the database', async function () {
      response = await agent.get('/api/hardware/0').expect(404);
      response.body.message.should.equal('A Hardware with that id does not exist');
    });
  });

  describe('PUT', function () {
    beforeEach(async function () {
      hardwareObject = new Hardware(validHardware);
      await hardwareObject.save();
    });

    it('should update a Hardware', async function () {
      validHardware2 = _.cloneDeep(validHardware);
      validHardware2.name = 'updatedName';

      response = await agent.put(`/api/hardware/${hardwareObject._id}`).send(validHardware2).expect(200);
      response.body.name.should.equal(validHardware2.name);
    });

    it('should not update a Hardware when user is not authenticated', async function () {
      validHardware2 = _.cloneDeep(validHardware);
      validHardware2.name = 'updatedName';
      response = await nonAuthAgent.put(`/api/hardware/${hardwareObject._id}`)
        .send(validHardware2).expect(401);
      response.body.message.should.equal('User must be logged in');
    });

    it('should update a Hardware when user is standard-user', async function () {
      validHardware2 = _.cloneDeep(validHardware);
      validHardware2.name = 'updatedName';
      userObject.userRoles = [roleUserObject._id];
      await userObject.save();
      await agent.put(`/api/hardware/${hardwareObject._id}`)
        .auth(validUser.username, validUser.password).send(validHardware2).expect(200);
    });

    it('should update a Hardware when user is admin', async function () {
      validHardware2 = _.cloneDeep(validHardware);
      validHardware2.name = 'updatedName';
      userObject.userRoles = [roleAdminObject._id];
      await userObject.save();
      await agent.put(`/api/hardware/${hardwareObject._id}`)
        .auth(validUser.username, validUser.password).send(validHardware2).expect(200);
    });

    it('should update a Hardware when user is super-admin', async function () {
      validHardware2 = _.cloneDeep(validHardware);
      validHardware2.name = 'updatedName';
      userObject.userRoles = [roleSuperAdmObject._id];
      await userObject.save();
      await agent.put(`/api/hardware/${hardwareObject._id}`)
        .auth(validUser.username, validUser.password).send(validHardware2).expect(200);
    });

    it('should not update a Hardware when Program ID is not provided', async function () {
      validHardware2 = _.cloneDeep(validHardware);
      validHardware2.program_id = null;
      response = await agent.put(`/api/hardware/${hardwareObject._id}`).send(validHardware2).expect(400);
      response.body.message.should.containEql('Path `program_id` is required.');
    });

    it('should not update a Hardware when name is not provided', async function () {
      validHardware2 = _.cloneDeep(validHardware);
      validHardware2.name = null;
      response = await agent.put(`/api/hardware/${hardwareObject._id}`).send(validHardware2).expect(400);
      response.body.message.should.containEql('Path `name` is required.');
    });

    it('should throw error when Hardware name already exists', async function () {
      validHardware2 = _.cloneDeep(validHardware);
      validHardware2.name = 'updatedName';
      response = await agent.post('/api/hardware').send(validHardware2).expect(201);
      validHardware2.name = validHardware.name;
      response = await agent.put(`/api/hardware/${response.body._id}`).send(validHardware2).expect(400);
      response.body.message.should.containEql('Error, provided name is not unique.');
    });

    it('should throw error when invalid Program ID is provided', async function () {
      validHardware2 = _.cloneDeep(validHardware);
      validHardware2.name = 'updatedTheName';
      validHardware2.program_id = '000000000000000000000000';
      response = await agent.put(`/api/hardware/${hardwareObject._id}`).send(validHardware2).expect(422);
      response.body.message.should.equal('A Program with the given id \'000000000000000000000000\' could not be found.');
    });
  });

  describe('DELETE', function () {
    beforeEach(async function () {
      hardwareObject = new Hardware(validHardware);
      await hardwareObject.save();
    });

    it('should delete a hardware and check its response and the db', async function () {
      response = await agent.delete(`/api/hardware/${hardwareObject._id}`).expect(200);
      response.body.should.be.instanceof(Object);
      response.body.name.should.equal(hardwareObject.name);
      count = await Hardware.count().exec();
      count.should.equal(0);
    });

    it('should not delete a hardware when user is not authenticated', async function () {
      response = await nonAuthAgent.delete(`/api/hardware/${hardwareObject._id}`).expect(401);
      response.body.message.should.equal('User must be logged in');
    });

    it('should delete a hardware when user is standard-user', async function () {
      userObject.userRoles = [roleUserObject._id];
      await userObject.save();
      response = await agent.delete(`/api/hardware/${hardwareObject._id}`).auth(validUser.username, validUser.password).expect(200);
    });

    it('should delete an hardware when user is admin', async function () {
      userObject.userRoles = [roleAdminObject._id];
      await userObject.save();
      await agent.delete(`/api/hardware/${hardwareObject._id}`).auth(validUser.username, validUser.password).expect(200);
    });

    it('should delete an hardware when user is super-admin', async function () {
      userObject.userRoles = [roleSuperAdmObject._id];
      await userObject.save();
      await agent.delete(`/api/hardware/${hardwareObject._id}`).auth(validUser.username, validUser.password).expect(200);
    });

    it('should fail when attempting to delete a hardware that does not exist', async function () {
      response = await agent.delete('/api/hardware/000000000000000000000000').expect(404);
      response.body.message.should.equal('A Hardware with that id does not exist');
    });

    it('should update an existing log with user-details for a hardware thats deleted by a logged-in user', async function () {
      response = await agent.delete(`/api/hardware/${hardwareObject._id}`).expect(200);
      response.body._id.should.have.length(24);
      response.body._id.should.equal(hardwareObject._id.toString());

      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      logReturned.originalData.should.not.equal(undefined);
      logReturned.originalData.name.should.equal(validHardware.name);

      logReturned.updates.should.be.instanceof(Array).and.have.lengthOf(0);
      logReturned.deletedAt.should.not.equal(undefined);
      logReturned.deletedBy.should.not.equal(undefined);
      logReturned.deletedBy.username.should.equal(validUser.username);
      logReturned.deletedBy.email.should.equal(validUser.email);
    });

    it('should create a log with defined user-details for a hardware that gets deleted by a logged-in user', async function () {
      // clear logs and verify
      await History.remove().exec();
      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      should.not.exist(logReturned);

      response = await agent.delete(`/api/hardware/${hardwareObject._id}`).expect(200);
      response.body._id.should.have.length(24);
      response.body._id.should.equal(hardwareObject._id.toString());

      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      logReturned.originalData.should.not.equal(undefined);
      logReturned.originalData.name.should.equal(validHardware.name);

      logReturned.updates.should.be.instanceof(Array).and.have.lengthOf(0);
      logReturned.deletedAt.should.not.equal(undefined);
      logReturned.deletedBy.should.not.equal(undefined);
      logReturned.deletedBy.username.should.equal(validUser.username);
      logReturned.deletedBy.email.should.equal(validUser.email);
    });
  });

  describe('SEARCH', function () {
    beforeEach(async function () {
      hardwareObject = new Hardware(validHardware);
      await hardwareObject.save();
    });

    it('should not return a hardware when passing in a valid parameter with a non existent hardware ID', async function () {
      response = await agent.get('/api/hardware?q=_id=5bcdbe7287e21906ed4f12ba').expect(200);
      response.body.length.should.equal(0);
    });

    it('should not return a hardware when passing in a valid parameter with a non existent parameter', async function () {
      response = await agent.get('/api/hardware?q=' + encodeURIComponent('_id=' + hardwareObject._id
      + '&name=notExisting')).expect(200);
      response.body.length.should.equal(0);
    });

    it('should return an error when not encoding q search parameters', async function () {
      response = await agent.get('/api/hardware?q=._id=' + hardwareObject._id + '&name=notExisting').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return a single hardware when passing in _id parameter', async function () {
      response = await agent.get('/api/hardware?q=_id=' + hardwareObject._id).expect(200);
      response.body[0].should.be.instanceof(Object);
      response.body[0].name.should.equal(hardwareObject.name);
    });

    it('should not return a hardware when passing in invalid parameter', async function () {
      response = await agent.get('/api/hardware?q=n0nsense=123454321').expect(200);
      response.body.length.should.equal(0);
    });

    it('should return a single hardware when passing in name parameter', async function () {
      response = await agent.get('/api/hardware?q=name=' + hardwareObject.name).expect(200);
      response.body[0].should.be.instanceof(Object);
      response.body[0].name.should.equal(hardwareObject.name);
    });

    it('should only return fields specified in url', async function () {
      response = await agent.get('/api/hardware?fields=name').expect(200);
      response.body.length.should.equal(1);
      for (var key in response.body) {
        if (Object.prototype.hasOwnProperty.call(response.body, key)) {
          Object.prototype.hasOwnProperty.call(response.body[key], 'name').should.equal(true);
        }
      }
    });

    it('should only return fields specified in url using fields and q functionality', async function () {
      response = await agent.get('/api/hardware?fields=name&q=name=' + hardwareObject.name).expect(200);
      response.body.length.should.equal(1);
      Object.prototype.hasOwnProperty.call(response.body[0], 'name').should.equal(true);
      response.body[0].name.should.equal(hardwareObject.name);
    });

    it('should return an error message when query has invalid search key blah', async function () {
      response = await agent.get('/api/hardware?q=name=' + hardwareObject.name + '&fields=name&blah=blah').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return an error message when queried with an improper search', async function () {
      response = await agent.get('/api/hardware?name=' + hardwareObject.name).expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return an error message when queried with an empty q=', async function () {
      response = await agent.get('/api/hardware?q=').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return an error message when queried with an empty fields=', async function () {
      response = await agent.get('/api/hardware?fields=').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return an error message when queried with an empty fields= and q=', async function () {
      response = await agent.get('/api/hardware?q=&fields=').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });
  });

  afterEach(async function () {
    await User.remove().exec();
    await Deployment.remove().exec();
    await Hardware.remove().exec();
    await Program.remove().exec();
    await History.remove().exec();
    await Role.remove().exec();
  });
});

'use strict';

var fs = require('fs');
var should = require('should'),
  superagentDefaults = require('superagent-defaults'),
  supertest = require('supertest'),
  mongoose = require('mongoose'),
  _ = require('lodash'),
  History = require('../../../history/server/models/history.server.model').getSchema('areas'),
  Area = require('../../server/models/areas.server.model').Schema,
  Program = require('../../../programs/server/models/programs.server.model').Schema,
  Deployment = require('../../../deployments/server/models/deployments.server.model').Schema,
  User = require('../../../users/server/models/user.server.model').Schema,
  Role = require('../../../roles/server/models/roles.server.model').Schema,
  express = require('../../../../config/lib/express');

var app,
  agent,
  nonAuthAgent,
  validArea,
  badArea,
  areaReturned,
  areaObject,
  validArea2,
  area2Object,
  validProgram,
  programObject,
  validDeployment,
  dependentDeployment,
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

describe('Areas', function () {
  before(async function () {
    app = express.init(mongoose);
    nonAuthAgent = superagentDefaults(supertest(app));
    agent = superagentDefaults(supertest(app));
  });

  beforeEach(async function () {
    validArea = JSON.parse(fs.readFileSync('/opt/mean.js/modules/areas/tests/server/test_files/valid_area.json', 'utf8'));
    validProgram = JSON.parse(fs.readFileSync('/opt/mean.js/modules/programs/tests/server/test_files/valid_program.json', 'utf8'));
    validDeployment = JSON.parse(fs.readFileSync('/opt/mean.js/modules/deployments/tests/server/test_files/valid_deployment.json', 'utf8'));
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

    programObject = new Program(validProgram);
    await programObject.save();
    validArea.program_id = programObject._id;

    validUser.userRoles = [roleAdminObject._id];
    userObject = new User(validUser);
    await userObject.save();

    agent.auth(validUser.username, validUser.password); // Setup User Authorization
  });

  describe('POST', function () {
    it('should create a new Area and check db', async function () {
      response = await agent
        .post('/api/areas')
        .send(validArea)
        .expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/Areas/${response.body._id}`);
      response.body.name.should.equal(validArea.name);
      areaReturned = await Area.findById(response.body._id).exec();
      areaReturned.name.should.equal(validArea.name);
    });

    it('should not create a new Area when user is not authenticated', async function () {
      response = await nonAuthAgent.post('/api/areas').send(validArea).expect(401);
      response.body.message.should.equal('User must be logged in');
    });

    it('should not create a new Area when user is standard-user', async function () {
      userObject.userRoles = [roleUserObject._id];
      await userObject.save();
      response = await agent.post('/api/areas').auth(validUser.username, validUser.password).send(validArea).expect(403);
      response.body.message.should.equal('User is not authorized');
    });

    it('should create a new Area when user is standard-user with special permission', async function () {
      userObject.userRoles = [roleUserObject._id];
      userObject.permissions = {'resources': '/areas', 'allResourceMethods': 'post', 'userCreatedResourceMethods': ''}
      await userObject.save();
      response = await agent.post('/api/areas').auth(validUser.username, validUser.password).send(validArea).expect(201);
    });

    it('should create a new Area when user is admin', async function () {
      userObject.userRoles = [roleAdminObject._id];
      await userObject.save();
      await agent.post('/api/areas').auth(validUser.username, validUser.password).send(validArea).expect(201);
    });

    it('should create a new Area when user is super-admin', async function () {
      userObject.userRoles = [roleSuperAdmObject._id];
      await userObject.save();
      await agent.post('/api/areas').auth(validUser.username, validUser.password).send(validArea).expect(201);
    });

    it('should create a new Area with name that contants an ampersand and check db', async function () {
      var diffArea = _.cloneDeep(validArea);
      diffArea.name = 'Planning & Configuration';
      response = await agent.post('/api/areas').send(diffArea).expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/Areas/${response.body._id}`);
      response.body.name.should.equal(diffArea.name);
      areaReturned = await Area.findById(response.body._id).exec();
      areaReturned.name.should.equal(diffArea.name);
    });

    it('should not post more than one area with the same name', async function () {
      areaObject = new Area(validArea);
      await areaObject.save();
      response = await agent.post('/api/areas').send(validArea).expect(400);
      response.body.message.should.equal('Error, provided name is not unique.');
    });

    it('should not post area with a name less than 2 characters', async function () {
      badArea = _.cloneDeep(validArea);
      badArea.name = 'x';
      response = await agent.post('/api/areas').send(badArea).expect(400);
      response.body.message.should.equal('Path `name` (`' + badArea.name + '`) is shorter than the minimum allowed length (2).');
    });

    it('should not post area with a name more than 50 characters', async function () {
      badArea = _.cloneDeep(validArea);
      badArea.name = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      response = await agent.post('/api/areas').send(badArea).expect(400);
      response.body.message.should.equal('Path `name` (`' + badArea.name + '`) is longer than the maximum allowed length (50).');
    });

    it('should not post an area without a name key', async function () {
      badArea = _.cloneDeep(validArea);
      delete badArea.name;
      response = await agent.post('/api/areas').send(badArea).expect(400);
      response.body.message.should.equal('Path `name` is required.');
    });

    it('should not post an area with unknown key', async function () {
      badArea = _.cloneDeep(validArea);
      badArea.rogueKey = 'rogueValue';
      response = await agent.post('/api/areas').send(badArea).expect(400);
      response.body.message.should.equal('Field `rogueKey` is not in schema and strict mode is set to throw.');
    });

    it('should throw error when invalid bookingAssigneeUser_id is provided', async function () {
      badArea = _.cloneDeep(validArea);
      badArea.bookingAssigneeUser_id = 'fake';
      response = await agent.post('/api/areas').send(badArea).expect(400);
      response.body.message.should.equal('Cast to ObjectID failed for value "fake" at path "bookingAssigneeUser_id"');
    });

    it('should throw error when no User exists for the provided bookingAssigneeUser_id', async function () {
      badArea = _.cloneDeep(validArea);
      badArea.bookingAssigneeUser_id = '000000000000000000000000';
      response = await agent.post('/api/areas').send(badArea).expect(422);
      response.body.message.should.equal(`A User with the given id '${badArea.bookingAssigneeUser_id}' could not be found.`);
    });

    it('should respond with bad request with invalid json', async function () {
      badArea = '{';
      response = await agent.post('/api/areas').send(badArea).type('json').expect(400);
      response.body.message.should.equal('There was a syntax error found in your request, please make sure that it is valid and try again');
    });

    it('should post a new log with user-details when an area is created by a logged-in user', async function () {
      response = await agent.post('/api/areas').send(validArea).expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/Areas/${response.body._id}`);
      response.body.name.should.equal(validArea.name);
      areaReturned = await Area.findById(response.body._id).exec();
      areaReturned.name.should.equal(validArea.name);

      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      logReturned.originalData.should.not.equal(undefined);
      logReturned.originalData.name.should.equal(validArea.name);
      logReturned.createdAt.should.not.equal(undefined);
      logReturned.createdBy.should.not.equal(undefined);
      logReturned.createdBy.username.should.equal(validUser.username);
      logReturned.createdBy.email.should.equal(validUser.email);
      logReturned.updates.should.be.instanceof(Array).and.have.lengthOf(0);
    });

    it('should not post a new log for an area that is created with a name beginning with \'A_Health_\'', async function () {
      var validAreaHealth = _.cloneDeep(validArea);
      validAreaHealth.name = 'A_Health_Area';
      response = await agent.post('/api/areas').send(validAreaHealth).expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/Areas/${response.body._id}`);
      response.body.name.should.equal(validAreaHealth.name);
      areaReturned = await Area.findById(response.body._id).exec();
      areaReturned.name.should.equal(validAreaHealth.name);

      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      should.not.exist(logReturned);
    });
  });

  describe('GET', function () {
    beforeEach(async function () {
      areaObject = new Area(validArea);
      await areaObject.save();
    });

    it('should be able to get empty area list', async function () {
      await areaObject.remove();
      response = await agent.get('/api/areas').expect(200);
      response.body.should.be.instanceof(Array).and.have.lengthOf(0);
    });

    it('should be able to get areas when user not authenticated', async function () {
      await nonAuthAgent.get('/api/areas').expect(200);
    });

    it('should be able to get areas when user is authenticated', async function () {
      await agent.get('/api/areas').expect(200);
    });

    it('should be able to get area list with one element', async function () {
      response = await agent.get('/api/areas').expect(200);
      response.body.should.be.instanceof(Array).and.have.lengthOf(1);
      response.body[0].name.should.equal(validArea.name);
    });

    it('should be able to get area list with more than one element', async function () {
      validArea2 = _.cloneDeep(validArea);
      validArea2.name = 'anotherAreaName';
      area2Object = new Area(validArea2);
      await area2Object.save();
      response = await agent.get('/api/areas').expect(200);
      response.body.should.be.instanceof(Array).and.have.lengthOf(2);
      response.body[0].name.should.equal(validArea2.name);
      response.body[1].name.should.deepEqual(validArea.name);
    });

    it('should be able to get a single area', async function () {
      response = await agent.get(`/api/Areas/${areaObject._id}`).expect(200);
      response.body.name.should.equal(validArea.name);
    });

    it('should be able to get single area when user not authenticated', async function () {
      await nonAuthAgent.get(`/api/areas/${areaObject._id}`).expect(200);
    });

    it('should be able to get single area when user is authenticated', async function () {
      await agent.get(`/api/areas/${areaObject._id}`).expect(200);
    });

    it('should throw 404 when id is not in database', async function () {
      response = await agent.get('/api/areas/000000000000000000000000').expect(404);
      response.body.message.should.equal('A Area with that id does not exist');
    });

    it('should throw 404 when id is invalid in the database', async function () {
      response = await agent.get('/api/areas/0').expect(404);
      response.body.message.should.equal('A Area with that id does not exist');
    });
  });

  describe('PUT', function () {
    beforeEach(async function () {
      areaObject = new Area(validArea);
      await areaObject.save();
      validArea2 = _.cloneDeep(validArea);
      validArea2.name = 'updatedName';
    });

    it('should update an Area and get reason in log', async function () {
      validArea2.maxBookingAdvanceWeeks = null;
      validArea2.maxBookingDurationDays = null;
      validArea2.bookingAssigneeUser_id = null;

      response = await agent.put(`/api/areas/${areaObject._id}`).send(validArea2).expect(200);
      response.body.name.should.equal(validArea2.name);

      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      logReturned.originalData.should.not.equal(undefined);
      logReturned.originalData.name.should.equal(validArea.name);

      logReturned.updates.should.be.instanceof(Array).and.have.lengthOf(1);
      var logUpdate = logReturned.updates[0];
      logUpdate.updateReason.should.equal(validArea2.updateReason);
    });

    it('should not update a Area when user is not authenticated', async function () {
      response = await nonAuthAgent.put(`/api/areas/${areaObject._id}`)
        .send(validArea2).expect(401);
      response.body.message.should.equal('User must be logged in');
    });

    it('should not update a Area when user is standard-user', async function () {
      userObject.userRoles = [roleUserObject._id];
      await userObject.save();
      response = await agent.put(`/api/areas/${areaObject._id}`)
        .auth(validUser.username, validUser.password).send(validArea2).expect(403);
      response.body.message.should.equal('User is not authorized');
    });

    it('should update a Area when user is standard-user with special permissions', async function () {
      userObject.userRoles = [roleAdminObject._id];
      userObject.permissions = {'resources': '/areas', 'allResourceMethods': 'put', 'userCreatedResourceMethods': ''}
      await userObject.save();
      await agent.put(`/api/areas/${areaObject._id}`)
        .auth(validUser.username, validUser.password).send(validArea2).expect(200);
    });

    it('should update a Area when user is admin', async function () {
      userObject.userRoles = [roleAdminObject._id];
      await userObject.save();
      await agent.put(`/api/areas/${areaObject._id}`)
        .auth(validUser.username, validUser.password).send(validArea2).expect(200);
    });

    it('should update a Area when user is super-admin', async function () {
      userObject.userRoles = [roleSuperAdmObject._id];
      await userObject.save();
      await agent.put(`/api/areas/${areaObject._id}`)
        .auth(validUser.username, validUser.password).send(validArea2).expect(200);
    });

    it('should not update a Area when Program ID is not provided', async function () {
      validArea2.program_id = null;
      response = await agent.put(`/api/areas/${areaObject._id}`).send(validArea2).expect(400);
      response.body.message.should.containEql('Path `program_id` is required.');
    });

    it('should not update a Area when name is not provided', async function () {
      validArea2.name = null;
      response = await agent.put(`/api/areas/${areaObject._id}`).send(validArea2).expect(400);
      response.body.message.should.containEql('Path `name` is required.');
    });

    it('should throw error when Area name already exists', async function () {
      response = await agent.post('/api/areas').send(validArea2).expect(201);
      validArea2.name = validArea.name;
      response = await agent.put(`/api/areas/${response.body._id}`).send(validArea2).expect(400);
      response.body.message.should.containEql('Error, provided name is not unique.');
    });

    it('should throw error when invalid Program ID is provided', async function () {
      validArea2.program_id = '000000000000000000000000';
      response = await agent.put(`/api/areas/${areaObject._id}`).send(validArea2).expect(422);
      response.body.message.should.equal('A Program with the given id \'000000000000000000000000\' could not be found.');
    });
  });

  describe('DELETE', function () {
    beforeEach(async function () {
      areaObject = new Area(validArea);
      await areaObject.save();
    });

    it('should delete an area and check its response and the db', async function () {
      response = await agent.delete(`/api/Areas/${areaObject._id}`).expect(200);
      response.body.should.be.instanceof(Object);
      response.body.name.should.equal(areaObject.name);
      count = await Area.count().exec();
      count.should.equal(0);
    });

    it('should not delete an area when user is not authenticated', async function () {
      response = await nonAuthAgent.delete(`/api/Areas/${areaObject._id}`).expect(401);
      response.body.message.should.equal('User must be logged in');
    });

    it('should not delete an Area when user is standard-user', async function () {
      userObject.userRoles = [roleUserObject._id];
      await userObject.save();
      response = await agent.delete(`/api/Areas/${areaObject._id}`).auth(validUser.username, validUser.password).expect(403);
      response.body.message.should.equal('User is not authorized');
    });

    it('should delete an Area when user is standard-user with special permission', async function () {
      userObject.userRoles = [roleUserObject._id];
      userObject.permissions = {'resources': '/areas', 'allResourceMethods': 'delete', 'userCreatedResourceMethods': ''}
      await userObject.save();
      response = await agent.delete(`/api/Areas/${areaObject._id}`).auth(validUser.username, validUser.password).expect(200);
    });

    it('should delete an Area when user is admin', async function () {
      userObject.userRoles = [roleAdminObject._id];
      await userObject.save();
      await agent.delete(`/api/Areas/${areaObject._id}`).auth(validUser.username, validUser.password).expect(200);
    });

    it('should delete an Area when user is super-admin', async function () {
      userObject.userRoles = [roleSuperAdmObject._id];
      await userObject.save();
      await agent.delete(`/api/Areas/${areaObject._id}`).auth(validUser.username, validUser.password).expect(200);
    });

    it('should fail when attempting to delete an area that does not exist', async function () {
      response = await agent.delete('/api/areas/000000000000000000000000').expect(404);
      response.body.message.should.equal('A Area with that id does not exist');
    });

    it('should fail when attempting to delete an area which has dependent deployments', async function () {
      validDeployment.area_id = areaObject._id;

      // Create Program and set its ID as Deployments 'program_id' field
      validDeployment.program_id = programObject._id;

      dependentDeployment = new Deployment(validDeployment);
      await dependentDeployment.save();

      response = await agent.delete(`/api/Areas/${areaObject._id}`).expect(422);
      response.body.message.should.equal('Can\'t delete Area, it has 1 dependent deployment(s).');
      count = await Area.count().exec();
      count.should.equal(1);
    });

    it('should update an existing log with user-details for an area thats deleted by a logged-in user', async function () {
      response = await agent.delete(`/api/Areas/${areaObject._id}`).expect(200);
      response.body._id.should.have.length(24);
      response.body._id.should.equal(areaObject._id.toString());

      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      logReturned.originalData.should.not.equal(undefined);
      logReturned.originalData.name.should.equal(validArea.name);

      logReturned.updates.should.be.instanceof(Array).and.have.lengthOf(0);
      logReturned.deletedAt.should.not.equal(undefined);
      logReturned.deletedBy.should.not.equal(undefined);
      logReturned.deletedBy.username.should.equal(validUser.username);
      logReturned.deletedBy.email.should.equal(validUser.email);
    });

    it('should create a log with defined user-details for an area that gets deleted by a logged-in user', async function () {
      // clear logs and verify
      await History.remove().exec();
      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      should.not.exist(logReturned);

      response = await agent.delete(`/api/Areas/${areaObject._id}`).expect(200);
      response.body._id.should.have.length(24);
      response.body._id.should.equal(areaObject._id.toString());

      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      logReturned.originalData.should.not.equal(undefined);
      logReturned.originalData.name.should.equal(validArea.name);

      logReturned.updates.should.be.instanceof(Array).and.have.lengthOf(0);
      logReturned.deletedAt.should.not.equal(undefined);
      logReturned.deletedBy.should.not.equal(undefined);
      logReturned.deletedBy.username.should.equal(validUser.username);
      logReturned.deletedBy.email.should.equal(validUser.email);
    });
  });

  describe('SEARCH', function () {
    beforeEach(async function () {
      areaObject = new Area(validArea);
      await areaObject.save();
    });

    it('should not return an area when passing in a valid parameter with a non existent area ID', async function () {
      response = await agent.get('/api/areas?q=_id=5bcdbe7287e21906ed4f12ba').expect(200);
      response.body.length.should.equal(0);
    });

    it('should not return an area when passing in a valid parameter with a non existent parameter', async function () {
      response = await agent.get(`/api/areas?q=${encodeURIComponent(`_id=${areaObject._id}&name=notExisting`)}`).expect(200);
      response.body.length.should.equal(0);
    });

    it('should return an error when not encoding q search parameters', async function () {
      response = await agent.get(`/api/areas?q=._id=${areaObject._id}&name=notExisting`).expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return a single area when passing in _id parameter', async function () {
      response = await agent.get(`/api/areas?q=_id=${areaObject._id}`).expect(200);
      response.body[0].should.be.instanceof(Object);
      response.body[0].name.should.equal(areaObject.name);
    });

    it('should not return an area when passing in invalid parameter', async function () {
      response = await agent.get('/api/areas?q=n0nsense=123454321').expect(200);
      response.body.length.should.equal(0);
    });

    it('should return a single area when passing in name parameter', async function () {
      response = await agent.get(`/api/areas?q=name=${areaObject.name}`).expect(200);
      response.body[0].should.be.instanceof(Object);
      response.body[0].name.should.equal(areaObject.name);
    });

    it('should only return fields specified in url', async function () {
      response = await agent.get('/api/areas?fields=name').expect(200);
      response.body.length.should.equal(1);
      for (var key in response.body) {
        if (Object.prototype.hasOwnProperty.call(response.body, key)) {
          Object.prototype.hasOwnProperty.call(response.body[key], 'name').should.equal(true);
        }
      }
    });

    it('should only return fields specified in url using fields and q functionality', async function () {
      response = await agent.get(`/api/areas?fields=name&q=name=${areaObject.name}`).expect(200);
      response.body.length.should.equal(1);
      Object.prototype.hasOwnProperty.call(response.body[0], 'name').should.equal(true);
      response.body[0].name.should.equal(areaObject.name);
    });

    it('should return an error message when query has invalid search key blah', async function () {
      response = await agent.get(`/api/areas?q=name=${areaObject.name}&fields=name&blah=blah`).expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return an error message when queried with an improper search', async function () {
      response = await agent.get(`/api/areas?name=${areaObject.name}`).expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return an error message when queried with an empty q=', async function () {
      response = await agent.get('/api/deployments?q=').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return an error message when queried with an empty fields=', async function () {
      response = await agent.get('/api/areas?fields=').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return an error message when queried with an empty fields= and q=', async function () {
      response = await agent.get('/api/areas?q=&fields=').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });
  });

  afterEach(async function () {
    await User.remove().exec();
    await Deployment.remove().exec();
    await Program.remove().exec();
    await Area.remove().exec();
    await Program.remove().exec();
    await History.remove().exec();
    await Role.remove().exec();
  });
});

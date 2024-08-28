'use strict';

var fs = require('fs');
const { log } = require('../../../../config/config');
var should = require('should'),
  superagentDefaults = require('superagent-defaults'),
  supertest = require('supertest'),
  mongoose = require('mongoose'),
  _ = require('lodash'),
  History = require('../../../history/server/models/history.server.model').getSchema('roles'),
  Role = require('../../server/models/roles.server.model').Schema,
  Deployment = require('../../../deployments/server/models/deployments.server.model').Schema,
  Area = require('../../../areas/server/models/areas.server.model').Schema,
  Program = require('../../../programs/server/models/programs.server.model').Schema,
  User = require('../../../users/server/models/user.server.model').Schema,
  express = require('../../../../config/lib/express');

var app,
  agent,
  nonAuthAgent,
  validRole,
  validArea,
  validProgram,
  badRole,
  roleReturned,
  roleObject,
  validRole2,
  role2Object,
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

describe('Roles', function () {
  before(async function () {
    app = express.init(mongoose);
    nonAuthAgent = superagentDefaults(supertest(app));
    agent = superagentDefaults(supertest(app));
  });

  beforeEach(async function () {
    validRole = JSON.parse(fs.readFileSync('/opt/mean.js/modules/roles/tests/server/test_files/valid_role.json', 'utf8'));
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

    validUser.userRoles = [roleAdminObject._id];
    userObject = new User(validUser);
    await userObject.save();


    agent.auth(validUser.username, validUser.password); // Setup User Authorization
  });

  describe('POST', function () {
    it('should create a new Role and check db', async function () {
      response = await agent
        .post('/api/roles')
        .send(validRole)
        .expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/Roles/${response.body._id}`);
      response.body.name.should.equal(validRole.name);
      roleReturned = await Role.findById(response.body._id).exec();
      roleReturned.name.should.equal(validRole.name);
    });

    it('should not create a new Role when user is not authenticated', async function () {
      response = await nonAuthAgent.post('/api/roles').send(validRole).expect(401);
      response.body.message.should.equal('User must be logged in');
    });

    it('should not create a new Role when user is standard-user', async function () {
      userObject.userRoles = [roleUserObject._id];
      await userObject.save();
      response = await agent.post('/api/roles').auth(validUser.username, validUser.password).send(validRole).expect(403);
    });

    it('should create a new Role when user is admin', async function () {
      userObject.userRoles = [roleAdminObject._id];
      await userObject.save();
      await agent.post('/api/roles').auth(validUser.username, validUser.password).send(validRole).expect(201);
    });

    it('should create a new Role when user is super-admin', async function () {
      userObject.userRoles = [roleSuperAdmObject._id];
      await userObject.save();
      await agent.post('/api/roles').auth(validUser.username, validUser.password).send(validRole).expect(201);
    });

    it('should not post more than one Role with the same name', async function () {
      roleObject = new Role(validRole);
      await roleObject.save();
      response = await agent.post('/api/roles').send(validRole).expect(400);
      response.body.message.should.equal('Error, provided name is not unique.');
    });

    it('should not post Role with a name less than 2 characters', async function () {
      badRole = _.cloneDeep(validRole);
      badRole.name = 'X';
      response = await agent.post('/api/roles').send(badRole).expect(400);
      response.body.message.should.equal('Path `name` (`' + badRole.name + '`) is shorter than the minimum allowed length (2).');
    });

    it('should not post Role with a name more than 50 characters', async function () {
      badRole = _.cloneDeep(validRole);
      badRole.name = 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
      response = await agent.post('/api/roles').send(badRole).expect(400);
      response.body.message.should.equal('Path `name` (`' + badRole.name + '`) is longer than the maximum allowed length (50).');
    });

    it('should not allow a Role with a non-alphanumeric-underscored name', async function () {
      badRole = _.cloneDeep(validRole);
      badRole.name = '!£$%&';
      response = await agent.post('/api/roles').send(badRole).expect(400);
      response.body.message.should.equal('name is not valid; \'!£$%&\' can only contain letters, numbers, dots, dashes and underscores.');
    });

    it('should not post a Role without a name key', async function () {
      badRole = _.cloneDeep(validRole);
      delete badRole.name;
      response = await agent.post('/api/roles').send(badRole).expect(400);
      response.body.message.should.equal('Path `name` is required.');
    });

    it('should not post a Role with unknown key', async function () {
      badRole = _.cloneDeep(validRole);
      badRole.rogueKey = 'rogueValue';
      response = await agent.post('/api/roles').send(badRole).expect(400);
      response.body.message.should.equal('Field `rogueKey` is not in schema and strict mode is set to throw.');
    });

    it('should respond with bad request with invalid json', async function () {
      badRole = '{';
      response = await agent.post('/api/roles').send(badRole).type('json').expect(400);
      response.body.message.should.equal('There was a syntax error found in your request, please make sure that it is valid and try again');
    });

    it('should post a new log with user-details when a Role is created by a logged-in user', async function () {
      response = await agent.post('/api/roles').send(validRole).expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/Roles/${response.body._id}`);
      response.body.name.should.equal(validRole.name);
      roleReturned = await Role.findById(response.body._id).exec();
      roleReturned.name.should.equal(validRole.name);

      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      logReturned.originalData.should.not.equal(undefined);
      logReturned.originalData.name.should.equal(validRole.name);
      logReturned.createdAt.should.not.equal(undefined);
      logReturned.createdBy.should.not.equal(undefined);
      logReturned.createdBy.username.should.equal(validUser.username);
      logReturned.createdBy.email.should.equal(validUser.email);
      logReturned.updates.should.be.instanceof(Array).and.have.lengthOf(0);
    });

    it('should not post a new log for a Role that is created with a name beginning with \'A_Health_\'', async function () {
      var validRoleHealth = _.cloneDeep(validRole);
      validRoleHealth.name = 'A_HEALTH_ROLE';
      response = await agent.post('/api/Roles').send(validRoleHealth).expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/Roles/${response.body._id}`);
      response.body.name.should.equal(validRoleHealth.name);
      roleReturned = await Role.findById(response.body._id).exec();
      roleReturned.name.should.equal(validRoleHealth.name);

      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      should.not.exist(logReturned);
    });
  });

  describe('GET', function () {
    beforeEach(async function () {
      roleObject = new Role(validRole);
      await roleObject.save();
    });

    it('should be able to get empty role list', async function () {
      await Role.remove().exec();
      response = await agent.get('/api/roles').expect(200);
      response.body.should.be.instanceof(Array).and.have.lengthOf(0);
    });

    it('should be able to get roles when user not authenticated', async function () {
      await nonAuthAgent.get('/api/roles').expect(200);
    });

    it('should be able to get roles when user is authenticated', async function () {
      await agent.get('/api/roles').expect(200);
    });

    it('should be able to get role list with one element', async function () {
      await Role.remove().exec();
      var newRole = new Role(validRole);
      await newRole.save();
      response = await agent.get('/api/roles').expect(200);
      response.body.should.be.instanceof(Array).and.have.lengthOf(1);
      response.body[0].name.should.equal(validRole.name);
    });

    it('should be able to get role list with more than one element', async function () {
      await Role.remove().exec();
      var newRole = new Role(validRole);
      await newRole.save();
      validRole2 = _.cloneDeep(validRole);
      validRole2.name = 'ANOTHERROLENAME';
      role2Object = new Role(validRole2);
      await role2Object.save();
      response = await agent.get('/api/roles').expect(200);
      response.body.should.be.instanceof(Array).and.have.lengthOf(2);
      response.body[0].name.should.equal(validRole2.name);
      response.body[1].name.should.deepEqual(validRole.name);
    });

    it('should be able to get a single role', async function () {
      response = await agent.get(`/api/Roles/${roleObject._id}`).expect(200);
      response.body.name.should.equal(validRole.name);
    });

    it('should be able to get single role when user not authenticated', async function () {
      await nonAuthAgent.get(`/api/Roles/${roleObject._id}`).expect(200);
    });

    it('should be able to get single role when user is authenticated', async function () {
      await agent.get(`/api/Roles/${roleObject._id}`).expect(200);
    });

    it('should throw 404 when id is not in database', async function () {
      response = await agent.get('/api/roles/000000000000000000000000').expect(404);
      response.body.message.should.equal('A Role with that id does not exist');
    });

    it('should throw 404 when id is invalid in the database', async function () {
      response = await agent.get('/api/roles/0').expect(404);
      response.body.message.should.equal('A Role with that id does not exist');
    });
  });

  describe('DELETE', function () {
    beforeEach(async function () {
      roleObject = new Role(validRole);
      await roleObject.save();
    });

    it('should delete a role and check its response and the db', async function () {
      var originalCount = await Role.count().exec();
      validRole2 = _.cloneDeep(validRole);
      validRole2.name = 'ANOTHERROLENAME';
      role2Object = new Role(validRole2);
      await role2Object.save();
      response = await agent.delete(`/api/roles/${role2Object._id}`).expect(200);
      response.body.should.be.instanceof(Object);
      response.body.name.should.equal(validRole2.name);
      count = await Role.count().exec();
      count.should.equal(originalCount);
    });

    it('should not delete a role when user is not authenticated', async function () {
      response = await nonAuthAgent.delete(`/api/roles/${roleObject._id}`).expect(401);
      response.body.message.should.equal('User must be logged in');
    });

    it('should not delete a role when user is standard-user', async function () {
      userObject.userRoles = [roleUserObject._id];
      await userObject.save();
      response = await agent.delete(`/api/roles/${roleObject._id}`).auth(validUser.username, validUser.password).expect(403);
    });

    it('should not delete admin role when user is admin', async function () {
      userObject.userRoles = [roleAdminObject._id];
      await userObject.save();
      response = await agent.delete(`/api/roles/${roleAdminObject._id}`).auth(validUser.username, validUser.password).expect(403);
    });

    it('should not delete super-admin role when user is admin', async function () {
      userObject.userRoles = [roleAdminObject._id];
      await userObject.save();
      response = await agent.delete(`/api/roles/${roleAdminObject._id}`).auth(validUser.username, validUser.password).expect(403);
    });

    it('should delete a role when user is admin', async function () {
      userObject.userRoles = [roleAdminObject._id];
      await userObject.save();
      await agent.delete(`/api/roles/${roleObject._id}`).auth(validUser.username, validUser.password).expect(200);
    });

    it('should delete a role when user is super-admin', async function () {
      userObject.userRoles = [roleSuperAdmObject._id];
      await userObject.save();
      await agent.delete(`/api/roles/${roleObject._id}`).auth(validUser.username, validUser.password).expect(200);
    });

    it('should fail when attempting to delete a role that does not exist', async function () {
      response = await agent.delete('/api/roles/000000000000000000000000').expect(404);
      response.body.message.should.equal('A Role with that id does not exist');
    });

    it('should update an existing log with user-details for a role thats deleted by a logged-in user', async function () {
      response = await agent.delete(`/api/Roles/${roleObject._id}`).expect(200);
      response.body._id.should.have.length(24);
      response.body._id.should.equal(roleObject._id.toString());

      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      logReturned.originalData.should.not.equal(undefined);
      logReturned.originalData.name.should.equal(validRole.name);

      logReturned.updates.should.be.instanceof(Array).and.have.lengthOf(0);
      logReturned.deletedAt.should.not.equal(undefined);
      logReturned.deletedBy.should.not.equal(undefined);
      logReturned.deletedBy.username.should.equal(validUser.username);
      logReturned.deletedBy.email.should.equal(validUser.email);
    });

    it('should create a log with defined user-details for a role that gets deleted by a logged-in user', async function () {
      // clear logs and verify
      await History.remove().exec();
      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      should.not.exist(logReturned);

      response = await agent.delete(`/api/Roles/${roleObject._id}`).expect(200);
      response.body._id.should.have.length(24);
      response.body._id.should.equal(roleObject._id.toString());

      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      logReturned.originalData.should.not.equal(undefined);
      logReturned.originalData.name.should.equal(validRole.name);

      logReturned.updates.should.be.instanceof(Array).and.have.lengthOf(0);
      logReturned.deletedAt.should.not.equal(undefined);
      logReturned.deletedBy.should.not.equal(undefined);
      logReturned.deletedBy.username.should.equal(validUser.username);
      logReturned.deletedBy.email.should.equal(validUser.email);
    });
  });

  describe('PUT', function () {
    beforeEach(async function () {
      roleObject = new Role(validRole);
      await roleObject.save();
    });

    it('should update a role and check its response and the db', async function () {
      validRole2 = _.cloneDeep(validRole);
      validRole2.name = 'UPDATEDROLENAME';
      response = await agent.put(`/api/roles/${roleObject._id}`).send(validRole2).expect(200);
      response.body.should.be.instanceof(Object);
      response.body.name.should.equal(validRole2.name);
    });

    it('should not update a role when user is not authenticated', async function () {
      validRole2 = _.cloneDeep(validRole);
      validRole2.name = 'UPDATEDROLENAME';
      response = await nonAuthAgent.put(`/api/roles/${roleObject._id}`).send(validRole2).expect(401);
      response.body.message.should.equal('User must be logged in');
    });

    it('should not update a role when user is standard-user', async function () {
      userObject.userRoles = [roleUserObject._id];
      await userObject.save();
      validRole2 = _.cloneDeep(validRole);
      validRole2.name = 'UPDATEDROLENAME';
      response = await agent.put(`/api/roles/${roleObject._id}`).auth(validUser.username, validUser.password).send(validRole2).expect(403);
    });

    it('should not update admin role when user is admin', async function () {
      userObject.userRoles = [roleAdminObject._id];
      await userObject.save();
      validRole2 = _.cloneDeep(validAdminRole);
      validRole2.name = 'UPDATEDROLENAME';
      response = await agent.put(`/api/roles/${roleAdminObject._id}`).auth(validUser.username, validUser.password).send(validRole2).expect(403);
    });

    it('should not update super-admin role when user is admin', async function () {
      userObject.userRoles = [roleAdminObject._id];
      await userObject.save();
      validRole2 = _.cloneDeep(validSuperAdminRole);
      validRole2.name = 'UPDATEDROLENAME';
      response = await agent.put(`/api/roles/${roleSuperAdmObject._id}`).auth(validUser.username, validUser.password).send(validRole2).expect(403);
    });

    it('should update a role when user is admin', async function () {
      userObject.userRoles = [roleAdminObject._id];
      await userObject.save();
      validRole2 = _.cloneDeep(validUserRole);
      validRole2.name = 'UPDATEDROLENAME';
      response = await agent.put(`/api/roles/${roleUserObject._id}`).auth(validUser.username, validUser.password).send(validRole2).expect(200);
    });

    it('should update a role when user is super-admin', async function () {
      userObject.userRoles = [roleSuperAdmObject._id];
      await userObject.save();
      validRole2 = _.cloneDeep(validUserRole);
      validRole2.name = 'UPDATEDROLENAME';
      response = await agent.put(`/api/roles/${roleUserObject._id}`).auth(validUser.username, validUser.password).send(validRole2).expect(200);
    });

    it('should fail when attempting to update a role that does not exist', async function () {
      response = await agent.put('/api/roles/000000000000000000000000').expect(404);
      response.body.message.should.equal('A Role with that id does not exist');
    });

    it('should update an existing log with user-details for a role thats updated by a logged-in user', async function () {
      var validRoleUpdate = _.cloneDeep(validRole);
      validRoleUpdate.name = 'UPDATEDROLENAME';
      response = await agent.put(`/api/roles/${roleObject._id}`).auth(validUser.username, validUser.password).send(validRoleUpdate).expect(200);
      response.body._id.should.have.length(24);
      response.body._id.should.equal(roleObject._id.toString());

      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      logReturned.originalData.should.not.equal(undefined);
      logReturned.originalData.name.should.equal(validRole.name);

      logReturned.updates.should.be.instanceof(Array).and.have.lengthOf(1);
      logReturned.updates[0].updatedAt.should.not.equal(undefined);
      logReturned.updates[0].updatedBy.should.not.equal(undefined);
      logReturned.updates[0].updatedBy.username.should.equal(validUser.username);
      logReturned.updates[0].updatedBy.email.should.equal(validUser.email);
    });

    it('should create a log with defined user-details for a role that gets updated by a logged-in user', async function () {
      // clear logs and verify
      await History.remove().exec();
      logReturned = await History.findOne({ associated_id: roleObject._id }).exec();
      should.not.exist(logReturned);

      var validRoleUpdate = _.cloneDeep(validRole);
      validRoleUpdate.name = 'UPDATEDROLENAME';
      response = await agent.put(`/api/roles/${roleObject._id}`).auth(validUser.username, validUser.password).send(validRoleUpdate).expect(200);
      response.body._id.should.have.length(24);
      response.body._id.should.equal(roleObject._id.toString());

      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      logReturned.originalData.should.not.equal(undefined);
      logReturned.originalData.name.should.equal(validRole.name);

      logReturned.updates.should.be.instanceof(Array).and.have.lengthOf(1);
      logReturned.updates[0].updatedAt.should.not.equal(undefined);
      logReturned.updates[0].updatedBy.should.not.equal(undefined);
      logReturned.updates[0].updatedBy.username.should.equal(validUser.username);
      logReturned.updates[0].updatedBy.email.should.equal(validUser.email);
    });
  });

  describe('SEARCH', function () {
    beforeEach(async function () {
      roleObject = new Role(validRole);
      await roleObject.save();
    });

    it('should not return a role when passing in a valid parameter with a non existent role ID', async function () {
      response = await agent.get('/api/roles?q=_id=5bcdbe7287e21906ed4f12ba').expect(200);
      response.body.length.should.equal(0);
    });

    it('should not return a role when passing in a valid parameter with a non existent parameter', async function () {
      response = await agent.get('/api/roles?q=' + encodeURIComponent('_id=' + roleObject._id
      + '&name=notExisting')).expect(200);
      response.body.length.should.equal(0);
    });

    it('should return an error when not encoding q search parameters', async function () {
      response = await agent.get('/api/roles?q=._id=' + roleObject._id + '&name=notExisting').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return a single role when passing in _id parameter', async function () {
      response = await agent.get('/api/roles?q=_id=' + roleObject._id).expect(200);
      response.body[0].should.be.instanceof(Object);
      response.body[0].name.should.equal(roleObject.name);
    });

    it('should not return a role when passing in invalid parameter', async function () {
      response = await agent.get('/api/roles?q=n0nsense=123454321').expect(200);
      response.body.length.should.equal(0);
    });

    it('should return a single role when passing in name parameter', async function () {
      response = await agent.get('/api/roles?q=name=' + roleObject.name).expect(200);
      response.body[0].should.be.instanceof(Object);
      response.body[0].name.should.equal(roleObject.name);
    });

    it('should only return fields specified in url', async function () {
      await Role.remove().exec();
      validRole = _.cloneDeep(validRole);
      roleObject = new Role(validRole);
      await roleObject.save();
      response = await agent.get('/api/roles?fields=name').expect(200);
      response.body.length.should.equal(1);
      for (var key in response.body) {
        if (Object.prototype.hasOwnProperty.call(response.body, key)) {
          Object.prototype.hasOwnProperty.call(response.body[key], 'name').should.equal(true);
        }
      }
    });

    it('should only return fields specified in url using fields and q functionality', async function () {
      response = await agent.get('/api/roles?fields=name&q=name=' + roleObject.name).expect(200);
      response.body.length.should.equal(1);
      Object.prototype.hasOwnProperty.call(response.body[0], 'name').should.equal(true);
      response.body[0].name.should.equal(roleObject.name);
    });

    it('should return an error message when query has invalid search key blah', async function () {
      response = await agent.get('/api/roles?q=name=' + roleObject.name + '&fields=name&blah=blah').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return an error message when queried with an improper search', async function () {
      response = await agent.get('/api/roles?name=' + roleObject.name).expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return an error message when queried with an empty q=', async function () {
      response = await agent.get('/api/deployments?q=').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return an error message when queried with an empty fields=', async function () {
      response = await agent.get('/api/roles?fields=').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return an error message when queried with an empty fields= and q=', async function () {
      response = await agent.get('/api/roles?q=&fields=').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });
  });

  afterEach(async function () {
    await User.remove().exec();
    await Deployment.remove().exec();
    await Role.remove().exec();
    await Area.remove().exec();
    await Program.remove().exec();
    await History.remove().exec();
  });
});

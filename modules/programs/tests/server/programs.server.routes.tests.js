'use strict';

var fs = require('fs');
var should = require('should'),
  superagentDefaults = require('superagent-defaults'),
  supertest = require('supertest'),
  mongoose = require('mongoose'),
  _ = require('lodash'),
  History = require('../../../history/server/models/history.server.model').getSchema('programs'),
  Program = require('../../server/models/programs.server.model').Schema,
  Area = require('../../../areas/server/models/areas.server.model').Schema,
  Deployment = require('../../../deployments/server/models/deployments.server.model').Schema,
  User = require('../../../users/server/models/user.server.model').Schema,
  Role = require('../../../roles/server/models/roles.server.model').Schema,
  express = require('../../../../config/lib/express');

var app,
  agent,
  nonAuthAgent,
  validProgram,
  badProgram,
  programReturned,
  programObject,
  validProgram2,
  validProgramWithJiraTemp,
  programObjectWithTemplate,
  program2Object,
  validArea,
  areaObject,
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

describe('Programs', function () {
  before(async function () {
    app = express.init(mongoose);
    nonAuthAgent = superagentDefaults(supertest(app));
    agent = superagentDefaults(supertest(app));
  });

  beforeEach(async function () {
    validProgram = JSON.parse(fs.readFileSync('/opt/mean.js/modules/programs/tests/server/test_files/valid_program.json', 'utf8'));
    validProgramWithJiraTemp = JSON.parse(fs.readFileSync('/opt/mean.js/modules/programs/tests/server/test_files/valid_program_with_jira_template.json', 'utf8'));
    validArea = JSON.parse(fs.readFileSync('/opt/mean.js/modules/areas/tests/server/test_files/valid_area.json', 'utf8'));
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
    it('should create a new Program and check db', async function () {
      response = await agent
        .post('/api/programs')
        .send(validProgram)
        .expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/Programs/${response.body._id}`);
      response.body.name.should.equal(validProgram.name);
      programReturned = await Program.findById(response.body._id).exec();
      programReturned.name.should.equal(validProgram.name);
    });

    it('should not create a new Program when user is not authenticated', async function () {
      response = await nonAuthAgent.post('/api/programs').send(validProgram).expect(401);
      response.body.message.should.equal('User must be logged in');
    });

    it('should not create a new Program when user is standard-user', async function () {
      userObject.userRoles = [roleUserObject._id];
      await userObject.save();
      response = await agent.post('/api/programs').auth(validUser.username, validUser.password).send(validProgram).expect(403);
      response.body.message.should.equal('User is not authorized');
    });

    it('should create a new Program when user is standard-user with special permissions', async function () {
      userObject.userRoles = [roleUserObject._id];
      userObject.permissions = {'resources': '/programs', 'allResourceMethods': 'post', 'userCreatedResourceMethods': ''}
      await userObject.save();
      response = await agent.post('/api/programs').auth(validUser.username, validUser.password).send(validProgram).expect(201);
    });

    it('should create a new Program when user is admin', async function () {
      userObject.userRoles = [roleAdminObject._id];
      await userObject.save();
      await agent.post('/api/programs').auth(validUser.username, validUser.password).send(validProgram).expect(201);
    });

    it('should create a new Program when user is super-admin', async function () {
      userObject.userRoles = [roleSuperAdmObject._id];
      await userObject.save();
      await agent.post('/api/programs').auth(validUser.username, validUser.password).send(validProgram).expect(201);
    });

    it('should not post more than one program with the same name', async function () {
      programObject = new Program(validProgram);
      await programObject.save();
      response = await agent.post('/api/programs').send(validProgram).expect(400);
      response.body.message.should.equal('Error, provided name is not unique.');
    });

    it('should not post program with a name less than 2 characters', async function () {
      badProgram = _.cloneDeep(validProgram);
      badProgram.name = 'x';
      response = await agent.post('/api/programs').send(badProgram).expect(400);
      response.body.message.should.equal('Path `name` (`' + badProgram.name + '`) is shorter than the minimum allowed length (2).');
    });

    it('should not post program with a name more than 50 characters', async function () {
      badProgram = _.cloneDeep(validProgram);
      badProgram.name = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      response = await agent.post('/api/programs').send(badProgram).expect(400);
      response.body.message.should.equal('Path `name` (`' + badProgram.name + '`) is longer than the maximum allowed length (50).');
    });

    it('should not allow a program with a non-alphanumeric-underscored name', async function () {
      badProgram = _.cloneDeep(validProgram);
      badProgram.name = '!£$%&';
      response = await agent.post('/api/programs').send(badProgram).expect(400);
      response.body.message.should.equal('name is not valid; \'!£$%&\' can only contain letters, numbers, dots, spaces, dashes and underscores.');
    });

    it('should not post a program without a name key', async function () {
      badProgram = _.cloneDeep(validProgram);
      delete badProgram.name;
      response = await agent.post('/api/programs').send(badProgram).expect(400);
      response.body.message.should.equal('Path `name` is required.');
    });

    it('should not post a program with unknown key', async function () {
      badProgram = _.cloneDeep(validProgram);
      badProgram.rogueKey = 'rogueValue';
      response = await agent.post('/api/programs').send(badProgram).expect(400);
      response.body.message.should.equal('Field `rogueKey` is not in schema and strict mode is set to throw.');
    });

    it('should respond with bad request with invalid json', async function () {
      badProgram = '{';
      response = await agent.post('/api/programs').send(badProgram).type('json').expect(400);
      response.body.message.should.equal('There was a syntax error found in your request, please make sure that it is valid and try again');
    });

    it('should post a new log with user-details when a program is created by a logged-in user', async function () {
      response = await agent.post('/api/programs').send(validProgram).expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/Programs/${response.body._id}`);
      response.body.name.should.equal(validProgram.name);
      programReturned = await Program.findById(response.body._id).exec();
      programReturned.name.should.equal(validProgram.name);

      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      logReturned.originalData.should.not.equal(undefined);
      logReturned.originalData.name.should.equal(validProgram.name);
      logReturned.createdAt.should.not.equal(undefined);
      logReturned.createdBy.should.not.equal(undefined);
      logReturned.createdBy.username.should.equal(validUser.username);
      logReturned.createdBy.email.should.equal(validUser.email);
      logReturned.updates.should.be.instanceof(Array).and.have.lengthOf(0);
    });

    it('should not post a new log for a Program that is created with a name beginning with \'A_Health_\'', async function () {
      var validProgramHealth = _.cloneDeep(validProgram);
      validProgramHealth.name = 'A_Health_Program';
      response = await agent.post('/api/Programs').send(validProgramHealth).expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/Programs/${response.body._id}`);
      response.body.name.should.equal(validProgramHealth.name);
      programReturned = await Program.findById(response.body._id).exec();
      programReturned.name.should.equal(validProgramHealth.name);

      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      should.not.exist(logReturned);
    });
  });

  describe('GET', function () {
    beforeEach(async function () {
      programObject = new Program(validProgram);
      await programObject.save();
    });

    it('should be able to get empty program list', async function () {
      await programObject.remove();
      response = await agent.get('/api/programs').expect(200);
      response.body.should.be.instanceof(Array).and.have.lengthOf(0);
    });

    it('should be able to get programs when user not authenticated', async function () {
      await nonAuthAgent.get('/api/programs').expect(200);
    });

    it('should be able to get programs when user is authenticated', async function () {
      await agent.get('/api/programs').expect(200);
    });

    it('should be able to get program list with one element', async function () {
      response = await agent.get('/api/programs').expect(200);
      response.body.should.be.instanceof(Array).and.have.lengthOf(1);
      response.body[0].name.should.equal(validProgram.name);
    });

    it('should be able to get program list with more than one element', async function () {
      validProgram2 = _.cloneDeep(validProgram);
      validProgram2.name = 'anotherProgramName';
      program2Object = new Program(validProgram2);
      await program2Object.save();
      response = await agent.get('/api/programs').expect(200);
      response.body.should.be.instanceof(Array).and.have.lengthOf(2);
      response.body[0].name.should.equal(validProgram2.name);
      response.body[1].name.should.deepEqual(validProgram.name);
    });

    it('should be able to get a single program', async function () {
      response = await agent.get(`/api/Programs/${programObject._id}`).expect(200);
      response.body.name.should.equal(validProgram.name);
    });

    it('should be able to get single program when user not authenticated', async function () {
      await nonAuthAgent.get(`/api/Programs/${programObject._id}`).expect(200);
    });

    it('should be able to get single program when user is authenticated', async function () {
      await agent.get(`/api/Programs/${programObject._id}`).expect(200);
    });

    it('should throw 404 when id is not in database', async function () {
      response = await agent.get('/api/programs/000000000000000000000000').expect(404);
      response.body.message.should.equal('A Program with that id does not exist');
    });

    it('should throw 404 when id is invalid in the database', async function () {
      response = await agent.get('/api/programs/0').expect(404);
      response.body.message.should.equal('A Program with that id does not exist');
    });
  });

  describe('PUT', function () {
    beforeEach(async function () {
      programObject = new Program(validProgram);
      await programObject.save();
      programObjectWithTemplate = new Program(validProgramWithJiraTemp);
      await programObjectWithTemplate.save();
    });

    it('should update a program with a jira template', async function () {
      validProgram2 = _.cloneDeep(validProgram);
      validProgram2.jira_templates = [{}];
      validProgram2.jira_templates[0].infrastructure = 'Physical';
      validProgram2.jira_templates[0].jiraBoard = 'CI_Framework';
      validProgram2.jira_templates[0].issueType = 'Task';
      validProgram2.jira_templates[0].project = 'Continuous Integration Services';
      validProgram2.jira_templates[0].components = ['DTT_Booking'];
      response = await agent.put(`/api/programs/${programObject._id}`).send(validProgram2).expect(200);
      response.body.name.should.equal(validProgram2.name);
      response.body.jira_templates[0].infrastructure.should.equal(validProgram2.jira_templates[0].infrastructure);
      response.body.jira_templates[0].jiraBoard.should.equal(validProgram2.jira_templates[0].jiraBoard);
      response.body.jira_templates[0].issueType.should.equal(validProgram2.jira_templates[0].issueType);
      response.body.jira_templates[0].project.should.equal(validProgram2.jira_templates[0].project);
      response.body.jira_templates[0].components[0].should.equal(validProgram2.jira_templates[0].components[0]);
    });

    it('should update a program with a jira template with custom fields', async function () {
      validProgram2 = _.cloneDeep(validProgram);
      validProgram2.jira_templates = [{}];
      validProgram2.jira_templates[0].infrastructure = 'Physical';
      validProgram2.jira_templates[0].jiraBoard = 'CI_Framework';
      validProgram2.jira_templates[0].issueType = 'Task';
      validProgram2.jira_templates[0].project = 'Continuous Integration Services';
      validProgram2.jira_templates[0].components = ['DTT_Booking'];
      validProgram2.jira_templates[0].custom_fields = [{}];
      validProgram2.jira_templates[0].custom_fields[0].key_name = 'Custom Field Name 1';
      validProgram2.jira_templates[0].custom_fields[0].key_value = 'Custom Field Value 1';
      response = await agent.put(`/api/programs/${programObject._id}`).send(validProgram2).expect(200);
      response.body.name.should.equal(validProgram2.name);
      response.body.jira_templates[0].infrastructure.should.equal(validProgram2.jira_templates[0].infrastructure);
      response.body.jira_templates[0].jiraBoard.should.equal(validProgram2.jira_templates[0].jiraBoard);
      response.body.jira_templates[0].issueType.should.equal(validProgram2.jira_templates[0].issueType);
      response.body.jira_templates[0].project.should.equal(validProgram2.jira_templates[0].project);
      response.body.jira_templates[0].components[0].should.equal(validProgram2.jira_templates[0].components[0]);
      response.body.jira_templates[0].custom_fields[0].key_name.should.equal(validProgram2.jira_templates[0].custom_fields[0].key_name);
      response.body.jira_templates[0].custom_fields[0].key_value.should.equal(validProgram2.jira_templates[0].custom_fields[0].key_value);
    });

    it('should update a program with multiple jira templates with multiple custom fields', async function () {
      validProgram2 = _.cloneDeep(validProgram);
      validProgram2.jira_templates = [{}];
      validProgram2.jira_templates[0].infrastructure = 'Physical';
      validProgram2.jira_templates[0].jiraBoard = 'CI_Framework';
      validProgram2.jira_templates[0].issueType = 'Task';
      validProgram2.jira_templates[0].project = 'Continuous Integration Services';
      validProgram2.jira_templates[0].components = ['DTT_Booking'];
      validProgram2.jira_templates[0].custom_fields = [{}];
      validProgram2.jira_templates[0].custom_fields[0].key_name = 'Custom Field Name 1';
      validProgram2.jira_templates[0].custom_fields[0].key_value = 'Custom Field Value 1';
      validProgram2.jira_templates[0].custom_fields.push({});
      validProgram2.jira_templates[0].custom_fields[1].key_name = 'Custom Field Name 2';
      validProgram2.jira_templates[0].custom_fields[1].key_value = 'Custom Field Value 2';
      validProgram2.jira_templates.push({});
      validProgram2.jira_templates[1].infrastructure = 'Cloud';
      validProgram2.jira_templates[1].jiraBoard = 'STSOSS';
      validProgram2.jira_templates[1].issueType = 'Story';
      validProgram2.jira_templates[1].project = 'FrameworkTeam_PDUOSS(CIP)';
      validProgram2.jira_templates[1].components = ['TEaaS'];
      validProgram2.jira_templates[1].custom_fields = [{}];
      validProgram2.jira_templates[1].custom_fields[0].key_name = 'Custom Field Name 2.1';
      validProgram2.jira_templates[1].custom_fields[0].key_value = 'Custom Field Value 2.1';
      validProgram2.jira_templates[1].custom_fields.push({});
      validProgram2.jira_templates[1].custom_fields[1].key_name = 'Custom Field Name 2.2';
      validProgram2.jira_templates[1].custom_fields[1].key_value = 'Custom Field Value 2.2';
      response = await agent.put(`/api/programs/${programObject._id}`).send(validProgram2).expect(200);
      response.body.name.should.equal(validProgram2.name);
      response.body.jira_templates[0].infrastructure.should.equal(validProgram2.jira_templates[0].infrastructure);
      response.body.jira_templates[0].jiraBoard.should.equal(validProgram2.jira_templates[0].jiraBoard);
      response.body.jira_templates[0].issueType.should.equal(validProgram2.jira_templates[0].issueType);
      response.body.jira_templates[0].project.should.equal(validProgram2.jira_templates[0].project);
      response.body.jira_templates[0].components[0].should.equal(validProgram2.jira_templates[0].components[0]);
      response.body.jira_templates[0].custom_fields[0].key_name.should.equal(validProgram2.jira_templates[0].custom_fields[0].key_name);
      response.body.jira_templates[0].custom_fields[0].key_value.should.equal(validProgram2.jira_templates[0].custom_fields[0].key_value);
      response.body.jira_templates[0].custom_fields[1].key_name.should.equal(validProgram2.jira_templates[0].custom_fields[1].key_name);
      response.body.jira_templates[0].custom_fields[1].key_value.should.equal(validProgram2.jira_templates[0].custom_fields[1].key_value);
      response.body.jira_templates[1].infrastructure.should.equal(validProgram2.jira_templates[1].infrastructure);
      response.body.jira_templates[1].jiraBoard.should.equal(validProgram2.jira_templates[1].jiraBoard);
      response.body.jira_templates[1].issueType.should.equal(validProgram2.jira_templates[1].issueType);
      response.body.jira_templates[1].project.should.equal(validProgram2.jira_templates[1].project);
      response.body.jira_templates[1].components[0].should.equal(validProgram2.jira_templates[1].components[0]);
      response.body.jira_templates[1].custom_fields[0].key_name.should.equal(validProgram2.jira_templates[1].custom_fields[0].key_name);
      response.body.jira_templates[1].custom_fields[0].key_value.should.equal(validProgram2.jira_templates[1].custom_fields[0].key_value);
      response.body.jira_templates[1].custom_fields[1].key_name.should.equal(validProgram2.jira_templates[1].custom_fields[1].key_name);
      response.body.jira_templates[1].custom_fields[1].key_value.should.equal(validProgram2.jira_templates[1].custom_fields[1].key_value);
    });

    it('should edit a programs jira template', async function () {
      validProgram2 = _.cloneDeep(validProgramWithJiraTemp);
      validProgram2.jira_templates[0].infrastructure = 'Cloud';
      validProgram2.jira_templates[0].jiraBoard = 'STSOSS';
      validProgram2.jira_templates[0].issueType = 'Story';
      validProgram2.jira_templates[0].project = 'FrameworkTeam_PDUOSS(CIP)';
      validProgram2.jira_templates[0].components = ['TEaaS'];
      validProgram2.jira_templates[0].custom_fields = [{}];
      validProgram2.jira_templates[0].custom_fields[0].key_name = 'Custom Field Name 2';
      validProgram2.jira_templates[0].custom_fields[0].key_value = 'Custom Field Value 2';
      response = await agent.put(`/api/programs/${programObjectWithTemplate._id}`).send(validProgram2).expect(200);
      response.body.name.should.equal(validProgram2.name);
      response.body.jira_templates[0].infrastructure.should.equal(validProgram2.jira_templates[0].infrastructure);
      response.body.jira_templates[0].jiraBoard.should.equal(validProgram2.jira_templates[0].jiraBoard);
      response.body.jira_templates[0].issueType.should.equal(validProgram2.jira_templates[0].issueType);
      response.body.jira_templates[0].project.should.equal(validProgram2.jira_templates[0].project);
      response.body.jira_templates[0].components[0].should.equal(validProgram2.jira_templates[0].components[0]);
      response.body.jira_templates[0].custom_fields[0].key_name.should.equal(validProgram2.jira_templates[0].custom_fields[0].key_name);
      response.body.jira_templates[0].custom_fields[0].key_value.should.equal(validProgram2.jira_templates[0].custom_fields[0].key_value);
    });

    it('should remove jira template from a program', async function () {
      validProgram2 = _.cloneDeep(validProgramWithJiraTemp);
      validProgram2.jira_templates = [];
      response = await agent.put(`/api/programs/${programObjectWithTemplate._id}`).send(validProgram2).expect(200);
      response.body.name.should.equal(validProgram2.name);
      response.body.jira_templates.length.should.equal(0);
    });

    it('should remove a custom field from a programs jira template', async function () {
      validProgram2 = _.cloneDeep(validProgramWithJiraTemp);
      validProgram2.jira_templates[0].custom_fields.splice(0, 1)
      response = await agent.put(`/api/programs/${programObjectWithTemplate._id}`).send(validProgram2).expect(200);
      response.body.name.should.equal(validProgram2.name);
      response.body.jira_templates[0].custom_fields.length.should.equal(0);
    });
  });

  describe('DELETE', function () {
    beforeEach(async function () {
      programObject = new Program(validProgram);
      await programObject.save();
    });

    it('should delete a program and check its response and the db', async function () {
      response = await agent.delete(`/api/Programs/${programObject._id}`).expect(200);
      response.body.should.be.instanceof(Object);
      response.body.name.should.equal(programObject.name);
      count = await Program.count().exec();
      count.should.equal(0);
    });

    it('should not delete a program when user is not authenticated', async function () {
      response = await nonAuthAgent.delete(`/api/programs/${programObject._id}`).expect(401);
      response.body.message.should.equal('User must be logged in');
    });

    it('should not delete a program when user is standard-user', async function () {
      userObject.userRoles = [roleUserObject._id];
      await userObject.save();
      response = await agent.delete(`/api/programs/${programObject._id}`).auth(validUser.username, validUser.password).expect(403);
      response.body.message.should.equal('User is not authorized');
    });

    it('should delete a program when user is standard-user with special permissions', async function () {
      userObject.userRoles = [roleUserObject._id];
      userObject.permissions = {'resources': '/programs', 'allResourceMethods': 'delete', 'userCreatedResourceMethods': ''}
      await userObject.save();
      response = await agent.delete(`/api/programs/${programObject._id}`).auth(validUser.username, validUser.password).expect(200);
    });


    it('should delete a program when user is admin', async function () {
      userObject.userRoles = [roleAdminObject._id];
      await userObject.save();
      await agent.delete(`/api/programs/${programObject._id}`).auth(validUser.username, validUser.password).expect(200);
    });

    it('should delete a program when user is super-admin', async function () {
      userObject.userRoles = [roleSuperAdmObject._id];
      await userObject.save();
      await agent.delete(`/api/programs/${programObject._id}`).auth(validUser.username, validUser.password).expect(200);
    });

    it('should fail when attempting to delete a program that does not exist', async function () {
      response = await agent.delete('/api/programs/000000000000000000000000').expect(404);
      response.body.message.should.equal('A Program with that id does not exist');
    });

    it('should fail when attempting to delete a program which has dependent area', async function () {
      validArea.program_id = programObject._id;
      areaObject = new Area(validArea);
      await areaObject.save();

      response = await agent.delete(`/api/Programs/${programObject._id}`).expect(422);
      response.body.message.should.equal('Can\'t delete Program, it has 1 dependent area(s).');
      count = await Program.count().exec();
      count.should.equal(1);
    });

    it('should update an existing log with user-details for a program thats deleted by a logged-in user', async function () {
      response = await agent.delete(`/api/Programs/${programObject._id}`).expect(200);
      response.body._id.should.have.length(24);
      response.body._id.should.equal(programObject._id.toString());

      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      logReturned.originalData.should.not.equal(undefined);
      logReturned.originalData.name.should.equal(validProgram.name);

      logReturned.updates.should.be.instanceof(Array).and.have.lengthOf(0);
      logReturned.deletedAt.should.not.equal(undefined);
      logReturned.deletedBy.should.not.equal(undefined);
      logReturned.deletedBy.username.should.equal(validUser.username);
      logReturned.deletedBy.email.should.equal(validUser.email);
    });

    it('should create a log with defined user-details for a program that gets deleted by a logged-in user', async function () {
      // clear logs and verify
      await History.remove().exec();
      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      should.not.exist(logReturned);

      response = await agent.delete(`/api/Programs/${programObject._id}`).expect(200);
      response.body._id.should.have.length(24);
      response.body._id.should.equal(programObject._id.toString());

      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      logReturned.originalData.should.not.equal(undefined);
      logReturned.originalData.name.should.equal(validProgram.name);

      logReturned.updates.should.be.instanceof(Array).and.have.lengthOf(0);
      logReturned.deletedAt.should.not.equal(undefined);
      logReturned.deletedBy.should.not.equal(undefined);
      logReturned.deletedBy.username.should.equal(validUser.username);
      logReturned.deletedBy.email.should.equal(validUser.email);
    });
  });

  describe('SEARCH', function () {
    beforeEach(async function () {
      programObject = new Program(validProgram);
      await programObject.save();
    });

    it('should not return a program when passing in a valid parameter with a non existent program ID', async function () {
      response = await agent.get('/api/programs?q=_id=5bcdbe7287e21906ed4f12ba').expect(200);
      response.body.length.should.equal(0);
    });

    it('should not return a program when passing in a valid parameter with a non existent parameter', async function () {
      response = await agent.get('/api/programs?q=' + encodeURIComponent('_id=' + programObject._id
      + '&name=notExisting')).expect(200);
      response.body.length.should.equal(0);
    });

    it('should return an error when not encoding q search parameters', async function () {
      response = await agent.get('/api/programs?q=._id=' + programObject._id + '&name=notExisting').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return a single program when passing in _id parameter', async function () {
      response = await agent.get('/api/programs?q=_id=' + programObject._id).expect(200);
      response.body[0].should.be.instanceof(Object);
      response.body[0].name.should.equal(programObject.name);
    });

    it('should not return a program when passing in invalid parameter', async function () {
      response = await agent.get('/api/programs?q=n0nsense=123454321').expect(200);
      response.body.length.should.equal(0);
    });

    it('should return a single program when passing in name parameter', async function () {
      response = await agent.get('/api/programs?q=name=' + programObject.name).expect(200);
      response.body[0].should.be.instanceof(Object);
      response.body[0].name.should.equal(programObject.name);
    });

    it('should only return fields specified in url', async function () {
      response = await agent.get('/api/programs?fields=name').expect(200);
      response.body.length.should.equal(1);
      for (var key in response.body) {
        if (Object.prototype.hasOwnProperty.call(response.body, key)) {
          Object.prototype.hasOwnProperty.call(response.body[key], 'name').should.equal(true);
        }
      }
    });

    it('should only return fields specified in url using fields and q functionality', async function () {
      response = await agent.get('/api/programs?fields=name&q=name=' + programObject.name).expect(200);
      response.body.length.should.equal(1);
      Object.prototype.hasOwnProperty.call(response.body[0], 'name').should.equal(true);
      response.body[0].name.should.equal(programObject.name);
    });

    it('should return an error message when query has invalid search key blah', async function () {
      response = await agent.get('/api/programs?q=name=' + programObject.name + '&fields=name&blah=blah').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return an error message when queried with an improper search', async function () {
      response = await agent.get('/api/programs?name=' + programObject.name).expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return an error message when queried with an empty q=', async function () {
      response = await agent.get('/api/deployments?q=').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return an error message when queried with an empty fields=', async function () {
      response = await agent.get('/api/programs?fields=').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return an error message when queried with an empty fields= and q=', async function () {
      response = await agent.get('/api/programs?q=&fields=').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });
  });

  afterEach(async function () {
    await User.remove().exec();
    await Deployment.remove().exec();
    await Program.remove().exec();
    await Area.remove().exec();
    await History.remove().exec();
    await Role.remove().exec();
  });
});

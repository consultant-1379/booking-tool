'use strict';

var fs = require('fs');
var should = require('should'),
  superagentDefaults = require('superagent-defaults'),
  supertest = require('supertest'),
  mongoose = require('mongoose'),
  _ = require('lodash'),
  History = require('../../../history/server/models/history.server.model').getSchema('teams'),
  Team = require('../../server/models/teams.server.model').Schema,
  Program = require('../../../programs/server/models/programs.server.model').Schema,
  Area = require('../../../areas/server/models/areas.server.model').Schema,
  Deployment = require('../../../deployments/server/models/deployments.server.model').Schema,
  User = require('../../../users/server/models/user.server.model').Schema,
  Role = require('../../../roles/server/models/roles.server.model').Schema,
  express = require('../../../../config/lib/express');

var app,
  agent,
  nonAuthAgent,
  validTeam,
  badTeam,
  teamReturned,
  teamObject,
  validTeam2,
  team2Object,
  validProgram,
  programObject,
  validArea,
  validDeployment,
  areaObject,
  deploymentObject,
  validUser,
  validUser2,
  validUser3,
  userObject,
  userObject2,
  userObject3,
  count,
  logReturned,
  response,
  validUserRole,
  validAdminRole,
  validSuperAdminRole,
  roleSuperAdmObject,
  roleAdminObject,
  roleUserObject;

describe('Teams', function () {
  before(async function () {
    app = express.init(mongoose);
    nonAuthAgent = superagentDefaults(supertest(app));
    agent = superagentDefaults(supertest(app));
  });
  beforeEach(async function () {
    validTeam = JSON.parse(fs.readFileSync('/opt/mean.js/modules/teams/tests/server/test_files/valid_team.json', 'utf8'));
    validProgram = JSON.parse(fs.readFileSync('/opt/mean.js/modules/programs/tests/server/test_files/valid_program.json', 'utf8'));
    validArea = JSON.parse(fs.readFileSync('/opt/mean.js/modules/areas/tests/server/test_files/valid_area.json', 'utf8'));
    validDeployment = JSON.parse(fs.readFileSync('/opt/mean.js/modules/deployments/tests/server/test_files/valid_deployment.json', 'utf8'));
    validUser = JSON.parse(fs.readFileSync('/opt/mean.js/modules/users/tests/server/test_files/valid_user.json', 'utf8'));
    validUser2 = JSON.parse(fs.readFileSync('/opt/mean.js/modules/users/tests/server/test_files/valid_user2.json', 'utf8'));
    validUser3 = JSON.parse(fs.readFileSync('/opt/mean.js/modules/users/tests/server/test_files/valid_user3.json', 'utf8'));
    validUserRole = JSON.parse(fs.readFileSync('/opt/mean.js/modules/roles/tests/server/test_files/valid_user_role.json', 'utf8'));
    validAdminRole = JSON.parse(fs.readFileSync('/opt/mean.js/modules/roles/tests/server/test_files/valid_admin_role.json', 'utf8'));
    validSuperAdminRole = JSON.parse(fs.readFileSync('/opt/mean.js/modules/roles/tests/server/test_files/valid_super_admin_role.json', 'utf8'));

    roleSuperAdmObject = new Role(validSuperAdminRole);
    roleAdminObject = new Role(validAdminRole);
    roleUserObject = new Role(validUserRole);
    await roleSuperAdmObject.save();
    await roleAdminObject.save();
    await roleUserObject.save();

    programObject = new Program(validProgram);
    await programObject.save();

    validArea.program_id = programObject._id;
    areaObject = new Area(validArea);
    await areaObject.save();

    validDeployment.program_id = programObject._id;
    validDeployment.area_id = areaObject._id;
    deploymentObject = new Deployment(validDeployment);
    await deploymentObject.save();

    validUser.userRoles = [roleAdminObject._id];
    userObject = new User(validUser);
    await userObject.save();
    validUser2.userRoles = [roleUserObject._id];
    userObject2 = new User(validUser2);
    await userObject2.save();
    validUser3.userRoles = [roleSuperAdmObject._id];
    userObject3 = new User(validUser3);
    await userObject3.save();

    validTeam.admin_IDs = [userObject._id];
    validTeam.area_id = areaObject._id;

    agent.auth(validUser.username, validUser.password); // Setup User Authorization
  });

  describe('POST', function () {
    it('should create a new Team and check db', async function () {
      response = await agent
        .post('/api/teams')
        .send(validTeam)
        .expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/Teams/${response.body._id}`);
      response.body.name.should.equal(validTeam.name);
      teamReturned = await Team.findById(response.body._id).exec();
      teamReturned.name.should.equal(validTeam.name);
      (JSON.stringify(teamReturned.area_id)).should.equal(JSON.stringify(validTeam.area_id));
    });

    it('should not create a new Team when user is not authenticated', async function () {
      response = await nonAuthAgent.post('/api/teams').send(validTeam).expect(401);
      response.body.message.should.equal('User must be logged in');
    });

    it('should not create a new Team when user is standard-user', async function () {
      userObject.userRoles = [roleUserObject._id];
      await userObject.save();
      response = await agent.post('/api/teams').auth(validUser.username, validUser.password).send(validTeam).expect(403);
      response.body.message.should.equal('User is not authorized');
    });

    it('should create a new Team when user is standard-user with special permissions', async function () {
      userObject.userRoles = [roleAdminObject._id];
      userObject.permissions = { resources: '/teams', allResourceMethods: 'post', userCreatedResourceMethods: '' };
      await userObject.save();
      await agent.post('/api/teams').auth(validUser.username, validUser.password).send(validTeam).expect(201);
    });

    it('should create a new Team when user is admin', async function () {
      userObject.userRoles = [roleAdminObject._id];
      await userObject.save();
      await agent.post('/api/teams').auth(validUser.username, validUser.password).send(validTeam).expect(201);
    });

    it('should create a new Team when user is super-admin', async function () {
      userObject.userRoles = [roleSuperAdmObject._id];
      await userObject.save();
      await agent.post('/api/teams').auth(validUser.username, validUser.password).send(validTeam).expect(201);
    });

    it('should not create a new Team if associated user does not exist', async function () {
      validTeam.users = ['987654321098765432109876'];
      response = await agent.post('/api/teams').send(validTeam).expect(422);
      response.body.message.should.equal('An associated user id does not exist.');
    });

    it('should create a new Team with only two admin users', async function () {
      validTeam.admin_IDs = [userObject._id, userObject2._id];
      response = await agent.post('/api/teams').send(validTeam).expect(201);
      response.body.name.should.equal(validTeam.name);
    });

    it('should not create a new Team with more than two admin users', async function () {
      validTeam.admin_IDs = [userObject._id, userObject2._id, userObject3._id];
      response = await agent.post('/api/teams').send(validTeam).expect(422);
      response.body.message.should.equal('There can be only a maximium of two admin users per team.');
    });

    it('should not create a new Team with duplicate admin users', async function () {
      validTeam.admin_IDs = [userObject._id, userObject._id];
      response = await agent.post('/api/teams').send(validTeam).expect(422);
      response.body.message.should.equal('Duplicate users added to admin team.');
    });

    it('should not create a new Team with duplicate users', async function () {
      validTeam.users = [userObject._id, userObject._id];
      response = await agent.post('/api/teams').send(validTeam).expect(422);
      response.body.message.should.equal('Duplicate users added to team.');
    });

    it('should not post more than one team with the same name', async function () {
      teamObject = new Team(validTeam);
      await teamObject.save();
      response = await agent.post('/api/teams').send(validTeam).expect(400);
      response.body.message.should.equal('Error, provided name is not unique.');
    });

    it('should not post team with a name more than 50 characters', async function () {
      badTeam = _.cloneDeep(validTeam);
      badTeam.name = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      response = await agent.post('/api/teams').send(badTeam).expect(400);
      response.body.message.should.equal('Path `name` (`' + badTeam.name + '`) is longer than the maximum allowed length (50).');
    });

    it('should not post a team without a name key', async function () {
      badTeam = _.cloneDeep(validTeam);
      delete badTeam.name;
      response = await agent.post('/api/teams').send(badTeam).expect(400);
      response.body.message.should.equal('Path `name` is required.');
    });

    it('should not post a team with unknown key', async function () {
      badTeam = _.cloneDeep(validTeam);
      badTeam.rogueKey = 'rogueValue';
      response = await agent.post('/api/teams').send(badTeam).expect(400);
      response.body.message.should.equal('Field `rogueKey` is not in schema and strict mode is set to throw.');
    });

    it('should respond with bad request with invalid json', async function () {
      badTeam = '{';
      response = await agent.post('/api/teams').send(badTeam).type('json').expect(400);
      response.body.message.should.equal('There was a syntax error found in your request, please make sure that it is valid and try again');
    });

    it('should post a new log with user-details when a team is created by a logged-in user', async function () {
      response = await agent.post('/api/teams').send(validTeam).expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/Teams/${response.body._id}`);
      response.body.name.should.equal(validTeam.name);
      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      logReturned.originalData.should.not.equal(undefined);
      logReturned.originalData.name.should.equal(validTeam.name);
      logReturned.createdAt.should.not.equal(undefined);
      logReturned.createdBy.should.not.equal(undefined);
      logReturned.createdBy.username.should.equal(validUser.username);
      logReturned.createdBy.email.should.equal(validUser.email);
      logReturned.updates.should.be.instanceof(Array).and.have.lengthOf(0);
    });

    it('should not post a new log for a Team that is created with a name beginning with \'A_Health_\'', async function () {
      var validTeamHealth = _.cloneDeep(validTeam);
      validTeamHealth.name = 'A_Health_Area';
      response = await agent.post('/api/Teams').send(validTeamHealth).expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/Teams/${response.body._id}`);
      response.body.name.should.equal(validTeamHealth.name);
      teamReturned = await Team.findById(response.body._id).exec();
      teamReturned.name.should.equal(validTeamHealth.name);

      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      should.not.exist(logReturned);
    });
  });

  describe('GET', function () {
    beforeEach(async function () {
      teamObject = new Team(validTeam);
      await teamObject.save();
    });

    it('should be able to get empty team list', async function () {
      await teamObject.remove();
      response = await agent.get('/api/teams').expect(200);
      response.body.should.be.instanceof(Array).and.have.lengthOf(0);
    });

    it('should be able to get teams when user not authenticated', async function () {
      await nonAuthAgent.get('/api/teams').expect(200);
    });

    it('should be able to get teams when user is authenticated', async function () {
      await agent.get('/api/teams').expect(200);
    });

    it('should be able to get team list with one element', async function () {
      response = await agent.get('/api/teams').expect(200);
      response.body.should.be.instanceof(Array).and.have.lengthOf(1);
      response.body[0].name.should.equal(validTeam.name);
    });

    it('should be able to get team list with more than one element', async function () {
      validTeam2 = _.cloneDeep(validTeam);
      validTeam2.name = 'anotherTeamName';
      team2Object = new Team(validTeam2);
      await team2Object.save();
      response = await agent.get('/api/teams').expect(200);
      response.body.should.be.instanceof(Array).and.have.lengthOf(2);
      response.body[0].name.should.equal(validTeam2.name);
      response.body[1].name.should.deepEqual(validTeam.name);
    });

    it('should be able to get a single team', async function () {
      response = await agent.get(`/api/teams/${teamObject._id}`).expect(200);
      response.body.name.should.equal(validTeam.name);
    });

    it('should be able to get single team when user not authenticated', async function () {
      await nonAuthAgent.get(`/api/teams/${teamObject._id}`).expect(200);
    });

    it('should be able to get single team when user is authenticated', async function () {
      await agent.get(`/api/teams/${teamObject._id}`).expect(200);
    });

    it('should throw 404 when id is not in database', async function () {
      response = await agent.get('/api/teams/000000000000000000000000').expect(404);
      response.body.message.should.equal('A Team with that id does not exist');
    });

    it('should throw 404 when id is invalid in the database', async function () {
      response = await agent.get('/api/teams/0').expect(404);
      response.body.message.should.equal('A Team with that id does not exist');
    });
  });

  describe('PUT', function () {
    beforeEach(async function () {
      teamObject = new Team(validTeam);
      await teamObject.save();
    });

    it('should not update a team when user is not authenticated', async function () {
      validTeam.name = 'updatedName';
      response = await nonAuthAgent.put(`/api/teams/${teamObject._id}`)
        .send(validTeam).expect(401);
      response.body.message.should.equal('User must be logged in');
    });

    it('should not update a team when user is standard-user', async function () {
      validTeam.name = 'updatedName';
      userObject.userRoles = [roleUserObject._id];
      await userObject.save();
      response = await agent.put(`/api/teams/${teamObject._id}`)
        .auth(validUser.username, validUser.password).send(validTeam).expect(403);
      response.body.message.should.equal('User is not authorized');
    });

    it('should update a team when user is standard-user with special permissions', async function () {
      validTeam.name = 'updatedName';
      userObject.permissions = { resources: '/teams', allResourceMethods: 'put', userCreatedResourceMethods: '' };
      userObject.userRoles = [roleUserObject._id];
      await userObject.save();
      response = await agent.put(`/api/teams/${teamObject._id}`).send(validTeam).expect(200);
    });

    it('should update a team when user is admin', async function () {
      validTeam.name = 'updatedName';
      userObject.userRoles = [roleAdminObject._id];
      await userObject.save();
      response = await agent.put(`/api/teams/${teamObject._id}`).send(validTeam).expect(200);
    });

    it('should update a team when user is super-admin', async function () {
      validTeam.name = 'updatedName';
      userObject.userRoles = [roleSuperAdmObject._id];
      await userObject.save();
      await agent.put(`/api/teams/${teamObject._id}`)
        .auth(validUser.username, validUser.password)
        .send(validTeam).expect(200);
    });

    it('should update an existing log with user-details when a team is updated', async function () {
      validTeam.users.push(userObject3._id);
      response = await agent.put(`/api/teams/${teamObject._id}`).send(validTeam).expect(200);
      response.body._id.should.have.length(24);
      response.body.users.includes(userObject3._id.toString()).should.be.true();

      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      logReturned.originalData.should.not.equal(undefined);
      logReturned.originalData.users.includes(userObject3._id.toString()).should.be.false();

      logReturned.updates.should.be.instanceof(Array).and.have.lengthOf(1);
      logReturned.updates[0].updatedAt.should.not.equal(undefined);
      logReturned.updates[0].updatedBy.should.not.equal(undefined);
      logReturned.updates[0].updatedBy.username.should.equal(validUser.username);
      logReturned.updates[0].updatedBy.email.should.equal(validUser.email);
      logReturned.updates[0].updateData.users[0].toString().should.equal(userObject3._id.toString());
    });

    it('should create a log (when none exists) with defined user-details for a team that gets updated by a logged-in user', async function () {
      // clear logs and verify
      await History.remove().exec();
      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      should.not.exist(logReturned);

      validTeam.users.push(userObject3._id);
      response = await agent.put(`/api/teams/${teamObject._id}`).send(validTeam).expect(200);
      response.body._id.should.have.length(24);
      response.body.users.includes(userObject3._id.toString()).should.be.true();

      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      logReturned.originalData.should.not.equal(undefined);
      logReturned.originalData.users.includes(userObject3._id.toString()).should.be.false();

      logReturned.updates.should.be.instanceof(Array).and.have.lengthOf(1);
      logReturned.updates[0].updatedAt.should.not.equal(undefined);
      logReturned.updates[0].updatedBy.should.not.equal(undefined);
      logReturned.updates[0].updatedBy.username.should.equal(validUser.username);
      logReturned.updates[0].updatedBy.email.should.equal(validUser.email);
      logReturned.updates[0].updateData.users[0].toString().should.equal(userObject3._id.toString());
    });
  });

  describe('DELETE', function () {
    beforeEach(async function () {
      teamObject = new Team(validTeam);
      await teamObject.save();
    });

    it('should delete a team as superAdmin and check its response and the db', async function () {
      response = await agent.delete(`/api/teams/${teamObject._id}`)
        .auth(validUser3.username, validUser3.password).expect(200);
      response.body.should.be.instanceof(Object);
      response.body.name.should.equal(teamObject.name);
      count = await Team.count().exec();
      count.should.equal(0);
    });

    it('should not delete a team when user is not authenticated', async function () {
      response = await nonAuthAgent.delete(`/api/teams/${teamObject._id}`).expect(401);
      response.body.message.should.equal('User must be logged in');
    });

    it('should not delete a team when user is standard-user', async function () {
      userObject.userRoles = [roleUserObject._id];
      await userObject.save();
      response = await agent.delete(`/api/teams/${teamObject._id}`).auth(validUser.username, validUser.password).expect(403);
      response.body.message.should.equal('User is not authorized');
    });

    it('should delete a team when user is standard-user with special permissions', async function () {
      userObject.userRoles = [roleAdminObject._id];
      userObject.permissions = { resources: '/teams', allResourceMethods: 'delete', userCreatedResourceMethods: '' };
      await userObject.save();
      await agent.delete(`/api/teams/${teamObject._id}`).auth(validUser.username, validUser.password).expect(200);
    });

    it('should delete a team when user is admin', async function () {
      userObject.userRoles = [roleAdminObject._id];
      await userObject.save();
      await agent.delete(`/api/teams/${teamObject._id}`).auth(validUser.username, validUser.password).expect(200);
    });

    it('should delete a team when user is super-admin', async function () {
      userObject.userRoles = [roleSuperAdmObject._id];
      await userObject.save();
      await agent.delete(`/api/teams/${teamObject._id}`).auth(validUser.username, validUser.password).expect(200);
    });

    it('should fail when attempting to delete a team that does not exist', async function () {
      response = await agent.delete('/api/teams/000000000000000000000000').expect(404);
      response.body.message.should.equal('A Team with that id does not exist');
    });

    it('should update an existing log with user-details for a team thats deleted by a logged-in user', async function () {
      response = await agent.delete(`/api/teams/${teamObject._id}`).expect(200);
      response.body._id.should.have.length(24);
      response.body._id.should.equal(teamObject._id.toString());

      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      logReturned.originalData.should.not.equal(undefined);
      logReturned.originalData.name.should.equal(teamObject.name);

      logReturned.updates.should.be.instanceof(Array).and.have.lengthOf(0);
      logReturned.deletedAt.should.not.equal(undefined);
      logReturned.deletedBy.should.not.equal(undefined);
      logReturned.deletedBy.username.should.equal(validUser.username);
      logReturned.deletedBy.email.should.equal(validUser.email);
    });

    it('should create a log with defined user-details for a team that gets deleted by a logged-in user', async function () {
      // clear logs and verify
      await History.remove().exec();
      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      should.not.exist(logReturned);

      response = await agent.delete(`/api/teams/${teamObject._id}`).expect(200);
      response.body._id.should.have.length(24);
      response.body._id.should.equal(teamObject._id.toString());

      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      logReturned.originalData.should.not.equal(undefined);
      logReturned.originalData.name.should.equal(teamObject.name);

      logReturned.updates.should.be.instanceof(Array).and.have.lengthOf(0);
      logReturned.deletedAt.should.not.equal(undefined);
      logReturned.deletedBy.should.not.equal(undefined);
      logReturned.deletedBy.username.should.equal(validUser.username);
      logReturned.deletedBy.email.should.equal(validUser.email);
    });
  });

  describe('SEARCH', function () {
    beforeEach(async function () {
      teamObject = new Team(validTeam);
      await teamObject.save();
    });

    it('should not return a team when passing in a valid parameter with a non existent team ID', async function () {
      response = await agent.get('/api/teams?q=_id=5bcdbe7287e21906ed4f12ba').expect(200);
      response.body.length.should.equal(0);
    });

    it('should not return a team when passing in a valid parameter with a non existent parameter', async function () {
      response = await agent.get('/api/teams?q=' + encodeURIComponent('_id=' + teamObject._id
      + '&name=notExisting')).expect(200);
      response.body.length.should.equal(0);
    });

    it('should return an error when not encoding q search parameters', async function () {
      response = await agent.get('/api/teams?q=._id=' + teamObject._id + '&name=notExisting').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return a single team when passing in _id parameter', async function () {
      response = await agent.get('/api/teams?q=_id=' + teamObject._id).expect(200);
      response.body[0].should.be.instanceof(Object);
      response.body[0].name.should.equal(teamObject.name);
    });

    it('should return a single team when passing in area_id parameter', async function () {
      response = await agent.get('/api/teams?q=area_id=' + teamObject.area_id).expect(200);
      response.body[0].should.be.instanceof(Object);
      response.body[0].name.should.equal(teamObject.name);
    });

    it('should not return a team when passing in invalid parameter', async function () {
      response = await agent.get('/api/teams?q=n0nsense=123454321').expect(200);
      response.body.length.should.equal(0);
    });

    it('should return a single team when passing in name parameter', async function () {
      response = await agent.get('/api/teams?q=name=' + teamObject.name).expect(200);
      response.body[0].should.be.instanceof(Object);
      response.body[0].name.should.equal(teamObject.name);
    });

    it('should only return fields specified in url', async function () {
      response = await agent.get('/api/teams?fields=name').expect(200);
      response.body.length.should.equal(1);
      for (var key in response.body) {
        if (Object.prototype.hasOwnProperty.call(response.body, key)) {
          Object.prototype.hasOwnProperty.call(response.body[key], 'name').should.equal(true);
        }
      }
    });

    it('should only return fields specified in url using fields and q functionality', async function () {
      response = await agent.get('/api/teams?fields=name&q=name=' + teamObject.name).expect(200);
      response.body.length.should.equal(1);
      Object.prototype.hasOwnProperty.call(response.body[0], 'name').should.equal(true);
      response.body[0].name.should.equal(teamObject.name);
    });

    it('should return an error message when query has invalid search key blah', async function () {
      response = await agent.get('/api/teams?q=name=' + teamObject.name + '&fields=name&blah=blah').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return an error message when queried with an improper search', async function () {
      response = await agent.get('/api/teams?name=' + teamObject.name).expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return an error message when queried with an empty q=', async function () {
      response = await agent.get('/api/teams?q=').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return an error message when queried with an empty fields=', async function () {
      response = await agent.get('/api/teams?fields=').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return an error message when queried with an empty fields= and q=', async function () {
      response = await agent.get('/api/teams?q=&fields=').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });
  });

  afterEach(async function () {
    await Deployment.remove().exec();
    await Team.remove().exec();
    await History.remove().exec();
    await User.remove().exec();
    await Program.remove().exec();
    await Area.remove().exec();
    await Role.remove().exec();
  });
});

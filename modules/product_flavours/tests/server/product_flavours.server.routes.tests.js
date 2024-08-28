'use strict';

var fs = require('fs');
var should = require('should'),
  superagentDefaults = require('superagent-defaults'),
  supertest = require('supertest'),
  mongoose = require('mongoose'),
  _ = require('lodash'),
  History = require('../../../history/server/models/history.server.model').getSchema('productflavours'),
  ProductFlavour = require('../../server/models/product_flavours.server.model').Schema,
  ProductType = require('../../../product_types/server/models/product_types.server.model').Schema,
  User = require('../../../users/server/models/user.server.model').Schema,
  Role = require('../../../roles/server/models/roles.server.model').Schema,
  express = require('../../../../config/lib/express');

var app,
  agent,
  nonAuthAgent,
  validProductFlavour,
  badProductFlavour,
  productFlavourReturned,
  productFlavourObject,
  validProductFlavour2,
  productFlavour2Object,
  validProductType,
  dependentProductType,
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

describe('ProductFlavours', function () {
  before(async function () {
    app = express.init(mongoose);
    nonAuthAgent = superagentDefaults(supertest(app));
    agent = superagentDefaults(supertest(app));
  });
  beforeEach(async function () {
    validProductFlavour = JSON.parse(fs.readFileSync('/opt/mean.js/modules/product_flavours/tests/server/test_files/valid_product_flavour.json', 'utf8'));
    validProductType = JSON.parse(fs.readFileSync('/opt/mean.js/modules/product_types/tests/server/test_files/valid_product_type.json', 'utf8'));
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
    it('should create a new Product-Flavour and check db', async function () {
      response = await agent.post('/api/productFlavours').send(validProductFlavour).expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/ProductFlavours/${response.body._id}`);
      response.body.name.should.equal(validProductFlavour.name);
      productFlavourReturned = await ProductFlavour.findById(response.body._id).exec();
      productFlavourReturned.name.should.equal(validProductFlavour.name);
    });

    it('should not create a new Product-Flavour when user is not authenticated', async function () {
      response = await nonAuthAgent.post('/api/productFlavours').send(validProductFlavour).expect(401);
      response.body.message.should.equal('User must be logged in');
    });

    it('should not create a new Product-Flavour when user is standard-user', async function () {
      userObject.userRoles = [roleUserObject._id];
      await userObject.save();
      response = await agent.post('/api/productFlavours').auth(validUser.username, validUser.password).send(validProductFlavour).expect(403);
      response.body.message.should.equal('User is not authorized');
    });

    it('should create a new Product-Flavour when user is standard-user with special permissions', async function () {
      userObject.userRoles = [roleAdminObject._id];
      userObject.permissions = {'resources': '/productFlavours', 'allResourceMethods': 'post', 'userCreatedResourceMethods': ''}
      await userObject.save();
      await agent.post('/api/productFlavours').auth(validUser.username, validUser.password).send(validProductFlavour).expect(201);
    });

    it('should create a new Product-Flavour when user is admin', async function () {
      userObject.userRoles = [roleAdminObject._id];
      await userObject.save();
      await agent.post('/api/productFlavours').auth(validUser.username, validUser.password).send(validProductFlavour).expect(201);
    });

    it('should create a new Product-Flavour when user is super-admin', async function () {
      userObject.userRoles = [roleSuperAdmObject._id];
      await userObject.save();
      await agent.post('/api/productFlavours').auth(validUser.username, validUser.password).send(validProductFlavour).expect(201);
    });

    it('should not post more than one Product-Flavour with the same name', async function () {
      productFlavourObject = new ProductFlavour(validProductFlavour);
      await productFlavourObject.save();
      response = await agent.post('/api/productFlavours').send(validProductFlavour).expect(400);
      response.body.message.should.equal('Error, provided name is not unique.');
    });

    it('should not post Product-Flavour with a name less than 2 characters', async function () {
      badProductFlavour = _.cloneDeep(validProductFlavour);
      badProductFlavour.name = 'x';
      response = await agent.post('/api/productFlavours').send(badProductFlavour).expect(400);
      response.body.message.should.equal('Path `name` (`' + badProductFlavour.name + '`) is shorter than the minimum allowed length (2).');
    });

    it('should not post Product-Flavour with a name more than 50 characters', async function () {
      badProductFlavour = _.cloneDeep(validProductFlavour);
      badProductFlavour.name = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      response = await agent.post('/api/productFlavours').send(badProductFlavour).expect(400);
      response.body.message.should.equal('Path `name` (`' + badProductFlavour.name + '`) is longer than the maximum allowed length (50).');
    });

    it('should not allow an Product-Flavour with a non-alphanumeric-underscored name', async function () {
      badProductFlavour = _.cloneDeep(validProductFlavour);
      badProductFlavour.name = '!£$%&';
      response = await agent.post('/api/productFlavours').send(badProductFlavour).expect(400);
      response.body.message.should.equal('name is not valid; \'!£$%&\' can only contain letters, numbers, dots, dashes and underscores.');
    });

    it('should not post an Product-Flavour without a name key', async function () {
      badProductFlavour = _.cloneDeep(validProductFlavour);
      delete badProductFlavour.name;
      response = await agent.post('/api/productFlavours').send(badProductFlavour).expect(400);
      response.body.message.should.equal('Path `name` is required.');
    });

    it('should not post an Product-Flavour with unknown key', async function () {
      badProductFlavour = _.cloneDeep(validProductFlavour);
      badProductFlavour.rogueKey = 'rogueValue';
      response = await agent.post('/api/productFlavours').send(badProductFlavour).expect(400);
      response.body.message.should.equal('Field `rogueKey` is not in schema and strict mode is set to throw.');
    });

    it('should respond with bad request with invalid json', async function () {
      badProductFlavour = '{';
      response = await agent.post('/api/productFlavours').send(badProductFlavour).type('json').expect(400);
      response.body.message.should.equal('There was a syntax error found in your request, please make sure that it is valid and try again');
    });

    it('should post a new log with user-details when an Product-Flavour is created by a logged-in user', async function () {
      response = await agent.post('/api/productFlavours').send(validProductFlavour).expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/ProductFlavours/${response.body._id}`);
      response.body.name.should.equal(validProductFlavour.name);
      productFlavourReturned = await ProductFlavour.findById(response.body._id).exec();
      productFlavourReturned.name.should.equal(validProductFlavour.name);

      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      logReturned.originalData.should.not.equal(undefined);
      logReturned.originalData.name.should.equal(validProductFlavour.name);
      logReturned.createdAt.should.not.equal(undefined);
      logReturned.createdBy.should.not.equal(undefined);
      logReturned.createdBy.username.should.equal(validUser.username);
      logReturned.createdBy.email.should.equal(validUser.email);
      logReturned.updates.should.be.instanceof(Array).and.have.lengthOf(0);
    });

    it('should not post a new log for a Product-Flavour that is created with a name beginning with \'A_Health_\'', async function () {
      var validProductFlavourHealth = _.cloneDeep(validProductFlavour);
      validProductFlavourHealth.name = 'A_Health_ProductFlavour';
      response = await agent.post('/api/ProductFlavours').send(validProductFlavourHealth).expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/ProductFlavours/${response.body._id}`);
      response.body.name.should.equal(validProductFlavourHealth.name);
      productFlavourReturned = await ProductFlavour.findById(response.body._id).exec();
      productFlavourReturned.name.should.equal(validProductFlavourHealth.name);

      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      should.not.exist(logReturned);
    });
  });

  describe('GET', function () {
    beforeEach(async function () {
      productFlavourObject = new ProductFlavour(validProductFlavour);
      await productFlavourObject.save();
    });

    it('should be able to get empty Product-Flavour list', async function () {
      await productFlavourObject.remove();
      response = await agent.get('/api/productFlavours').expect(200);
      response.body.should.be.instanceof(Array).and.have.lengthOf(0);
    });

    it('should be able to get Product-Flavour list when user not authenticated', async function () {
      await nonAuthAgent.get('/api/productFlavours').expect(200);
    });

    it('should be able to get Product-Flavour list when user is authenticated', async function () {
      await agent.get('/api/productFlavours').expect(200);
    });

    it('should be able to get Product-Flavour list with one element', async function () {
      response = await agent.get('/api/productFlavours').expect(200);
      response.body.should.be.instanceof(Array).and.have.lengthOf(1);
      response.body[0].name.should.equal(validProductFlavour.name);
    });

    it('should be able to get Product-Flavour list with more than one element', async function () {
      validProductFlavour2 = _.cloneDeep(validProductFlavour);
      validProductFlavour2.name = 'anotherProductFlavourName';
      productFlavour2Object = new ProductFlavour(validProductFlavour2);
      await productFlavour2Object.save();
      response = await agent.get('/api/productFlavours').expect(200);
      response.body.should.be.instanceof(Array).and.have.lengthOf(2);
      response.body[0].name.should.equal(validProductFlavour2.name);
      response.body[1].name.should.deepEqual(validProductFlavour.name);
    });

    it('should be able to get a single Product-Flavour', async function () {
      response = await agent.get(`/api/ProductFlavours/${productFlavourObject._id}`).expect(200);
      response.body.name.should.equal(validProductFlavour.name);
    });

    it('should be able to get single Product-Flavour when user not authenticated', async function () {
      await nonAuthAgent.get(`/api/ProductFlavours/${productFlavourObject._id}`).expect(200);
    });

    it('should be able to get single Product-Flavour when user is authenticated', async function () {
      await agent.get(`/api/ProductFlavours/${productFlavourObject._id}`).expect(200);
    });

    it('should throw 404 when id is not in database', async function () {
      response = await agent.get('/api/productFlavours/000000000000000000000000').expect(404);
      response.body.message.should.equal('A ProductFlavour with that id does not exist');
    });

    it('should throw 404 when id is invalid in the database', async function () {
      response = await agent.get('/api/productFlavours/0').expect(404);
      response.body.message.should.equal('A ProductFlavour with that id does not exist');
    });
  });

  describe('DELETE', function () {
    beforeEach(async function () {
      productFlavourObject = new ProductFlavour(validProductFlavour);
      await productFlavourObject.save();
    });

    it('should delete an Product-Flavour and check its response and the db', async function () {
      response = await agent.delete(`/api/ProductFlavours/${productFlavourObject._id}`).expect(200);
      response.body.should.be.instanceof(Object);
      response.body.name.should.equal(productFlavourObject.name);
      count = await ProductFlavour.count().exec();
      count.should.equal(0);
    });

    it('should not delete a Product-Flavour when user is not authenticated', async function () {
      response = await nonAuthAgent.delete(`/api/productFlavours/${productFlavourObject._id}`).expect(401);
      response.body.message.should.equal('User must be logged in');
    });

    it('should not delete an Product-Flavour when user is standard-user', async function () {
      userObject.userRoles = [roleUserObject._id];
      await userObject.save();
      response = await agent.delete(`/api/productFlavours/${productFlavourObject._id}`).auth(validUser.username, validUser.password).expect(403);
      response.body.message.should.equal('User is not authorized');
    });

    it('should delete an Product-Flavour when user is standard-user with special permissions', async function () {
      userObject.userRoles = [roleAdminObject._id];
      userObject.permissions = {'resources': '/productFlavours', 'allResourceMethods': 'delete', 'userCreatedResourceMethods': ''}
      await userObject.save();
      await agent.delete(`/api/productFlavours/${productFlavourObject._id}`).auth(validUser.username, validUser.password).expect(200);
    });

    it('should delete an Product-Flavour when user is admin', async function () {
      userObject.userRoles = [roleAdminObject._id];
      await userObject.save();
      await agent.delete(`/api/productFlavours/${productFlavourObject._id}`).auth(validUser.username, validUser.password).expect(200);
    });

    it('should delete an Product-Flavour when user is super-admin', async function () {
      userObject.userRoles = [roleSuperAdmObject._id];
      await userObject.save();
      await agent.delete(`/api/productFlavours/${productFlavourObject._id}`).auth(validUser.username, validUser.password).expect(200);
    });

    it('should fail when attempting to delete an Product-Flavour that does not exist', async function () {
      response = await agent.delete('/api/productFlavours/000000000000000000000000').expect(404);
      response.body.message.should.equal('A ProductFlavour with that id does not exist');
    });

    it('should fail when attempting to delete a Product-Flavour which has dependent Product-Yypes', async function () {
      validProductType.flavours = [productFlavourObject.name];
      dependentProductType = new ProductType(validProductType);
      await dependentProductType.save();

      response = await agent.delete(`/api/ProductFlavours/${productFlavourObject._id}`).expect(422);
      response.body.message.should.equal('Can\'t delete Product-Flavour, it has 1 dependent product-type(s).');
      count = await ProductFlavour.count().exec();
      count.should.equal(1);
    });

    it('should update an existing log with user-details for an Product-Flavour thats deleted by a logged-in user', async function () {
      response = await agent.delete(`/api/ProductFlavours/${productFlavourObject._id}`).expect(200);
      response.body._id.should.have.length(24);
      response.body._id.should.equal(productFlavourObject._id.toString());

      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      logReturned.originalData.should.not.equal(undefined);
      logReturned.originalData.name.should.equal(validProductFlavour.name);

      logReturned.updates.should.be.instanceof(Array).and.have.lengthOf(0);
      logReturned.deletedAt.should.not.equal(undefined);
      logReturned.deletedBy.should.not.equal(undefined);
      logReturned.deletedBy.username.should.equal(validUser.username);
      logReturned.deletedBy.email.should.equal(validUser.email);
    });

    it('should create a log with defined user-details for an Product-Flavour that gets deleted by a logged-in user', async function () {
      // clear logs and verify
      await History.remove().exec();
      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      should.not.exist(logReturned);

      response = await agent.delete(`/api/ProductFlavours/${productFlavourObject._id}`).expect(200);
      response.body._id.should.have.length(24);
      response.body._id.should.equal(productFlavourObject._id.toString());

      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      logReturned.originalData.should.not.equal(undefined);
      logReturned.originalData.name.should.equal(validProductFlavour.name);

      logReturned.updates.should.be.instanceof(Array).and.have.lengthOf(0);
      logReturned.deletedAt.should.not.equal(undefined);
      logReturned.deletedBy.should.not.equal(undefined);
      logReturned.deletedBy.username.should.equal(validUser.username);
      logReturned.deletedBy.email.should.equal(validUser.email);
    });
  });

  describe('SEARCH', function () {
    beforeEach(async function () {
      productFlavourObject = new ProductFlavour(validProductFlavour);
      await productFlavourObject.save();
    });

    it('should not return an Product-Flavour when passing in a valid parameter with a non existent Product-Flavour ID', async function () {
      response = await agent.get('/api/productFlavours?q=_id=5bcdbe7287e21906ed4f12ba').expect(200);
      response.body.length.should.equal(0);
    });

    it('should not return an Product-Flavour when passing in a valid parameter with a non existent parameter', async function () {
      response = await agent.get('/api/productFlavours?q=' + encodeURIComponent('_id=' + productFlavourObject._id
      + '&name=notExisting')).expect(200);
      response.body.length.should.equal(0);
    });

    it('should return an error when not encoding q search parameters', async function () {
      response = await agent.get('/api/productFlavours?q=._id=' + productFlavourObject._id + '&name=notExisting').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return a single Product-Flavour when passing in _id parameter', async function () {
      response = await agent.get('/api/productFlavours?q=_id=' + productFlavourObject._id).expect(200);
      response.body[0].should.be.instanceof(Object);
      response.body[0].name.should.equal(productFlavourObject.name);
    });

    it('should not return an Product-Flavour when passing in invalid parameter', async function () {
      response = await agent.get('/api/productFlavours?q=n0nsense=123454321').expect(200);
      response.body.length.should.equal(0);
    });

    it('should return a single Product-Flavour when passing in name parameter', async function () {
      response = await agent.get('/api/productFlavours?q=name=' + productFlavourObject.name).expect(200);
      response.body[0].should.be.instanceof(Object);
      response.body[0].name.should.equal(productFlavourObject.name);
    });

    it('should only return fields specified in url', async function () {
      response = await agent.get('/api/productFlavours?fields=name').expect(200);
      response.body.length.should.equal(1);
      for (var key in response.body) {
        if (Object.prototype.hasOwnProperty.call(response.body, key)) {
          Object.prototype.hasOwnProperty.call(response.body[key], 'name').should.equal(true);
        }
      }
    });

    it('should only return fields specified in url using fields and q functionality', async function () {
      response = await agent.get('/api/productFlavours?fields=name&q=name=' + productFlavourObject.name).expect(200);
      response.body.length.should.equal(1);
      Object.prototype.hasOwnProperty.call(response.body[0], 'name').should.equal(true);
      response.body[0].name.should.equal(productFlavourObject.name);
    });

    it('should return an error message when query has invalid search key blah', async function () {
      response = await agent.get('/api/productFlavours?q=name=' + productFlavourObject.name + '&fields=name&blah=blah').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return an error message when queried with an improper search', async function () {
      response = await agent.get('/api/productFlavours?name=' + productFlavourObject.name).expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return an error message when queried with an empty q=', async function () {
      response = await agent.get('/api/productTypes?q=').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return an error message when queried with an empty fields=', async function () {
      response = await agent.get('/api/productFlavours?fields=').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return an error message when queried with an empty fields= and q=', async function () {
      response = await agent.get('/api/productFlavours?q=&fields=').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });
  });

  afterEach(async function () {
    await User.remove().exec();
    await ProductType.remove().exec();
    await ProductFlavour.remove().exec();
    await History.remove().exec();
    await Role.remove().exec();
  });
});

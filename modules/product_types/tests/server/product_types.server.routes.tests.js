'use strict';

var fs = require('fs');
var should = require('should'),
  superagentDefaults = require('superagent-defaults'),
  supertest = require('supertest'),
  mongoose = require('mongoose'),
  _ = require('lodash'),
  History = require('../../../history/server/models/history.server.model').getSchema('producttypes'),
  Program = require('../../../programs/server/models/programs.server.model').Schema,
  Area = require('../../../areas/server/models/areas.server.model').Schema,
  ProductType = require('../../server/models/product_types.server.model').Schema,
  ProductFlavour = require('../../../product_flavours/server/models/product_flavours.server.model').Schema,
  Deployment = require('../../../deployments/server/models/deployments.server.model').Schema,
  User = require('../../../users/server/models/user.server.model').Schema,
  Role = require('../../../roles/server/models/roles.server.model').Schema,
  express = require('../../../../config/lib/express');

var app,
  agent,
  nonAuthAgent,
  validProductType,
  badProductType,
  validDeployment,
  validProgram,
  programObject,
  validArea,
  areaObject,
  validProductFlavour,
  productFlavourObject,
  validProductFlavour2,
  productFlavour2Object,
  productTypeReturned,
  productTypeObject,
  validProductType2,
  productType2Object,
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

describe('Product-Types', function () {
  before(async function () {
    app = express.init(mongoose);
    nonAuthAgent = superagentDefaults(supertest(app));
    agent = superagentDefaults(supertest(app));
  });
  beforeEach(async function () {
    validProgram = JSON.parse(fs.readFileSync('/opt/mean.js/modules/programs/tests/server/test_files/valid_program.json', 'utf8'));
    validArea = JSON.parse(fs.readFileSync('/opt/mean.js/modules/areas/tests/server/test_files/valid_area.json', 'utf8'));
    validProductFlavour = JSON.parse(fs.readFileSync('/opt/mean.js/modules/product_flavours/tests/server/test_files/valid_product_flavour.json', 'utf8'));
    validProductType = JSON.parse(fs.readFileSync('/opt/mean.js/modules/product_types/tests/server/test_files/valid_product_type.json', 'utf8'));
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

    productFlavourObject = new ProductFlavour(validProductFlavour);
    await productFlavourObject.save();

    validProductType.flavours.push(productFlavourObject.name);

    userObject = new User(validUser);
    await userObject.save();

    agent.auth(validUser.username, validUser.password); // Setup User Authorization
  });

  describe('POST', function () {
    it('should create a new Product-Type and check db', async function () {
      response = await agent.post('/api/productTypes').send(validProductType).expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/ProductTypes/${response.body._id}`);
      response.body.name.should.equal(validProductType.name);
      productTypeReturned = await ProductType.findById(response.body._id).exec();
      productTypeReturned.name.should.equal(validProductType.name);
    });

    it('should not create a new Product-Type when user is not authenticated', async function () {
      response = await nonAuthAgent.post('/api/productTypes').send(validProductType).expect(401);
      response.body.message.should.equal('User must be logged in');
    });

    it('should create a new Product-Type when user is standard-user', async function () {
      userObject.userRoles = [roleUserObject._id];
      await userObject.save();
      response = await agent.post('/api/productTypes').auth(validUser.username, validUser.password).send(validProductType).expect(201);
    });

    it('should create a new Product-Type when user is admin', async function () {
      userObject.userRoles = [roleAdminObject._id];
      await userObject.save();
      await agent.post('/api/productTypes').auth(validUser.username, validUser.password).send(validProductType).expect(201);
    });

    it('should create a new Product-Type when user is super-admin', async function () {
      userObject.userRoles = [roleSuperAdmObject._id];
      await userObject.save();
      await agent.post('/api/productTypes').auth(validUser.username, validUser.password).send(validProductType).expect(201);
    });

    it('should not post more than one Product-Type with the same name', async function () {
      productTypeObject = new ProductType(validProductType);
      await productTypeObject.save();
      response = await agent.post('/api/productTypes').send(validProductType).expect(400);
      response.body.message.should.equal('Error, provided name is not unique.');
    });

    it('should not post Product-Type with a name less than 2 characters', async function () {
      badProductType = _.cloneDeep(validProductType);
      badProductType.name = 'x';
      response = await agent.post('/api/productTypes').send(badProductType).expect(400);
      response.body.message.should.equal('Path `name` (`' + badProductType.name + '`) is shorter than the minimum allowed length (2).');
    });

    it('should not post Product-Type with a name more than 50 characters', async function () {
      badProductType = _.cloneDeep(validProductType);
      badProductType.name = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      response = await agent.post('/api/productTypes').send(badProductType).expect(400);
      response.body.message.should.equal('Path `name` (`' + badProductType.name + '`) is longer than the maximum allowed length (50).');
    });

    it('should not allow a Product-Type with a non-alphanumeric-underscored name', async function () {
      badProductType = _.cloneDeep(validProductType);
      badProductType.name = '!£$%&';
      response = await agent.post('/api/productTypes').send(badProductType).expect(400);
      response.body.message.should.equal('name is not valid; \'!£$%&\' can only contain letters, numbers, dots, dashes and underscores.');
    });

    it('should not post a Product-Type without a name key', async function () {
      badProductType = _.cloneDeep(validProductType);
      delete badProductType.name;
      response = await agent.post('/api/productTypes').send(badProductType).expect(400);
      response.body.message.should.equal('Path `name` is required.');
    });

    it('should not post a Product-Type with unknown key', async function () {
      badProductType = _.cloneDeep(validProductType);
      badProductType.rogueKey = 'rogueValue';
      response = await agent.post('/api/productTypes').send(badProductType).expect(400);
      response.body.message.should.equal('Field `rogueKey` is not in schema and strict mode is set to throw.');
    });

    it('should respond with bad request with invalid json', async function () {
      badProductType = '{';
      response = await agent.post('/api/productTypes').send(badProductType).type('json').expect(400);
      response.body.message.should.equal('There was a syntax error found in your request, please make sure that it is valid and try again');
    });

    it('should post a new log with user-details when a Product-Type is created by a logged-in user', async function () {
      response = await agent.post('/api/productTypes').send(validProductType).expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/ProductTypes/${response.body._id}`);
      response.body.name.should.equal(validProductType.name);
      productTypeReturned = await ProductType.findById(response.body._id).exec();
      productTypeReturned.name.should.equal(validProductType.name);

      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      logReturned.originalData.should.not.equal(undefined);
      logReturned.originalData.name.should.equal(validProductType.name);
      logReturned.createdAt.should.not.equal(undefined);
      logReturned.createdBy.should.not.equal(undefined);
      logReturned.createdBy.username.should.equal(validUser.username);
      logReturned.createdBy.email.should.equal(validUser.email);
      logReturned.updates.should.be.instanceof(Array).and.have.lengthOf(0);
    });

    it('should not post a new log for an Product-Type that is created with a name beginning with \'A_Health_\'', async function () {
      var validProductTypeHealth = _.cloneDeep(validProductType);
      validProductTypeHealth.name = 'A_Health_ProductType';
      response = await agent.post('/api/productTypes').send(validProductTypeHealth).expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/ProductTypes/${response.body._id}`);
      response.body.name.should.equal(validProductTypeHealth.name);
      productTypeReturned = await ProductType.findById(response.body._id).exec();
      productTypeReturned.name.should.equal(validProductTypeHealth.name);

      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      should.not.exist(logReturned);
    });
  });

  describe('GET', function () {
    beforeEach(async function () {
      productTypeObject = new ProductType(validProductType);
      await productTypeObject.save();
    });

    it('should be able to get empty Product-Type list', async function () {
      await productTypeObject.remove();
      response = await agent.get('/api/productTypes').expect(200);
      response.body.should.be.instanceof(Array).and.have.lengthOf(0);
    });

    it('should be able to get Product-Type list when user not authenticated', async function () {
      await nonAuthAgent.get('/api/productTypes').expect(200);
    });

    it('should be able to get Product-Type list when user is authenticated', async function () {
      await agent.get('/api/productTypes').expect(200);
    });

    it('should be able to get Product-Type list with one element', async function () {
      response = await agent.get('/api/productTypes').expect(200);
      response.body.should.be.instanceof(Array).and.have.lengthOf(1);
      response.body[0].name.should.equal(validProductType.name);
    });

    it('should be able to get Product-Type list with more than one element', async function () {
      validProductType2 = _.cloneDeep(validProductType);
      validProductType2.name = 'anotherProductTypeName';
      productType2Object = new ProductType(validProductType2);
      await productType2Object.save();
      response = await agent.get('/api/productTypes').expect(200);
      response.body.should.be.instanceof(Array).and.have.lengthOf(2);
      response.body[0].name.should.equal(validProductType2.name);
      response.body[1].name.should.deepEqual(validProductType.name);
    });

    it('should be able to get a single Product-Type', async function () {
      response = await agent.get(`/api/productTypes/${productTypeObject._id}`).expect(200);
      response.body.name.should.equal(validProductType.name);
    });

    it('should be able to get single Product-Type when user not authenticated', async function () {
      await nonAuthAgent.get(`/api/productTypes/${productTypeObject._id}`).expect(200);
    });

    it('should be able to get single Product-Type when user is authenticated', async function () {
      await agent.get(`/api/productTypes/${productTypeObject._id}`).expect(200);
    });

    it('should throw 404 when id is not in database', async function () {
      response = await agent.get('/api/productTypes/000000000000000000000000').expect(404);
      response.body.message.should.equal('A ProductType with that id does not exist');
    });

    it('should throw 404 when id is invalid in the database', async function () {
      response = await agent.get('/api/productTypes/0').expect(404);
      response.body.message.should.equal('A ProductType with that id does not exist');
    });
  });

  describe('PUT', function () {
    beforeEach(async function () {
      validProductFlavour2 = _.cloneDeep(validProductFlavour);
      validProductFlavour2.name = 'secondProductFlavour';
      productFlavour2Object = new ProductFlavour(validProductFlavour2);
      await productFlavour2Object.save();

      validProductType.flavours = [productFlavourObject.name];
      productTypeObject = new ProductType(validProductType);
      await productTypeObject.save();
    });

    it('should update a Product-Type', async function () {
      validProductType2 = _.cloneDeep(validProductType);
      validProductType2.name = 'updatedName';
      validProductType2.flavours.push(validProductFlavour2.name);
      response = await agent.put(`/api/productTypes/${productTypeObject._id}`).send(validProductType2).expect(200);
      response.body.name.should.equal(validProductType2.name);
      response.body.flavours.length.should.equal(2);
      response.body.flavours[0].should.equal(productFlavourObject.name);
      response.body.flavours[1].should.equal(productFlavour2Object.name);
    });

    it('should not update a Product-Type when user is not authenticated', async function () {
      validProductType2 = _.cloneDeep(validProductType);
      validProductType2.name = 'updatedName';
      response = await nonAuthAgent.put(`/api/productTypes/${productTypeObject._id}`)
        .send(validProductType2).expect(401);
      response.body.message.should.equal('User must be logged in');
    });

    it('should update a Product-Type when user is standard-user', async function () {
      validProductType2 = _.cloneDeep(validProductType);
      validProductType2.name = 'updatedName';
      userObject.userRoles = [roleUserObject._id];
      await userObject.save();
      response = await agent.put(`/api/productTypes/${productTypeObject._id}`)
        .auth(validUser.username, validUser.password).send(validProductType2).expect(200);
    });

    it('should update a Product-Type when user is admin', async function () {
      validProductType2 = _.cloneDeep(validProductType);
      validProductType2.name = 'updatedName';
      userObject.userRoles = [roleAdminObject._id];
      await userObject.save();
      await agent.put(`/api/productTypes/${productTypeObject._id}`)
        .auth(validUser.username, validUser.password).send(validProductType2).expect(200);
    });

    it('should update a Product-Type when user is super-admin', async function () {
      validProductType2 = _.cloneDeep(validProductType);
      validProductType2.name = 'updatedName';
      userObject.userRoles = [roleSuperAdmObject._id];
      await userObject.save();
      await agent.put(`/api/productTypes/${productTypeObject._id}`)
        .auth(validUser.username, validUser.password).send(validProductType2).expect(200);
    });

    it('should not update a Product-Type when flavours are not provided', async function () {
      validProductType2 = _.cloneDeep(validProductType);
      validProductType2.name = 'updatedName';
      validProductType2.flavours = [];
      response = await agent.put(`/api/productTypes/${productTypeObject._id}`).send(validProductType2).expect(400);
      response.body.message.should.containEql('You must provide at least one flavour.');
    });

    it('should not update a Product-Type when name is not provided', async function () {
      validProductType2 = _.cloneDeep(validProductType);
      validProductType2.name = null;
      validProductType2.flavours.push(validProductFlavour2.name);
      response = await agent.put(`/api/productTypes/${productTypeObject._id}`).send(validProductType2).expect(400);
      response.body.message.should.containEql('Path `name` is required.');
    });

    it('should throw error when Product-Type name already exist', async function () {
      validProductType2 = _.cloneDeep(validProductType);
      validProductType2.name = 'updatedName';
      response = await agent.post('/api/productTypes').send(validProductType2).expect(201);
      validProductType2.name = validProductType.name;
      response = await agent.put(`/api/productTypes/${response.body._id}`).send(validProductType2).expect(400);
      response.body.message.should.containEql('Error, provided name is not unique.');
    });

    it('should throw error when invalid Product-Flavour is provided', async function () {
      validProductType2 = _.cloneDeep(validProductType);
      validProductType2.name = 'updatedTheName';
      validProductType2.flavours = ['fake_flavour'];
      response = await agent.put(`/api/productTypes/${productTypeObject._id}`).send(validProductType2).expect(422);
      response.body.message.should.equal('Error, Flavour \'fake_flavour\' does not exist!');
    });

    it('should throw error when trying to update the name of Product type that has a dependent Deployment', async function () {
      programObject = new Program(validProgram);
      await programObject.save();

      validArea.program_id = programObject._id;
      areaObject = new Area(validArea);
      await areaObject.save();

      var deploymentProduct = {
        product_type_name: productTypeObject.name,
        flavour_name: productTypeObject.flavours[0],
        infrastructure: 'Cloud',
        admins_only: false
      };

      validDeployment.program_id = programObject._id;
      validDeployment.area_id = areaObject._id;
      validDeployment.products = [deploymentProduct];

      var dependentDeployment = new Deployment(validDeployment);
      await dependentDeployment.save();

      validProductType.name = 'updatedTheName';
      response = await agent.put(`/api/productTypes/${productTypeObject._id}`).send(validProductType).expect(422);
      response.body.message.should.equal('Can\'t update Product-Type name, it has 1 dependent deployment(s).');
    });

    it('should throw error when trying to remove a flavour (that has a dependent Deployment) from a Product type', async function () {
      programObject = new Program(validProgram);
      await programObject.save();

      validArea.program_id = programObject._id;
      areaObject = new Area(validArea);
      await areaObject.save();

      var deploymentProduct = {
        product_type_name: productTypeObject.name,
        flavour_name: productTypeObject.flavours[0],
        infrastructure: 'Cloud',
        admins_only: false
      };

      validDeployment.program_id = programObject._id;
      validDeployment.area_id = areaObject._id;
      validDeployment.products = [deploymentProduct];

      var dependentDeployment = new Deployment(validDeployment);
      await dependentDeployment.save();

      validProductType.flavours = [];
      response = await agent.put(`/api/productTypes/${productTypeObject._id}`).send(validProductType).expect(422);
      // eslint-disable-next-line max-len
      response.body.message.should.equal(`Can't update Product-Type flavours, they have 1 dependent deployment(s).\nEnsure the following flavours are included: ${productTypeObject.flavours[0]}`);
    });
  });

  describe('DELETE', function () {
    beforeEach(async function () {
      productTypeObject = new ProductType(validProductType);
      await productTypeObject.save();
    });

    it('should delete a Product-Type and check its response and the db', async function () {
      response = await agent.delete(`/api/productTypes/${productTypeObject._id}`).expect(200);
      response.body.should.be.instanceof(Object);
      response.body.name.should.equal(productTypeObject.name);
      count = await ProductType.count().exec();
      count.should.equal(0);
    });

    it('should not delete a Product-Type when user is not authenticated', async function () {
      response = await nonAuthAgent.delete(`/api/productTypes/${productTypeObject._id}`).expect(401);
      response.body.message.should.equal('User must be logged in');
    });

    it('should delete a Product-Type when user is standard-user', async function () {
      userObject.userRoles = [roleUserObject._id];
      await userObject.save();
      response = await agent.delete(`/api/productTypes/${productTypeObject._id}`).auth(validUser.username, validUser.password).expect(200);
    });

    it('should delete an Product-Type when user is admin', async function () {
      userObject.userRoles = [roleAdminObject._id];
      await userObject.save();
      await agent.delete(`/api/productTypes/${productTypeObject._id}`).auth(validUser.username, validUser.password).expect(200);
    });

    it('should delete an Product-Type when user is super-admin', async function () {
      userObject.userRoles = [roleSuperAdmObject._id];
      await userObject.save();
      await agent.delete(`/api/productTypes/${productTypeObject._id}`).auth(validUser.username, validUser.password).expect(200);
    });

    it('should fail when attempting to delete a Product-Type that does not exist', async function () {
      response = await agent.delete('/api/productTypes/000000000000000000000000').expect(404);
      response.body.message.should.equal('A ProductType with that id does not exist');
    });

    it('should fail when attempting to delete a Product-Type which has dependent deployments', async function () {
      programObject = new Program(validProgram);
      await programObject.save();

      validArea.program_id = programObject._id;
      areaObject = new Area(validArea);
      await areaObject.save();

      var deploymentProduct = {
        product_type_name: productTypeObject.name,
        flavour_name: productTypeObject.flavours[0],
        infrastructure: 'Cloud',
        admins_only: false
      };

      validDeployment.program_id = programObject._id;
      validDeployment.area_id = areaObject._id;
      validDeployment.products = [deploymentProduct];

      var dependentDeployment = new Deployment(validDeployment);
      await dependentDeployment.save();

      response = await agent.delete(`/api/productTypes/${productTypeObject._id}`).expect(422);
      response.body.message.should.equal('Can\'t delete Product-Type, it has 1 dependent deployment(s).');
      count = await ProductType.count().exec();
      count.should.equal(1);
    });

    it('should update an existing log with user-details for a Product-Type thats deleted by a logged-in user', async function () {
      response = await agent.delete(`/api/productTypes/${productTypeObject._id}`).expect(200);
      response.body._id.should.have.length(24);
      response.body._id.should.equal(productTypeObject._id.toString());

      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      logReturned.originalData.should.not.equal(undefined);
      logReturned.originalData.name.should.equal(validProductType.name);

      logReturned.updates.should.be.instanceof(Array).and.have.lengthOf(0);
      logReturned.deletedAt.should.not.equal(undefined);
      logReturned.deletedBy.should.not.equal(undefined);
      logReturned.deletedBy.username.should.equal(validUser.username);
      logReturned.deletedBy.email.should.equal(validUser.email);
    });

    it('should create a log with defined user-details for a Product-Type that gets deleted by a logged-in user', async function () {
      // clear logs and verify
      await History.remove().exec();
      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      should.not.exist(logReturned);

      response = await agent.delete(`/api/productTypes/${productTypeObject._id}`).expect(200);
      response.body._id.should.have.length(24);
      response.body._id.should.equal(productTypeObject._id.toString());

      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      logReturned.originalData.should.not.equal(undefined);
      logReturned.originalData.name.should.equal(validProductType.name);

      logReturned.updates.should.be.instanceof(Array).and.have.lengthOf(0);
      logReturned.deletedAt.should.not.equal(undefined);
      logReturned.deletedBy.should.not.equal(undefined);
      logReturned.deletedBy.username.should.equal(validUser.username);
      logReturned.deletedBy.email.should.equal(validUser.email);
    });
  });

  describe('SEARCH', function () {
    beforeEach(async function () {
      productTypeObject = new ProductType(validProductType);
      await productTypeObject.save();
    });

    it('should not return a Product-Type when passing in a valid parameter with a non existent Product-Type ID', async function () {
      response = await agent.get('/api/productTypes?q=_id=5bcdbe7287e21906ed4f12ba').expect(200);
      response.body.length.should.equal(0);
    });

    it('should not return a Product-Type when passing in a valid parameter with a non existent parameter', async function () {
      response = await agent.get('/api/productTypes?q=' + encodeURIComponent('_id=' + productTypeObject._id
      + '&name=notExisting')).expect(200);
      response.body.length.should.equal(0);
    });

    it('should return an error when not encoding q search parameters', async function () {
      response = await agent.get('/api/productTypes?q=._id=' + productTypeObject._id + '&name=notExisting').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return a single Product-Type when passing in _id parameter', async function () {
      response = await agent.get('/api/productTypes?q=_id=' + productTypeObject._id).expect(200);
      response.body[0].should.be.instanceof(Object);
      response.body[0].name.should.equal(productTypeObject.name);
    });

    it('should not return a Product-Type when passing in invalid parameter', async function () {
      response = await agent.get('/api/productTypes?q=n0nsense=123454321').expect(200);
      response.body.length.should.equal(0);
    });

    it('should return a single Product-Type when passing in name parameter', async function () {
      response = await agent.get('/api/productTypes?q=name=' + productTypeObject.name).expect(200);
      response.body[0].should.be.instanceof(Object);
      response.body[0].name.should.equal(productTypeObject.name);
    });

    it('should only return fields specified in url', async function () {
      response = await agent.get('/api/productTypes?fields=name').expect(200);
      response.body.length.should.equal(1);
      for (var key in response.body) {
        if (Object.prototype.hasOwnProperty.call(response.body, key)) {
          Object.prototype.hasOwnProperty.call(response.body[key], 'name').should.equal(true);
        }
      }
    });

    it('should only return fields specified in url using fields and q functionality', async function () {
      response = await agent.get('/api/productTypes?fields=name&q=name=' + productTypeObject.name).expect(200);
      response.body.length.should.equal(1);
      Object.prototype.hasOwnProperty.call(response.body[0], 'name').should.equal(true);
      response.body[0].name.should.equal(productTypeObject.name);
    });

    it('should return an error message when query has invalid search key blah', async function () {
      response = await agent.get('/api/productTypes?q=name=' + productTypeObject.name + '&fields=name&blah=blah').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return an error message when queried with an improper search', async function () {
      response = await agent.get('/api/productTypes?name=' + productTypeObject.name).expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return an error message when queried with an empty q=', async function () {
      response = await agent.get('/api/deployments?q=').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return an error message when queried with an empty fields=', async function () {
      response = await agent.get('/api/productTypes?fields=').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return an error message when queried with an empty fields= and q=', async function () {
      response = await agent.get('/api/productTypes?q=&fields=').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });
  });

  afterEach(async function () {
    await User.remove().exec();
    await Deployment.remove().exec();
    await ProductType.remove().exec();
    await ProductFlavour.remove().exec();
    await Program.remove().exec();
    await Area.remove().exec();
    await History.remove().exec();
    await Role.remove().exec();
  });
});

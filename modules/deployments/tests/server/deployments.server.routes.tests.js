'use strict';

var helperController = require('../../../core/server/controllers/helpers.server.controller');
var deploymentServerController = require('../../../deployments/server/controllers/deployments.server.controller.js');
var fs = require('fs');
var should = require('should'),
  superagentDefaults = require('superagent-defaults'),
  supertest = require('supertest'),
  mongoose = require('mongoose'),
  _ = require('lodash'),
  sinon = require('sinon'),
  History = require('../../../history/server/models/history.server.model').getSchema('deployments'),
  Deployment = require('../../server/models/deployments.server.model').Schema,
  ProductFlavour = require('../../../product_flavours/server/models/product_flavours.server.model').Schema,
  ProductType = require('../../../product_types/server/models/product_types.server.model').Schema,
  Program = require('../../../programs/server/models/programs.server.model').Schema,
  Area = require('../../../areas/server/models/areas.server.model').Schema,
  User = require('../../../users/server/models/user.server.model').Schema,
  Team = require('../../../teams/server/models/teams.server.model').Schema,
  Role = require('../../../roles/server/models/roles.server.model').Schema,
  Label = require('../../../labels/server/models/labels.server.model').Schema,
  Hardware = require('../../../hardware/server/models/hardware.server.model').Schema,
  express = require('../../../../config/lib/express');

var app,
  agent,
  nonAuthAgent,
  validDeployment,
  badDeployment,
  deploymentReturned,
  deploymentObject,
  validDeployment2,
  deployment2Object,
  validArea,
  areaObject,
  validTeam,
  teamObject,
  validProductFlavour,
  productFlavourObject,
  validProductType,
  productTypeObject,
  validProgram,
  programObject,
  validHardware,
  hardwareObject,
  validLabel,
  labelObject,
  count,
  response,
  logReturned,
  validUser,
  userObject,
  validDeploymentProduct,
  validUserRole,
  validAdminRole,
  validSuperAdminRole,
  roleSuperAdmObject,
  roleAdminObject,
  roleUserObject;

var jiraHost = process.env.JIRA_URL;
/* eslint-disable no-unused-expressions */
describe('Deployments', function () {
  before(async function () {
    app = express.init(mongoose);
    nonAuthAgent = superagentDefaults(supertest(app));
    agent = superagentDefaults(supertest(app));
  });

  beforeEach(async function () {
    validArea = JSON.parse(fs.readFileSync('/opt/mean.js/modules/areas/tests/server/test_files/valid_area.json', 'utf8'));
    validProductFlavour = JSON.parse(fs.readFileSync('/opt/mean.js/modules/product_flavours/tests/server/test_files/valid_product_flavour.json', 'utf8'));
    validProductType = JSON.parse(fs.readFileSync('/opt/mean.js/modules/product_types/tests/server/test_files/valid_product_type.json', 'utf8'));
    validProgram = JSON.parse(fs.readFileSync('/opt/mean.js/modules/programs/tests/server/test_files/valid_program.json', 'utf8'));
    validDeployment = JSON.parse(fs.readFileSync('/opt/mean.js/modules/deployments/tests/server/test_files/valid_deployment.json', 'utf8'));
    validUser = JSON.parse(fs.readFileSync('/opt/mean.js/modules/users/tests/server/test_files/valid_user.json', 'utf8'));
    validTeam = JSON.parse(fs.readFileSync('/opt/mean.js/modules/teams/tests/server/test_files/valid_team.json', 'utf8'));
    validHardware = JSON.parse(fs.readFileSync('/opt/mean.js/modules/hardware/tests/server/test_files/valid_hardware.json', 'utf8'));
    validLabel = JSON.parse(fs.readFileSync('/opt/mean.js/modules/labels/tests/server/test_files/valid_label.json', 'utf8'));
    validDeploymentProduct = JSON.parse(fs.readFileSync('/opt/mean.js/modules/deployments/tests/server/test_files/valid_deployment_product.json', 'utf8'));
    validUserRole = JSON.parse(fs.readFileSync('/opt/mean.js/modules/roles/tests/server/test_files/valid_user_role.json', 'utf8'));
    validAdminRole = JSON.parse(fs.readFileSync('/opt/mean.js/modules/roles/tests/server/test_files/valid_admin_role.json', 'utf8'));
    validSuperAdminRole = JSON.parse(fs.readFileSync('/opt/mean.js/modules/roles/tests/server/test_files/valid_super_admin_role.json', 'utf8'));

    roleSuperAdmObject = new Role(validSuperAdminRole)
    roleAdminObject = new Role(validAdminRole)
    roleUserObject = new Role(validUserRole)
    await roleSuperAdmObject.save();
    await roleAdminObject.save();
    await roleUserObject.save();

    // Create Program and set its ID as Deployments 'program_id' field
    programObject = new Program(validProgram);
    await programObject.save();
    validDeployment.program_id = programObject._id;

    // Create Area and set its ID as Deployments 'area_id' field
    validArea.program_id = programObject._id;
    areaObject = new Area(validArea);
    await areaObject.save();
    validDeployment.area_id = areaObject._id;

    // Create a Product-Flavour
    validProductFlavour.name = 'uniqueProductFlavour';
    productFlavourObject = new ProductFlavour(validProductFlavour);
    await productFlavourObject.save();

    // Create a Product-Type and add the Product-Flavour to the list of valid flavours
    validProductType.flavours.push(productFlavourObject.name);
    productTypeObject = new ProductType(validProductType);
    await productTypeObject.save();

    // Create Hardware
    validHardware.program_id = programObject._id;
    validHardware.freeStartDate = Date.now();
    hardwareObject = new Hardware(validHardware);
    await hardwareObject.save();

    // Create User
    userObject = new User(validUser);
    await userObject.save();

    // Create Team
    validTeam.admin_IDs = [userObject._id];
    validTeam.area_id = areaObject._id;
    teamObject = new Team(validTeam);
    await teamObject.save();

    // Add Attributes to Deployment-Product
    validDeploymentProduct.product_type_name = productTypeObject.name;
    validDeploymentProduct.flavour_name = productTypeObject.flavours[0];
    validDeploymentProduct.hardware_ids.push(String(hardwareObject._id));
    validDeploymentProduct.admins_only = false;

    agent.auth(validUser.username, validUser.password); // Setup User Authorization
  });

  describe('POST', function () {
    it('should create a new Deployment and check db', async function () {
      validDeployment.team_id = teamObject._id;
      response = await agent
        .post('/api/deployments')
        .send(validDeployment)
        .expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/deployments/${response.body._id}`);
      response.body.name.should.equal(validDeployment.name);
      deploymentReturned = await Deployment.findById(response.body._id).exec();
      deploymentReturned.name.should.equal(validDeployment.name);
      (deploymentReturned.area_id.equals(validDeployment.area_id)).should.be.true;
    });

    it('should not create a new Deployment when user is not authenticated', async function () {
      response = await nonAuthAgent.post('/api/deployments').send(validDeployment).expect(401);
      response.body.message.should.equal('User must be logged in');
    });

    it('should create a new Deployment when user is standard-user', async function () {
      userObject.userRoles = [roleUserObject._id];
      await userObject.save();
      response = await agent.post('/api/deployments').auth(validUser.username, validUser.password).send(validDeployment).expect(201);
    });

    it('should create a new Deployment when user is admin', async function () {
      userObject.userRoles = [roleAdminObject._id];
      await userObject.save();
      await agent.post('/api/deployments').auth(validUser.username, validUser.password).send(validDeployment).expect(201);
    });

    it('should create a new Deployment when user is super-admin', async function () {
      userObject.userRoles = [roleSuperAdmObject._id];
      await userObject.save();
      await agent.post('/api/deployments').auth(validUser.username, validUser.password).send(validDeployment).expect(201);
    });

    it('should create a new Deployment with one child Product', async function () {
      // Assign Product to Deployment
      validDeployment.products = [validDeploymentProduct];
      response = await agent.post('/api/deployments').send(validDeployment).expect(201);

      // Response info
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/deployments/${response.body._id}`);

      // Deployment info
      deploymentReturned = await Deployment.findById(response.body._id).exec();
      deploymentReturned.name.should.equal(validDeployment.name);
      (deploymentReturned.area_id.equals(validDeployment.area_id)).should.be.true;
      deploymentReturned.products.length.should.equal(1);

      // Product info
      var childProduct = deploymentReturned.products[0];
      childProduct.product_type_name.should.equal(validDeploymentProduct.product_type_name);
      childProduct.flavour_name.should.equal(validDeploymentProduct.flavour_name);
      childProduct.infrastructure.should.equal(validDeploymentProduct.infrastructure);
      childProduct.location.should.equal(validDeploymentProduct.location);
      childProduct.purpose.should.equal(validDeploymentProduct.purpose);
      childProduct.links.length.should.equal(1);
      childProduct.hardware_ids.length.should.equal(1);

      // Product-Link info
      var productLink = childProduct.links[0];
      productLink.link_name.should.equal(validDeploymentProduct.links[0].link_name);
      productLink.url.should.equal(validDeploymentProduct.links[0].url);
    });

    it('should create a new Deployment with JIRA Issue and check db', async function () {
      validDeployment2 = _.cloneDeep(validDeployment);

      var mockDeploymentReturned = new Deployment(validDeployment);
      mockDeploymentReturned.name = 'MockName';
      mockDeploymentReturned.jira_issues = ['CIS-123639TIMEBOXDATE2022-12-30', 'CIP-29798'];
      mockDeploymentReturned.timebox_data = {
        timebox: '2022-12-30T00:00:00.000Z',
        issue: 'CIS-123639TIMEBOXDATE2022-12-30'
      };
      await mockDeploymentReturned.save();

      sinon.stub(deploymentServerController, 'jiraIssuesValidationAndUpdateTimebox').withArgs(sinon.match.any).returns(mockDeploymentReturned);

      var jira1 = 'CIS-123639TIMEBOXDATE2022-12-30';
      validDeployment2.jira_issues = ['CIP-29798', jira1];

      response = await agent.post('/api/deployments').send(validDeployment2).expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/deployments/${response.body._id}`);
      response.body.name.should.equal(mockDeploymentReturned.name);
      response.body.jira_issues.should.containEql(jira1);
      response.body.jira_issues.should.containEql('CIP-29798');
      deploymentReturned = await Deployment.findById(response.body._id).exec();
      deploymentReturned.name.should.equal(mockDeploymentReturned.name);
      (deploymentReturned.area_id.equals(validDeployment2.area_id)).should.be.true;
      deploymentReturned.jira_issues.should.containEql(jira1);
      deploymentReturned.jira_issues.should.containEql('CIP-29798');
      deploymentReturned.timebox_data.issue.should.equal(jira1);
      await Deployment.deleteOne({ _id: mockDeploymentReturned._id });
    });

    it('should create a new Deployment with eTeams prefix JIRA Issue and check db', async function () {
      validDeployment2 = _.cloneDeep(validDeployment);

      var mockDeploymentReturned = new Deployment(validDeployment);
      mockDeploymentReturned.name = 'MockName';
      mockDeploymentReturned.jira_issues = ['GTEC-7866', 'STSOSS-1945'];
      mockDeploymentReturned.timebox_data = {};
      await mockDeploymentReturned.save();

      sinon.stub(deploymentServerController, 'jiraIssuesValidationAndUpdateTimebox').withArgs(sinon.match.any).returns(mockDeploymentReturned);

      validDeployment2.jira_issues = ['GTEC-7866', 'STSOSS-1945'];
      response = await agent.post('/api/deployments').send(validDeployment2).expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/deployments/${response.body._id}`);
      response.body.name.should.equal('MockName');
      response.body.jira_issues.should.containEql('GTEC-7866');
      response.body.jira_issues.should.containEql('STSOSS-1945');
      deploymentReturned = await Deployment.findById(response.body._id).exec();
      deploymentReturned.name.should.equal('MockName');
      (deploymentReturned.area_id.equals(validDeployment2.area_id)).should.be.true;
      deploymentReturned.jira_issues.should.containEql('GTEC-7866');
      deploymentReturned.jira_issues.should.containEql('STSOSS-1945');
    });

    it('should create a new Deployment with new Labels and check db', async function () {
      var labelsToCreate = ['NEWLABEL1', 'NEWLABEL2'];
      validDeployment.newLabels = labelsToCreate.join(',');
      response = await agent.post('/api/deployments').send(validDeployment).expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/deployments/${response.body._id}`);
      response.body.name.should.equal(validDeployment.name);
      await helperController.asyncForEach(labelsToCreate, async function (labelName) {
        var foundLabel = await agent.get(`/api/labels?q=name=${labelName}`).auth(validUser.username, validUser.password).expect(200);
        response.body.label_ids.includes(foundLabel.body[0]._id).should.equal(true);
      });
    });

    it('should create a new Deployment with a new Label that already exists', async function () {
      // Create Label
      validLabel.name = 'VALIDLABEL';
      labelObject = new Label(validLabel);
      await labelObject.save();

      validDeployment.newLabels = 'VALIDLABEL';
      response = await agent.post('/api/deployments').send(validDeployment).expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/deployments/${response.body._id}`);
      response.body.name.should.equal(validDeployment.name);
      var foundLabel = await agent.get(`/api/labels?q=name=${validLabel.name}`).auth(validUser.username, validUser.password).expect(200);
      response.body.label_ids.includes(foundLabel.body[0]._id).should.equal(true);
    });

    it('should create a new Deployment with a new Label that already exists and is already assigned to the Deployment', async function () {
      // Create Label
      validLabel.name = 'VALIDLABEL';
      labelObject = new Label(validLabel);
      await labelObject.save();

      validDeployment.label_ids = [labelObject._id];
      validDeployment.newLabels = validLabel.name;
      response = await agent.post('/api/deployments').send(validDeployment).expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/deployments/${response.body._id}`);
      response.body.name.should.equal(validDeployment.name);
      var foundLabel = await agent.get(`/api/labels?q=name=VALIDLABEL`).auth(validUser.username, validUser.password).expect(200);
      response.body.label_ids.includes(foundLabel.body[0]._id).should.equal(true);
    });

    it('should create a new Deployment with no new Labels', async function () {
      response = await agent.post('/api/deployments').send(validDeployment).expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/deployments/${response.body._id}`);
      response.body.name.should.equal(validDeployment.name);
      response.body.label_ids.length.should.equal(0);
    });

    it('should create a new Deployment with JIRA Issue even if can\'t connect to JIRA and check db', async function () {
      process.env.JIRA_URL = 'jira-oss';
      validDeployment2 = _.cloneDeep(validDeployment);
      validDeployment2.jira_issues = ['CIP-29798'];
      response = await agent.post('/api/deployments').send(validDeployment2).expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/deployments/${response.body._id}`);
      response.body.name.should.equal(validDeployment2.name);
      response.body.jira_issues.should.containEql('CIP-29798');
      deploymentReturned = await Deployment.findById(response.body._id).exec();
      deploymentReturned.name.should.equal(validDeployment2.name);
      (deploymentReturned.area_id.equals(validDeployment2.area_id)).should.be.true;
      deploymentReturned.jira_issues.should.containEql('CIP-29798');
      process.env.JIRA_URL = jiraHost;
    });

    it('should not create a new Deployment when a child Product has an invalid product-type-name', async function () {
      validDeploymentProduct.product_type_name = '$!"£%^';
      validDeployment.products = [validDeploymentProduct];
      response = await agent.post('/api/deployments').send(validDeployment).expect(422);
      response.body.message.should.equal(`Error, Product-Type '${validDeploymentProduct.product_type_name}' does not exist.`);
    });

    it('should not create a new Deployment when a child Product has an invalid flavour-name', async function () {
      validDeploymentProduct.flavour_name = '$!"£%^';
      validDeployment.products = [validDeploymentProduct];
      response = await agent.post('/api/deployments').send(validDeployment).expect(422);
      response.body.message.should.equal(`Error, Product-Flavour '${validDeploymentProduct.flavour_name}' is not valid for Product-Type '${validDeploymentProduct.product_type_name}'.`); // eslint-disable-line max-len
    });

    it('should not create a new Deployment when a child Product has an invalid link-name', async function () {
      validDeploymentProduct.links[0].link_name = '$!"£%^';
      validDeployment.products = [validDeploymentProduct];
      response = await agent.post('/api/deployments').send(validDeployment).expect(400);
      response.body.message.should.equal(`link_name is not valid; '${validDeploymentProduct.links[0].link_name}' can only contain letters, numbers, ampersand (&), dots, dashes, underscores and spaces.`); // eslint-disable-line max-len
    });

    it('should not create a new Deployment when a child Product has an invalid link-url', async function () {
      validDeploymentProduct.links[0].url = 'This is not a URL';
      validDeployment.products = [validDeploymentProduct];
      response = await agent.post('/api/deployments').send(validDeployment).expect(400);
      response.body.message.should.equal(`url is not valid; '${validDeploymentProduct.links[0].url}' must be a valid url.`);
    });

    it('should set up dummy url when product data link is undefined', async function () {
      validDeploymentProduct.links[0].url = undefined;
      validDeployment.products = [validDeploymentProduct];
      response = await agent.post('/api/deployments').send(validDeployment).expect(201);
      response.body.products[0].links[0].url.should.equal('https://www.urlnotentered.se')
    });

    it('should not create a new Deployment when a product uses the same hardware multiple times', async function () {
      // Assign 2nd Hardware to Product
      validDeploymentProduct.hardware_ids.push(hardwareObject._id);
      // Assign Product to Deployment
      validDeployment.products = [validDeploymentProduct];
      response = await agent.post('/api/deployments').send(validDeployment).expect(422);
      // eslint-disable-next-line max-len
      response.body.message.should.equal(`Hardware ${hardwareObject._id} cannot be assigned multiple times to product ${validDeploymentProduct.product_type_name}`);
    });

    it('should not create a new Deployment when a products hardware is associated with a different program', async function () {
      // Create 2nd Program
      var programObject2 = new Program({ name: 'OtherProgram' });
      await programObject2.save();

      // Assign Deployment to Program 2
      validDeployment.program_id = programObject2._id;
      // Assign Product to Deployment
      validDeployment.products = [validDeploymentProduct];
      response = await agent.post('/api/deployments').send(validDeployment).expect(422);
      // eslint-disable-next-line max-len
      response.body.message.should.equal(`Hardware '${hardwareObject.name}' cannot be assigned as it is associated to Program with ID '${programObject._id}`);
    });

    it('should not create a new Deployment when a products hardware is assigned to another deployment', async function () {
      // Assign Product to Deployment
      validDeployment.products = [validDeploymentProduct];
      response = await agent.post('/api/deployments').send(validDeployment).expect(201);
      // Create 2nd Deployment which also has the same product hardware
      validDeployment.name = 'SecondDeployment';
      response = await agent.post('/api/deployments').send(validDeployment).expect(422);
      // eslint-disable-next-line max-len
      response.body.message.should.equal(`Hardware '${hardwareObject.name}' cannot be assigned as it is already assigned to another Deployment`);
    });

    it('should not create a new Deployment when a products hardware is assigned to multiple products within the same deployment', async function () {
      // Assign Multiple Products to Deployment with same hardwae
      validDeployment.products = [validDeploymentProduct, validDeploymentProduct];
      response = await agent.post('/api/deployments').send(validDeployment).expect(422);
      // eslint-disable-next-line max-len
      response.body.message.should.equal(`Hardware '${hardwareObject.name}' cannot be assigned to multiple products within the same Deployment`);
    });

    it('should not create a new Deployment when area_id is not provided', async function () {
      validDeployment.area_id = null;
      response = await agent.post('/api/deployments').send(validDeployment).expect(400);
      response.body.message.should.equal('Path `area_id` is required.');
    });

    it('should not create more than one deployment with the same name', async function () {
      deploymentObject = new Deployment(validDeployment);
      await deploymentObject.save();
      response = await agent.post('/api/deployments').send(validDeployment).expect(400);
      response.body.message.should.equal('Error, provided name is not unique.');
    });

    it('should not create deployment with a name less than 2 characters', async function () {
      badDeployment = _.cloneDeep(validDeployment);
      badDeployment.name = 'x';
      response = await agent.post('/api/deployments').send(badDeployment).expect(400);
      response.body.message.should.equal('Path `name` (`' + badDeployment.name + '`) is shorter than the minimum allowed length (2).');
    });

    it('should not create deployment with a name more than 50 characters', async function () {
      badDeployment = _.cloneDeep(validDeployment);
      badDeployment.name = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      response = await agent.post('/api/deployments').send(badDeployment).expect(400);
      response.body.message.should.equal('Path `name` (`' + badDeployment.name + '`) is longer than the maximum allowed length (50).');
    });

    it('should not allow a deployment with a non-alphanumeric-underscored name', async function () {
      badDeployment = _.cloneDeep(validDeployment);
      badDeployment.name = '!£$%&';
      response = await agent.post('/api/deployments').send(badDeployment).expect(400);
      response.body.message.should.equal('name is not valid; \'!£$%&\' can only contain letters, numbers, dots, dashes and underscores.');
    });

    it('should not create a deployment without a name key', async function () {
      badDeployment = _.cloneDeep(validDeployment);
      delete badDeployment.name;
      response = await agent.post('/api/deployments').send(badDeployment).expect(400);
      response.body.message.should.equal('Path `name` is required.');
    });

    it('should not create a deployment with unknown key', async function () {
      badDeployment = _.cloneDeep(validDeployment);
      badDeployment.rogueKey = 'rogueValue';
      response = await agent.post('/api/deployments').send(badDeployment).expect(400);
      response.body.message.should.equal('Field `rogueKey` is not in schema and strict mode is set to throw.');
    });

    it('should respond with bad request with invalid json', async function () {
      badDeployment = '{';
      response = await agent.post('/api/deployments').send(badDeployment).type('json').expect(400);
      response.body.message.should.equal('There was a syntax error found in your request, please make sure that it is valid and try again');
    });

    it('should create a new log with user-details when a deployment is created by a logged-in user', async function () {
      response = await agent.post('/api/deployments').send(validDeployment).expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/deployments/${response.body._id}`);
      response.body.name.should.equal(validDeployment.name);
      deploymentReturned = await Deployment.findById(response.body._id).exec();
      deploymentReturned.name.should.equal(validDeployment.name);

      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      logReturned.originalData.should.not.equal(undefined);
      logReturned.originalData.name.should.equal(validDeployment.name);
      logReturned.createdAt.should.not.equal(undefined);
      logReturned.createdBy.should.not.equal(undefined);
      logReturned.createdBy.username.should.equal(validUser.username);
      logReturned.createdBy.email.should.equal(validUser.email);
      logReturned.updates.should.be.instanceof(Array).and.have.lengthOf(0);
    });

    it('should not create a new log for a deployment that is created with a name beginning with \'A_Health_\'', async function () {
      var validDeploymentHealth = _.cloneDeep(validDeployment);
      validDeploymentHealth.name = 'A_Health_Deployment';
      response = await agent.post('/api/deployments').send(validDeploymentHealth).expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/deployments/${response.body._id}`);
      response.body.name.should.equal(validDeploymentHealth.name);
      deploymentReturned = await Deployment.findById(response.body._id).exec();
      deploymentReturned.name.should.equal(validDeploymentHealth.name);

      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      should.not.exist(logReturned);
    });

    it('should throw error when invalid area_id is provided', async function () {
      validDeployment.area_id = 'fake';
      response = await agent.post('/api/deployments').send(validDeployment).expect(400);
      response.body.message.should.equal('Cast to ObjectID failed for value "fake" at path "area_id"');
    });

    it('should throw error when same JIRA Issue entered multiple times', async function () {
      validDeployment2 = _.cloneDeep(validDeployment);
      validDeployment2.jira_issues = ['CIP-29798', 'CIP-29798'];
      response = await agent.post('/api/deployments').send(validDeployment2).expect(422);
      response.body.message.should.containEql('You cannot add the same JIRA Issue multiple times. Please remove the duplicates: CIP-29798 and try again.');
    });

    it('should throw error when same JIRA Issue entered multiple times, display two issues the error message', async function () {
      validDeployment2 = _.cloneDeep(validDeployment);
      validDeployment2.jira_issues = ['CIP-29798', 'CIP-29798', 'CIP-30052', 'CIP-30052'];
      response = await agent.post('/api/deployments').send(validDeployment2).expect(422);
      response.body.message.should.containEql('You cannot add the same JIRA Issue multiple times. Please remove the duplicates: CIP-29798, CIP-30052 and try again.');
    });

    it('should throw error when same JIRA Issue entered multiple times: lowercase JIRA Issue value', async function () {
      validDeployment2 = _.cloneDeep(validDeployment);
      validDeployment2.jira_issues = ['CIP-29798', 'cip-29798', 'CIP-29798'];
      response = await agent.post('/api/deployments').send(validDeployment2).expect(422);
      response.body.message.should.containEql('You cannot add the same JIRA Issue multiple times. Please remove the duplicates: CIP-29798 and try again.');
    });

    it('should throw error when JIRA Issue is invalid', async function () {
      validDeployment2 = _.cloneDeep(validDeployment);
      validDeployment2.jira_issues = ['CIP-29798', 'CI2979899999INVALID'];
      response = await agent.post('/api/deployments').send(validDeployment2).expect(422);
      response.body.message.should.containEql('is invalid');
    });

    afterEach(async function () {
      sinon.restore();
    });
  });

  describe('GET', function () {
    beforeEach(async function () {
      deploymentObject = new Deployment(validDeployment);
      await deploymentObject.save();
    });

    it('should be able to get empty deployment list', async function () {
      await deploymentObject.remove();
      response = await agent.get('/api/deployments').expect(200);
      response.body.should.be.instanceof(Array).and.have.lengthOf(0);
    });

    it('should be able to get deployments when user not authenticated', async function () {
      await nonAuthAgent.get('/api/deployments').expect(200);
    });

    it('should be able to get deployments when user is authenticated', async function () {
      await agent.get('/api/deployments').expect(200);
    });

    it('should be able to get deployment list with one element', async function () {
      response = await agent.get('/api/deployments').expect(200);
      response.body.should.be.instanceof(Array).and.have.lengthOf(1);
      response.body[0].name.should.equal(validDeployment.name);
      (validDeployment.area_id.equals(response.body[0].area_id)).should.be.true;
    });

    it('should be able to get deployment list with more than one element', async function () {
      validDeployment2 = _.cloneDeep(validDeployment);
      validDeployment2.name = 'anotherDeploymentName';
      deployment2Object = new Deployment(validDeployment2);
      await deployment2Object.save();
      response = await agent.get('/api/deployments').expect(200);
      response.body.should.be.instanceof(Array).and.have.lengthOf(2);
      response.body[0].name.should.equal(validDeployment2.name);
      response.body[1].name.should.deepEqual(validDeployment.name);
    });

    it('should be able to get a single deployment', async function () {
      response = await agent.get(`/api/deployments/${deploymentObject._id}`).expect(200);
      response.body.name.should.equal(validDeployment.name);
    });

    it('should be able to get single deployment when user not authenticated', async function () {
      await nonAuthAgent.get(`/api/deployments/${deploymentObject._id}`).expect(200);
    });

    it('should be able to get single deployment when user is authenticated', async function () {
      await agent.get(`/api/deployments/${deploymentObject._id}`).expect(200);
    });

    it('should throw 404 when id is not in database', async function () {
      response = await agent.get('/api/deployments/000000000000000000000000').expect(404);
      response.body.message.should.equal('A Deployment with that id does not exist');
    });

    it('should throw 404 when id is invalid in the database', async function () {
      response = await agent.get('/api/deployments/0').expect(404);
      response.body.message.should.equal('A Deployment with that id does not exist');
    });
  });

  describe('PUT', function () {
    beforeEach(async function () {
      deploymentObject = new Deployment(validDeployment);
      await deploymentObject.save();
    });

    it('should update a deployment', async function () {
      validDeployment2 = _.cloneDeep(validDeployment);
      validDeployment2.name = 'updatedName';
      validDeployment2.status = 'In Use';
      response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(validDeployment2).expect(200);
      response.body.name.should.equal(validDeployment2.name);
      response.body.area_id.should.equal(validDeployment2.area_id.toString());
    });

    it('should not update a deployment when user is not authenticated', async function () {
      validDeployment.name = 'updatedName';
      response = await nonAuthAgent.put(`/api/deployments/${deploymentObject._id}`)
        .send(validDeployment).expect(401);
      response.body.message.should.equal('User must be logged in');
    });

    it('should update a deployment when user is standard-user', async function () {
      validDeployment.name = 'updatedName';
      userObject.userRoles = [roleUserObject._id];
      await userObject.save();
      response = await agent.put(`/api/deployments/${deploymentObject._id}`)
        .auth(validUser.username, validUser.password).send(validDeployment).expect(200);
    });

    it('should update a deployment when user is admin', async function () {
      validDeployment.name = 'updatedName';
      userObject.userRoles = [roleAdminObject._id];
      await userObject.save();
      await agent.put(`/api/deployments/${deploymentObject._id}`)
        .auth(validUser.username, validUser.password).send(validDeployment).expect(200);
    });

    it('should update a deployment when user is super-admin', async function () {
      validDeployment.name = 'updatedName';
      userObject.userRoles = [roleSuperAdmObject._id];
      await userObject.save();
      await agent.put(`/api/deployments/${deploymentObject._id}`)
        .auth(validUser.username, validUser.password).send(validDeployment).expect(200);
    });

    it('should update a deployment with a product', async function () {
      validDeployment2 = _.cloneDeep(validDeployment);
      validDeployment2.name = 'updatedNameWithProduct';
      validDeployment2.status = 'In Use';
      validDeployment2.products.push(validDeploymentProduct);
      response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(validDeployment2).expect(200);
      response.body.name.should.equal(validDeployment2.name);
      response.body.area_id.should.equal(validDeployment2.area_id.toString());

      // Product info
      var childProduct = response.body.products[0];
      childProduct.product_type_name.should.equal(validDeploymentProduct.product_type_name);
      childProduct.flavour_name.should.equal(validDeploymentProduct.flavour_name);
      childProduct.infrastructure.should.equal(validDeploymentProduct.infrastructure);
      childProduct.location.should.equal(validDeploymentProduct.location);
      childProduct.purpose.should.equal(validDeploymentProduct.purpose);
      childProduct.links.length.should.equal(1);
      childProduct.hardware_ids.length.should.equal(1);
    });

    it('should update a deployment with a product with hardware and then remove hardware to trigger Free Time', async function () {
      validDeployment2 = _.cloneDeep(validDeployment);
      validDeployment2.name = 'updatedNameHardware';
      validDeployment2.products.push(validDeploymentProduct);
      response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(validDeployment2).expect(200);

      // Product info
      var childProduct = response.body.products[0];
      childProduct.hardware_ids.length.should.equal(1);
      // check that doesn't update Hardware already added
      response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(validDeployment2).expect(200);

      // Remove hardware
      validDeploymentProduct.hardware_ids = [];

      // Update Deployment
      validDeployment2 = _.cloneDeep(validDeployment);
      validDeployment2.products.push(validDeploymentProduct);
      response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(validDeployment2).expect(200);

      childProduct = response.body.products[0];
      childProduct.hardware_ids.length.should.equal(0);
    });

    it('should update Deployment with JIRA Issues and check db', async function () {
      validDeployment2 = _.cloneDeep(validDeployment);
      var mockDeploymentReturned = _.cloneDeep(deploymentObject);
      mockDeploymentReturned.jira_issues = ['CIS-117440TIMEBOXDATE2022-12-31', 'CIS-161095'];
      mockDeploymentReturned.timebox_data = {
        timebox: '2022-12-31T00:00:00.000Z',
        issue: 'CIS-117440TIMEBOXDATE2022-12-31'
      };
      sinon.stub(deploymentServerController, 'jiraIssuesValidationAndUpdateTimebox').withArgs(sinon.match.any).returns(mockDeploymentReturned);
      var jira1 = 'CIS-117440TIMEBOXDATE2022-12-31';
      validDeployment2.jira_issues = [jira1, 'CIS-161095'];
      response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(validDeployment2).expect(200);
      deploymentReturned = await Deployment.findById(deploymentObject._id).exec();
      deploymentReturned.name.should.equal(validDeployment2.name);
      (deploymentReturned.area_id.equals(validDeployment2.area_id)).should.be.true;
      deploymentReturned.jira_issues.should.containEql('CIS-161095');
      deploymentReturned.timebox_data.issue.should.equal(jira1);
    });

    it('should update Deployment with JIRA Issues and then remove JIRAs, to check that timebox is cleared', async function () {
      validDeployment2 = _.cloneDeep(validDeployment);
      var stubb = sinon.stub(deploymentServerController, 'jiraIssuesValidationAndUpdateTimebox');

      var mockDeploymentReturned = _.cloneDeep(deploymentObject);
      mockDeploymentReturned.jira_issues = ['CIS-117440TIMEBOXDATE2022-12-31', 'CIS-161095'];
      mockDeploymentReturned.timebox_data = {
        timebox: '2022-12-31T00:00:00.000Z',
        issue: 'CIS-117440TIMEBOXDATE2022-12-31'
      };

      var mockDeploymentReturned2 = _.cloneDeep(deploymentObject)
      mockDeploymentReturned2.jira_issues = [];
      mockDeploymentReturned2.timebox_data = {};
      // Need to update __v:1 as object has been saved once already and Mongo changed __v to 1 from 0.
      mockDeploymentReturned2.__v = 1;

      stubb.onCall(0).returns(mockDeploymentReturned);
      stubb.onCall(1).returns(mockDeploymentReturned2);

      var jira1 = 'CIS-117440TIMEBOXDATE2022-12-31';
      validDeployment2.jira_issues = [jira1, 'CIS-161095'];
      response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(validDeployment2).expect(200);
      response.body.jira_issues.should.containEql('CIS-161095');
      response.body.timebox_data.issue.should.equal(jira1);
      validDeployment2.jira_issues = [];
      response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(validDeployment2).expect(200);
      response.body.jira_issues.should.be.empty();
      response.body.timebox_data.should.be.empty();
    });

    it('should update Deployment with JIRA Issues and check that timebox is updated', async function () {
      validDeployment2 = _.cloneDeep(validDeployment);
      var stubb = sinon.stub(deploymentServerController, 'jiraIssuesValidationAndUpdateTimebox');

      var mockDeploymentReturned = _.cloneDeep(deploymentObject);
      mockDeploymentReturned.jira_issues = ['CIS-166946TIMEBOXDATE2024-04-14',
        'CIS-161095TIMEBOXDATE2025-04-14'];
      mockDeploymentReturned.timebox_data = {
        timebox: '2024-04-14T00:00:00.000Z',
        issue: 'CIS-166946TIMEBOXDATE2024-04-14'
      };

      var mockDeploymentReturned2 = _.cloneDeep(deploymentObject);
      mockDeploymentReturned2.jira_issues = ['CIS-166946TIMEBOXDATE2024-04-14',
        'CIS-161095TIMEBOXDATE2025-04-14',
        'CIS-166961TIMEBOXDATE2023-04-14'];
      mockDeploymentReturned2.timebox_data = {
        timebox: '2023-04-14T00:00:00.000Z',
        issue: 'CIS-166961TIMEBOXDATE2023-04-14'
      };
      // Need to update __v:1 as object has been saved once already and Mongo changed __v to 1 from 0.
      mockDeploymentReturned2.__v = 1;

      stubb.onCall(0).returns(mockDeploymentReturned);
      stubb.onCall(1).returns(mockDeploymentReturned2);

      var jira1 = 'CIS-166946TIMEBOXDATE2024-04-14';
      var jira2 = 'CIS-161095TIMEBOXDATE2025-04-14';
      var jira3 = 'CIS-166961TIMEBOXDATE2023-04-14';
      // timebox ends 14/04/2024 , 14/04/2025
      validDeployment2.jira_issues = [jira1, jira2];
      response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(validDeployment2).expect(200);
      response.body.jira_issues.should.containEql(jira2);
      response.body.timebox_data.issue.should.equal(jira1);
      // timebox ends 14/04/2024, 14/04/2025, 14/04/2023
      validDeployment2.jira_issues = [jira1, jira2, jira3];
      response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(validDeployment2).expect(200);
      response.body.jira_issues.should.containEql(jira3);
      response.body.timebox_data.issue.should.equal(jira3);
    });

    it('should update Deployment with JIRA Issues and check that timebox is updated to the only JIRA', async function () {
      validDeployment2 = _.cloneDeep(validDeployment);
      var stubb = sinon.stub(deploymentServerController, 'jiraIssuesValidationAndUpdateTimebox');

      var mockDeploymentReturned = _.cloneDeep(deploymentObject);
      mockDeploymentReturned.jira_issues = ['CIS-166946TIMEBOXDATE2023-04-14',
        'CIS-161095TIMEBOXDATE2025-04-14'];
      mockDeploymentReturned.timebox_data = {
        timebox: '2023-04-14T00:00:00.000Z',
        issue: 'CIS-166946TIMEBOXDATE2023-04-14'
      };

      var mockDeploymentReturned2 = _.cloneDeep(deploymentObject);
      mockDeploymentReturned2.jira_issues = ['CIS-161095TIMEBOXDATE2025-04-14'];
      mockDeploymentReturned2.timebox_data = {
        issue: 'CIS-161095TIMEBOXDATE2025-04-14',
        timebox: '2025-04-14T00:00:00.000Z'
      };
      // Need to update __v:1 as object has been saved once already and Mongo changed __v to 1 from 0.
      mockDeploymentReturned2.__v = 1;

      stubb.onCall(0).returns(mockDeploymentReturned);
      stubb.onCall(1).returns(mockDeploymentReturned2);

      var jira1 = 'CIS-166946TIMEBOXDATE2023-04-14';
      var jira2 = 'CIS-161095TIMEBOXDATE2025-04-14';
      // timebox ends 14/04/2023 , 14/04/2025
      validDeployment2.jira_issues = [jira1, jira2];
      response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(validDeployment2).expect(200);
      response.body.jira_issues.should.containEql(jira1);
      response.body.timebox_data.issue.should.equal(jira1);
      // timebox ends 14/04/2025
      validDeployment2.jira_issues = [jira2];
      response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(validDeployment2).expect(200);
      response.body.jira_issues.should.containEql(jira2);
      response.body.timebox_data.issue.should.equal(jira2);
    });

    it('should update Deployment with JIRA Issues and check that timebox empty after finding no timebox info', async function () {
      validDeployment2 = _.cloneDeep(validDeployment);

      var stubb = sinon.stub(deploymentServerController, 'jiraIssuesValidationAndUpdateTimebox');
      var mockDeploymentReturned = _.cloneDeep(deploymentObject);
      mockDeploymentReturned.jira_issues = ['CIS-161095TIMEBOXDATE2025-04-14'];
      mockDeploymentReturned.timebox_data = {
        timebox: '2025-04-14T00:00:00.000Z',
        issue: 'CIS-161095TIMEBOXDATE2025-04-14'
      };

      var mockDeploymentReturned2 = _.cloneDeep(deploymentObject);
      mockDeploymentReturned2.jira_issues = ['CIS-147272'];
      mockDeploymentReturned2.timebox_data = {};
      // Need to update __v:1 as object has been saved once already and Mongo changed __v to 1 from 0.
      mockDeploymentReturned2.__v = 1;

      stubb.onCall(0).returns(mockDeploymentReturned);
      stubb.onCall(1).returns(mockDeploymentReturned2);

      var jira1 = 'CIS-161095TIMEBOXDATE2025-04-14';
      validDeployment2.jira_issues = [jira1];
      response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(validDeployment2).expect(200);
      response.body.jira_issues.should.containEql(jira1);
      response.body.timebox_data.issue.should.equal(jira1);
      validDeployment2.jira_issues = ['CIS-147272'];
      response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(validDeployment2).expect(200);
      response.body.jira_issues.should.containEql('CIS-147272');
      response.body.timebox_data.should.be.empty();
    });

    it('should update Deployment with JIRA Issue even if can\'t connect to JIRA and check db', async function () {
      process.env.JIRA_URL = 'jira-oss';
      validDeployment2 = _.cloneDeep(validDeployment);
      validDeployment2.jira_issues = ['CIP-29798'];

      var stubb = sinon.stub(deploymentServerController, 'jiraIssuesValidationAndUpdateTimebox');
      var mockDeploymentReturned = _.cloneDeep(deploymentObject);
      mockDeploymentReturned.jira_issues = ['CIP-29798'];
      mockDeploymentReturned.timebox_data = {};

      stubb.onCall(0).returns(mockDeploymentReturned);

      response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(validDeployment2).expect(200);
      deploymentReturned = await Deployment.findById(deploymentObject._id).exec();
      deploymentReturned.name.should.equal(validDeployment2.name);
      (deploymentReturned.area_id.equals(validDeployment2.area_id)).should.be.true;
      deploymentReturned.jira_issues.should.containEql('CIP-29798');
      process.env.JIRA_URL = jiraHost;
    });

    it('should throw error for adding invalid hardware id', async function () {
      validDeploymentProduct.hardware_ids.push('5dfb830e9e4bfd5b6c000999');
      validDeployment2 = _.cloneDeep(validDeployment);
      validDeployment2.name = 'updatedNameHardware';
      validDeployment2.products.push(validDeploymentProduct);
      response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(validDeployment2).expect(422);
      response.body.message.should.containEql('A Hardware with the given id \'5dfb830e9e4bfd5b6c000999\' could not be found.');
    });

    it('should throw error when same JIRA Issue entered multiple times', async function () {
      validDeployment2 = _.cloneDeep(validDeployment);
      validDeployment2.jira_issues = ['CIP-29798', 'CIP-29798'];
      response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(validDeployment2).expect(422);
      response.body.message.should.containEql('You cannot add the same JIRA Issue multiple times. Please remove the duplicates: CIP-29798 and try again.');
    });

    it('should throw error when same JIRA Issue entered multiple times, display two issues the error message', async function () {
      validDeployment2 = _.cloneDeep(validDeployment);
      validDeployment2.jira_issues = ['CIP-29798', 'CIP-29798', 'CIP-30052', 'CIP-30052'];
      response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(validDeployment2).expect(422);
      response.body.message.should.containEql('You cannot add the same JIRA Issue multiple times. Please remove the duplicates: CIP-29798, CIP-30052 and try again.');
    });

    it('should throw error when same JIRA Issue entered multiple times: lowercase JIRA Issue value', async function () {
      validDeployment2 = _.cloneDeep(validDeployment);
      validDeployment2.jira_issues = ['CIP-29798', 'cip-29798', 'CIP-29798'];
      response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(validDeployment2).expect(422);
      response.body.message.should.containEql('You cannot add the same JIRA Issue multiple times. Please remove the duplicates: CIP-29798 and try again.');
    });

    it('should throw error when JIRA Issue is invalid', async function () {
      validDeployment2 = _.cloneDeep(validDeployment);
      validDeployment2.jira_issues = ['CIP-29798', 'CI2979899999INVALID'];
      response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(validDeployment2).expect(422);
      response.body.message.should.containEql('is invalid');
    });

    it('should throw error when deployment name is not provided', async function () {
      validDeployment2 = _.cloneDeep(validDeployment);
      validDeployment2.name = null;
      validDeployment2.status = 'In Use';
      response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(validDeployment2).expect(400);
      response.body.message.should.containEql('Path `name` is required.');
    });

    it('should throw error when deployment name already exists', async function () {
      validDeployment2 = _.cloneDeep(validDeployment);
      validDeployment2.name = 'updatedName';
      response = await agent.post('/api/deployments').send(validDeployment2).expect(201);
      validDeployment2.name = 'validDeployment';
      response = await agent.put(`/api/deployments/${response.body._id}`).send(validDeployment2).expect(400);
      response.body.message.should.containEql('Error, provided name is not unique.');
    });

    it('should throw error when invalid area_id is provided', async function () {
      validDeployment2 = _.cloneDeep(validDeployment);
      validDeployment2.name = 'updatedTheName';
      validDeployment2.area_id = 'fake';
      response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(validDeployment2).expect(400);
      response.body.message.should.equal('Cast to ObjectID failed for value "fake" at path "area_id"');
    });

    it('should throw error when invalid program_id is provided', async function () {
      validDeployment2 = _.cloneDeep(validDeployment);
      validDeployment2.name = 'updatedTheName';
      validDeployment2.program_id = 'fake';
      response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(validDeployment2).expect(400);
      response.body.message.should.equal('Cast to ObjectID failed for value "fake" at path "program_id"');
    });

    it('should throw error when invalid team_id is provided', async function () {
      validDeployment2 = _.cloneDeep(validDeployment);
      validDeployment2.name = 'updatedTheName';
      validDeployment2.team_id = 'fake';
      response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(validDeployment2).expect(400);
      response.body.message.should.equal('Cast to ObjectID failed for value "fake" at path "team_id"');
    });

    it('should throw error when area_id is not provided', async function () {
      validDeployment2 = _.cloneDeep(validDeployment);
      validDeployment2.name = 'updatedName';
      validDeployment2.area_id = null;
      response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(validDeployment2).expect(400);
      response.body.message.should.equal('Path `area_id` is required.');
    });

    it('should throw error when program_id is not provided', async function () {
      validDeployment2 = _.cloneDeep(validDeployment);
      validDeployment2.name = 'updatedName';
      validDeployment2.program_id = null;
      response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(validDeployment2).expect(400);
      response.body.message.should.equal('Path `program_id` is required.');
    });

    it('should throw error when area_id does not correspond with an actual Area artifact', async function () {
      validDeployment2 = _.cloneDeep(validDeployment);
      validDeployment2.name = 'updatedName';
      validDeployment2.area_id = '000000000000000000000000';
      response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(validDeployment2).expect(422);
      response.body.message.should.equal(`A Area with the given id '${validDeployment2.area_id}' could not be found.`);
    });

    it('should throw error when program_id does not correspond with an actual Program artifact', async function () {
      validDeployment2 = _.cloneDeep(validDeployment);
      validDeployment2.name = 'updatedName';
      validDeployment2.program_id = '000000000000000000000000';
      response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(validDeployment2).expect(422);
      response.body.message.should.equal(`A Program with the given id '${validDeployment2.program_id}' could not be found.`);
    });

    it('should throw error when team_id does not correspond with an actual Team artifact', async function () {
      validDeployment2 = _.cloneDeep(validDeployment);
      validDeployment2.name = 'updatedName';
      validDeployment2.team_id = '000000000000000000000000';
      response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(validDeployment2).expect(422);
      response.body.message.should.equal(`A Team with the given id '${validDeployment2.team_id}' could not be found.`);
    });

    it('should update a deployment with new protected product configuration when user is standard-user', async function () {
      userObject.userRoles = [roleUserObject._id];
      await userObject.save();

      var deploymentProduct = {
        product_type_name: productTypeObject.name,
        flavour_name: productTypeObject.flavours[0],
        infrastructure: 'Cloud',
        location: 'Athlone',
        purpose: 'Product Notes',
        jenkinsJob: 'https://fem162-eiffel004.lmera.ericsson.se:8443/jenkins/job/647_physicaldeployment/',
        admins_only: true,
        configuration: [
          {
            "key_name": "name",
            "key_value": "value"
          }
        ]
      };
      validDeployment2 = _.cloneDeep(validDeployment);
      validDeployment2.name = 'updateDeployment';
      validDeployment2.status = 'In Use';
      validDeployment2.products[0] = deploymentProduct;
      response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(validDeployment2).expect(200);
      response.body.name.should.equal(validDeployment2.name);
    });

    it('should not update a deployment with protected product configuration when user is standard-user and protected config is missing in request', async function () {
      userObject.userRoles = [roleAdminObject._id];
      await userObject.save();
      // add new configuration
      var deploymentProduct = {
        product_type_name: productTypeObject.name,
        flavour_name: productTypeObject.flavours[0],
        infrastructure: 'Cloud',
        location: 'Athlone',
        purpose: 'Product Notes',
        jenkinsJob: 'https://fem162-eiffel004.lmera.ericsson.se:8443/jenkins/job/647_physicaldeployment/',
        admins_only: true,
        configuration: [
          {
            "key_name": "name",
            "key_value": "value"
          }
        ]
      };
      validDeployment2 = _.cloneDeep(validDeployment);
      validDeployment2.name = 'updateDeployment';
      validDeployment2.status = 'In Use';
      validDeployment2.products[0] = deploymentProduct;
      response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(validDeployment2).expect(200);
      response.body.name.should.equal(validDeployment2.name);

      // update as a user
      userObject.userRoles = [roleUserObject._id];
      await userObject.save();
      var deploymentProduct = {
        product_type_name: productTypeObject.name,
        flavour_name: productTypeObject.flavours[0],
        infrastructure: 'Cloud',
        location: 'Athlone',
        purpose: 'Product Notes',
        jenkinsJob: 'https://fem162-eiffel004.lmera.ericsson.se:8443/jenkins/job/647_physicaldeployment/',
        admins_only: true,
        configuration: [
          {
            "key_name": "anotherKey",
            "key_value": "anotherValue"
          }
        ]
      };
      validDeployment2 = _.cloneDeep(validDeployment);
      validDeployment2.name = 'updateDeployment';
      validDeployment2.status = 'In Use';
      validDeployment2.products[0] = deploymentProduct;
      response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(validDeployment2).expect(422);
      response.body.message.should.equal('You are not allowed to edit Product Configuration as User, that is for \'Admins Only\'. Please include them in your request unchanged.');
    });

    it('should not update a deployment with protected product configuration when user is standard-user and product with protected config is missing in request', async function () {
      userObject.userRoles = [roleAdminObject._id];
      await userObject.save();
      // add new configuration
      var deploymentProduct = {
        product_type_name: productTypeObject.name,
        flavour_name: productTypeObject.flavours[0],
        infrastructure: 'Cloud',
        location: 'Athlone',
        purpose: 'Product Notes',
        jenkinsJob: 'https://fem162-eiffel004.lmera.ericsson.se:8443/jenkins/job/647_physicaldeployment/',
        admins_only: true,
        configuration: [
          {
            "key_name": "name",
            "key_value": "value"
          }
        ]
      };
      validDeployment2 = _.cloneDeep(validDeployment);
      validDeployment2.name = 'updateDeployment';
      validDeployment2.status = 'In Use';
      validDeployment2.products[0] = deploymentProduct;
      response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(validDeployment2).expect(200);
      response.body.name.should.equal(validDeployment2.name);

      // update as a user
      userObject.userRoles = [roleUserObject._id];
      await userObject.save();
      var deploymentProduct = {};
      validDeployment2 = _.cloneDeep(validDeployment);
      validDeployment2.name = 'updateDeployment';
      validDeployment2.status = 'In Use';
      validDeployment2.products[0] = deploymentProduct;
      response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(validDeployment2).expect(422);
      response.body.message.should.equal('You are not allowed to edit Product Configuration as User, that is for \'Admins Only\'. Please include them in your request unchanged.');
    });

    it('should not update a deployment with protected product configuration when user is standard-user and new config has extra field', async function () {
      userObject.userRoles = [roleAdminObject._id];
      await userObject.save();
      // add new configuration
      var deploymentProduct = {
        product_type_name: productTypeObject.name,
        flavour_name: productTypeObject.flavours[0],
        infrastructure: 'Cloud',
        location: 'Athlone',
        purpose: 'Product Notes',
        jenkinsJob: 'https://fem162-eiffel004.lmera.ericsson.se:8443/jenkins/job/647_physicaldeployment/',
        admins_only: true,
        configuration: [
          {
            "key_name": "name",
            "key_value": "value"
          }
        ]
      };
      validDeployment2 = _.cloneDeep(validDeployment);
      validDeployment2.name = 'updateDeployment';
      validDeployment2.status = 'In Use';
      validDeployment2.products[0] = deploymentProduct;
      response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(validDeployment2).expect(200);
      response.body.name.should.equal(validDeployment2.name);

      // update as a user
      userObject.userRoles = [roleUserObject._id];
      await userObject.save();
      var deploymentProduct = {
        product_type_name: productTypeObject.name,
        flavour_name: productTypeObject.flavours[0],
        infrastructure: 'Cloud',
        location: 'Athlone',
        purpose: 'Product Notes',
        jenkinsJob: 'https://fem162-eiffel004.lmera.ericsson.se:8443/jenkins/job/647_physicaldeployment/',
        admins_only: true,
        configuration: [
          {
            "key_name": "name",
            "key_value": "value"
          },
          {
            "key_name": "extraName",
            "key_value": "extraValue"
          }
        ]
      };
      validDeployment2 = _.cloneDeep(validDeployment);
      validDeployment2.name = 'updateDeployment';
      validDeployment2.status = 'In Use';
      validDeployment2.products[0] = deploymentProduct;
      response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(validDeployment2).expect(422);
      response.body.message.should.equal('You are not allowed to edit Product Configuration as User, that is for \'Admins Only\'. Please include them in your request unchanged.');
    });

    afterEach(async function () {
      sinon.restore();
    });
  });

  describe('DELETE', function () {
    beforeEach(async function () {
      deploymentObject = new Deployment(validDeployment);
      await deploymentObject.save();
    });

    it('should delete a deployment and check its response and the db', async function () {
      response = await agent.delete(`/api/deployments/${deploymentObject._id}`).expect(200);
      response.body.should.be.instanceof(Object);
      response.body.name.should.equal(deploymentObject.name);
      count = await Deployment.count().exec();
      count.should.equal(0);
    });

    it('should not delete a deployment when user is not authenticated', async function () {
      response = await nonAuthAgent.delete(`/api/deployments/${deploymentObject._id}`).expect(401);
      response.body.message.should.equal('User must be logged in');
    });

    it('should delete a deployment when user is standard-user', async function () {
      userObject.userRoles = [roleUserObject._id];
      await userObject.save();
      response = await agent.delete(`/api/deployments/${deploymentObject._id}`).auth(validUser.username, validUser.password).expect(200);
    });

    it('should delete a deployment when user is admin', async function () {
      userObject.userRoles = [roleAdminObject._id];
      await userObject.save();
      await agent.delete(`/api/deployments/${deploymentObject._id}`).auth(validUser.username, validUser.password).expect(200);
    });

    it('should delete a deployment when user is super-admin', async function () {
      userObject.userRoles = [roleSuperAdmObject._id];
      await userObject.save();
      await agent.delete(`/api/deployments/${deploymentObject._id}`).auth(validUser.username, validUser.password).expect(200);
    });

    it('should fail when attempting to delete a deployment that does not exist', async function () {
      response = await agent.delete('/api/deployments/000000000000000000000000').expect(404);
      response.body.message.should.equal('A Deployment with that id does not exist');
    });

    it('should update an existing log with user-details for a deployment thats deleted by a logged-in user', async function () {
      response = await agent.delete(`/api/deployments/${deploymentObject._id}`).expect(200);
      response.body._id.should.have.length(24);
      (deploymentObject.area_id.equals(response.body.area_id)).should.be.true;

      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      logReturned.originalData.should.not.equal(undefined);
      logReturned.originalData.name.should.equal(validDeployment.name);

      logReturned.updates.should.be.instanceof(Array).and.have.lengthOf(0);
      logReturned.deletedAt.should.not.equal(undefined);
      logReturned.deletedBy.should.not.equal(undefined);
      logReturned.deletedBy.username.should.equal(validUser.username);
      logReturned.deletedBy.email.should.equal(validUser.email);
    });

    it('should create a log with defined user-details for a deployment that gets deleted by a logged-in user', async function () {
      // clear logs and verify
      await History.remove().exec();
      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      should.not.exist(logReturned);

      response = await agent.delete(`/api/deployments/${deploymentObject._id}`).expect(200);
      response.body._id.should.have.length(24);
      (deploymentObject.area_id.equals(response.body.area_id)).should.be.true;

      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      logReturned.originalData.should.not.equal(undefined);
      logReturned.originalData.name.should.equal(validDeployment.name);

      logReturned.updates.should.be.instanceof(Array).and.have.lengthOf(0);
      logReturned.deletedAt.should.not.equal(undefined);
      logReturned.deletedBy.should.not.equal(undefined);
      logReturned.deletedBy.username.should.equal(validUser.username);
      logReturned.deletedBy.email.should.equal(validUser.email);
    });

    it('should not delete a deployment with protected product configuration when user is standard-user', async function () {
      userObject.userRoles = [roleUserObject._id];
      await userObject.save();
      // Deployment-Product
      var deploymentProduct = {
        product_type_name: productTypeObject.name,
        flavour_name: productTypeObject.flavours[0],
        infrastructure: 'Cloud',
        location: 'Athlone',
        purpose: 'Product Notes',
        jenkinsJob: 'https://fem162-eiffel004.lmera.ericsson.se:8443/jenkins/job/647_physicaldeployment/',
        admins_only: true,
        configuration: [
          {
            "key_name": "name",
            "key_value": "value"
          }
        ]
      };
      validDeployment2 = _.cloneDeep(validDeployment);
      validDeployment2.name = 'deleteDeployment';
      validDeployment2.status = 'In Use';
      validDeployment2.products[0] = deploymentProduct;

      response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(validDeployment2).expect(200);
      response.body.name.should.equal(validDeployment2.name);
      response = await agent.delete(`/api/deployments/${deploymentObject._id}`).auth(validUser.username, validUser.password).expect(422);
      response.body.message.should.equal('Only Admin can delete this Deployment as it contains Product Configuration that can only be edited by an Admin.');
    });

    it('should delete a deployment with protected product configuration when user is admin', async function () {
      userObject.userRoles = [roleAdminObject._id];
      await userObject.save();

      var deploymentProduct = {
        product_type_name: productTypeObject.name,
        flavour_name: productTypeObject.flavours[0],
        infrastructure: 'Cloud',
        location: 'Athlone',
        purpose: 'Product Notes',
        jenkinsJob: 'https://fem162-eiffel004.lmera.ericsson.se:8443/jenkins/job/647_physicaldeployment/',
        admins_only: true,
        configuration: [
          {
            "key_name": "name",
            "key_value": "value"
          }
        ]
      };
      validDeployment2 = _.cloneDeep(validDeployment);
      validDeployment2.name = 'deleteDeployment';
      validDeployment2.status = 'In Use';
      validDeployment2.products[0] = deploymentProduct;

      response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(validDeployment2).expect(200);
      response.body.name.should.equal(validDeployment2.name);
      await agent.delete(`/api/deployments/${deploymentObject._id}`).auth(validUser.username, validUser.password).expect(200);
    });

    it('should delete a deployment with protected product configuration when user is superAdmin', async function () {
      userObject.userRoles = [roleSuperAdmObject._id];
      await userObject.save();

      var deploymentProduct = {
        product_type_name: productTypeObject.name,
        flavour_name: productTypeObject.flavours[0],
        infrastructure: 'Cloud',
        location: 'Athlone',
        purpose: 'Product Notes',
        jenkinsJob: 'https://fem162-eiffel004.lmera.ericsson.se:8443/jenkins/job/647_physicaldeployment/',
        admins_only: true,
        configuration: [
          {
            "key_name": "name",
            "key_value": "value"
          }
        ]
      };
      validDeployment2 = _.cloneDeep(validDeployment);
      validDeployment2.name = 'deleteDeployment';
      validDeployment2.status = 'In Use';
      validDeployment2.products[0] = deploymentProduct;

      response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(validDeployment2).expect(200);
      response.body.name.should.equal(validDeployment2.name);
      await agent.delete(`/api/deployments/${deploymentObject._id}`).auth(validUser.username, validUser.password).expect(200);
    });
  });

  describe('SEARCH', function () {
    beforeEach(async function () {
      deploymentObject = new Deployment(validDeployment);
      await deploymentObject.save();
    });

    it('should not return a deployment when passing in a valid parameter with a non existent deployment ID', async function () {
      response = await agent.get('/api/deployments?q=_id=5bcdbe7287e21906ed4f12ba').expect(200);
      response.body.length.should.equal(0);
    });

    it('should not return a deployment when passing in a valid parameter with a non existent parameter', async function () {
      response = await agent.get('/api/deployments?q=' + encodeURIComponent('_id=' + deploymentObject._id
        + '&name=notExisting')).expect(200);
      response.body.length.should.equal(0);
    });

    it('should return an error when not encoding q search parameters', async function () {
      response = await agent.get('/api/deployments?q=._id=' + deploymentObject._id + '&name=notExisting').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return a single deployment when passing in _id parameter', async function () {
      response = await agent.get('/api/deployments?q=_id=' + deploymentObject._id).expect(200);
      response.body[0].should.be.instanceof(Object);
      response.body[0].name.should.equal(deploymentObject.name);
    });

    it('should not return a deployment when passing in invalid parameter', async function () {
      response = await agent.get('/api/deployments?q=n0nsense=123454321').expect(200);
      response.body.length.should.equal(0);
    });

    it('should return a single deployment when passing in name parameter', async function () {
      response = await agent.get('/api/deployments?q=name=' + deploymentObject.name).expect(200);
      response.body[0].should.be.instanceof(Object);
      response.body[0].name.should.equal(deploymentObject.name);
    });

    it('should only return fields specified in url', async function () {
      response = await agent.get('/api/deployments?fields=name').expect(200);
      response.body.length.should.equal(1);
      for (var key in response.body) {
        if (Object.prototype.hasOwnProperty.call(response.body, key)) {
          Object.prototype.hasOwnProperty.call(response.body[key], 'name').should.equal(true);
        }
      }
    });

    it('should only return fields specified in url using fields and q functionality', async function () {
      response = await agent.get('/api/deployments?fields=name&q=name=' + deploymentObject.name).expect(200);
      response.body.length.should.equal(1);
      Object.prototype.hasOwnProperty.call(response.body[0], 'name').should.equal(true);
      response.body[0].name.should.equal(deploymentObject.name);
    });

    it('should return an error message when query has invalid search key blah', async function () {
      response = await agent.get('/api/deployments?q=name=' + deploymentObject.name + '&fields=name&blah=blah').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return an error message when queried with an improper search', async function () {
      response = await agent.get('/api/deployments?name=' + deploymentObject.name).expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return an error message when queried with an empty q=', async function () {
      response = await agent.get('/api/deployments?q=').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return an error message when queried with an empty fields=', async function () {
      response = await agent.get('/api/deployments?fields=').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return an error message when queried with an empty fields= and q=', async function () {
      response = await agent.get('/api/deployments?q=&fields=').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });
  });

  afterEach(async function () {
    await Team.remove().exec();
    await User.remove().exec();
    await Area.remove().exec();
    await Deployment.remove().exec();
    await ProductType.remove().exec();
    await ProductFlavour.remove().exec();
    await Program.remove().exec();
    await Hardware.remove().exec();
    await History.remove().exec();
    await Label.remove().exec();
    await Role.remove().exec();
  });
});

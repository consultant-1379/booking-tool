'use strict';

var fs = require('fs');
var should = require('should'),
  superagentDefaults = require('superagent-defaults'),
  supertest = require('supertest'),
  mongoose = require('mongoose'),
  _ = require('lodash'),
  Moment = require('moment'),
  MomentRange = require('moment-range'),
  sinon = require('sinon'),
  History = require('../../../history/server/models/history.server.model').getSchema('bookings'),
  Booking = require('../../server/models/bookings.server.model').Schema,
  Deployment = require('../../../deployments/server/models/deployments.server.model').Schema,
  Program = require('../../../programs/server/models/programs.server.model').Schema,
  Area = require('../../../areas/server/models/areas.server.model').Schema,
  User = require('../../../users/server/models/user.server.model').Schema,
  Role = require('../../../roles/server/models/roles.server.model').Schema,
  Team = require('../../../teams/server/models/teams.server.model').Schema,
  ProductType = require('../../../product_types/server/models/product_types.server.model').Schema,
  ProductFlavour = require('../../../product_flavours/server/models/product_flavours.server.model').Schema,
  express = require('../../../../config/lib/express'),
  moment = MomentRange.extendMoment(Moment),
  timeErrorFormat = 'YYYY-MM-DD',
  today = moment(new Date()).format(timeErrorFormat);

require('sinon-mongoose');

var app,
  agent,
  nonAuthAgent,
  validBooking,
  validBookingWithTemplate,
  bookingObject,
  badBooking,
  bookingReturned,
  validBooking2,
  validProductType,
  validProductFlavour,
  productTypeObject,
  productFlavourObject,
  booking2Object,
  validDeployment,
  validDeployment2,
  validDeployment3,
  validDeployment5,
  validDeployment7,
  validDeployment8,
  validDeploymentWithProduct,
  deploymentObject,
  deploymentObject2,
  deploymentObject3,
  deploymentObject4,
  deploymentObject5,
  deploymentObject6,
  deploymentObject7,
  deploymentObject8,
  validArea,
  validArea2,
  validArea3,
  validArea4,
  areaObject,
  areaObject2,
  areaObject3,
  areaObject4,
  validTeam,
  validTeam2,
  validTeam3,
  validTeam4,
  teamObject,
  teamObject2,
  teamObject3,
  teamObject4,
  validProgram,
  validProgram2,
  validProgramObjectWithTemplate,
  programObject,
  programObject2,
  programObjectWithTemplate,
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
  roleUserObject,
  bookingRange;

describe('Bookings', function () {
  before(async function () {
    app = express.init(mongoose);
    nonAuthAgent = superagentDefaults(supertest(app));
    agent = superagentDefaults(supertest(app));
  });

  beforeEach(async function () {
    validArea = JSON.parse(fs.readFileSync('/opt/mean.js/modules/areas/tests/server/test_files/valid_area.json', 'utf8'));
    validProgram = JSON.parse(fs.readFileSync('/opt/mean.js/modules/programs/tests/server/test_files/valid_program.json', 'utf8'));
    validProgramObjectWithTemplate = JSON.parse(fs.readFileSync('/opt/mean.js/modules/programs/tests/server/test_files/valid_program_with_jira_template.json', 'utf8'));
    validUser = JSON.parse(fs.readFileSync('/opt/mean.js/modules/core/tests/server/test_files/dttUser.json', 'utf8'));
    validTeam = JSON.parse(fs.readFileSync('/opt/mean.js/modules/teams/tests/server/test_files/valid_team.json', 'utf8'));
    validDeployment = JSON.parse(fs.readFileSync('/opt/mean.js/modules/deployments/tests/server/test_files/valid_deployment.json', 'utf8'));
    validBooking = JSON.parse(fs.readFileSync('/opt/mean.js/modules/bookings/tests/server/test_files/valid_booking.json', 'utf8'));
    validBookingWithTemplate = JSON.parse(fs.readFileSync('/opt/mean.js/modules/bookings/tests/server/test_files/valid_booking_jira_template.json', 'utf8'));
    validProductType = JSON.parse(fs.readFileSync('/opt/mean.js/modules/bookings/tests/server/test_files/valid_product_type_ENM.json', 'utf8'));
    validProductFlavour = JSON.parse(fs.readFileSync('/opt/mean.js/modules/product_flavours/tests/server/test_files/valid_product_flavour.json', 'utf8'));
    validUserRole = JSON.parse(fs.readFileSync('/opt/mean.js/modules/roles/tests/server/test_files/valid_user_role.json', 'utf8'));
    validAdminRole = JSON.parse(fs.readFileSync('/opt/mean.js/modules/roles/tests/server/test_files/valid_admin_role.json', 'utf8'));
    validSuperAdminRole = JSON.parse(fs.readFileSync('/opt/mean.js/modules/roles/tests/server/test_files/valid_super_admin_role.json', 'utf8'));

    // Create Roles
    roleSuperAdmObject = new Role(validSuperAdminRole)
    roleAdminObject = new Role(validAdminRole)
    roleUserObject = new Role(validUserRole)
    await roleSuperAdmObject.save();
    await roleAdminObject.save();
    await roleUserObject.save();

    // Create User
    validUser.userRoles = [roleUserObject._id];
    userObject = new User(validUser);
    await userObject.save();

    // Create Program
    programObject = new Program(validProgram);
    await programObject.save();
    validProgram2 = _.cloneDeep(validProgram);
    validProgram2.name = 'Unassigned';
    programObject2 = new Program(validProgram2);
    await programObject2.save();
    validProgramObjectWithTemplate.name = 'validProgramObjectWithTemplate';
    programObjectWithTemplate = new Program(validProgramObjectWithTemplate);
    await programObjectWithTemplate.save();

    // Create Areas
    validArea.bookingAssigneeUser_id = userObject._id;
    validArea.program_id = programObject._id;
    validArea.maxBookingDurationDays = 3;
    areaObject = new Area(validArea);
    await areaObject.save();
    validArea2 = _.cloneDeep(validArea);
    validArea2.name = 'validArea2';
    areaObject2 = new Area(validArea2);
    await areaObject2.save();
    // Unassigned - Area
    validArea3 = _.cloneDeep(validArea);
    validArea3.program_id = programObject2._id;
    validArea3.name = 'Unassigned';
    areaObject3 = new Area(validArea3);
    await areaObject3.save();
    // Area For Jira template Testing
    validArea4 = _.cloneDeep(validArea);
    validArea4.name = 'validArea4';
    validArea4.program_id = programObjectWithTemplate._id;
    areaObject4 = new Area(validArea4);
    await areaObject4.save();

    // Create Teams
    validTeam.admin_IDs = [userObject._id];
    validTeam.area_id = areaObject._id;
    teamObject = new Team(validTeam);
    await teamObject.save();

    validTeam2 = _.cloneDeep(validTeam);
    validTeam2.name = 'secondTeamName';
    teamObject2 = new Team(validTeam2);
    await teamObject2.save();

    validTeam3 = _.cloneDeep(validTeam);
    validTeam3.name = 'thirdTeamName';
    validTeam3.area_id = areaObject2._id;
    teamObject3 = new Team(validTeam3);
    await teamObject3.save();

    validTeam4 = _.cloneDeep(validTeam);
    validTeam4.name = 'fourthTeamName';
    validTeam4.area_id = areaObject4._id;
    teamObject4 = new Team(validTeam4);
    await teamObject4.save();

    // Create Product-Flavour
    productFlavourObject = new ProductFlavour(validProductFlavour);
    await productFlavourObject.save();

    // Create Product-Type
    validProductType.flavours.push(productFlavourObject.name);
    validProductType.name = 'ENM';
    productTypeObject = new ProductType(validProductType);
    await productTypeObject.save();

    // Prepare Deployment-Product
    var deploymentProductCloud = {
      product_type_name: productTypeObject.name,
      flavour_name: productTypeObject.flavours[0],
      infrastructure: 'Cloud',
      location: 'Athlone',
      purpose: 'Product Notes',
      jenkinsJob: 'https://fem13s11-eiffel004.eiffel.gic.ericsson.se:8443/jenkins/job/testingTrigger2/',
      admins_only: false
    };

    var deploymentProductPhysical = {
      configuration: [
        { key_name: "SVC", key_value: "4" },
        { key_name: "DB", key_value: "2" },
        { key_name: "SCP", key_value: "2" }
      ],
      product_type_name: productTypeObject.name,
      flavour_name: productTypeObject.flavours[0],
      infrastructure: 'Physical',
      location: 'Athlone',
      purpose: 'Product Notes',
      jenkinsJob: 'https://fem13s11-eiffel004.eiffel.gic.ericsson.se:8443/jenkins/job/testingTrigger2/',
      admins_only: false
    };

    // Create Deployment
    validDeployment.area_id = areaObject._id;
    validDeployment.program_id = programObject._id;
    validDeployment.team_id = teamObject._id;
    validDeployment.products = [deploymentProductCloud];
    deploymentObject = new Deployment(validDeployment);
    await deploymentObject.save();

    validDeployment.name = 'validDeployment2';
    validDeployment.crossRASharing = true;
    deploymentObject2 = new Deployment(validDeployment);
    await deploymentObject2.save();

    validDeployment2 = _.cloneDeep(validDeployment);
    validDeployment2.products = [];
    validDeployment2.name = 'validDeployment3';
    deploymentObject3 = new Deployment(validDeployment2);
    await deploymentObject3.save();

    validDeployment3 = _.cloneDeep(validDeployment);
    validDeployment3.name = 'validDeployment4';
    validDeployment3.products = [deploymentProductPhysical];
    deploymentObject4 = new Deployment(validDeployment3);
    await deploymentObject4.save();

    validDeployment5 = _.cloneDeep(validDeployment);
    validDeployment5.name = 'validDeployment5';
    validDeployment5.products = [deploymentProductPhysical];
    validDeployment5.program_id = programObject2._id;
    validDeployment5.area_id = areaObject3._id;
    deploymentObject5 = new Deployment(validDeployment5);
    await deploymentObject5.save();

    validDeployment8 = _.cloneDeep(validDeployment);
    validDeployment8.name = 'validDeployment8';
    var deploymentProductInvalidJenkinsURL = _.cloneDeep(deploymentProductCloud);
    deploymentProductInvalidJenkinsURL.jenkinsJob= 'https://fem13s11-eiffel004.eiffel.gic.ericsson.se:8443/jenkins/job/testingTrigger2NOTVALID/';
    validDeployment8.products = [deploymentProductInvalidJenkinsURL];
    deploymentObject8 = new Deployment(validDeployment8);
    await deploymentObject8.save();

    // Create Deployment For Program with Jira Template
    validDeploymentWithProduct = _.cloneDeep(validDeployment)
    validDeploymentWithProduct.name = 'validDeployment6'
    validDeploymentWithProduct.area_id = areaObject4._id;
    validDeploymentWithProduct.program_id = programObjectWithTemplate._id;
    validDeploymentWithProduct.team_id = teamObject4._id;
    validDeploymentWithProduct.products = [deploymentProductCloud];
    deploymentObject6 = new Deployment(validDeploymentWithProduct);
    await deploymentObject6.save();

    validDeployment7 = _.cloneDeep(validDeployment);
    validDeployment7.name = 'validDeployment7';
    validDeployment7.products = [deploymentProductPhysical];
    validDeployment7.status = 'In Review';
    deploymentObject7 = new Deployment(validDeployment7);
    await deploymentObject7.save();

    // Update Valid-Booking with relevant info
    validBooking.team_id = teamObject._id;
    validBooking.deployment_id = deploymentObject._id;
    validBooking.product_id = deploymentObject.products[0]._id;
    validBooking.startTime = today;
    validBooking.endTime = today;

    validBookingWithTemplate.team_id = teamObject4._id;
    validBookingWithTemplate.deployment_id = deploymentObject6._id;
    validBookingWithTemplate.product_id = deploymentObject6.products[0]._id;
    validBookingWithTemplate.startTime = today;
    validBookingWithTemplate.endTime = today;

    agent.auth(validUser.username, validUser.password);
  });

  describe('POST', function () {
    it('should create a new Booking and check db', async function () {
      response = await agent
        .post('/api/bookings')
        .send(validBooking)
        .expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/bookings/${response.body._id}`);
      bookingReturned = await Booking.findById(response.body._id).exec();
      bookingReturned.name.should.equal(response.body._id);
      bookingReturned.team_id.toString().should.equal(validBooking.team_id.toString());
      bookingReturned.deployment_id.toString().should.equal(validBooking.deployment_id.toString());
      bookingReturned.jenkinsJobType.should.equal(validBooking.jenkinsJobType);
    });

    it('should not create a new Booking if Jenkins Job URL is invalid and automaticJenkinsIITrigger is true', async function () {
      validBooking.deployment_id = deploymentObject8._id;
      validBooking.product_id = deploymentObject8.products[0]._id;
      validBooking.team_id = teamObject2._id;
      response = await agent
        .post('/api/bookings')
        .send(validBooking)
        .expect(422);
      response.body.message.should.equal(`Jenkins URL is invalid for Product ENM, please set 'automaticJenkinsIITrigger' to 'false' or ensure Jenkins URL is valid for Product ENM which is part of Deployment validDeployment8.`);
    });

    it('should not create a new Booking if Jenkins Job URL is invalid and automaticJenkinsIITrigger is true until automaticJenkinsIITrigger is set to false.', async function () {
      validBooking.deployment_id = deploymentObject8._id;
      validBooking.product_id = deploymentObject8.products[0]._id;
      validBooking.team_id = teamObject2._id;
      response = await agent
        .post('/api/bookings')
        .send(validBooking)
        .expect(422);
      response.body.message.should.equal(`Jenkins URL is invalid for Product ENM, please set 'automaticJenkinsIITrigger' to 'false' or ensure Jenkins URL is valid for Product ENM which is part of Deployment validDeployment8.`);

      // change to false
      validBooking.automaticJenkinsIITrigger = false;
      response = await agent
        .post('/api/bookings')
        .send(validBooking)
        .expect(201);
        bookingReturned = await Booking.findById(response.body._id).exec();
        bookingReturned.name.should.equal(response.body._id);
        bookingReturned.team_id.toString().should.equal(validBooking.team_id.toString());
        bookingReturned.deployment_id.toString().should.equal(validBooking.deployment_id.toString());
        bookingReturned.jenkinsJobType.should.equal(validBooking.jenkinsJobType);
    });

    it('should create a new Booking with Jira Templates and check db', async function () {
      response = await agent
        .post('/api/bookings')
        .send(validBookingWithTemplate)
        .expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/bookings/${response.body._id}`);
      bookingReturned = await Booking.findById(response.body._id).exec();
      bookingReturned.name.should.equal(response.body._id);
      bookingReturned.team_id.toString().should.equal(validBookingWithTemplate.team_id.toString());
      bookingReturned.deployment_id.toString().should.equal(validBookingWithTemplate.deployment_id.toString());
      bookingReturned.jenkinsJobType.should.equal(validBookingWithTemplate.jenkinsJobType);
    });

    it('should create a new Booking with Jira Templates for eTeams Jira and check db', async function () {
      validBookingWithTemplate.jiraTemplate.jiraBoard = '';
      validBookingWithTemplate.jiraTemplate.issueType = '';
      validBookingWithTemplate.jiraTemplate.project = '';
      validBookingWithTemplate.jiraTemplate.custom_fields = [];
      validBookingWithTemplate.jiraTemplate.components = [];
      response = await agent
        .post('/api/bookings')
        .send(validBookingWithTemplate)
        .expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/bookings/${response.body._id}`);
      bookingReturned = await Booking.findById(response.body._id).exec();
      bookingReturned.name.should.equal(response.body._id);
      bookingReturned.team_id.toString().should.equal(validBookingWithTemplate.team_id.toString());
      bookingReturned.deployment_id.toString().should.equal(validBookingWithTemplate.deployment_id.toString());
      bookingReturned.jenkinsJobType.should.equal(validBookingWithTemplate.jenkinsJobType);
    });

    it('should create a new Booking for a Deployment without Products', async function () {
      delete validBooking.product_id;
      validBooking.deployment_id = deploymentObject3._id;
      response = await agent
        .post('/api/bookings')
        .send(validBooking)
        .expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/bookings/${response.body._id}`);
      bookingReturned = await Booking.findById(response.body._id).exec();
      bookingReturned.name.should.equal(response.body._id);
      bookingReturned.team_id.toString().should.equal(validBooking.team_id.toString());
      bookingReturned.deployment_id.toString().should.equal(validBooking.deployment_id.toString());
      bookingReturned.jenkinsJobType.should.equal(validBooking.jenkinsJobType);
    });

    it('should not create a new Booking when user is not authenticated', async function () {
      response = await nonAuthAgent.post('/api/bookings').send(validBooking).expect(401);
      response.body.message.should.equal('User must be logged in');
    });

    it('should create a new Booking when user is standard-user', async function () {
      userObject.userRoles = [roleUserObject._id];
      await userObject.save();
      response = await agent.post('/api/bookings').auth(validUser.username, validUser.password).send(validBooking).expect(201);
    });

    it('should create a new Booking when user is admin', async function () {
      userObject.userRoles = [roleAdminObject._id];
      await userObject.save();
      await agent.post('/api/bookings').auth(validUser.username, validUser.password).send(validBooking).expect(201);
    });

    it('should create a new Booking when user is super-admin', async function () {
      userObject.userRoles = [roleSuperAdmObject._id];
      await userObject.save();
      await agent.post('/api/bookings').auth(validUser.username, validUser.password).send(validBooking).expect(201);
    });

    it('should create a new Booking with UG job type and check db', async function () {
      var validBookingUG = _.cloneDeep(validBooking);
      validBookingUG.jenkinsJobType = 'UG';
      response = await agent.post('/api/bookings').send(validBookingUG).expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/bookings/${response.body._id}`);
      bookingReturned = await Booking.findById(response.body._id).exec();
      bookingReturned.name.should.equal(response.body._id);
      bookingReturned.team_id.toString().should.equal(validBookingUG.team_id.toString());
      bookingReturned.deployment_id.toString().should.equal(validBookingUG.deployment_id.toString());
      bookingReturned.jenkinsJobType.should.equal(validBookingUG.jenkinsJobType);
    });

    it('should create a Booking with no configuration', async function () {
      delete validBooking.configuration;
      response = await agent.post('/api/bookings').send(validBooking).expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/bookings/${response.body._id}`);
      bookingReturned = await Booking.findById(response.body._id).exec();
      bookingReturned.name.should.equal(response.body._id);
      bookingReturned.configuration.length.should.equal(0);
    });

    it('should create a Cloud Booking', async function () {
      validBooking.infrastructure = 'Cloud';
      response = await agent.post('/api/bookings').send(validBooking).expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/bookings/${response.body._id}`);
      bookingReturned = await Booking.findById(response.body._id).exec();
      bookingReturned.name.should.equal(response.body._id);
      bookingReturned.infrastructure.should.equal('Cloud');
    });

    it('should create a Physical Booking', async function () {
      validBooking.infrastructure = 'Physical';
      validBooking.deployment_id = deploymentObject4._id;
      validBooking.product_id = deploymentObject4.products[0]._id;
      response = await agent.post('/api/bookings').send(validBooking).expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/bookings/${response.body._id}`);
      bookingReturned = await Booking.findById(response.body._id).exec();
      bookingReturned.name.should.equal(response.body._id);
      bookingReturned.infrastructure.should.equal('Physical');
    });

    it('should create a Booking with no JIRA assignee', async function () {
      // Check Area has Assignee First
      response = await Area.findById(areaObject._id);
      response.should.not.equal(undefined);
      response.bookingAssigneeUser_id.toString().should.equal(userObject._id.toString());
      // Remove Area Assignee
      areaObject.bookingAssigneeUser_id = undefined;
      areaObject.updateReason = validArea.updateReason;
      await areaObject.save();
      // Check Area assignee was removed
      response = await Area.findById(areaObject._id);
      response.should.not.equal(undefined);
      should.equal(response.bookingAssigneeUser_id, undefined);
      // Create and Check Booking
      response = await agent.post('/api/bookings').send(validBooking).expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/bookings/${response.body._id}`);
      bookingReturned = await Booking.findById(response.body._id).exec();
      bookingReturned.name.should.equal(response.body._id);
    });

    it('should create a Booking with custom Team name', async function () {
      validBooking.customTeamName = 'customTeam';
      validBooking.team_id = undefined;
      response = await agent.post('/api/bookings').send(validBooking).expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/bookings/${response.body._id}`);
      bookingReturned = await Booking.findById(response.body._id).exec();
      bookingReturned.name.should.equal(response.body._id);
      bookingReturned.customTeamName.should.equal('customTeam');
    });

    it('should not create a new Booking when Product Drop begins with `\'ENM:\' and Set Version does not exist', async function () {
      validBooking.enmProductSetDrop = 'ENM:20.06';
      validBooking.enmProductSetVersion = undefined;
      response = await agent.post('/api/bookings').send(validBooking).expect(422);
      response.body.message.should.equal('Product Set Version must be defined if Product Set Drop is \'ENM:XXX\'.');
    });

    it('should not create a new Booking when Product Drop and Set Version are incompatible', async function () {
      validBooking.enmProductSetDrop = 'ENM:20.06';
      validBooking.enmProductSetVersion = '20.07.01';
      response = await agent.post('/api/bookings').send(validBooking).expect(422);
      // eslint-disable-next-line max-len
      response.body.message.should.equal(`Product Set Drop '${validBooking.enmProductSetDrop}' and Version '${validBooking.enmProductSetVersion}' are not compatible.`);
    });

    it('should not create a new Booking when deployment_id is not provided', async function () {
      validBooking.deployment_id = null;
      response = await agent.post('/api/bookings').send(validBooking).expect(400);
      response.body.message.should.equal('Path `deployment_id` is required.');
    });

    it('should not create a new Booking when startTime is not provided', async function () {
      validBooking.startTime = null;
      response = await agent.post('/api/bookings').send(validBooking).expect(400);
      response.body.message.should.equal('Path `startTime` is required.');
    });

    it('should not create a new Booking when product set drop version is not provided', async function () {
      validBooking.enmProductSetDrop = null;
      response = await agent.post('/api/bookings').send(validBooking).expect(400);
      response.body.message.should.equal('Path `enmProductSetDrop` is required.');
    });

    it('should not create a new Booking when endTime is not provided', async function () {
      validBooking.endTime = null;
      response = await agent.post('/api/bookings').send(validBooking).expect(400);
      response.body.message.should.equal('Path `endTime` is required.');
    });

    it('should throw error when invalid deployment_id is provided', async function () {
      validBooking.deployment_id = 'fake';
      response = await agent.post('/api/bookings').send(validBooking).expect(400);
      response.body.message.should.equal('Cast to ObjectID failed for value "fake" at path "deployment_id"');
    });

    it('should throw error when invalid product_id is provided', async function () {
      validBooking.product_id = 'fake';
      response = await agent.post('/api/bookings').send(validBooking).expect(400);
      response.body.message.should.equal('Cast to ObjectID failed for value "fake" at path "product_id"');
    });

    it('should throw error when invalid team_id is provided', async function () {
      validBooking.team_id = 'fake';
      response = await agent.post('/api/bookings').send(validBooking).expect(400);
      response.body.message.should.equal('Cast to ObjectID failed for value "fake" at path "team_id"');
    });

    it('should throw error when invalid startTime is provided', async function () {
      validBooking.startTime = 'fake';
      response = await agent.post('/api/bookings').send(validBooking).expect(400);
      response.body.message.should.equal('Cast to Date failed for value "fake" at path "startTime"');
    });

    it('should throw error when invalid endTime is provided', async function () {
      validBooking.endTime = 'fake';
      response = await agent.post('/api/bookings').send(validBooking).expect(400);
      response.body.message.should.equal('Cast to Date failed for value "fake" at path "endTime"');
    });

    it('should throw error when booking infrastructure is not the same as product being used', async function () {
      validBooking.infrastructure = 'Physical';
      response = await agent.post('/api/bookings').send(validBooking).expect(422);
      response.body.message.should.equal('Ìnrastructure of product \'Cloud\' is not equal to the one passed \'Physical\'');
    });

    it('should not create a booking with unknown key', async function () {
      badBooking = _.cloneDeep(validBooking);
      badBooking.rogueKey = 'rogueValue';
      response = await agent.post('/api/bookings').send(badBooking).expect(400);
      response.body.message.should.equal('Field `rogueKey` is not in schema and strict mode is set to throw.');
    });

    it('should respond with bad request with invalid json', async function () {
      badBooking = '{';
      response = await agent.post('/api/bookings').send(badBooking).type('json').expect(400);
      response.body.message.should.equal('There was a syntax error found in your request, please make sure that it is valid and try again');
    });

    it('should throw error when end-time for booking collides with another booking for the same deployment', async function () {
      await agent.post('/api/bookings').send(validBooking).expect(201);
      bookingRange = moment.range(validBooking.startTime, validBooking.endTime);
      validBooking2 = _.cloneDeep(validBooking);
      validBooking2.startTime = today;
      validBooking2.endTime = today;
      response = await agent.post('/api/bookings/').send(validBooking2).expect(422);
      response.body.message.should.equal(`${getTimeErrorMessage(bookingRange)}.`);
    });

    it('should throw error when start-time for booking collides with another booking for the same deployment', async function () {
      await agent.post('/api/bookings').send(validBooking).expect(201);
      bookingRange = moment.range(validBooking.startTime, validBooking.endTime);
      validBooking2 = _.cloneDeep(validBooking);
      validBooking2.startTime = today;
      validBooking2.endTime = today;
      response = await agent.post('/api/bookings/').send(validBooking2).expect(422);
      response.body.message.should.equal(`${getTimeErrorMessage(bookingRange)}.`);
    });

    it('should throw error when the time between Start-Time and End-Time for booking contains the time of another booking for the same deployment', async function () {
      await agent.post('/api/bookings').send(validBooking).expect(201);
      bookingRange = moment.range(validBooking.startTime, validBooking.endTime);

      validBooking2 = _.cloneDeep(validBooking);
      validBooking2.startTime = today;
      validBooking2.endTime = today;
      response = await agent.post('/api/bookings/').send(validBooking2).expect(422);
      response.body.message.should.equal(`${getTimeErrorMessage(bookingRange)}.`);
    });

    it('should create a Sharing booking if Start-time and End-Time is between Shareable booking', async function () {
      validBooking.bookingType = 'Shareable';
      response = await agent.post('/api/bookings').send(validBooking).expect(201);
      var bookingId = response.body._id;
      // Create Second Shareable Booking which should get set to 'Sharing'
      validBooking.team_id = teamObject2._id;
      response = await agent.post('/api/bookings').send(validBooking).expect(201);
      response.body.bookingType.should.equal('Sharing');
      response.body.sharingWithBooking_id.toString().should.equal(bookingId.toString());
    });

    it('should throw error when creating a Sharing booking if both Parent and Child Booking have the same Team', async function () {
      validBooking.bookingType = 'Shareable';
      response = await agent.post('/api/bookings').send(validBooking).expect(201);
      // Create Second Shareable Booking which should get set to 'Sharing'
      response = await agent.post('/api/bookings').send(validBooking).expect(422);
      response.body.message.should.equal('The selected team already has a Parent-Booking for this Deployment and time-range. Change team or remove this Booking.');
    });

    it('should automatically set Sharing booking attributes to match Shareable booking', async function () {
      // Create Parent Booking
      validBooking.bookingType = 'Shareable';
      response = await agent.post('/api/bookings').send(validBooking).expect(201);
      var parentBookingId = response.body._id;

      // Prepare Child Booking
      var childBooking = _.cloneDeep(validBooking);
      childBooking.team_id = teamObject2._id;
      childBooking.jiraMRBugReferenceIssue = 'CIP-32752';
      childBooking.testingType = 'Exploratory';
      childBooking.enmProductSetDrop = 'ENM:20.07';
      childBooking.enmProductSetVersion = '20.07.87';
      childBooking.additionalJenkinsUsers = 'eavrbra,eistpav';
      childBooking.automaticJenkinsIITrigger = false;
      childBooking.jenkinsJobType = 'UG';
      childBooking.nssVersion = 'NSS 18.10';
      childBooking.configurationType = 'Custom';
      childBooking.configuration = [];
      childBooking.infrastructure = 'Cloud';

      // Create Child Booking
      response = await agent.post('/api/bookings/').send(childBooking).expect(201);
      response.body.bookingType.should.equal('Sharing');
      response.body.sharingWithBooking_id.toString().should.equal(parentBookingId.toString());

      // Child Booking Values have been set to match Parent Bookings
      checkCascadeAttributes(response.body, childBooking, validBooking);
    });

    it('should throw error to make a booking shareable when Start-Time and End-time is between a shareable booking and only shareable bookings are available', async function () {
      validBooking.bookingType = 'Shareable';
      validBooking.endTime = today;
      await agent.post('/api/bookings').send(validBooking).expect(201);
      bookingRange = moment.range(validBooking.startTime, validBooking.endTime);

      validBooking2 = _.cloneDeep(validBooking);
      validBooking2.bookingType = 'Single';
      validBooking2.startTime = today;
      validBooking2.endTime = today;
      response = await agent.post('/api/bookings/').send(validBooking2).expect(422);
      response.body.message.should.equal(`${getTimeErrorMessage(bookingRange)} or set booking-type to "Shareable" to share with another Booking.`);
    });

    it('should post a new log with user-details when a booking is created by a logged-in user', async function () {
      response = await agent.post('/api/bookings').send(validBooking).expect(201);
      response.body._id.should.have.length(24);
      response.headers.location.should.equal(`/api/bookings/${response.body._id}`);
      response.body.name.should.equal(response.body._id);
      bookingReturned = await Booking.findById(response.body._id).exec();
      bookingReturned.name.should.equal(response.body._id);

      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      logReturned.originalData.should.not.equal(undefined);
      logReturned.originalData.name.should.equal(response.body._id);
      logReturned.createdAt.should.not.equal(undefined);
      logReturned.createdBy.should.not.equal(undefined);
      logReturned.createdBy.username.should.equal(validUser.username);
      logReturned.createdBy.email.should.equal(validUser.email);
      logReturned.updates.should.be.instanceof(Array).and.have.lengthOf(0);
    });

    it('should return error message if error occurs during Booking Product ENM evaluation', async function () {
      // Setup
      sinon.mock(Deployment).expects('aggregate').throws(new Error('Simulated Error.'));
      response = await agent.post('/api/bookings').send(validBooking).expect(400);
      response.body.message.should.equal('Error whilst checking if Booking is ENM based: Simulated Error.');
    });

    it('should create a Booking when given team is not in the same RA as the Deployment when cross RA is enabled', async function () {
      validBooking.team_id = teamObject3._id;
      validBooking.product_id = deploymentObject2.products[0]._id;
      validBooking.deployment_id = deploymentObject2._id.toString();
      response = await agent.post('/api/bookings').send(validBooking).expect(201);
      response.body.team_id.should.equal(teamObject3._id.toString());
    });

    it('should not create a Booking when given product ID is not in the Deployment given', async function () {
      validBooking.deployment_id = deploymentObject2._id.toString();
      validBooking.product_id = deploymentObject.products[0]._id;
      response = await agent.post('/api/bookings').send(validBooking).expect(422);
      response.body.message.should.equal('Selected Product is not part of chosen Deployment, check Product ID passed');
    });

    it('should throw error when creating a Booking when chosen team is not in the same RA as the Deployment when cross RA is disabled', async function () {
      validBooking.team_id = teamObject3._id;
      response = await agent.post('/api/bookings').send(validBooking).expect(422);
      response.body.message.should.equal('Selected Team does not belong to Deployment RA and Deployment has cross RA disabled');
    });

    it('should throw error when creating a Booking when chosen Team id does not exist ', async function () {
      validBooking.team_id = '000000000000000000000777';
      response = await agent.post('/api/bookings').send(validBooking).expect(422);
      response.body.message.should.equal(`A Team with the given id '${validBooking.team_id}' could not be found.`);
    });

    it('should throw error when creating a Booking when chosen Deployment id does not exist ', async function () {
      validBooking.deployment_id = '000000000000000000000777';
      response = await agent.post('/api/bookings').send(validBooking).expect(422);
      response.body.message.should.equal(`A Deployment with the given id '${validBooking.deployment_id}' could not be found.`);
    });

    it('should not create a Booking if Deployment Program/RA is Unassigned', async function () {
      validBooking.infrastructure = 'Physical';
      validBooking.deployment_id = deploymentObject5._id;
      validBooking.product_id = deploymentObject5.products[0]._id;
      response = await agent.post('/api/bookings').send(validBooking).expect(422);
      response.body.message.should.equal('This Deployment is not assigned to Program/RA therefore can not be booked, please select a different Deployment or assign a valid Program/RA.');
    });

    it('should not create a new Booking days over RA maxBookingDurationDays limit', async function () {
      var validBookingModified = _.cloneDeep(validBooking);
      validBookingModified.startTime = '2019-12-07';
      validBookingModified.endTime = '2019-12-20';
      response = await agent.post('/api/bookings').send(validBookingModified).expect(422);
      response.body.message.should.equal('Failed to book as the time-range is greater than RA validArea maxBookingDurationDays of 3 day(s). Alter the Booking time-range and try again.');
    });

    it('should create a Booking at RA maxBookingAdvanceWeeks limit', async function () {
      var validBookingModified = _.cloneDeep(validBooking);
      var maxToday = moment(moment(new Date()).format(timeErrorFormat), timeErrorFormat);
      var maxDate = maxToday.add(7, 'days');
      validBookingModified.startTime = maxDate;
      validBookingModified.endTime = maxDate;
      response = await agent.post('/api/bookings').send(validBookingModified).expect(201);
    });

    it('should not create a Booking over RA maxBookingAdvanceWeeks limit', async function () {
      var validBookingModified = _.cloneDeep(validBooking);
      var maxToday = moment(moment(new Date()).format(timeErrorFormat), timeErrorFormat);
      var maxDate = maxToday.add(8, 'days');
      validBookingModified.startTime = maxDate;
      validBookingModified.endTime = maxDate;
      response = await agent.post('/api/bookings').send(validBookingModified).expect(422);
      response.body.message.should.equal('Failed to book as the time-range is greater than RA validArea maxBookingAdvanceWeeks of 1 week(s). Alter the Booking time-range and try again.');
    });

    it('should not create a Booking when Deployment status is In Review', async function () {
      validBooking.deployment_id = deploymentObject7._id.toString();
      validBooking.name = 'InReviewStatus';
      response = await agent.post('/api/bookings').send(validBooking).expect(422);
      response.body.message.should.equal('A Booking cannot be created for \'validDeployment7\' as its status is \'In Review\'.');
    });

    it('should not create a Booking when Deployment status is Blocked/In Maintenance', async function () {
      deploymentObject7.status = 'Blocked/In Maintenance';
      await deploymentObject7.save();
      validBooking.deployment_id = deploymentObject7._id;
      validBooking.name = 'BlockedInMaintenanceStatus';
      response = await agent.post('/api/bookings').send(validBooking).expect(422);
      response.body.message.should.equal('A Booking cannot be created for \'validDeployment7\' as its status is \'Blocked/In Maintenance\'.');
    });

    it('should not create a Booking when Deployment status is Booking Disabled', async function () {
      deploymentObject7.status = 'Booking Disabled';
      await deploymentObject7.save();
      validBooking.deployment_id = deploymentObject7._id;
      validBooking.name = 'BookingDisabledStatus';
      response = await agent.post('/api/bookings').send(validBooking).expect(422);
      response.body.message.should.equal('A Booking cannot be created for \'validDeployment7\' as its status is \'Booking Disabled\'.');
    });
  });

  describe('GET', function () {
    beforeEach(async function () {
      validBooking.startTime = today;
      validBooking.endTime = today;
      bookingObject = new Booking(validBooking);
      await bookingObject.save();
    });

    it('should be able to get empty booking list', async function () {
      await bookingObject.remove();
      response = await agent.get('/api/bookings').expect(200);
      response.body.should.be.instanceof(Array).and.have.lengthOf(0);
    });

    it('should be able to get bookings when user not authenticated', async function () {
      await nonAuthAgent.get('/api/bookings').expect(200);
    });

    it('should be able to get bookings when user is authenticated', async function () {
      await agent.get('/api/bookings').expect(200);
    });

    it('should be able to get booking list with one element', async function () {
      response = await agent.get('/api/bookings').expect(200);
      response.body.should.be.instanceof(Array).and.have.lengthOf(1);
      response.body[0].name.should.equal(bookingObject._id.toString());
    });

    it('should be able to get booking list with more than one element', async function () {
      validBooking2 = _.cloneDeep(validBooking);
      validBooking2.name = 'anotherBookingName';
      booking2Object = new Booking(validBooking2);
      await booking2Object.save();
      response = await agent.get('/api/bookings').expect(200);
      response.body.should.be.instanceof(Array).and.have.lengthOf(2);
      response.body[0].name.should.equal(bookingObject._id.toString());
      response.body[1].name.should.deepEqual(booking2Object._id.toString());
    });

    it('should be able to get a single booking', async function () {
      response = await agent.get(`/api/bookings/${bookingObject._id}`).expect(200);
      response.body.name.should.equal(response.body._id);
    });

    it('should be able to get single booking when user not authenticated', async function () {
      await nonAuthAgent.get(`/api/bookings/${bookingObject._id}`).expect(200);
    });

    it('should be able to get single booking when user is authenticated', async function () {
      await agent.get(`/api/bookings/${bookingObject._id}`).expect(200);
    });

    it('should throw 404 when id is not in database', async function () {
      response = await agent.get('/api/bookings/000000000000000000000000').expect(404);
      response.body.message.should.equal('A Booking with that id does not exist');
    });

    it('should throw 404 when id is invalid in the database', async function () {
      response = await agent.get('/api/bookings/0').expect(404);
      response.body.message.should.equal('A Booking with that id does not exist');
    });
  });

  describe('PUT', function () {
    beforeEach(async function () {
      validBooking.startTime = today.toString();
      var endTime = moment(moment(new Date()).format(timeErrorFormat), timeErrorFormat);
      validBooking.endTime = endTime.add(1, 'days').format(timeErrorFormat).toString();
      bookingObject = new Booking(validBooking);
      await bookingObject.save();
      validBooking.endTime = today.toString();
    });

    it('should not update a Booking when user is not authenticated', async function () {
      validBooking.description = 'updated description';
      response = await nonAuthAgent.put(`/api/bookings/${bookingObject._id}`)
        .send(validBooking).expect(401);
      response.body.message.should.equal('User must be logged in');
    });

    it('should update a Booking when user is standard-user', async function () {
      var today = moment(new Date()).format(timeErrorFormat);
      validBooking.description = 'updated description';
      userObject.userRoles = [roleUserObject._id];
      await userObject.save();
      response = await agent.put(`/api/bookings/${bookingObject._id}`)
        .auth(validUser.username, validUser.password).send(validBooking).expect(200);
    });

    it('should update a Booking when user is admin', async function () {
      validBooking.description = 'updated description';
      userObject.userRoles = [roleAdminObject._id];
      await userObject.save();
      await agent.put(`/api/bookings/${bookingObject._id}`)
        .auth(validUser.username, validUser.password).send(validBooking).expect(200);
    });

    it('should update a Booking when user is super-admin', async function () {
      validBooking.description = 'updated description';
      userObject.userRoles = [roleSuperAdmObject._id];
      await userObject.save();
      await agent.put(`/api/bookings/${bookingObject._id}`)
        .auth(validUser.username, validUser.password).send(validBooking).expect(200);
    });

    it('should update a "Single" Booking', async function () {
      validBooking.description = 'updated description';
      response = await agent.put(`/api/bookings/${bookingObject._id}`).send(validBooking).expect(200);
      response.body.bookingType.should.equal('Single');
      response.body.description.should.equal(validBooking.description);
    });

    it('should update a "Shareable" Booking', async function () {
      validBooking.bookingType = 'Shareable';
      await agent.put(`/api/bookings/${bookingObject._id}`).send(validBooking).expect(200);
      validBooking.description = 'updated description';
      response = await agent.put(`/api/bookings/${bookingObject._id}`).send(validBooking).expect(200);
      response.body.bookingType.should.equal('Shareable');
      response.body.description.should.equal(validBooking.description);
    });

    it('should update a "Sharing" Booking', async function () {
      // Create Parent 'Shareable' Booking
      validBooking.bookingType = 'Shareable';
      await agent.put(`/api/bookings/${bookingObject._id}`).send(validBooking).expect(200);
      // Create Child 'Sharing' Booking
      validBooking.team_id = teamObject2._id;
      response = await agent.post('/api/bookings/').send(validBooking).expect(201);
      response.body.bookingType.should.equal('Sharing');
      var sharingBooking = response.body;
      // Take -1 day since returned booking in response has end time +1 after save.
      sharingBooking.endTime = today;
      // Update Child 'Sharing' Booking
      sharingBooking.description = 'updated description';
      response = await agent.put(`/api/bookings/${sharingBooking._id}`).send(sharingBooking).expect(200);
      response.body.bookingType.should.equal('Sharing');
      response.body.description.should.equal(sharingBooking.description);
    });

    it('should throw error when updating a Sharing bookings associated Team if the Parent has the same Team', async function () {
      // Create Parent 'Shareable' Booking
      validBooking.bookingType = 'Shareable';
      await agent.put(`/api/bookings/${bookingObject._id}`).send(validBooking).expect(200);
      // Create Child 'Sharing' Booking
      var childBooking = _.cloneDeep(validBooking);
      childBooking.team_id = teamObject2._id;
      response = await agent.post('/api/bookings/').send(childBooking).expect(201);
      response.body.bookingType.should.equal('Sharing');
      childBooking = response.body;
      // Update Child 'Sharing' Bookings Team
      var teamUpdate = { team_id: validBooking.team_id };
      response = await agent.put(`/api/bookings/${childBooking._id}`).send(teamUpdate).expect(422);
      response.body.message.should.equal('The selected team already has a Parent-Booking for this Deployment and time-range. Change team or remove this Booking.');
    });

    it('should throw error when updating a Shareable bookings associated Team if a Child has the same Team', async function () {
      // Create Parent 'Shareable' Booking
      validBooking.bookingType = 'Shareable';
      response = await agent.put(`/api/bookings/${bookingObject._id}`).send(validBooking).expect(200);
      var parentBookingId = response.body._id;
      // Create Child 'Sharing' Booking
      var childBooking = _.cloneDeep(validBooking);
      childBooking.team_id = teamObject2._id;
      response = await agent.post('/api/bookings/').send(childBooking).expect(201);
      response.body.bookingType.should.equal('Sharing');
      // Update Parent 'Shareable' Bookings Team
      var teamUpdate = { team_id: teamObject2._id };
      response = await agent.put(`/api/bookings/${parentBookingId}`).send(teamUpdate).expect(422);
      response.body.message.should.equal('The selected team already has a Child-Booking that is sharing with this Booking. Change team or remove Child Booking.');
    });

    it('should update a Bookings configuration', async function () {
      validBooking.configuration = [{ key_name: 'NEW_KEY', key_value: '999' }];
      response = await agent.put(`/api/bookings/${bookingObject._id}`).send(validBooking).expect(200);
      response.body.configuration.length.should.equal(1);
      var configElem = response.body.configuration[0];
      configElem.key_name.should.equal('NEW_KEY');
      configElem.key_value.should.equal('999');
    });

    it('should update a Booking with a JIRA Issue', async function () {
      validBooking.jiraIssue = 'CIP-32753';
      response = await agent.put(`/api/bookings/${bookingObject._id}`).send(validBooking).expect(200);
      response.body.bookingType.should.equal('Single');
      response.body.jiraIssue.should.equal(validBooking.jiraIssue);
    });

    it('should throw error when invalid deployment_id is provided', async function () {
      validBooking2 = _.cloneDeep(validBooking);
      validBooking2.description = 'updated description';
      validBooking2.deployment_id = 'fake';
      response = await agent.put(`/api/bookings/${bookingObject._id}`).send(validBooking2).expect(400);
      response.body.message.should.equal('Cast to ObjectID failed for value "fake" at path "deployment_id"');
    });

    it('should throw error when invalid team_id is provided', async function () {
      validBooking2 = _.cloneDeep(validBooking);
      validBooking2.description = 'updated description';
      validBooking2.team_id = 'fake';
      response = await agent.put(`/api/bookings/${bookingObject._id}`).send(validBooking2).expect(400);
      response.body.message.should.equal('Cast to ObjectID failed for value "fake" at path "team_id"');
    });

    it('should throw error when invalid startTime is provided', async function () {
      validBooking2 = _.cloneDeep(validBooking);
      validBooking2.description = 'updated description';
      validBooking2.startTime = 'fake';
      response = await agent.put(`/api/bookings/${bookingObject._id}`).send(validBooking2).expect(400);
      response.body.message.should.equal('Cast to Date failed for value "fake" at path "startTime"');
    });

    it('should throw error when invalid endTime is provided', async function () {
      validBooking2 = _.cloneDeep(validBooking);
      validBooking2.description = 'updated description';
      validBooking2.endTime = 'fake';
      response = await agent.put(`/api/bookings/${bookingObject._id}`).send(validBooking2).expect(400);
      response.body.message.should.equal('Cast to Date failed for value "fake" at path "endTime"');
    });

    it('should throw error when deployment_id is not provided', async function () {
      validBooking2 = _.cloneDeep(validBooking);
      validBooking2.description = 'updated description';
      validBooking2.deployment_id = null;
      response = await agent.put(`/api/bookings/${bookingObject._id}`).send(validBooking2).expect(400);
      response.body.message.should.equal('Path `deployment_id` is required.');
    });

    it('should throw error when startTime is not provided', async function () {
      validBooking2 = _.cloneDeep(validBooking);
      validBooking2.description = 'updated description';
      validBooking2.startTime = null;
      response = await agent.put(`/api/bookings/${bookingObject._id}`).send(validBooking2).expect(400);
      response.body.message.should.equal('Path `startTime` is required.');
    });

    it('should throw error when endTime is not provided', async function () {
      validBooking2 = _.cloneDeep(validBooking);
      validBooking2.description = 'updated description';
      validBooking2.endTime = null;
      response = await agent.put(`/api/bookings/${bookingObject._id}`).send(validBooking2).expect(400);
      response.body.message.should.equal('Path `endTime` is required.');
    });

    it('should throw error when deployment_id does not correspond with an actual Deployment artifact', async function () {
      validBooking2 = _.cloneDeep(validBooking);
      validBooking2.description = 'updated description';
      validBooking2.deployment_id = '000000000000000000000000';
      response = await agent.put(`/api/bookings/${bookingObject._id}`).send(validBooking2).expect(422);
      response.body.message.should.equal(`A Deployment with the given id '${validBooking2.deployment_id}' could not be found.`);
    });

    it('should throw error when team_id does not correspond with an actual Team artifact', async function () {
      validBooking2 = _.cloneDeep(validBooking);
      validBooking2.description = 'updated description';
      validBooking2.team_id = '000000000000000000000000';
      response = await agent.put(`/api/bookings/${bookingObject._id}`).send(validBooking2).expect(422);
      response.body.message.should.equal(`A Team with the given id '${validBooking2.team_id}' could not be found.`);
    });

    it('should throw error when start-time for booking collides with another booking for the same deployment', async function () {
      validBooking2 = _.cloneDeep(validBooking);
      var startTime = moment(moment(new Date()).format(timeErrorFormat), timeErrorFormat);
      validBooking2.startTime = startTime.add(2, 'days').format(timeErrorFormat).toString();
      var endTime = moment(moment(new Date()).format(timeErrorFormat), timeErrorFormat);
      validBooking2.endTime = endTime.add(2, 'days').format(timeErrorFormat).toString();
      response = await agent.post('/api/bookings').send(validBooking2).expect(201);
      bookingRange = moment.range(validBooking.startTime, validBooking.startTime);
      validBooking2.startTime = today.toString();
      response = await agent.put(`/api/bookings/${response.body._id}`).send(validBooking2).expect(422);
      response.body.message.should.equal(`${getTimeErrorMessage(bookingRange)}.`);
    });

    it('should throw error when end-time for booking collides with another booking for the same deployment', async function () {
      validBooking2 = _.cloneDeep(validBooking);
      var startTime = moment(moment(new Date()).format(timeErrorFormat), timeErrorFormat);
      validBooking2.startTime = startTime.subtract(3, 'days').format(timeErrorFormat).toString();
      var endTime = moment(moment(new Date()).format(timeErrorFormat), timeErrorFormat);
      validBooking2.endTime = endTime.subtract(2, 'days').format(timeErrorFormat).toString();
      response = await agent.post('/api/bookings').send(validBooking2).expect(201);
      bookingRange = moment.range(validBooking.startTime, validBooking.startTime);
      endTime = moment(moment(new Date()).format(timeErrorFormat), timeErrorFormat);
      validBooking2.endTime = endTime.add(1, 'days').format(timeErrorFormat).toString();
      response = await agent.put(`/api/bookings/${response.body._id}`).send(validBooking2).expect(422);
      response.body.message.should.equal(`${getTimeErrorMessage(bookingRange)}.`);
    });

    it('should throw error when the time between Start-Time and End-Time for booking contains the time of another booking for the same deployment', async function () {
      validBooking2 = _.cloneDeep(validBooking);
      var startTime = moment(moment(new Date()).format(timeErrorFormat), timeErrorFormat);
      validBooking2.startTime = startTime.add(2, 'days').format(timeErrorFormat).toString();
      var endTime = moment(moment(new Date()).format(timeErrorFormat), timeErrorFormat);
      validBooking2.endTime = endTime.add(2, 'days').format(timeErrorFormat).toString();
      response = await agent.post('/api/bookings').send(validBooking2).expect(201);
      bookingRange = moment.range(validBooking.startTime, validBooking.startTime);

      validBooking2.startTime = today.toString();
      endTime = moment(moment(new Date()).format(timeErrorFormat), timeErrorFormat);
      validBooking2.endTime = endTime.add(1, 'days').format(timeErrorFormat).toString();
      response = await agent.put(`/api/bookings/${response.body._id}`).send(validBooking2).expect(422);
      response.body.message.should.equal(`${getTimeErrorMessage(bookingRange)}.`);
    });

    it('should throw error when updating Start-Time of Sharing booking to be before parent shareable booking Start-Time', async function () {
      validBooking.bookingType = 'Shareable';
      await agent.put(`/api/bookings/${bookingObject._id}`).send(validBooking).expect(200);

      validBooking.team_id = teamObject2._id;
      response = await agent.post('/api/bookings/').send(validBooking).expect(201);
      var sharingBooking = response.body;

      sharingBooking.startTime = '2019-12-04T00:00:00.000Z';
      response = await agent.put(`/api/bookings/${sharingBooking._id}`).send(sharingBooking).expect(422);
      response.body.message.should.equal('Failed to update booking; Every "Sharing" Child Bookings time-range must be within "Shareable" Parent Bookings time-range.');
    });

    it('should throw error when updating End-Time of Sharing booking after parent shareable booking End-Time', async function () {
      validBooking.bookingType = 'Shareable';
      await agent.put(`/api/bookings/${bookingObject._id}`).send(validBooking).expect(200);
      validBooking.team_id = teamObject2._id;
      response = await agent.post('/api/bookings/').send(validBooking).expect(201);
      var sharingBooking = response.body;
      var endTime = moment(moment(new Date()).format(timeErrorFormat), timeErrorFormat);
      sharingBooking.endTime = endTime.add(3, 'days');
      response = await agent.put(`/api/bookings/${sharingBooking._id}`).send(sharingBooking).expect(422);
      response.body.message.should.equal('Failed to update booking; Every "Sharing" Child Bookings time-range must be within "Shareable" Parent Bookings time-range.');
    });

    it('should throw error when updating Start-Time of Shareable booking after child Sharing booking Start-Time', async function () {
      validBooking2 = _.cloneDeep(validBooking);
      validBooking2.bookingType = 'Shareable';
      validBooking2.startTime = today;
      validBooking2.endTime = today;
      await agent.put(`/api/bookings/${bookingObject._id}`).send(validBooking2).expect(200);

      var childBooking = _.cloneDeep(validBooking2);
      childBooking.team_id = teamObject2._id;
      await agent.post('/api/bookings/').send(childBooking).expect(201);

      var startTime = moment(moment(new Date()).format(timeErrorFormat), timeErrorFormat);
      validBooking2.startTime = startTime.add(1, 'days').format(timeErrorFormat);
      startTime = moment(moment(new Date()).format(timeErrorFormat), timeErrorFormat);
      validBooking2.endTime = startTime.add(2, 'days').format(timeErrorFormat);
      response = await agent.put(`/api/bookings/${bookingObject._id}`).send(validBooking2).expect(422);
      response.body.message.should.equal('Failed to update booking; Every "Sharing" Child Bookings time-range must be within "Shareable" Parent Bookings time-range.');
    });

    it('should throw error when updating End-Time of Shareable booking before child Sharing booking End-Time', async function () {
      validBooking2 = _.cloneDeep(validBooking);
      validBooking2.bookingType = 'Shareable';
      validBooking2.startTime = today;
      var endTime = moment(moment(new Date()).format(timeErrorFormat), timeErrorFormat);
      validBooking2.endTime = endTime.add(2, 'days').format(timeErrorFormat);
      await agent.put(`/api/bookings/${bookingObject._id}`).send(validBooking2).expect(200);

      var childBooking = _.cloneDeep(validBooking2);
      childBooking.team_id = teamObject2._id;
      await agent.post('/api/bookings/').send(childBooking).expect(201);

      endTime = moment(moment(new Date()).format(timeErrorFormat), timeErrorFormat);
      validBooking2.endTime = endTime.add(1, 'days').format(timeErrorFormat);
      response = await agent.put(`/api/bookings/${bookingObject._id}`).send(validBooking2).expect(422);
      response.body.message.should.equal('Failed to update booking; Every "Sharing" Child Bookings time-range must be within "Shareable" Parent Bookings time-range.');
    });

    it('should automatically Cascade Update Child booking attributes to match Shareable booking on Update', async function () {
      // Set Parent Booking to Shareable
      validBooking.bookingType = 'Shareable';
      await agent.put(`/api/bookings/${bookingObject._id}`).send(validBooking).expect(200);
      // Create Child Booking
      var childBooking = _.cloneDeep(validBooking);
      childBooking.team_id = teamObject2._id;
      response = await agent.post('/api/bookings/').send(childBooking).expect(201);
      var childBookingId = response.body._id;
      response.body.bookingType.should.equal('Sharing');
      response.body.sharingWithBooking_id.toString().should.equal(bookingObject._id.toString());

      // Child Booking Values Should have been set to match Parent Bookings
      checkCascadeAttributes(response.body, {}, validBooking);

      // Update Parent Booking with new values
      var validBookingModified = _.cloneDeep(validBooking);
      validBookingModified.jiraMRBugReferenceIssue = 'CIP-32752';
      validBookingModified.testingType = 'Exploratory';
      validBookingModified.enmProductSetDrop = 'ENM:20.07';
      validBookingModified.enmProductSetVersion = '20.07.87';
      validBookingModified.additionalJenkinsUsers = 'eavrbra,eistpav';
      validBookingModified.automaticJenkinsIITrigger = false;
      validBookingModified.jenkinsJobType = 'UG';
      validBookingModified.nssVersion = 'NSS 18.10';
      validBookingModified.configurationType = 'Custom';
      validBookingModified.configuration = [];
      validBookingModified.infrastructure = 'Cloud';
      response = await agent.put(`/api/bookings/${bookingObject._id}`).send(validBookingModified).expect(200);

      // Verify Parent attributes were updated
      checkCascadeAttributes(response.body, validBooking, validBookingModified);

      // Check that the Child Booking was updated
      childBooking = await Booking.findById(childBookingId).exec();
      checkCascadeAttributes(childBooking, validBooking, validBookingModified);
    });

    it('should not update a Booking if Deployment Program/RA is Unassigned', async function () {
      var validBookingModified = _.cloneDeep(validBooking);
      validBookingModified.deployment_id = deploymentObject5._id;
      validBookingModified.product_id = deploymentObject5.products[0]._id;
      response = await agent.put(`/api/bookings/${bookingObject._id}`).send(validBookingModified).expect(422);
      response.body.message.should.equal('This Deployment is not assigned to Program/RA therefore can not be booked, please select a different Deployment or assign a valid Program/RA.');
    });

    it('should not update a Booking days over RA maxBookingDurationDays limit', async function () {
      var validBookingModified = _.cloneDeep(validBooking);
      validBookingModified.startTime = '2019-12-09';
      validBookingModified.endTime = '2019-12-20';
      response = await agent.put(`/api/bookings/${bookingObject._id}`).send(validBookingModified).expect(422);
      response.body.message.should.equal('Failed to book as the time-range is greater than RA validArea maxBookingDurationDays of 3 day(s). Alter the Booking time-range and try again.');
    });

    it('should update a Booking at RA maxBookingAdvanceWeeks limit', async function () {
      var validBookingModified = _.cloneDeep(validBooking);
      var maxToday = moment(moment(new Date()).format(timeErrorFormat), timeErrorFormat);
      var maxDate = maxToday.add(7, 'days').format(timeErrorFormat);
      validBookingModified.startTime = maxDate;
      validBookingModified.endTime = maxDate;
      response = await agent.put(`/api/bookings/${bookingObject._id}`).send(validBookingModified).expect(200);
    });

    it('should not update a Booking over RA maxBookingAdvanceWeeks limit', async function () {
      var validBookingModified = _.cloneDeep(validBooking);
      var maxToday = moment(moment(new Date()).format(timeErrorFormat), timeErrorFormat);
      var maxDate = maxToday.add(8, 'days').format(timeErrorFormat);
      validBookingModified.startTime = maxDate;
      validBookingModified.endTime = maxDate;
      response = await agent.put(`/api/bookings/${bookingObject._id}`).send(validBookingModified).expect(422);
      response.body.message.should.equal('Failed to book as the time-range is greater than RA validArea maxBookingAdvanceWeeks of 1 week(s). Alter the Booking time-range and try again.');
    });
  });

  describe('DELETE', function () {
    beforeEach(async function () {
      bookingObject = new Booking(validBooking);
      await bookingObject.save();
    });

    it('should delete a booking and check its response and the db', async function () {
      response = await agent.delete(`/api/bookings/${bookingObject._id}`).expect(200);
      response.body.should.be.instanceof(Object);
      response.body.name.should.equal(bookingObject.name);
      count = await Booking.count().exec();
      count.should.equal(0);
    });

    it('should not delete a booking when user is not authenticated', async function () {
      response = await nonAuthAgent.delete(`/api/bookings/${bookingObject._id}`).expect(401);
      response.body.message.should.equal('User must be logged in');
    });

    it('should delete a booking when user is standard-user', async function () {
      userObject.userRoles = [roleUserObject._id];
      await userObject.save();
      response = await agent.delete(`/api/bookings/${bookingObject._id}`).auth(validUser.username, validUser.password).expect(200);
    });

    it('should delete an booking when user is admin', async function () {
      userObject.userRoles = [roleAdminObject._id];
      await userObject.save();
      await agent.delete(`/api/bookings/${bookingObject._id}`).auth(validUser.username, validUser.password).expect(200);
    });

    it('should delete an booking when user is super-admin', async function () {
      userObject.userRoles = [roleSuperAdmObject._id];
      await userObject.save();
      await agent.delete(`/api/bookings/${bookingObject._id}`).auth(validUser.username, validUser.password).expect(200);
    });

    it('should delete a Booking with a JIRA Issue', async function () {
      // Update Booking with JIRA Issue
      validBooking.jiraIssue = 'CIP-32753';
      response = await agent.put(`/api/bookings/${bookingObject._id}`).send(validBooking).expect(200);
      response.body.bookingType.should.equal('Single');
      response.body.jiraIssue.should.equal(validBooking.jiraIssue);
      // Delete Booking
      response = await agent.delete(`/api/bookings/${bookingObject._id}`).expect(200);
    });

    it('should fail when attempting to delete a "Shareable" Parent Booking that has dependant Child "Sharing" Bookings', async function () {
      // Create Parent 'Shareable' Booking
      validBooking.bookingType = 'Shareable';
      await agent.put(`/api/bookings/${bookingObject._id}`).send(validBooking).expect(200);
      // Create Child 'Sharing' Booking
      validBooking.team_id = teamObject2._id;
      response = await agent.post('/api/bookings/').send(validBooking).expect(201);
      response.body.bookingType.should.equal('Sharing');
      // Try to Delete Parent 'Sharing' Booking
      response = await agent.delete(`/api/bookings/${bookingObject._id}`).expect(422);
      response.body.message.should.equal('Can\'t delete Booking, it has 1 dependent booking(s).');
    });

    it('should delete a "Shareable" Parent Booking that has no dependant Child "Sharing" Bookings', async function () {
      // Create Parent 'Shareable' Booking
      validBooking.bookingType = 'Shareable';
      await agent.put(`/api/bookings/${bookingObject._id}`).send(validBooking).expect(200);
      // Create Child 'Sharing' Booking
      validBooking.team_id = teamObject2._id;
      response = await agent.post('/api/bookings/').send(validBooking).expect(201);
      response.body.bookingType.should.equal('Sharing');
      var sharingBooking = response.body;
      // Try to Delete Parent 'Sharing' Booking
      response = await agent.delete(`/api/bookings/${bookingObject._id}`).expect(422);
      response.body.message.should.equal('Can\'t delete Booking, it has 1 dependent booking(s).');
      // Delete Child 'Sharing' Booking
      response = await agent.delete(`/api/bookings/${sharingBooking._id}`).expect(200);
      // Delete Parent 'Shareable' Booking
      response = await agent.delete(`/api/bookings/${bookingObject._id}`).expect(200);
    });

    it('should fail when attempting to delete a booking that does not exist', async function () {
      response = await agent.delete('/api/bookings/000000000000000000000000').expect(404);
      response.body.message.should.equal('A Booking with that id does not exist');
    });

    it('should update an existing log with user-details for a booking thats deleted by a logged-in user', async function () {
      response = await agent.delete(`/api/bookings/${bookingObject._id}`).expect(200);
      response.body._id.should.have.length(24);
      bookingObject.team_id.toString().should.equal(response.body.team_id.toString());

      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      logReturned.originalData.should.not.equal(undefined);
      logReturned.originalData.name.should.equal(response.body._id);

      logReturned.updates.should.be.instanceof(Array).and.have.lengthOf(0);
      logReturned.deletedAt.should.not.equal(undefined);
      logReturned.deletedBy.should.not.equal(undefined);
      logReturned.deletedBy.username.should.equal(validUser.username);
      logReturned.deletedBy.email.should.equal(validUser.email);
    });

    it('should create a log with defined user-details for a booking that gets deleted by a logged-in user', async function () {
      // clear logs and verify
      await History.remove().exec();
      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      should.not.exist(logReturned);

      response = await agent.delete(`/api/bookings/${bookingObject._id}`).expect(200);
      response.body._id.should.have.length(24);
      bookingObject.team_id.toString().should.equal(response.body.team_id.toString());

      logReturned = await History.findOne({ associated_id: response.body._id }).exec();
      logReturned.originalData.should.not.equal(undefined);
      logReturned.originalData.name.should.equal(response.body._id);

      logReturned.updates.should.be.instanceof(Array).and.have.lengthOf(0);
      logReturned.deletedAt.should.not.equal(undefined);
      logReturned.deletedBy.should.not.equal(undefined);
      logReturned.deletedBy.username.should.equal(validUser.username);
      logReturned.deletedBy.email.should.equal(validUser.email);
    });
  });

  describe('SEARCH', function () {
    beforeEach(async function () {
      bookingObject = new Booking(validBooking);
      await bookingObject.save();
    });

    it('should not return a booking when passing in a valid parameter with a non existent booking ID', async function () {
      response = await agent.get('/api/bookings?q=_id=5bcdbe7287e21906ed4f12ba').expect(200);
      response.body.length.should.equal(0);
    });

    it('should not return a booking when passing in a valid parameter with a non existent parameter', async function () {
      response = await agent.get('/api/bookings?q=' + encodeURIComponent('_id=' + bookingObject._id
        + '&name=notExisting')).expect(200);
      response.body.length.should.equal(0);
    });

    it('should return an error when not encoding q search parameters', async function () {
      response = await agent.get('/api/bookings?q=._id=' + bookingObject._id + '&name=notExisting').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return a single booking when passing in _id parameter', async function () {
      response = await agent.get('/api/bookings?q=_id=' + bookingObject._id).expect(200);
      response.body[0].should.be.instanceof(Object);
      response.body[0].name.should.equal(bookingObject.name);
    });

    it('should not return a booking when passing in invalid parameter', async function () {
      response = await agent.get('/api/bookings?q=n0nsense=123454321').expect(200);
      response.body.length.should.equal(0);
    });

    it('should return a single booking when passing in name parameter', async function () {
      response = await agent.get('/api/bookings?q=name=' + bookingObject.name).expect(200);
      response.body[0].should.be.instanceof(Object);
      response.body[0].name.should.equal(bookingObject.name);
    });

    it('should only return fields specified in url', async function () {
      response = await agent.get('/api/bookings?fields=name').expect(200);
      response.body.length.should.equal(1);
      for (var key in response.body) {
        if (Object.prototype.hasOwnProperty.call(response.body, key)) {
          Object.prototype.hasOwnProperty.call(response.body[key], 'name').should.equal(true);
        }
      }
    });

    it('should only return fields specified in url using fields and q functionality', async function () {
      response = await agent.get('/api/bookings?fields=name&q=name=' + bookingObject.name).expect(200);
      response.body.length.should.equal(1);
      Object.prototype.hasOwnProperty.call(response.body[0], 'name').should.equal(true);
      response.body[0].name.should.equal(bookingObject.name);
    });

    it('should return an error message when query has invalid search key blah', async function () {
      response = await agent.get('/api/bookings?q=name=' + bookingObject.name + '&fields=name&blah=blah').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return an error message when queried with an improper search', async function () {
      response = await agent.get('/api/bookings?name=' + bookingObject.name).expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return an error message when queried with an empty q=', async function () {
      response = await agent.get('/api/bookings?q=').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return an error message when queried with an empty fields=', async function () {
      response = await agent.get('/api/bookings?fields=').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return an error message when queried with an empty fields= and q=', async function () {
      response = await agent.get('/api/bookings?q=&fields=').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });
  });

  describe('SCHEDULER TESTS', function () {
    beforeEach(async function () {
      today = moment(new Date()).format(timeErrorFormat);
      validBooking.startTime = today;
      validBooking.endTime = today;
      validBooking2 = _.cloneDeep(validBooking);
      validBooking2.startTime = moment().add(5, 'days').format(timeErrorFormat);
      validBooking2.endTime = moment().add(5, 'days').format(timeErrorFormat);
      bookingObject = new Booking(validBooking2);
      await bookingObject.save();

      userObject.userRoles = [roleSuperAdmObject._id];
      await userObject.save();
    });

    describe('Update Started Bookings', async function () {
      it('should not throw any errors when triggering a jenkins job on physical deployment - Drop: LATEST GREEN', async function () {
        bookingObject.automaticJenkinsIITrigger.should.equal(true);
        bookingObject.jenkinsJobType.should.equal('II');
        bookingObject.jenkinsIIWasTriggered.should.equal(false);
        validBooking.enmProductSetDrop = 'LATEST GREEN';
        validBooking.enmProductSetVersion = undefined;
        response = await agent.put(`/api/bookings/${bookingObject._id}`).send(validBooking).expect(200);
        response.body.enmProductSetDrop.should.equal('LATEST GREEN');
        await agent.post('/api/updateStartedBookings').expect(200);
      });

      it('should not throw any errors when triggering a jenkins job on physical deployment - Drop: DONT CARE', async function () {
        bookingObject.automaticJenkinsIITrigger.should.equal(true);
        bookingObject.jenkinsJobType.should.equal('II');
        bookingObject.jenkinsIIWasTriggered.should.equal(false);
        validBooking.enmProductSetDrop = 'DON\'T CARE';
        validBooking.enmProductSetVersion = undefined;
        response = await agent.put(`/api/bookings/${bookingObject._id}`).send(validBooking).expect(200);
        response.body.enmProductSetDrop.should.equal('DON\'T CARE');
        response = await agent.post('/api/updateStartedBookings').expect(200);
      });

      it('should not throw any errors when triggering a jenkins job on physical deployment - Version: LATEST GREEN', async function () {
        bookingObject.automaticJenkinsIITrigger.should.equal(true);
        bookingObject.jenkinsJobType.should.equal('II');
        bookingObject.jenkinsIIWasTriggered.should.equal(false);
        validBooking.enmProductSetDrop = 'ENM:20.06';
        validBooking.enmProductSetVersion = 'LATEST GREEN';
        response = await agent.put(`/api/bookings/${bookingObject._id}`).send(validBooking).expect(200);
        response.body.enmProductSetDrop.should.equal('ENM:20.06');
        response.body.enmProductSetVersion.should.equal('LATEST GREEN');
        response = await agent.post('/api/updateStartedBookings').expect(200);
      });

      it('should not throw any errors when triggering a jenkins job on physical deployment - Version: LATEST GREEN', async function () {
        bookingObject.automaticJenkinsIITrigger.should.equal(true);
        bookingObject.jenkinsJobType.should.equal('II');
        bookingObject.jenkinsIIWasTriggered.should.equal(false);
        validBooking.enmProductSetDrop = 'ENM:20.06';
        validBooking.enmProductSetVersion = 'DON\'T CARE';
        response = await agent.put(`/api/bookings/${bookingObject._id}`).send(validBooking).expect(200);
        response.body.enmProductSetDrop.should.equal('ENM:20.06');
        response.body.enmProductSetVersion.should.equal('DON\'T CARE');
        response = await agent.post('/api/updateStartedBookings').expect(200);
      });

      it('should not throw any errors when triggering a jenkins job on physical deployment - Version: 20.06.87', async function () {
        bookingObject.automaticJenkinsIITrigger.should.equal(true);
        bookingObject.jenkinsJobType.should.equal('II');
        bookingObject.jenkinsIIWasTriggered.should.equal(false);
        validBooking.enmProductSetDrop = 'ENM:20.06';
        validBooking.enmProductSetVersion = '20.06.87';
        response = await agent.put(`/api/bookings/${bookingObject._id}`).send(validBooking).expect(200);
        response.body.enmProductSetDrop.should.equal('ENM:20.06');
        response.body.enmProductSetVersion.should.equal('20.06.87');
        response = await agent.post('/api/updateStartedBookings').expect(200);
      });

      it('should not throw any errors when triggering a jenkins job on cloud deployment - Drop: LATEST GREEN', async function () {
        bookingObject.automaticJenkinsIITrigger.should.equal(true);
        bookingObject.jenkinsJobType.should.equal('II');
        bookingObject.jenkinsIIWasTriggered.should.equal(false);
        deploymentObject.products[0].jenkinsJob = 'https://fem162-eiffel004.lmera.ericsson.se:8443/jenkins/job/clouddeployment/';
        response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(deploymentObject).expect(200);
        var updatedDeployment = response.body;
        updatedDeployment.products[0].jenkinsJob.should.equal('https://fem162-eiffel004.lmera.ericsson.se:8443/jenkins/job/clouddeployment/');
        validBooking.infrastructure = 'Cloud';
        validBooking.enmProductSetDrop = 'LATEST GREEN';
        validBooking.enmProductSetVersion = undefined;
        response = await agent.put(`/api/bookings/${bookingObject._id}`).send(validBooking).expect(200);
        response.body.infrastructure.should.equal('Cloud');
        response.body.enmProductSetDrop.should.equal('LATEST GREEN');
        response = await agent.post('/api/updateStartedBookings').expect(200);
      });

      it('should not throw any errors when triggering a jenkins job on cloud deployment - Drop: DONT CARE', async function () {
        bookingObject.automaticJenkinsIITrigger.should.equal(true);
        bookingObject.jenkinsJobType.should.equal('II');
        bookingObject.jenkinsIIWasTriggered.should.equal(false);
        deploymentObject.products[0].jenkinsJob = 'https://fem162-eiffel004.lmera.ericsson.se:8443/jenkins/job/clouddeployment/';
        response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(deploymentObject).expect(200);
        var updatedDeployment = response.body;
        updatedDeployment.products[0].jenkinsJob.should.equal('https://fem162-eiffel004.lmera.ericsson.se:8443/jenkins/job/clouddeployment/');
        validBooking.infrastructure = 'Cloud';
        validBooking.enmProductSetDrop = 'DON\'T CARE';
        validBooking.enmProductSetVersion = undefined;
        response = await agent.put(`/api/bookings/${bookingObject._id}`).send(validBooking).expect(200);
        response.body.infrastructure.should.equal('Cloud');
        response.body.enmProductSetDrop.should.equal('DON\'T CARE');
        response = await agent.post('/api/updateStartedBookings').expect(200);
      });

      it('should not throw any errors when triggering a jenkins job on cloud deployment - Version: LATEST GREEN', async function () {
        bookingObject.automaticJenkinsIITrigger.should.equal(true);
        bookingObject.jenkinsJobType.should.equal('II');
        bookingObject.jenkinsIIWasTriggered.should.equal(false);
        deploymentObject.products[0].jenkinsJob = 'https://fem162-eiffel004.lmera.ericsson.se:8443/jenkins/job/clouddeployment/';
        response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(deploymentObject).expect(200);
        var updatedDeployment = response.body;
        updatedDeployment.products[0].jenkinsJob.should.equal('https://fem162-eiffel004.lmera.ericsson.se:8443/jenkins/job/clouddeployment/');
        validBooking.infrastructure = 'Cloud';
        validBooking.enmProductSetDrop = 'ENM:20.06';
        validBooking.enmProductSetVersion = 'LATEST GREEN';
        response = await agent.put(`/api/bookings/${bookingObject._id}`).send(validBooking).expect(200);
        response.body.infrastructure.should.equal('Cloud');
        response.body.enmProductSetDrop.should.equal('ENM:20.06');
        response.body.enmProductSetVersion.should.equal('LATEST GREEN');
        response = await agent.post('/api/updateStartedBookings').expect(200);
      });

      it('should not throw any errors when triggering a jenkins job on cloud deployment - Version: DONT CARE', async function () {
        bookingObject.automaticJenkinsIITrigger.should.equal(true);
        bookingObject.jenkinsJobType.should.equal('II');
        bookingObject.jenkinsIIWasTriggered.should.equal(false);
        deploymentObject.products[0].jenkinsJob = 'https://fem162-eiffel004.lmera.ericsson.se:8443/jenkins/job/clouddeployment/';
        response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(deploymentObject).expect(200);
        var updatedDeployment = response.body;
        updatedDeployment.products[0].jenkinsJob.should.equal('https://fem162-eiffel004.lmera.ericsson.se:8443/jenkins/job/clouddeployment/');
        validBooking.infrastructure = 'Cloud';
        validBooking.enmProductSetDrop = 'ENM:20.06';
        validBooking.enmProductSetVersion = 'DON\'T CARE';
        response = await agent.put(`/api/bookings/${bookingObject._id}`).send(validBooking).expect(200);
        response.body.infrastructure.should.equal('Cloud');
        response.body.enmProductSetDrop.should.equal('ENM:20.06');
        response.body.enmProductSetVersion.should.equal('DON\'T CARE');
        response = await agent.post('/api/updateStartedBookings').expect(200);
      });

      it('should not throw any errors when triggering a jenkins job on cloud deployment - Version: 20.06.87', async function () {
        bookingObject.automaticJenkinsIITrigger.should.equal(true);
        bookingObject.jenkinsJobType.should.equal('II');
        bookingObject.jenkinsIIWasTriggered.should.equal(false);
        deploymentObject.products[0].jenkinsJob = 'https://fem162-eiffel004.lmera.ericsson.se:8443/jenkins/job/clouddeployment/';
        response = await agent.put(`/api/deployments/${deploymentObject._id}`).send(deploymentObject).expect(200);
        var updatedDeployment = response.body;
        updatedDeployment.products[0].jenkinsJob.should.equal('https://fem162-eiffel004.lmera.ericsson.se:8443/jenkins/job/clouddeployment/');
        validBooking.infrastructure = 'Cloud';
        validBooking.enmProductSetDrop = 'ENM:20.06';
        validBooking.enmProductSetVersion = '20.06.87';
        response = await agent.put(`/api/bookings/${bookingObject._id}`).send(validBooking).expect(200);
        response.body.infrastructure.should.equal('Cloud');
        response.body.enmProductSetDrop.should.equal('ENM:20.06');
        response.body.enmProductSetVersion.should.equal('20.06.87');
        response = await agent.post('/api/updateStartedBookings').expect(200);
      });

      it('should put booking to started', async function () {
        response = await agent.post('/api/bookings/').send(validBooking).expect(201);
        response.body.isStarted.should.equal(false);
        await agent.post('/api/updateStartedBookings').expect(200);
        var updatedBooking = await Booking.findById(response.body._id).exec();
        updatedBooking.isStarted.should.equal(true);
      });

      it('should update associated deployments status to "In Use" when booking has started', async function () {
        response = await agent.post('/api/bookings/').send(validBooking).expect(201);
        response.body.isStarted.should.equal(false);
        var associatedDeployment = await Deployment.findById(response.body.deployment_id).exec();
        associatedDeployment.status.should.equal('Free');
        await agent.post('/api/updateStartedBookings').expect(200);
        await agent.post('/api/updateDeploymentStatus').expect(200);
        var updatedBooking = await Booking.findById(response.body._id).exec();
        updatedBooking.isStarted.should.equal(true);
        associatedDeployment = await Deployment.findById(updatedBooking.deployment_id).exec();
        associatedDeployment.status.should.equal('In Use');
      });

      it('should not update started-bookings when user is not authenticated', async function () {
        response = await nonAuthAgent.post('/api/updateStartedBookings').expect(401);
        response.body.message.should.equal('User must be logged in');
      });

      it('should not update started-bookings when user is standard-user', async function () {
        userObject.userRoles = [roleUserObject._id];
        await userObject.save();
        response = await agent.post('/api/updateStartedBookings').expect(403);
        response.body.message.should.equal('User is not authorized');
      });

      it('should not update started-bookings when user is admin-user', async function () {
        userObject.userRoles = [roleAdminObject._id];
        await userObject.save();
        response = await agent.post('/api/updateStartedBookings').expect(403);
        response.body.message.should.equal('User is not authorized');
      });

      it('should update started-bookings when user is super-admin', async function () {
        userObject.userRoles = [roleSuperAdmObject._id];
        await userObject.save();
        response = await agent.post('/api/updateStartedBookings').expect(200);
      });
    });

    describe('Update Expired Bookings', async function () {
      it('should put booking to expired and associated deployments status to "Free"', async function () {
        var now1  = moment(new Date(), timeErrorFormat);
        var now2  = moment(new Date(), timeErrorFormat);
        validBooking.startTime = now1;
        validBooking.endTime = now2.add(1, 'days');
        var bookingResponse = await agent.post('/api/bookings/').send(validBooking).expect(201);
        bookingResponse.body.isExpired.should.equal(false);
        // Check Deployment status is 'Free'
        var associatedDeployment = await Deployment.findById(bookingResponse.body.deployment_id).exec();
        associatedDeployment.status.should.equal('Free');
        // Put Booking to isStarted
        await agent.post('/api/updateStartedBookings').expect(200);
        var updatedBooking = await Booking.findById(bookingResponse.body._id).exec();
        updatedBooking.isStarted.should.equal(true);
        // Check Deployment status is 'In Use'
        await agent.post('/api/updateDeploymentStatus').expect(200);
        associatedDeployment = await Deployment.findById(bookingResponse.body.deployment_id).exec();
        associatedDeployment.status.should.equal('In Use');
        // Update Booking start and end time
        var newStartTime = now1.subtract(1,'days');
        var newEndTime = now2.subtract(2, 'days');
        response = await agent.put(`/api/bookings/${bookingResponse.body._id}`).send({startTime: newStartTime, endTime: newEndTime}).expect(200);
        // Put Booking to isExpired
        await agent.post('/api/updateExpiredBookings').expect(200);
        await agent.post('/api/updateDeploymentStatus').expect(200);
        updatedBooking = await Booking.findById(response.body._id).exec();
        updatedBooking.isExpired.should.equal(true);
        // Check Deployment status is 'Free'
        associatedDeployment = await Deployment.findById(updatedBooking.deployment_id).exec();
        associatedDeployment.status.should.equal('Free');
      });

      it('should not update expired-bookings when user is not authenticated', async function () {
        response = await nonAuthAgent.post('/api/updateExpiredBookings').expect(401);
        response.body.message.should.equal('User must be logged in');
      });

      it('should not update expired-bookings when user is standard-user', async function () {
        userObject.userRoles = [roleUserObject._id];
        await userObject.save();
        response = await agent.post('/api/updateExpiredBookings').expect(403);
        response.body.message.should.equal('User is not authorized');
      });

      it('should not update expired-bookings when user is admin-user', async function () {
        userObject.userRoles = [roleAdminObject._id];
        await userObject.save();
        response = await agent.post('/api/updateExpiredBookings').expect(403);
        response.body.message.should.equal('User is not authorized');
      });

      it('should update expired-bookings when user is super-admin', async function () {
        userObject.userRoles = [roleSuperAdmObject._id];
        await userObject.save();
        response = await agent.post('/api/updateExpiredBookings').expect(200);
      });
    });
  });

  afterEach(async function () {
    sinon.restore();
    await Team.remove().exec();
    await User.remove().exec();
    await Role.remove().exec();
    await Area.remove().exec();
    await Deployment.remove().exec();
    await ProductType.remove().exec();
    await ProductFlavour.remove().exec();
    await Program.remove().exec();
    await Booking.remove().exec();
    await History.remove().exec();
  });
});

function getTimeErrorMessage(range) {
  var timeRangePrint = `${range.start.format(timeErrorFormat)} - ${range.end.format(timeErrorFormat)}`;
  return `The specified time-range collides with the time-range (${timeRangePrint}) of another Booking for this Deployment. Alter the time-range`;
}

function checkCascadeAttributes(booking, oldValues, newValues) {
  booking.jiraMRBugReferenceIssue.should.not.equal(oldValues.jiraMRBugReferenceIssue);
  booking.jiraMRBugReferenceIssue.should.equal(newValues.jiraMRBugReferenceIssue);

  booking.testingType.should.not.equal(oldValues.testingType);
  booking.testingType.should.equal(newValues.testingType);

  booking.enmProductSetDrop.should.not.equal(oldValues.enmProductSetDrop);
  booking.enmProductSetDrop.should.equal(newValues.enmProductSetDrop);

  booking.enmProductSetVersion.should.not.equal(oldValues.enmProductSetVersion);
  booking.enmProductSetVersion.should.equal(newValues.enmProductSetVersion);

  booking.additionalJenkinsUsers.should.not.equal(oldValues.additionalJenkinsUsers);
  booking.additionalJenkinsUsers.should.equal(newValues.additionalJenkinsUsers);

  booking.automaticJenkinsIITrigger.should.not.equal(oldValues.automaticJenkinsIITrigger);
  booking.automaticJenkinsIITrigger.should.equal(newValues.automaticJenkinsIITrigger);

  booking.jenkinsJobType.should.not.equal(oldValues.jenkinsJobType);
  booking.jenkinsJobType.should.equal(newValues.jenkinsJobType);

  booking.nssVersion.should.not.equal(oldValues.nssVersion);
  booking.nssVersion.should.equal(newValues.nssVersion);

  booking.configurationType.should.not.equal(oldValues.configurationType);
  booking.configurationType.should.equal(newValues.configurationType);

  JSON.stringify(booking.configuration).should.not.equal(JSON.stringify(oldValues.configuration));
  JSON.stringify(booking.configuration).should.equal(JSON.stringify(newValues.configuration));
}

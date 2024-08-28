'use strict';

var fs = require('fs');
var should = require('should'),
  superagentDefaults = require('superagent-defaults'),
  supertest = require('supertest'),
  mongoose = require('mongoose'),
  _ = require('lodash'),
  sinon = require('sinon'),
  Moment = require('moment'),
  MomentRange = require('moment-range'),
  History = require('../../../history/server/models/history.server.model').getSchema('bookings'),
  Booking = require('../../../bookings/server/models/bookings.server.model').Schema,
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
  validBooking1,
  validBooking2,
  validBooking3,
  bookingObject1,
  bookingObject2,
  bookingObject3,
  validDeployment1,
  validDeployment2,
  validDeployment3,
  deploymentObject1,
  deploymentObject2,
  deploymentObject3,
  validProductType1,
  validProductType2,
  productTypeObject1,
  productTypeObject2,
  validProductFlavour,
  productFlavourObject,
  validArea,
  areaObject,
  validTeam,
  validTeam2,
  teamObject,
  teamObject2,
  validProgram,
  programObject,
  response,
  validUser,
  userObject,
  validUserRole,
  roleUserObject;

describe('Statistics', function () {
  before(async function () {
    app = express.init(mongoose);
    agent = superagentDefaults(supertest(app));
  });

  beforeEach(async function () {
    validArea = JSON.parse(fs.readFileSync('/opt/mean.js/modules/areas/tests/server/test_files/valid_area.json', 'utf8'));
    validProgram = JSON.parse(fs.readFileSync('/opt/mean.js/modules/programs/tests/server/test_files/valid_program.json', 'utf8'));
    validUser = JSON.parse(fs.readFileSync('/opt/mean.js/modules/core/tests/server/test_files/dttUser.json', 'utf8'));
    validTeam = JSON.parse(fs.readFileSync('/opt/mean.js/modules/teams/tests/server/test_files/valid_team.json', 'utf8'));
    validDeployment1 = JSON.parse(fs.readFileSync('/opt/mean.js/modules/deployments/tests/server/test_files/valid_deployment.json', 'utf8'));
    validBooking1 = JSON.parse(fs.readFileSync('/opt/mean.js/modules/bookings/tests/server/test_files/valid_booking.json', 'utf8'));
    validProductType1 = JSON.parse(fs.readFileSync('/opt/mean.js/modules/bookings/tests/server/test_files/valid_product_type_ENM.json', 'utf8'));
    validProductFlavour = JSON.parse(fs.readFileSync('/opt/mean.js/modules/product_flavours/tests/server/test_files/valid_product_flavour.json', 'utf8'));
    validUserRole = JSON.parse(fs.readFileSync('/opt/mean.js/modules/roles/tests/server/test_files/valid_user_role.json', 'utf8'));

    roleUserObject = new Role(validUserRole)
    await roleUserObject.save();

    // Create User
    validUser.userRoles = [roleUserObject._id];
    userObject = new User(validUser);
    await userObject.save();

    // Create Program
    programObject = new Program(validProgram);
    await programObject.save();

    // Create Area
    validArea.bookingAssigneeUser_id = userObject._id;
    validArea.program_id = programObject._id;
    areaObject = new Area(validArea);
    await areaObject.save();

    // Create Teams
    validTeam.admin_IDs = [userObject._id];
    validTeam.area_id = areaObject._id;
    teamObject = new Team(validTeam);
    await teamObject.save();

    validTeam2 = _.cloneDeep(validTeam);
    validTeam2.name = 'secondTeamName';
    teamObject2 = new Team(validTeam2);
    await teamObject2.save();

    // Create Product-Flavour
    productFlavourObject = new ProductFlavour(validProductFlavour);
    await productFlavourObject.save();

    // Create Product-Type
    validProductType1.flavours.push(productFlavourObject.name);
    validProductType1.name = 'ENM';
    productTypeObject1 = new ProductType(validProductType1);
    await productTypeObject1.save();

    // Create Product-Type
    validProductType2 = _.cloneDeep(validProductType1);
    validProductType2.name = 'CCD';
    productTypeObject2 = new ProductType(validProductType2);
    await productTypeObject2.save();

    // Prepare Deployment-Product
    var deploymentProduct1 = {
      product_type_name: productTypeObject1.name,
      flavour_name: productTypeObject1.flavours[0],
      infrastructure: 'Cloud',
      location: 'Athlone',
      purpose: 'Product Notes',
      jenkinsJob: 'https://fem13s11-eiffel004.eiffel.gic.ericsson.se:8443/jenkins/job/testingTrigger2/',
      admins_only: false
    };

    // Create 1st Deployment
    validDeployment1.area_id = areaObject._id;
    validDeployment1.program_id = programObject._id;
    validDeployment1.team_id = teamObject._id;
    validDeployment1.products = [deploymentProduct1];
    deploymentObject1 = new Deployment(validDeployment1);
    await deploymentObject1.save();

    // Create Booking for Deployment 1
    validBooking1.startTime = today.toString();
    var endTime = moment(moment(new Date()).format(timeErrorFormat), timeErrorFormat);
    validBooking1.endTime = endTime.add(1, 'days').format(timeErrorFormat).toString();
    validBooking1.team_id = teamObject._id;
    validBooking1.deployment_id = deploymentObject1._id;
    validBooking1.product_id = deploymentObject1.products[0]._id;
    validBooking1.bookingType = 'Shareable';
    bookingObject1 = new Booking(validBooking1);
    await bookingObject1.save();

    // Prepare 2nd Deployment-Product
    var deploymentProduct2 = _.cloneDeep(deploymentProduct1);
    deploymentProduct2.product_type_name = productTypeObject2.name;

    // Create 2nd Deployment
    validDeployment2 = _.cloneDeep(validDeployment1);
    validDeployment2.name = 'validDeployment2';
    validDeployment2.products = [deploymentProduct2];
    deploymentObject2 = new Deployment(validDeployment2);
    await deploymentObject2.save();

    // Create Booking for Deployment 2
    validBooking2 = _.clone(validBooking1);
    validBooking2.deployment_id = deploymentObject2._id;
    validBooking2.product_id = deploymentObject2.products[0]._id;
    bookingObject2 = new Booking(validBooking2);
    await bookingObject2.save();

    // Set Agent Request Authorization
    agent.auth(validUser.username, validUser.password);
  });

  describe('GET bookings', function () {
    it('should get booking statistics for multiple Deployments', async function () {
      response = await agent.get('/api/statistics/bookings').expect(200);
      response.body.deployments.should.be.instanceof(Array).and.have.length(2);
    });

    it('should get booking statistics', async function () {
      response = await agent.get('/api/statistics/bookingsExport').expect(200);
      response.body.should.be.instanceof(Array).and.have.length(7);
    });

    it('should get booking statistics for a single Deployment with single Booking', async function () {
      response = await agent.get(`/api/statistics/bookings?deploymentFilter=${deploymentObject1._id}`).expect(200);
      response.body.deployments.should.be.instanceof(Array).and.have.length(1);

      var statisticsObj = response.body.deployments[0];
      statisticsObj.deployment.name.should.equal(validDeployment1.name);
      statisticsObj.totalBookings.should.equal(1);
      statisticsObj.averageDuration.should.equal(1);
    });

    it('should get booking statistics for Deployment with multiple Bookings', async function () {
      validBooking2 = _.cloneDeep(validBooking1);
      validBooking2.startTime = '2019-12-10T00:00:00.000Z';
      validBooking2.endTime = '2019-12-14T00:00:00.000Z';
      bookingObject2 = new Booking(validBooking2);
      await bookingObject2.save();

      validBooking3 = _.cloneDeep(validBooking1);
      validBooking3.startTime = '2019-12-14T00:00:00.000Z';
      validBooking3.endTime = '2019-12-16T00:00:00.000Z';
      bookingObject3 = new Booking(validBooking3);
      await bookingObject3.save();

      response = await agent.get(`/api/statistics/bookings?deploymentFilter=${deploymentObject1._id}`).expect(200);
      response.body.deployments.should.be.instanceof(Array).and.have.length(1);
      var statisticsObj = response.body.deployments[0];
      statisticsObj.deployment.name.should.equal(validDeployment1.name);
      statisticsObj.totalBookings.should.equal(3);
      statisticsObj.averageDuration.should.equal(2);
    });

    it('should get booking statistics for Deployment with no Bookings when using emptyDeploymentsFilter', async function () {
      // Create New Deployment with no Bookings
      validDeployment3 = _.cloneDeep(validDeployment1);
      validDeployment3.name = 'validDeployment3';
      deploymentObject3 = new Deployment(validDeployment3);
      await deploymentObject3.save();

      response = await agent.get(`/api/statistics/bookings?deploymentFilter=${deploymentObject3._id}`).expect(200);
      response.body.deployments.should.be.instanceof(Array).and.have.length(0);

      response = await agent.get(`/api/statistics/bookings?deploymentFilter=${deploymentObject3._id}&emptyDeploymentsFilter=true`).expect(200);
      response.body.deployments.should.be.instanceof(Array).and.have.length(1);

      var statisticsObj = response.body.deployments[0];
      statisticsObj.deployment.name.should.equal(validDeployment3.name);

      (!statisticsObj.totalBookings).should.equal(true);
      (!statisticsObj.teams).should.equal(true);
    });

    it('should get shared bookings included in statistics when using sharedBookingsFilter', async function () {
      // Create Child Booking
      validBooking3 = _.cloneDeep(validBooking1);
      validBooking3.endTime = today;
      validBooking3.team_id = teamObject2._id;
      await agent.post('/api/bookings').send(validBooking3).expect(201);

      // Get Statistics without 'Sharing' Child
      response = await agent.get(`/api/statistics/bookings?deploymentFilter=${deploymentObject1._id}`).expect(200);
      response.body.deployments.should.be.instanceof(Array).and.have.length(1);

      var statisticsObj = response.body.deployments[0];
      statisticsObj.deployment.name.should.equal(validDeployment1.name);
      statisticsObj.totalBookings.should.equal(1);
      statisticsObj.averageDuration.should.equal(1);

      // Get Statistics with 'Sharing' Child
      response = await agent.get(`/api/statistics/bookings?deploymentFilter=${deploymentObject1._id}&sharedBookingsFilter=true`).expect(200);
      response.body.deployments.should.be.instanceof(Array).and.have.length(1);

      statisticsObj = response.body.deployments[0];
      statisticsObj.deployment.name.should.equal(validDeployment1.name);
      statisticsObj.totalBookings.should.equal(2);
      // Bookings are 4 and 2 days long duration respectively
      statisticsObj.averageDuration.should.equal(1);
    });

    it('should get booking statistics for bookings using a specified product-type', async function () {
      // Get Statistics for any product type
      response = await agent.get('/api/statistics/bookings?').expect(200);
      response.body.deployments.should.be.instanceof(Array).and.have.length(2);

      // Get Statistics for specific product type
      response = await agent.get(`/api/statistics/bookings?productTypeFilter=${productTypeObject1._id}`).expect(200);
      response.body.deployments.should.be.instanceof(Array).and.have.length(1);
    });

    it('should get booking statistics for a Deployment with no Team', async function () {
      // Create New Deployment with no Team
      validDeployment3 = _.cloneDeep(validDeployment1);
      validDeployment3.name = 'validDeployment3';
      validDeployment3.team_id = undefined;
      deploymentObject3 = new Deployment(validDeployment3);
      await deploymentObject3.save();
      // Create Booking
      validBooking3 = _.cloneDeep(validBooking1);
      validBooking3.startTime = today;
      validBooking3.endTime = today;
      validBooking3.deployment_id = deploymentObject3._id;
      validBooking3.product_id = deploymentObject3.products[0]._id;
      await agent.post('/api/bookings').send(validBooking3).expect(201); // Need API to get controller updates

      response = await agent.get(`/api/statistics/bookings?deploymentFilter=${deploymentObject3._id}`).expect(200);
      response.body.deployments.should.be.instanceof(Array).and.have.length(1);
      (!response.body.deployments[0].team).should.equal(true);
    });

    it('should not get booking statistics when an invalid filter is selected', async function () {
      var invalidDeploymentId = '000000000000000000000000';
      response = await agent.get(`/api/statistics/bookings?deploymentFilter=${invalidDeploymentId}`).expect(200);
      response.body.deployments.should.be.instanceof(Array).and.have.length(0);
    });

    it('should not get booking statistics when an error occurs', async function () {
      sinon.mock(Deployment).expects('find').throws(new Error('Simulated Error.'));
      response = await agent.get('/api/statistics/bookings').expect(400);
    });
  });

  afterEach(async function () {
    sinon.restore();
    await Team.remove().exec();
    await User.remove().exec();
    await Area.remove().exec();
    await Deployment.remove().exec();
    await ProductType.remove().exec();
    await ProductFlavour.remove().exec();
    await Program.remove().exec();
    await Booking.remove().exec();
    await History.remove().exec();
    await Role.remove().exec();
  });
});

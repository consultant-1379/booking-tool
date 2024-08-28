'use strict';

var fs = require('fs'),
  superagentDefaults = require('superagent-defaults'),
  supertest = require('supertest'),
  chai = require('chai'),
  chaiHttp = require('chai-http'),
  expect = chai.expect,
  mongoose = require('mongoose'),
  _ = require('lodash'),
  sinon = require('sinon'),
  Moment = require('moment'),
  MomentRange = require('moment-range'),
  BookingsHistory = require('../../../history/server/models/history.server.model').getSchema('bookings'),
  DeploymentsHistory = require('../../../history/server/models/history.server.model').getSchema('deployments'),
  ProgramsHistory = require('../../../history/server/models/history.server.model').getSchema('programs'),
  AreasHistory = require('../../../history/server/models/history.server.model').getSchema('areas'),
  ProductTypesHistory = require('../../../history/server/models/history.server.model').getSchema('producttypes'),
  ProductFlavoursHistory = require('../../../history/server/models/history.server.model').getSchema('productflavours'),
  TeamsHistory = require('../../../history/server/models/history.server.model').getSchema('teams'),
  Booking = mongoose.model('Booking'),
  Deployment = mongoose.model('Deployment'),
  Program = mongoose.model('Program'),
  Area = mongoose.model('Area'),
  ProductType = mongoose.model('ProductType'),
  ProductFlavour = mongoose.model('ProductFlavour'),
  Team = mongoose.model('Team'),
  User = mongoose.model('User'),
  express = require('../../../../config/lib/express'),
  nodeEnv = process.env.NODE_ENV,
  moment = MomentRange.extendMoment(Moment),
  timeErrorFormat = 'YYYY-MM-DD',
  today = moment(new Date()).format(timeErrorFormat);

require('sinon-mongoose');

var app,
  agent,
  clock,
  response,
  validProductType,
  productTypeObject,
  validProgram,
  programObject,
  secondValidProgram,
  secondProgramObject,
  validArea,
  areaObject,
  secondValidArea,
  secondAreaObject,
  validProductFlavour,
  productFlavourObject,
  secondValidProductFlavour,
  secondProductFlavourObject,
  secondValidProductType,
  secondProductTypeObject,
  validDeployment,
  deploymentObject,
  secondValidDeployment,
  secondDeploymentObject,
  validBooking,
  bookingObject,
  validUser,
  userObject,
  validTeam,
  teamObject,
  secondValidTeam,
  secondTeamObject;

describe('History', function () {
  before(async function () {
    app = express.init(mongoose);
    agent = superagentDefaults(supertest(app));
  });

  beforeEach(async function () {
    validProgram = JSON.parse(fs.readFileSync('/opt/mean.js/modules/programs/tests/server/test_files/valid_program.json', 'utf8'));
    validArea = JSON.parse(fs.readFileSync('/opt/mean.js/modules/areas/tests/server/test_files/valid_area.json', 'utf8'));
    validProductFlavour = JSON.parse(fs.readFileSync('/opt/mean.js/modules/product_flavours/tests/server/test_files/valid_product_flavour.json', 'utf8'));
    validProductType = JSON.parse(fs.readFileSync('/opt/mean.js/modules/product_types/tests/server/test_files/valid_product_type.json', 'utf8'));
    validDeployment = JSON.parse(fs.readFileSync('/opt/mean.js/modules/deployments/tests/server/test_files/valid_deployment.json', 'utf8'));
    validBooking = JSON.parse(fs.readFileSync('/opt/mean.js/modules/bookings/tests/server/test_files/valid_booking.json', 'utf8'));
    validUser = JSON.parse(fs.readFileSync('/opt/mean.js/modules/users/tests/server/test_files/valid_user.json', 'utf8'));
    validTeam = JSON.parse(fs.readFileSync('/opt/mean.js/modules/teams/tests/server/test_files/valid_team.json', 'utf8'));

    // User
    userObject = new User(validUser);
    await userObject.save();

    // Setup User Authorization
    agent.auth(validUser.username, validUser.password);

    // Program
    programObject = new Program(validProgram);
    await programObject.save();

    // Area
    validArea.program_id = programObject._id;
    areaObject = new Area(validArea);
    await areaObject.save();

    // Product-Flavour
    productFlavourObject = new ProductFlavour(validProductFlavour);
    await productFlavourObject.save();

    // Product-Type
    validProductType.flavours.push(productFlavourObject.name);
    productTypeObject = new ProductType(validProductType);
    await productTypeObject.save();

    // Team
    validTeam.admin_IDs = [userObject._id];
    validTeam.area_id = areaObject._id;
    teamObject = new Team(validTeam);
    await teamObject.save();

    // Deployment-Product
    var deploymentProduct = {
      product_type_name: productTypeObject.name,
      flavour_name: productTypeObject.flavours[0],
      infrastructure: 'Cloud',
      location: 'Athlone',
      purpose: 'Product Notes',
      jenkinsJob: 'https://fem162-eiffel004.lmera.ericsson.se:8443/jenkins/job/647_physicaldeployment/',
      admins_only: false
    };

    // Deployment
    validDeployment.program_id = programObject._id;
    validDeployment.area_id = areaObject._id;
    validDeployment.team_id = teamObject._id;
    validDeployment.products = [deploymentProduct];
    deploymentObject = new Deployment(validDeployment);
    await deploymentObject.save();

    // Booking
    validBooking.startTime = today;
    validBooking.endTime = today;
    validBooking.team_id = teamObject._id;
    validBooking.deployment_id = deploymentObject._id;
    validBooking.product_id = deploymentObject.products[0]._id;
  });

  describe('GET', function () {
    describe('logs/deployments', function () {
      it('should be able to get empty deployments-log list', async function () {
        await DeploymentsHistory.remove().exec();
        response = await agent.get('/api/logs/deployments').expect(200);
        response.body.should.be.instanceof(Array).and.have.lengthOf(0);
      });

      it('should be able to get deployments-log list with one element', async function () {
        response = await agent.get('/api/logs/deployments').expect(200);
        response.body.should.be.instanceof(Array).and.have.lengthOf(1);
        response.body[0].associated_id.should.equal(deploymentObject._id.toString());
      });

      it('should be able to get deployments-log list with more than one element', async function () {
        secondValidDeployment = _.cloneDeep(validDeployment);
        secondValidDeployment.name = 'tmpDepl2';
        secondDeploymentObject = new Deployment(secondValidDeployment);
        await secondDeploymentObject.save();

        response = await agent.get('/api/logs/deployments/').expect(200);
        response.body.should.be.instanceof(Array).and.have.lengthOf(2);
      });

      it('should be able to get a single deployment log', async function () {
        response = await agent.get(`/api/logs/deployments/${deploymentObject._id}`).expect(200);
        response.body.associated_id.toString().should.deepEqual(deploymentObject._id.toString());
        response.body.originalData.name.should.equal(validDeployment.name);
      });

      it('should throw 404 when deployment id is not in deployments-log database', async function () {
        response = await agent.get('/api/logs/deployments/000000000000000000000000').expect(404);
        response.body.message.should.equal('A deployments log with that id does not exist. Ensure a correct deployments id is entered and is not a log or legacy object id.');
      });

      it('should throw 404 when deployment id is invalid in the deployments-log database', async function () {
        response = await agent.get('/api/logs/deployments/0').expect(404);
        response.body.message.should.equal('A deployments log with that id does not exist. Ensure a correct deployments id is entered and is not a log or legacy object id.');
      });

      it('should return an error message and status 422 when the DeploymentsHistory.find function fails', async function () {
        sinon.mock(DeploymentsHistory).expects('find').chain('exec').yields(new Error('Simulated Error.'));
        response = await agent.get('/api/logs/deployments/').expect(422);
        expect(response.body.message).to.deep.equal('Simulated Error.');
      });

      it('should return an error message and status 500 when the DeploymentsHistory.findOne function fails', async function () {
        sinon.mock(DeploymentsHistory).expects('findOne').chain('exec').yields(new Error('Simulated Error'));
        response = await agent.get(`/api/logs/deployments/${deploymentObject._id}`).expect(404);
        expect(response.body.message).to.deep.equal('An error occurred whilst trying to find a log: Internal Server Error.');
      });
    });

    describe('logs/productTypes', function () {
      it('should be able to get empty product-type-log list', async function () {
        await ProductTypesHistory.remove().exec();
        response = await agent.get('/api/logs/productTypes').expect(200);
        response.body.should.be.instanceof(Array).and.have.lengthOf(0);
      });

      it('should be able to get product-type-log list with one element', async function () {
        response = await agent.get('/api/logs/productTypes').expect(200);
        response.body.should.be.instanceof(Array).and.have.lengthOf(1);
        response.body[0].associated_id.should.equal(productTypeObject._id.toString());
      });

      it('should be able to get product-type-log list with more than one element', async function () {
        secondValidProductType = _.cloneDeep(validProductType);
        secondValidProductType.name = 'tmpProductType2';
        secondProductTypeObject = new ProductType(secondValidProductType);
        await secondProductTypeObject.save();

        response = await agent.get('/api/logs/productTypes/').expect(200);
        response.body.should.be.instanceof(Array).and.have.lengthOf(2);
      });

      it('should be able to get a single product-type log', async function () {
        response = await agent.get(`/api/logs/productTypes/${productTypeObject._id}`).expect(200);
        response.body.associated_id.toString().should.deepEqual(productTypeObject._id.toString());
        response.body.originalData.name.should.equal(validProductType.name);
      });

      it('should throw 404 when product-type id is not in product-type-log database', async function () {
        response = await agent.get('/api/logs/productTypes/000000000000000000000000').expect(404);
        response.body.message.should.equal('A producttypes log with that id does not exist. Ensure a correct producttypes id is entered and is not a log or legacy object id.');
      });

      it('should throw 404 when product-type id is invalid in the product-type-log database', async function () {
        response = await agent.get('/api/logs/productTypes/0').expect(404);
        response.body.message.should.equal('A producttypes log with that id does not exist. Ensure a correct producttypes id is entered and is not a log or legacy object id.');
      });

      it('should return an error message and status 422 when the ProductTypesHistory.find function fails', async function () {
        sinon.mock(ProductTypesHistory).expects('find').chain('exec').yields(new Error('Simulated Error.'));
        response = await agent.get('/api/logs/productTypes/').expect(422);
        expect(response.body.message).to.deep.equal('Simulated Error.');
      });

      it('should return an error message and status 500 when the ProductTypesHistory.findOne function fails', async function () {
        sinon.mock(ProductTypesHistory).expects('findOne').chain('exec').yields(new Error('Simulated Error'));
        response = await agent.get(`/api/logs/productTypes/${productTypeObject._id}`).expect(404);
        expect(response.body.message).to.deep.equal('An error occurred whilst trying to find a log: Internal Server Error.');
      });
    });

    describe('logs/programs', function () {
      it('should be able to get empty Programs-log list', async function () {
        await ProgramsHistory.remove().exec();
        response = await agent.get('/api/logs/programs').expect(200);
        response.body.should.be.instanceof(Array).and.have.lengthOf(0);
      });

      it('should be able to get Programs-log list with one element', async function () {
        response = await agent.get('/api/logs/programs').expect(200);
        response.body.should.be.instanceof(Array).and.have.lengthOf(1);
        response.body[0].associated_id.should.equal(programObject._id.toString());
      });

      it('should be able to get Programs-log list with more than one element', async function () {
        secondValidProgram = _.cloneDeep(validProgram);
        secondValidProgram.name = 'tmpProgram2';
        secondProgramObject = new Program(secondValidProgram);
        await secondProgramObject.save();

        response = await agent.get('/api/logs/programs/').expect(200);
        response.body.should.be.instanceof(Array).and.have.lengthOf(2);
      });

      it('should be able to get a single program log', async function () {
        response = await agent.get(`/api/logs/programs/${programObject._id}`).expect(200);
        response.body.associated_id.toString().should.deepEqual(programObject._id.toString());
        response.body.originalData.name.should.equal(validProgram.name);
      });

      it('should throw 404 when program id is not in Programs-log database', async function () {
        response = await agent.get('/api/logs/programs/000000000000000000000000').expect(404);
        response.body.message.should.equal('A programs log with that id does not exist. Ensure a correct programs id is entered and is not a log or legacy object id.');
      });

      it('should throw 404 when program id is invalid in the Programs-log database', async function () {
        response = await agent.get('/api/logs/programs/0').expect(404);
        response.body.message.should.equal('A programs log with that id does not exist. Ensure a correct programs id is entered and is not a log or legacy object id.');
      });

      it('should return an error message and status 422 when the ProgramsHistory.find function fails', async function () {
        sinon.mock(ProgramsHistory).expects('find').chain('exec').yields(new Error('Simulated Error.'));
        response = await agent.get('/api/logs/programs/').expect(422);
        expect(response.body.message).to.deep.equal('Simulated Error.');
      });

      it('should return an error message and status 500 when the ProgramsHistory.findOne function fails', async function () {
        sinon.mock(ProgramsHistory).expects('findOne').chain('exec').yields(new Error('Simulated Error'));
        response = await agent.get(`/api/logs/programs/${programObject._id}`).expect(404);
        expect(response.body.message).to.deep.equal('An error occurred whilst trying to find a log: Internal Server Error.');
      });
    });

    describe('logs/areas', function () {
      it('should be able to get empty Areas-log list', async function () {
        await AreasHistory.remove().exec();
        response = await agent.get('/api/logs/areas').expect(200);
        response.body.should.be.instanceof(Array).and.have.lengthOf(0);
      });

      it('should be able to get Areas-log list with one element', async function () {
        response = await agent.get('/api/logs/areas').expect(200);
        response.body.should.be.instanceof(Array).and.have.lengthOf(1);
        response.body[0].associated_id.should.equal(areaObject._id.toString());
      });

      it('should be able to get Areas-log list with more than one element', async function () {
        secondValidArea = _.cloneDeep(validArea);
        secondValidArea.name = 'tmpArea2';
        secondAreaObject = new Area(secondValidArea);
        await secondAreaObject.save();

        response = await agent.get('/api/logs/areas/').expect(200);
        response.body.should.be.instanceof(Array).and.have.lengthOf(2);
      });

      it('should be able to get a single area log', async function () {
        response = await agent.get(`/api/logs/areas/${areaObject._id}`).expect(200);
        response.body.associated_id.toString().should.deepEqual(areaObject._id.toString());
        response.body.originalData.name.should.equal(validArea.name);
      });

      it('should throw 404 when area id is not in Areas-log database', async function () {
        response = await agent.get('/api/logs/areas/000000000000000000000000').expect(404);
        response.body.message.should.equal('A areas log with that id does not exist. Ensure a correct areas id is entered and is not a log or legacy object id.');
      });

      it('should throw 404 when area id is invalid in the Areas-log database', async function () {
        response = await agent.get('/api/logs/areas/0').expect(404);
        response.body.message.should.equal('A areas log with that id does not exist. Ensure a correct areas id is entered and is not a log or legacy object id.');
      });

      it('should return an error message and status 422 when the AreasHistory.find function fails', async function () {
        sinon.mock(AreasHistory).expects('find').chain('exec').yields(new Error('Simulated Error.'));
        response = await agent.get('/api/logs/areas/').expect(422);
        expect(response.body.message).to.deep.equal('Simulated Error.');
      });

      it('should return an error message and status 500 when the AreasHistory.findOne function fails', async function () {
        sinon.mock(AreasHistory).expects('findOne').chain('exec').yields(new Error('Simulated Error'));
        response = await agent.get(`/api/logs/areas/${areaObject._id}`).expect(404);
        expect(response.body.message).to.deep.equal('An error occurred whilst trying to find a log: Internal Server Error.');
      });
    });

    describe('logs/productFlavours', function () {
      it('should be able to get empty product-flavour-log list', async function () {
        await ProductFlavoursHistory.remove().exec();
        response = await agent.get('/api/logs/productFlavours').expect(200);
        response.body.should.be.instanceof(Array).and.have.lengthOf(0);
      });

      it('should be able to get product-flavour-log list with one element', async function () {
        response = await agent.get('/api/logs/productFlavours').expect(200);
        response.body.should.be.instanceof(Array).and.have.lengthOf(1);
        response.body[0].associated_id.should.equal(productFlavourObject._id.toString());
      });

      it('should be able to get product-flavour-log list with more than one element', async function () {
        secondValidProductFlavour = _.cloneDeep(validProductFlavour);
        secondValidProductFlavour.name = 'tmpFlavour2';
        secondProductFlavourObject = new ProductFlavour(secondValidProductFlavour);
        await secondProductFlavourObject.save();

        response = await agent.get('/api/logs/productFlavours/').expect(200);
        response.body.should.be.instanceof(Array).and.have.lengthOf(2);
      });

      it('should be able to get a single product-flavour-log', async function () {
        response = await agent.get(`/api/logs/productFlavours/${productFlavourObject._id}`).expect(200);
        response.body.associated_id.toString().should.deepEqual(productFlavourObject._id.toString());
        response.body.originalData.name.should.equal(validProductFlavour.name);
      });

      it('should throw 404 when product id is not in product-flavour-log database', async function () {
        response = await agent.get('/api/logs/productFlavours/000000000000000000000000').expect(404);
        response.body.message.should.equal('A productflavours log with that id does not exist. Ensure a correct productflavours id is entered and is not a log or legacy object id.');
      });

      it('should throw 404 when product id is invalid in the product-flavour-log database', async function () {
        response = await agent.get('/api/logs/productFlavours/0').expect(404);
        response.body.message.should.equal('A productflavours log with that id does not exist. Ensure a correct productflavours id is entered and is not a log or legacy object id.');
      });

      it('should return an error message and status 422 when the ProductFlavoursHistory.find function fails', async function () {
        sinon.mock(ProductFlavoursHistory).expects('find').chain('exec').yields(new Error('Simulated Error.'));
        response = await agent.get('/api/logs/productFlavours/').expect(422);
        expect(response.body.message).to.deep.equal('Simulated Error.');
      });

      it('should return an error message and status 500 when the ProductFlavoursHistory.findOne function fails', async function () {
        sinon.mock(ProductFlavoursHistory).expects('findOne').chain('exec').yields(new Error('Simulated Error'));
        response = await agent.get(`/api/logs/productFlavours/${productFlavourObject._id}`).expect(404);
        expect(response.body.message).to.deep.equal('An error occurred whilst trying to find a log: Internal Server Error.');
      });
    });

    describe('logs/teams', function () {
      it('should be able to get empty teams-log list', async function () {
        await TeamsHistory.remove().exec();
        response = await agent.get('/api/logs/teams').expect(200);
        response.body.should.be.instanceof(Array).and.have.lengthOf(0);
      });

      it('should be able to get teams-log list with one element', async function () {
        response = await agent.get('/api/logs/teams').expect(200);
        response.body.should.be.instanceof(Array).and.have.lengthOf(1);
        response.body[0].associated_id.should.equal(teamObject._id.toString());
      });

      it('should be able to get teams-log list with more than one element', async function () {
        secondValidTeam = _.cloneDeep(validTeam);
        secondValidTeam.name = 'tmpTeam2';
        secondTeamObject = new Team(secondValidTeam);
        await secondTeamObject.save();

        response = await agent.get('/api/logs/teams/').expect(200);
        response.body.should.be.instanceof(Array).and.have.lengthOf(2);
      });

      it('should be able to get a single team log', async function () {
        response = await agent.get(`/api/logs/teams/${teamObject._id}`).expect(200);
        response.body.associated_id.toString().should.deepEqual(teamObject._id.toString());
        response.body.originalData.name.should.equal(validTeam.name);
      });

      it('should throw 404 when team id is not in teams-log database', async function () {
        response = await agent.get('/api/logs/teams/000000000000000000000000').expect(404);
        response.body.message.should.equal('A teams log with that id does not exist. Ensure a correct teams id is entered and is not a log or legacy object id.');
      });

      it('should throw 404 when team id is invalid in the teams-log database', async function () {
        response = await agent.get('/api/logs/teams/0').expect(404);
        response.body.message.should.equal('A teams log with that id does not exist. Ensure a correct teams id is entered and is not a log or legacy object id.');
      });

      it('should return an error message and status 422 when the TeamsHistory.find function fails', async function () {
        sinon.mock(TeamsHistory).expects('find').chain('exec').yields(new Error('Simulated Error.'));
        response = await agent.get('/api/logs/teams/').expect(422);
        expect(response.body.message).to.deep.equal('Simulated Error.');
      });

      it('should return an error message and status 500 when the TeamsHistory.findOne function fails', async function () {
        sinon.mock(TeamsHistory).expects('findOne').chain('exec').yields(new Error('Simulated Error'));
        response = await agent.get(`/api/logs/teams/${teamObject._id}`).expect(404);
        expect(response.body.message).to.deep.equal('An error occurred whilst trying to find a log: Internal Server Error.');
      });
    });

    describe('logs/invalid_object', function () {
      it('should not be able to get a log list when querying an invalid object-type', async function () {
        response = await agent.get('/api/logs/invalid_object').expect(422);
        response.body.should.not.be.instanceof(Array);
        response.body.message.should.startWith('Logs are not available for object type: invalid_object.');
      });
    });
  });

  describe('DELETE', function () {
    describe('logs/<artifactType>', function () {
      it('should be able to delete all program logs', async function () {
        // Set node env to development
        process.env.NODE_ENV = 'development';

        // Create 2nd program
        var programObject2 = new Program({ name: 'secondProgram' });
        await programObject2.save();

        // Get Logs - Length = 2
        response = await agent.get('/api/logs/programs').expect(200);
        response.body.should.be.instanceof(Array).and.have.lengthOf(2);

        // Delete Logs
        response = await agent.delete('/api/logs/programs').expect(200);
        response.body.message.should.equal('Total removed instances: 2');

        // Get Logs - Length = 0
        response = await agent.get('/api/logs/programs').expect(200);
        response.body.should.be.instanceof(Array).and.have.lengthOf(0);
      });

      it('should not delete logs when not in development mode', async function () {
        // Set node env to production
        process.env.NODE_ENV = 'production';

        // Get Logs - Length = 1
        response = await agent.get('/api/logs/programs').expect(200);
        response.body.should.be.instanceof(Array).and.have.lengthOf(1);

        // Try Delete Logs
        response = await agent.delete('/api/logs/programs').expect(422);
        response.body.message.should.equal('An error occurred whilst trying to delete logs: Must be in development mode.');

        // Get Logs - Length = 1
        response = await agent.get('/api/logs/programs').expect(200);
        response.body.should.be.instanceof(Array).and.have.lengthOf(1);
      });
    });

    describe('logs/<artifactType>/<associatedId>', function () {
      it('should be able to delete a program log', async function () {
        // Set node env to development
        process.env.NODE_ENV = 'development';

        // Create 2nd program
        var programObject2 = new Program({ name: 'secondProgram' });
        await programObject2.save();

        // Get Logs - Length = 2
        response = await agent.get('/api/logs/programs').expect(200);
        response.body.should.be.instanceof(Array).and.have.lengthOf(2);

        // Delete Log
        response = await agent.delete(`/api/logs/programs/${programObject._id}`).expect(200);
        response.body.originalData.name.should.equal(programObject.name);

        // Get Logs - Length = 0
        response = await agent.get('/api/logs/programs').expect(200);
        response.body.should.be.instanceof(Array).and.have.lengthOf(1);
      });

      it('should not delete a log when not in development mode', async function () {
        // Set node env to production
        process.env.NODE_ENV = 'production';

        // Get Logs - Length = 1
        response = await agent.get('/api/logs/programs').expect(200);
        response.body.should.be.instanceof(Array).and.have.lengthOf(1);

        // Try Delete Log
        response = await agent.delete(`/api/logs/programs/${programObject._id}`).expect(422);
        response.body.message.should.equal('An error occurred whilst trying to delete the log: Must be in development mode.');

        // Get Logs - Length = 1
        response = await agent.get('/api/logs/programs').expect(200);
        response.body.should.be.instanceof(Array).and.have.lengthOf(1);
      });
    });
  });

  describe('SEARCH', function () {
    it('should not return a log when passing in a valid parameter with a non existent associated deployments ID', async function () {
      response = await agent.get('/api/logs/deployments?q=associated_id=000000000000000000000000').expect(200);
      response.body.length.should.equal(0);
    });

    it('should not return a log when passing in a valid parameter with a non existent parameter', async function () {
      response = await agent.get('/api/logs/deployments?q=' + encodeURIComponent('name=notExisting')).expect(200);
      response.body.length.should.equal(0);
    });

    it('should return an error when not encoding q search parameters', async function () {
      response = await agent.get('/api/logs/deployments?q=.associated_id=' + deploymentObject._id + '&name=notExisting').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return a single log when passing in a valid associated_id parameter', async function () {
      response = await agent.get('/api/logs/deployments?q=associated_id=' + deploymentObject._id).expect(200);
      response.body.length.should.equal(1);
      response.body[0].should.be.instanceof(Object);
      response.body[0].originalData.name.should.equal(deploymentObject.name);
      response.body[0].associated_id.should.equal(deploymentObject._id.toString());
    });

    it('should not return a log when passing in invalid parameter', async function () {
      response = await agent.get('/api/logs/deployments?q=n0nsense=123454321').expect(200);
      response.body.length.should.equal(0);
    });

    it('should return a single log when passing in name parameter', async function () {
      response = await agent.get('/api/logs/deployments?q=originalData.name=' + deploymentObject.name).expect(200);
      response.body.length.should.equal(1);
      response.body[0].should.be.instanceof(Object);
      response.body[0].originalData.name.should.equal(deploymentObject.name);
    });

    it('should only return fields specified in url', async function () {
      response = await agent.get('/api/logs/deployments?fields=associated_id').expect(200);
      response.body.length.should.equal(1);
      for (var key in response.body) {
        if (Object.prototype.hasOwnProperty.call(response.body, key)) {
          Object.prototype.hasOwnProperty.call(response.body[key], 'associated_id').should.equal(true);
        }
      }
    });

    it('should only return fields specified in url using fields and q functionality', async function () {
      response = await agent.get('/api/logs/deployments?fields=associated_id&q=associated_id=' + deploymentObject._id).expect(200);
      response.body.length.should.equal(1);
      Object.prototype.hasOwnProperty.call(response.body[0], 'associated_id').should.equal(true);
      response.body[0].associated_id.should.equal(deploymentObject._id.toString());
    });

    it('should only return nested fields specified in url', async function () {
      response = await agent.get('/api/logs/deployments?fields=originalData(name)').expect(200);
      response.body.length.should.equal(1);
      Object.prototype.hasOwnProperty.call(response.body[0], 'originalData').should.equal(true);
      Object.prototype.hasOwnProperty.call(response.body[0].originalData, 'name').should.equal(true);
      response.body[0].originalData.name.should.equal(deploymentObject.name);
    });

    it('should return an error message when query has invalid search key blah', async function () {
      response = await agent.get('/api/logs/deployments?q=name=' + deploymentObject.name + '&fields=name&blah=blah').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return an error message when queried with an improper search', async function () {
      response = await agent.get('/api/logs/deployments?name=' + deploymentObject.name).expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return an error message when queried with an empty q=', async function () {
      response = await agent.get('/api/logs/deployments?q=').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return an error message when queried with an empty fields=', async function () {
      response = await agent.get('/api/logs/deployments?fields=').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });

    it('should return an error message when queried with an empty fields= and q=', async function () {
      response = await agent.get('/api/logs/deployments?q=&fields=').expect(422);
      response.body.message.should.equal('Improperly structured query. Make sure to use ?q=<key>=<value> syntax');
    });
  });

  // describe('POST /api/logs/clearBookingEmailLogs', function () {
  //   beforeEach(async function () {
  //
  //     response = await agent.post('/api/bookings').send(validBooking).expect(201);
  //     bookingObject = response.body;
  //     // Add sleep so email info can be appended to log
  //     await new Promise(r => setTimeout(r, 2000));
  //     // Set Sinon Clock to current time
  //     clock = sinon.useFakeTimers(Date.now());
  //   });
  //
  //   it('should be able to get a booking log with a single email', async function () {
  //     response = await agent.get(`/api/logs/bookings/${bookingObject._id}`).expect(200);
  //     response.body.associated_id.toString().should.deepEqual(bookingObject._id.toString());
  //     response.body.originalData.name.should.equal(bookingObject.name);
  //     response.body.emails.length.should.equal(1);
  //   });
  //
  //   it('should not delete email logs that were created within the last 30 days', async function () {
  //     // Verify Single Email Log exists
  //     response = await agent.get(`/api/logs/bookings/${bookingObject._id}`).expect(200);
  //     response.body.emails.length.should.equal(1);
  //
  //     // Run Email Log Cleaner
  //     response = await agent.post('/api/logs/clearBookingEmailLogs').expect(200);
  //     response.body.message.should.equal('Email Logs cleared successfully');
  //
  //     // Verify Single Email Log still exists
  //     response = await agent.get(`/api/logs/bookings/${bookingObject._id}`).expect(200);
  //     response.body.emails.length.should.equal(1);
  //   });
  //
  //   it('should be able to get a booking log with no emails when older than 30 days', async function () {
  //     // Verify Single Email Log exists
  //     response = await agent.get(`/api/logs/bookings/${bookingObject._id}`).expect(200);
  //     response.body.emails.length.should.equal(1);
  //
  //     // Go forward 31 days (31 days * 24 hours * 60 mins * 60 secs * 1000 ms ) so old email logs can be deleted
  //     clock.tick(2678400000);
  //
  //     // Run Email Log Cleaner
  //     response = await agent.post('/api/logs/clearBookingEmailLogs').expect(200);
  //     response.body.message.should.equal('Email Logs cleared successfully');
  //
  //     // Verify Single Email Log has been removed
  //     response = await agent.get(`/api/logs/bookings/${bookingObject._id}`).expect(200);
  //     response.body.emails.length.should.equal(0);
  //   });
  //
  //   it('should return a success message when clearing booking email logs runs successfully', async function () {
  //     // Run Email Log Cleaner
  //     response = await agent.post('/api/logs/clearBookingEmailLogs').expect(200);
  //     response.body.message.should.equal('Email Logs cleared successfully');
  //   });
  //
  //   it('should return an error message when clearing booking email logs fails whilst running', async function () {
  //     sinon.mock(BookingsHistory).expects('find').throws(new Error('Simulated Error'));
  //     // Run Email Log Cleaner
  //     response = await agent.post('/api/logs/clearBookingEmailLogs').expect(422);
  //     response.body.message.should.equal('Error Whilst clearing Email Logs: Simulated Error');
  //   });
  //
  //   afterEach(async function () {
  //     clock.restore();
  //   });
  // });

  afterEach(async function () {
    process.env.NODE_ENV = nodeEnv;
    sinon.restore();
    await User.remove().exec();
    await Team.remove().exec();
    await Area.remove().exec();
    await Program.remove().exec();
    await Deployment.remove().exec();
    await ProductType.remove().exec();
    await ProductFlavour.remove().exec();
    await Booking.remove().exec();
    await BookingsHistory.remove().exec();
    await ProductFlavoursHistory.remove().exec();
    await ProductTypesHistory.remove().exec();
    await DeploymentsHistory.remove().exec();
    await ProgramsHistory.remove().exec();
    await AreasHistory.remove().exec();
    await TeamsHistory.remove().exec();
  });
});

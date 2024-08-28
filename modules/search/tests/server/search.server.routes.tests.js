'use strict';

var fs = require('fs');
var should = require('should'),
  superagentDefaults = require('superagent-defaults'),
  supertest = require('supertest'),
  mongoose = require('mongoose'),
  _ = require('lodash'),
  User = require('../../../users/server/models/user.server.model').Schema,
  Team = require('../../../teams/server/models/teams.server.model').Schema,
  Area = require('../../../areas/server/models/areas.server.model').Schema,
  Program = require('../../../programs/server/models/programs.server.model').Schema,
  ProductFlavour = require('../../../product_flavours/server/models/product_flavours.server.model').Schema,
  ProductType = require('../../../product_types/server/models/product_types.server.model').Schema,
  Deployment = require('../../../deployments/server/models/deployments.server.model').Schema,
  express = require('../../../../config/lib/express');

var app,
  agent,
  nonAuthAgent,
  validUser,
  validTeam,
  validArea,
  validArea2,
  validProgram,
  validProductFlavour,
  validProductType,
  validDeployment,
  userObject,
  teamObject,
  areaObject,
  programObject,
  productFlavourObject,
  productTypeObject,
  deploymentObject,
  response;

describe('Search', function () {
  before(async function () {
    app = express.init(mongoose);
    nonAuthAgent = superagentDefaults(supertest(app));
    agent = superagentDefaults(supertest(app));
  });
  beforeEach(async function () {
    validUser = JSON.parse(fs.readFileSync('/opt/mean.js/modules/users/tests/server/test_files/valid_user.json', 'utf8'));
    validTeam = JSON.parse(fs.readFileSync('/opt/mean.js/modules/teams/tests/server/test_files/valid_team.json', 'utf8'));
    validArea = JSON.parse(fs.readFileSync('/opt/mean.js/modules/areas/tests/server/test_files/valid_area.json', 'utf8'));
    validProgram = JSON.parse(fs.readFileSync('/opt/mean.js/modules/programs/tests/server/test_files/valid_program.json', 'utf8'));
    validProductFlavour = JSON.parse(fs.readFileSync('/opt/mean.js/modules/product_flavours/tests/server/test_files/valid_product_flavour.json', 'utf8'));
    validProductType = JSON.parse(fs.readFileSync('/opt/mean.js/modules/product_types/tests/server/test_files/valid_product_type.json', 'utf8'));
    validDeployment = JSON.parse(fs.readFileSync('/opt/mean.js/modules/deployments/tests/server/test_files/valid_deployment.json', 'utf8'));

    // Create a User
    userObject = new User(validUser);
    await userObject.save();

    // Create a Program
    programObject = new Program(validProgram);
    await programObject.save();

    // Create an Area
    validArea.program_id = programObject._id;
    areaObject = new Area(validArea);
    await areaObject.save();

    // Create a Team after adding the User ID to the list of Admin IDs
    validTeam.admin_IDs.push(userObject._id);
    validTeam.area_id = areaObject._id;
    teamObject = new Team(validTeam);
    await teamObject.save();


    // Create a Product-Flavour
    productFlavourObject = new ProductFlavour(validProductFlavour);
    await productFlavourObject.save();

    // Create a Product-Type after adding the Product-Flavour to the list of valid flavours
    validProductType.flavours.push(productFlavourObject.name);
    productTypeObject = new ProductType(validProductType);
    await productTypeObject.save();

    // Create a Deployment Child-Product with 2 links
    var productLink1 = {
      link_name: 'linkToTenency1',
      url: 'https://www.temp.com'
    };
    var productLink2 = {
      link_name: 'linkToTenency2',
      url: 'https://www.temp.com'
    };

    var childProduct = {
      product_type_name: productTypeObject.name,
      flavour_name: productFlavourObject.name,
      location: 'Athlone',
      infrastructure: 'Cloud',
      links: [productLink1, productLink2],
      admins_only: false
    };

    // Create a Deployment after adding all associated Artifacts to it
    validDeployment.area_id = areaObject._id;
    validDeployment.program_id = programObject._id;
    validDeployment.team_id = teamObject._id;
    validDeployment.products.push(childProduct);

    deploymentObject = new Deployment(validDeployment);
    await deploymentObject.save();

    agent.auth(validUser.username, validUser.password); // Setup User Authorization
  });

  describe('GET', function () {
    it('should be able to get empty search-result list', async function () {
      response = await agent.get('/api/search?searchParam=invalidSearchValue').expect(200);
      response.body.should.be.instanceof(Array).and.have.lengthOf(0);
    });

    it('should be able to get search-result list when user not authenticated', async function () {
      await nonAuthAgent.get('/api/search?searchParam=validDeployment').expect(200);
    });

    it('should be able to get search-result list when user is authenticated', async function () {
      await agent.get('/api/search?searchParam=validDeployment').expect(200);
    });

    it('should be able to get search-result list with one element', async function () {
      response = await agent.get('/api/search?searchParam=validDeployment').expect(200);
      response.body.should.be.instanceof(Array).and.have.lengthOf(1);
    });

    it('should be able to get search-result list with more than one element', async function () {
      response = await agent.get('/api/search?searchParam=valid').expect(200);
      response.body.should.be.instanceof(Array);
      response.body.length.should.be.above(1);
    });

    it('should be able to get search-result list limited to only areas by specifying the artifactParam as area', async function () {
      response = await agent.get('/api/search?searchParam=valid&artifactParam=area').expect(200);
      response.body.forEach(function (searchResult) {
        searchResult.parentObject.type.should.equal('area');
      });
    });

    it('should be able to get search-result list limited to only teams by specifying the artifactParam as team', async function () {
      response = await agent.get('/api/search?searchParam=valid&artifactParam=team').expect(200);
      response.body.forEach(function (searchResult) {
        searchResult.parentObject.type.should.equal('team');
      });
    });

    it('should be able to get search-result list limited to only areas by specifying the artifactParam as area', async function () {
      response = await agent.get('/api/search?searchParam=valid&artifactParam=area').expect(200);
      response.body.forEach(function (searchResult) {
        searchResult.parentObject.type.should.equal('area');
      });
    });

    it('should be able to get search-result list limited to only programs by specifying the artifactParam as program', async function () {
      response = await agent.get('/api/search?searchParam=valid&artifactParam=program').expect(200);
      response.body.forEach(function (searchResult) {
        searchResult.parentObject.type.should.equal('program');
      });
    });

    it('should be able to get search-result list limited to only productFlavours by specifying the artifactParam as productFlavour', async function () {
      response = await agent.get('/api/search?searchParam=valid&artifactParam=productFlavour').expect(200);
      response.body.forEach(function (searchResult) {
        searchResult.parentObject.type.should.equal('productFlavour');
      });
    });

    it('should be able to get search-result list limited to only productTypes by specifying the artifactParam as productType', async function () {
      response = await agent.get('/api/search?searchParam=valid&artifactParam=productType').expect(200);
      response.body.forEach(function (searchResult) {
        searchResult.parentObject.type.should.equal('productType');
      });
    });

    it('should be able to get search-result list limited to only deployments by specifying the artifactParam as deployment', async function () {
      response = await agent.get('/api/search?searchParam=valid&artifactParam=deployment').expect(200);
      response.body.forEach(function (searchResult) {
        searchResult.parentObject.type.should.equal('deployment');
      });
    });

    it('should be able to get non-case-sensitive search-results that match search-value when caseSensitiveParam is undefined', async function () {
      var validAreaFunnyCase = _.cloneDeep(validArea);
      validAreaFunnyCase.name = 'VaLiDaReA';
      await new Area(validAreaFunnyCase).save();

      var searchParamVal = 'VaLiDaReA';
      response = await agent.get(`/api/search?searchParam=${searchParamVal}`).expect(200);
      response.body.should.be.instanceof(Array).and.have.lengthOf(2);
      response.body.forEach(function (searchResult) {
        searchResult.value.toLowerCase().should.containEql(searchParamVal.toLowerCase());
      });
    });

    it('should be able to get non-case-sensitive search-results that match search-value when caseSensitiveParam is false', async function () {
      var validAreaFunnyCase = _.cloneDeep(validArea);
      validAreaFunnyCase.name = 'VaLiDaReA';
      await new Area(validAreaFunnyCase).save();

      var searchParamVal = 'VaLiDaReA';
      response = await agent.get(`/api/search?searchParam=${searchParamVal}&caseSensitiveParam=false`).expect(200);
      response.body.should.be.instanceof(Array).and.have.lengthOf(2);
      response.body.forEach(function (searchResult) {
        searchResult.value.toLowerCase().should.containEql(searchParamVal.toLowerCase());
      });
    });

    it('should be able to get case-sensitive search-results that match search-value when caseSensitiveParam is true', async function () {
      var validAreaFunnyCase = _.cloneDeep(validArea);
      validAreaFunnyCase.name = 'VaLiDaReA';
      await new Area(validAreaFunnyCase).save();

      var searchParamVal = 'VaLiDaReA';
      response = await agent.get(`/api/search?searchParam=${searchParamVal}&caseSensitiveParam=true`).expect(200);
      response.body.should.be.instanceof(Array).and.have.lengthOf(1);
      response.body[0].key.should.equal('name');
      response.body[0].value.should.equal(validAreaFunnyCase.name);
      response.body[0].value.should.equal(searchParamVal);
    });

    it('should be able to get search-results where any part of the key-value matches the search-value when valueMatchParam is undefined', async function () {
      validArea2 = _.cloneDeep(validArea);
      validArea2.name = 'validArea2';
      await new Area(validArea2).save();

      var searchParamVal = 'validArea';
      response = await agent.get(`/api/search?searchParam=${searchParamVal}`).expect(200);
      response.body.should.be.instanceof(Array).and.have.lengthOf(2);
      response.body.forEach(function (searchResult) {
        searchResult.value.should.containEql(searchParamVal);
      });
    });

    it('should be able to get search-results where any part of the key-value matches the search-value when valueMatchParam is \'partialValue\'', async function () {
      validArea2 = _.cloneDeep(validArea);
      validArea2.name = 'validArea2';
      await new Area(validArea2).save();

      var searchParamVal = 'validArea';
      response = await agent.get(`/api/search?searchParam=${searchParamVal}&valueMatchParam=partialValue`).expect(200);
      response.body.should.be.instanceof(Array).and.have.lengthOf(2);
      response.body.forEach(function (searchResult) {
        searchResult.value.should.containEql(searchParamVal);
      });
    });

    it('should be able to get search-results where the full key-value matches the search-value when valueMatchParam is \'fullValue\'', async function () {
      validArea2 = _.cloneDeep(validArea);
      validArea2.name = 'validArea2';
      await new Area(validArea2).save();

      var searchParamVal = 'validArea';
      response = await agent.get(`/api/search?searchParam=${searchParamVal}&valueMatchParam=fullValue`).expect(200);
      response.body.should.be.instanceof(Array).and.have.lengthOf(1);
      response.body[0].key.should.equal('name');
      response.body[0].value.should.equal(validArea.name);
      response.body[0].value.should.equal(searchParamVal);
    });

    it('should be able to get search-results where the start of the artifact key-value matches the search-value when valueMatchParam is \'startsWith\'', async function () {
      validArea2 = _.cloneDeep(validArea);
      validArea2.name = 'areaValid';
      await new Area(validArea2).save();

      var searchParamVal = 'area';
      response = await agent.get(`/api/search?searchParam=${searchParamVal}&valueMatchParam=startsWith`).expect(200);
      response.body.should.be.instanceof(Array).and.have.lengthOf(1);
      response.body[0].key.should.equal('name');
      response.body[0].value.should.equal(validArea2.name);
      response.body[0].value.toLowerCase().should.startWith(searchParamVal);
    });

    it('should be able to get search-results where the ends of the artifact key-value matches the search-value when valueMatchParam is \'endsWith\'', async function () {
      validArea2 = _.cloneDeep(validArea);
      validArea2.name = 'areaValid';
      await new Area(validArea2).save();

      var searchParamVal = 'area';
      response = await agent.get(`/api/search?searchParam=${searchParamVal}&valueMatchParam=endsWith`).expect(200);
      response.body.should.be.instanceof(Array).and.have.lengthOf(1);
      response.body[0].key.should.equal('name');
      response.body[0].value.should.equal(validArea.name);
      response.body[0].value.toLowerCase().should.endWith(searchParamVal);
    });

    it('should throw 422 when an invalid valueMatchParam is entered', async function () {
      var valueMatchParamVal = 'invalidValueMatchParam';
      response = await agent.get(`/api/search?searchParam=valid&valueMatchParam=${valueMatchParamVal}`).expect(422);
      response.body.message.should.equal(`Improperly structured query: ${valueMatchParamVal} is not a valid valueMatchParam. Accepted values: partialValue, fullValue, startsWith, endsWith, multipleLabels.`); // eslint-disable-line max-len
    });

    it('should throw 422 when searchParam parameter is missing', async function () {
      response = await agent.get('/api/search').expect(422);
      response.body.message.should.equal('Improperly structured query: Missing mandatory parameter: searchParam.');
    });

    it('should throw 422 when an invalid parameter is entered', async function () {
      response = await agent.get('/api/search?searchParam=valid&invalidParameter=xyz').expect(422);
      response.body.message.should.equal('Improperly structured query: Invalid parameter. Accepted parameters: searchParam, artifactParam, valueMatchParam, caseSensitiveParam.');
    });

    it('should throw 422 when a parameter has no value', async function () {
      response = await agent.get('/api/search?searchParam= &artifactParam=deployment').expect(422);
      response.body.message.should.equal('Improperly structured query: Missing value(s) for parameter(s): Make sure to use ?<key>=<value> syntax.');
    });

    it('should throw 422 when an invalid artifactParam is entered', async function () {
      var invalidArtifactType = 'invalidArtifactType';
      response = await agent.get(`/api/search?searchParam=valid&artifactParam=${invalidArtifactType}`).expect(422);
      response.body.message.should.equal(`Improperly structured query: ArtifactParam value '${invalidArtifactType}' is an invalid Artifact-Type. Accepted values: booking, deployment, area, productFlavour, productType, hardware, program, team, label.`); // eslint-disable-line max-len
    });
  });

  afterEach(async function () {
    await User.remove().exec();
    await Team.remove().exec();
    await Deployment.remove().exec();
    await ProductType.remove().exec();
    await ProductFlavour.remove().exec();
    await Program.remove().exec();
    await Area.remove().exec();
  });
});

'use strict';

var ObjectId = require('mongoose').Types.ObjectId;
var _ = require('lodash');
var Booking = require('../../../bookings/server/models/bookings.server.model').Schema;
var Deployment = require('../../../deployments/server/models/deployments.server.model').Schema;
var Area = require('../../../areas/server/models/areas.server.model').Schema;
var ProductFlavour = require('../../../product_flavours/server/models/product_flavours.server.model').Schema;
var ProductType = require('../../../product_types/server/models/product_types.server.model').Schema;
var Hardware = require('../../../hardware/server/models/hardware.server.model').Schema;
var Program = require('../../../programs/server/models/programs.server.model').Schema;
var Team = require('../../../teams/server/models/teams.server.model').Schema;
var Label = require('../../../labels/server/models/labels.server.model').Schema;
var helperHandler = require('../../../core/server/controllers/helpers.server.controller');

exports.search = async function (req, res) {
  var matchingArtifacts = [];

  try {
    // Check validity of Search Query
    var queryValidityResponse = checkQueryValidity(req.query);
    if (queryValidityResponse !== 'valid') {
      throw new Error(queryValidityResponse);
    }

    // Check validity of artifactParam
    var artifactTypes = [
      { name: 'booking', schema: Booking },
      { name: 'deployment', schema: Deployment },
      { name: 'area', schema: Area },
      { name: 'productFlavour', schema: ProductFlavour },
      { name: 'productType', schema: ProductType },
      { name: 'hardware', schema: Hardware },
      { name: 'program', schema: Program },
      { name: 'team', schema: Team },
      { name: 'label', schema: Label }

    ];

    var artifactTypeNames = artifactTypes.map(artifactType => artifactType.name);
    var artifactParam = (req.query.artifactParam) ? req.query.artifactParam.trim() : undefined;
    var foundArtifactType;

    if (artifactParam) {
      foundArtifactType = artifactTypes.find(artifactType => artifactType.name === artifactParam);
      if (!foundArtifactType) {
        throw new Error(`ArtifactParam value '${artifactParam}' is an invalid Artifact-Type. Accepted values: ${artifactTypeNames.join(', ')}`);
      }
    }

    // Create Search Options object using additional search parameters
    var searchParam = req.query.searchParam.trim();
    var valueMatchParam = (req.query.valueMatchParam) ? req.query.valueMatchParam.trim() : undefined;
    var caseSensitiveParam = (req.query.caseSensitiveParam && req.query.caseSensitiveParam.trim() === 'true');

    var searchOptions = {
      searchValue: searchParam,
      valueMatchExpression: valueMatchParam,
      isCaseSensitive: caseSensitiveParam
    };

    if (!artifactParam) {
      // Find artifact(s) across all Artifact-Types
      await helperHandler.asyncForEach(artifactTypes, async function (artifactType) {
        await searchArtifacts(matchingArtifacts, artifactType.schema, artifactType.name, searchOptions);
      });
    } else {
      // Find artifact(s) across one Artifact-Type
      await searchArtifacts(matchingArtifacts, foundArtifactType.schema, foundArtifactType.name, searchOptions);
    }
  } catch (parametersErr) {
    return res.status(422).send({ message: `Improperly structured query: ${parametersErr.message}.` });
  }

  res.json(matchingArtifacts);
};

function checkQueryValidity(query) {
  var queryKeys = Object.keys(query);

  var searchParamExists = queryKeys.includes('searchParam');
  if (!searchParamExists) return 'Missing mandatory parameter: searchParam';

  var acceptedKeys = ['searchParam', 'artifactParam', 'valueMatchParam', 'caseSensitiveParam'];
  var invalidKeyExists = !queryKeys.every(key => acceptedKeys.includes(key));
  if (invalidKeyExists) return `Invalid parameter. Accepted parameters: ${acceptedKeys.join(', ')}`;

  var undefinedKeyValueExists = !queryKeys.every(key => (query[key] && query[key].toString().trim() !== ''));
  if (undefinedKeyValueExists) return 'Missing value(s) for parameter(s): Make sure to use ?<key>=<value> syntax';

  return 'valid';
}

async function searchArtifacts(matchingArtifacts, artifactSchema, artifactType, searchOptions) {
  var artifacts = await artifactSchema.find();
  if (searchOptions.valueMatchExpression === 'multipleLabels') {
    var searchForLabels = searchOptions.searchValue.split(',');
    await helperHandler.asyncForEach(searchForLabels, async function (labelName) {
      var label = await Label.find({
        name: labelName.toUpperCase()
      });
      if (label.length !== 0) {
        var deployments = await Deployment.find({
          label_ids: label[0]._id
        });
        matchingArtifacts.push(deployments);
      }
    });
  } else {
    artifacts.forEach(function (artifact) {
      artifact = artifact.toObject();
      deepSearch(matchingArtifacts, artifact, artifactType, artifact, searchOptions);
    });
  }
}

function deepSearch(matchingArtifacts, artifact, keyHierarchy, parentObject, searchOptions) {
  for (var keyName in artifact) {
    if (Object.prototype.hasOwnProperty.call(artifact, keyName)) {
      var keyValue = artifact[keyName];
      if (keyValue) {
        if (keyValue instanceof ObjectId) keyValue = keyValue.toHexString();
        var keyNameHierarchy = (Number.isNaN(Number(keyName))) ? `${keyHierarchy}.${keyName}` : `${keyHierarchy}[${keyName}]`;
        if (typeof keyValue === 'object') {
          deepSearch(matchingArtifacts, keyValue, keyNameHierarchy, parentObject, searchOptions);
        } else {
          var keyValueAsString = keyValue.toString();
          var searchValue = searchOptions.searchValue;
          if (!searchOptions.isCaseSensitive) {
            keyValueAsString = keyValueAsString.toLowerCase();
            searchValue = searchValue.toLowerCase();
          }
          var foundMatch = false;
          switch (searchOptions.valueMatchExpression) {
            case undefined:
            case 'partialValue': foundMatch = (keyValueAsString.includes(searchValue)); break;
            case 'fullValue': foundMatch = (keyValueAsString === searchValue); break;
            case 'startsWith': foundMatch = (keyValueAsString.startsWith(searchValue)); break;
            case 'endsWith': foundMatch = (keyValueAsString.endsWith(searchValue)); break;
            case 'multipleLabels': foundMatch = (keyValueAsString.endsWith(searchValue)); break;
            default: throw new Error(searchOptions.valueMatchExpression +
              ' is not a valid valueMatchParam. Accepted values: partialValue, fullValue, startsWith, endsWith, multipleLabels');
          }
          if (foundMatch) {
            matchingArtifacts.push({
              key: keyNameHierarchy.substr(keyNameHierarchy.indexOf('.') + 1),
              value: keyValue,
              parentObject: { type: keyNameHierarchy.split('.')[0], name: parentObject.name, _id: parentObject._id }
            });
          }
        }
      }
    }
  }
}

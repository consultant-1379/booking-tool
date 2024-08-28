module.exports.objectNameValidator = {
  validator: function (name) {
    return /^[a-z0-9\-_.]*$/i.test(name);
  },
  message: '{PATH} is not valid; \'{VALUE}\' can only contain letters, numbers, dots, dashes and underscores.'
};

module.exports.normalNameValidator = {
  validator: function (name) {
    return /^[a-z0-9\-_.&amp;\s]*$/i.test(name);
  },
  message: '{PATH} is not valid; \'{VALUE}\' can only contain letters, numbers, ampersand (&), dots, dashes, underscores and spaces.'
};

module.exports.urlLinkValidator = {
  validator: function (link) {
    return /^$|^(https?:\/\/)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[-0-9a-z]{0,61}[0-9a-z])?)*)(.*)$/.test(link);
  },
  message: '{PATH} is not valid; \'{VALUE}\' must be a valid url.'
};

module.exports.objectIntegerValidator = {
  validator: function (value) {
    return Number.isInteger(value);
  },
  message: '{PATH} is not valid, {VALUE} is not an integer'
};

module.exports.usersListValidator = {
  validator: function (usersList) {
    return /^[a-zA-Z]{0,10}(?:,[a-zA-Z]{0,10})*$/i.test(usersList);
  },
  message: '{PATH} is not valid, {VALUE} must be a comma-separated list of Users Signum IDs'
};

module.exports.yearValidator = {
  validator: function (link) {
    return /^\d{4}$/.test(link);
  },
  message: '{PATH} is not valid; \'{VALUE}\' must be a valid year. e.g. 2021'
};

module.exports.dateFormatValidator = {
  validator: function (link) {
    return /^\d{2}\/\d{2}\/\d{4}$/.test(link);
  },
  message: '{PATH} is not valid; \'{VALUE}\' must be a valid date in format dd/mm/yyyy. e.g. 01/01/2021'
};

module.exports.validateModelId = async function (model, modelId, childModel) {
  if (modelId) {
    var modelName = (childModel) ? `${model.modelName} child ${childModel}` : model.modelName;
    var keyName = (childModel) ? `${childModel}s._id` : '_id';
    var objectFound = await model.findOne({ [keyName]: modelId }).exec();
    if (!objectFound) {
      throw new Error(`A ${modelName} with the given id '${modelId}' could not be found.`);
    }
  }
};

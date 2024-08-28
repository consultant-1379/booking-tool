'use strict';

var mongoose = require('mongoose'),
  MongooseSchema = mongoose.Schema,
  config = require('../../../../config/config'),
  loggingDbConn = mongoose.createConnection(config.dbLogging.uri),
  User = require('../../../users/server/models/user.server.model').Schema,
  models = ['deployments', 'producttypes', 'areas', 'programs', 'productflavours', 'teams', 'hardwares', 'bookings', 'labels', 'roles', 'emails'],
  historyModels = {},
  loggedInUser = 'UNKNOWN USER';

var UpdateSchema = new MongooseSchema({
  _id: false,
  updatedAt: { type: Date, required: true },
  updatedBy: { type: mongoose.Schema.Types.Mixed, required: true },
  updateData: { type: mongoose.Schema.Types.Mixed, required: true },
  updateReason: { type: String }
});

var EmailSchema = new MongooseSchema({
  subject: { type: String, required: true },
  body: { type: String, required: true },
  recipients: [{
    type: String,
    required: true
  }],
  sendTime: { type: Date, required: true },
  actionType: { type: String, required: true },
  sentSuccessfully: { type: Boolean, default: false, required: true }
}, { strict: 'throw' });

var LogSchema = new MongooseSchema({
  associated_id: { type: mongoose.Schema.ObjectId, ref: 'associated_id', required: true },
  createdAt: { type: Date, required: true },
  createdBy: { type: mongoose.Schema.Types.Mixed, required: true },
  originalData: { type: mongoose.Schema.Types.Mixed, required: true },
  currentName: { type: String, required: true },
  updates: [UpdateSchema],
  emails: [EmailSchema],
  deletedAt: Date,
  deletedBy: mongoose.Schema.Types.Mixed
});

// Returns the history-log equivalent collection for any object - creating it first if it does not exist.
module.exports.getSchema = function (collectionName) {
  if (!historyModels[`${collectionName}_log`]) {
    throw new Error(`Logs are not available for object type: ${collectionName}. Try one of: ${models.join(', ')}.`);
  }
  return historyModels[collectionName + '_log'];
};

// Sets all logged-in user details relevant to the history-logs.
module.exports.setLoggedInUser = async function (user, isAutoUpdate) {
  try {
    if (user) {
      loggedInUser = {
        displayName: (user.displayName) ? user.displayName : 'UNKNOWN NAME',
        username: (user.username) ? user.username : 'UNKNOWN SIGNUM',
        email: (user.email) ? user.email : 'UNKNOWN EMAIL'
      };
    } else if (isAutoUpdate) {
      const adminUser = await User.findOne({ username: 'dttadm100' });
      loggedInUser = {
        displayName: adminUser.displayName,
        username: adminUser.username,
        email: adminUser.email
      };
    } else loggedInUser = 'UNKNOWN USER';
  } catch (error) {
    loggedInUser = 'UNKNOWN USER';
  }
};

module.exports.getLoggedInUser = function () {
  return loggedInUser;
};

// Used for generating a history-log collection within the Logging DB.
function generateHistoryModel(collectionName) {
  collectionName += '_log';
  historyModels[collectionName] = loggingDbConn.model(collectionName, LogSchema);
}

for (var modelIndex = 0; modelIndex < models.length; modelIndex += 1) {
  generateHistoryModel(models[modelIndex]);
}

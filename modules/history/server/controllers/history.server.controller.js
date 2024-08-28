'use strict';

var querystring = require('querystring'),
  mongoose = require('mongoose'),
  mongoMask = require('mongo-mask'),
  errorHandler = require('../../../core/server/controllers/errors.server.controller'),
  helperHandler = require('../../../core/server/controllers/helpers.server.controller'),
  BookingLogSchema = require('../models/history.server.model').getSchema('bookings'),
  modelNameLowercase,
  objectType;

exports.aggregate = async function (req, res) {
  var ObjectId = mongoose.Types.ObjectId;
  var pipeline = req.body;
  pipeline[0].$match.associated_id = new ObjectId(pipeline[0].$match.associated_id);

  if (!mongoose.Types.ObjectId.isValid(pipeline[0].$match.associated_id)) {
    return res.status(404).send({
      message: `A ${modelNameLowercase} log with that id does not exist. Ensure a correct ${modelNameLowercase} id is entered and is not a log or legacy object id.` // eslint-disable-line max-len
    });
  }

  objectType.aggregate(pipeline).exec(function (err, modelInstance) {
    if (err || !modelInstance) {
      var errMsg = (err)
        ? 'An error occurred whilst trying to find a log: Internal Server Error.'
        : `A ${modelNameLowercase} log with that id does not exist. Ensure a correct ${modelNameLowercase} id is entered and is not a log or legacy object id.`; // eslint-disable-line max-len
      return res.status(404).send({ message: errMsg });
    }

    res.json(modelInstance);
  });
};

exports.getObjectType = async function (req, res, next, modelName) {
  try {
    modelNameLowercase = modelName.toLowerCase();
    objectType = require('../models/history.server.model').getSchema(modelNameLowercase); // eslint-disable-line global-require
    return next();
  } catch (err) {
    return res.status(422).send({ message: err.message });
  }
};

exports.findByAssociatedId = function (req, res, next, _id) {
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(404).send({
      message: `A ${modelNameLowercase} log with that id does not exist. Ensure a correct ${modelNameLowercase} id is entered and is not a log or legacy object id.` // eslint-disable-line max-len
    });
  }
  objectType.findOne({ associated_id: _id }).exec(function (err, modelInstance) {
    if (err || !modelInstance) {
      var errMsg = (err)
        ? 'An error occurred whilst trying to find a log: Internal Server Error.'
        : `A ${modelNameLowercase} log with that id does not exist. Ensure a correct ${modelNameLowercase} id is entered and is not a log or legacy object id.`; // eslint-disable-line max-len
      return res.status(404).send({ message: errMsg });
    }
    req[modelNameLowercase] = modelInstance;
    return next();
  });
};

exports.list = async function (req, res, err) {
  var query;
  if (!helperHandler.isValidSearch(req.query)) {
    return res.status(422).send({
      message: 'Improperly structured query. Make sure to use ?q=<key>=<value> syntax'
    });
  }

  if (req.query.q) {
    query = querystring.parse(req.query.q);
  }

  var fields;
  if (req.query.fields) {
    fields = mongoMask(req.query.fields, {});
  } else {
    fields = null;
  }
  objectType.find(query).select(fields).exec(async function (err, modelInstances) {
    if (err) {
      return res.status(422).send({
        message: errorHandler.getErrorMessage(err)
      });
    }
    res.json(modelInstances);
  });
};

exports.read = function (req, res) {
  var modelInstance = req[modelNameLowercase] ? req[modelNameLowercase].toJSON() : {};
  res.json(modelInstance);
};

exports.delete = async function (req, res) {
  try {
    if (process.env.NODE_ENV !== 'development') throw new Error('Must be in development mode.');
    var modelInstance = req[modelNameLowercase] ? req[modelNameLowercase].toJSON() : {};
    var deletedInstance = await objectType.findOneAndRemove({ _id: modelInstance._id });
    res.json(deletedInstance);
  } catch (deleteErr) {
    var resStatus = (deleteErr.message.includes('development mode')) ? 422 : 404;
    return res.status(resStatus).send({ message: `An error occurred whilst trying to delete the log: ${deleteErr.message}` });
  }
};

exports.deleteAll = async function (req, res) {
  try {
    if (process.env.NODE_ENV !== 'development') throw new Error('Must be in development mode.');
    var deletedInstances = await objectType.remove();
    res.status(200).send({ message: 'Total removed instances: ' + deletedInstances.result.n });
  } catch (deleteAllErr) {
    var resStatus = (deleteAllErr.message.includes('development mode')) ? 422 : 404;
    return res.status(resStatus).send({ message: `An error occurred whilst trying to delete logs: ${deleteAllErr.message}` });
  }
};

// Delete Booking Emails older than 30 days
exports.clearBookingEmailLogs = async function (req, res) {
  try {
    var aMonthAgo = new Date();
    aMonthAgo.setMonth(aMonthAgo.getMonth() - 1);

    var bookingLogs = await BookingLogSchema.find();
    helperHandler.asyncForEach(bookingLogs, function (bookingLog) {
      bookingLog.emails = bookingLog.emails.filter(email => email.sendTime >= aMonthAgo);
      bookingLog.save();
    });
    res.status(200).send({ message: 'Email Logs cleared successfully' });
  } catch (clearingError) {
    res.status(422).send({ message: `Error Whilst clearing Email Logs: ${clearingError.message}` });
  }
};

'use strict';

module.exports = function (dttObject) {
  const ARTIFACTS_REQUIRING_UPDATE_REASONS = ['areas'];
  class ValidationError extends Error {
    constructor(message) {
      super(message);
      this.name = 'ValidationError';
    }
  }

  // Validation for Artifacts using Update Reason functionality
  dttObject.pre('save', async function (next) {
    try {
      var artifact = this;

      // Validate Update Reason for Artifact being updated
      if (!artifact.isNew && ARTIFACTS_REQUIRING_UPDATE_REASONS.includes(artifact.collection.name)) {
        if (!artifact.updateReason || artifact.updateReason.length < 10) {
          throw new ValidationError('Field \'updateReason\' is required and must be minimum 10 characters.');
        }
      }

      // Move Update Reason to a Symbol
      artifact[Symbol.for('updateReason')] = artifact.updateReason;
      delete artifact.updateReason;
      delete artifact._doc.updateReason;

      // Validate Artifact Strict-Keys
      Object.keys(artifact._doc).every(function (key) {
        if (!Object.keys(artifact.schema.paths).includes(key)) {
          throw new ValidationError(`Field \`${key}\` is not in schema and strict mode is set to throw.`);
        }
        return true;
      });

      // Validate Artifact Key-Values
      await artifact.validate();
      return next();
    } catch (validationError) {
      return next(validationError);
    }
  });
};

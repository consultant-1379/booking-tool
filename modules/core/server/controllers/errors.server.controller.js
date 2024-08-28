'use strict';

// Get the error message from error object
exports.getErrorMessage = function (err) {
  var message = '';

  if (err.message && !err.errors) {
    message = err.message;
  } else if (err.name === 'ValidationError') {
    for (var key in err.errors) {
      if (Object.prototype.hasOwnProperty.call(err.errors, key)) {
        message = err.errors[key].message;
      }
    }
  } else if (err.errors && err.errors.isArray) {
    err.errors.forEach(function (errName) {
      if (errName.message) {
        message = errName.message;
      }
    });
  } else {
    message = err;
  }

  return message;
};

var Moment = require('moment');
var MomentRange = require('moment-range');
var moment = MomentRange.extendMoment(Moment);
var Deployment = require('../../../deployments/server/models/deployments.server.model').Schema,
  Area = require('../../../areas/server/models/areas.server.model').Schema,
  helperHandler = require('../../../core/server/controllers/helpers.server.controller');
var errorFormat = 'YYYY-MM-DD';

module.exports.verifyStartEndTimes = async function (booking, otherBookings, crudIsCreate) {
  var bookingRange = moment.range(booking.startTime, booking.endTime);

  await helperHandler.asyncForEach(otherBookings, async function (otherBooking) {
    var otherRange = moment.range(otherBooking.startTime, otherBooking.endTime);
    // booking end time can be equal to other booking start time and booking start time can be equal to other booking end time
    if (bookingRange.overlaps(otherRange, { adjacent: true })
      && !moment(booking.endTime).isSame(moment(otherBooking.startTime))
      && !moment(booking.startTime).isSame(moment(otherBooking.endTime))) {
      var rangeAdjusted = moment.range(otherBooking.startTime, otherRange.end.subtract(1, 'days'));
      throw new Error(`${getErrorMessage(rangeAdjusted)}.`);
    }
  });
};

module.exports.findShareableStartEndTimes = async function (booking, sameDeploymentBookings) {
  var bookingRange = moment.range(booking.startTime, booking.endTime);
  var shareableBooking = sameDeploymentBookings.find(function (otherBooking) {
    var otherRange = moment.range(otherBooking.startTime, otherBooking.endTime);
    if (otherBooking.bookingType === 'Shareable' && otherRange.contains(bookingRange.start) && otherRange.contains(bookingRange.end)) {
      if (booking.bookingType === 'Shareable') return true;
      var rangeAdjusted = moment.range(otherBooking.startTime, otherRange.end.subtract(1, 'days'));
      throw new Error(`${getErrorMessage(rangeAdjusted)} or set booking-type to "Shareable" to share with another Booking.`);
    }
    return false;
  });
  return shareableBooking;
};

module.exports.verifyChildStartEndTimes = async function (parentBooking, childBooking, crudIsCreate) {
  var parentRange = moment.range(parentBooking.startTime, parentBooking.endTime);
  var childRange = moment.range(childBooking.startTime, childBooking.endTime);

  if (!parentRange.contains(childRange)) {
    throw new Error('Failed to update booking; Every "Sharing" Child Bookings time-range must be within "Shareable" Parent Bookings time-range.');
  }
};

function getErrorMessage(range) {
  var timeRangePrint = `${range.start.format(errorFormat)} - ${range.end.format(errorFormat)}`;
  return `The specified time-range collides with the time-range (${timeRangePrint}) of another Booking for this Deployment. Alter the time-range`;
}

module.exports.verifyBookingTimeBasedOnRAmaxLimts = async function (booking) {
  var foundDeployment = await Deployment.findById(booking.deployment_id);
  if (foundDeployment) {
    var foundArea = await Area.findById(foundDeployment.area_id);
    var start = moment(booking.startTime, errorFormat);
    var end = moment(booking.endTime, errorFormat);
    if (foundArea.maxBookingDurationDays) {
      if (moment.duration(end.diff(start)).asDays() > foundArea.maxBookingDurationDays) {
        throw new Error('Failed to book as the time-range is greater than RA ' + foundArea.name + ' maxBookingDurationDays of ' + foundArea.maxBookingDurationDays + ' day(s). Alter the Booking time-range and try again.');
      }
    }
    if (foundArea.maxBookingAdvanceWeeks) {
      // Removing the added day to check very last day's date
      end = end.subtract(1, 'days').format(errorFormat);
      // Multipling by Number 7 (Number of Days in a Week)
      var maxBookingAdvanceWeeksInDays = foundArea.maxBookingAdvanceWeeks * 7;
      var today = moment(moment(new Date()).format(errorFormat), errorFormat);
      today = today.add(maxBookingAdvanceWeeksInDays, 'days').format(errorFormat);
      if (moment(end).isAfter(today)) {
        throw new Error('Failed to book as the time-range is greater than RA ' + foundArea.name + ' maxBookingAdvanceWeeks of ' + foundArea.maxBookingAdvanceWeeks + ' week(s). Alter the Booking time-range and try again.');
      }
    }
  }
};

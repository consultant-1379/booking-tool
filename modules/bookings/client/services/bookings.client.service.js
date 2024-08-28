BookingsService.$inject = ['$resource', '$log'];
export default function BookingsService($resource, $log) {
  var Booking = $resource('/api/bookings/:bookingId', {
    bookingId: '@_id'
  }, {
    update: {
      method: 'PUT'
    }
  });

  angular.extend(Booking.prototype, {
    createOrUpdate: function () {
      var booking = this;
      return createOrUpdate(booking);
    }
  });
  return Booking;

  function createOrUpdate(booking) {
    if (booking._id) {
      return booking.$update(onSuccess, onError);
    }
    return booking.$save(onSuccess, onError);

    function onSuccess() {
    }

    function onError(errorResponse) {
      $log.error(errorResponse.data);
    }
  }
}

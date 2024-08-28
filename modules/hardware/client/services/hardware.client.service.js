HardwareService.$inject = ['$resource', '$log'];
export default function HardwareService($resource, $log) {
  var Hardware = $resource('/api/hardware/:hardwareId', {
    hardwareId: '@_id'
  }, {
    update: {
      method: 'PUT'
    }
  });

  angular.extend(Hardware.prototype, {
    createOrUpdate: function () {
      var hardware = this;
      return createOrUpdate(hardware);
    }
  });
  return Hardware;

  function createOrUpdate(hardware) {
    if (hardware._id) {
      return hardware.$update(onSuccess, onError);
    }
    return hardware.$save(onSuccess, onError);

    function onSuccess() {
    }

    function onError(errorResponse) {
      $log.error(errorResponse.data);
    }
  }
}

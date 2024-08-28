LabelsService.$inject = ['$resource', '$log'];
export default function LabelsService($resource, $log) {
  var Label = $resource('/api/labels/:labelId', {
    labelId: '@_id'
  }, {
    update: {
      method: 'PUT'
    }
  });

  angular.extend(Label.prototype, {
    createOrUpdate: function () {
      var label = this;
      return createOrUpdate(label);
    }
  });
  return Label;

  function createOrUpdate(label) {
    if (label._id) {
      return label.$update(onSuccess, onError);
    }
    return label.$save(onSuccess, onError);

    function onSuccess() {
    }

    function onError(errorResponse) {
      $log.error(errorResponse.data);
    }
  }
}

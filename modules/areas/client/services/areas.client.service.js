AreasService.$inject = ['$resource', '$log'];
export default function AreasService($resource, $log) {
  var Area = $resource('/api/areas/:areaId', {
    areaId: '@_id'
  }, {
    update: {
      method: 'PUT'
    }
  });

  angular.extend(Area.prototype, {
    createOrUpdate: function () {
      var area = this;
      return createOrUpdate(area);
    }
  });
  return Area;

  function createOrUpdate(area) {
    if (area._id) {
      return area.$update(onSuccess, onError);
    }
    return area.$save(onSuccess, onError);

    function onSuccess() {
    }

    function onError(errorResponse) {
      $log.error(errorResponse.data);
    }
  }
}

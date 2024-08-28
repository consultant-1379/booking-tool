ProductTypesService.$inject = ['$resource', '$log'];
export default function ProductTypesService($resource, $log) {
  var ProductType = $resource('/api/productTypes/:productTypeId', {
    productTypeId: '@_id'
  }, {
    update: {
      method: 'PUT'
    }
  });

  angular.extend(ProductType.prototype, {
    createOrUpdate: function () {
      var productType = this;
      return createOrUpdate(productType);
    }
  });
  return ProductType;

  function createOrUpdate(productType) {
    if (productType._id) {
      return productType.$update(onSuccess, onError);
    }
    return productType.$save(onSuccess, onError);

    function onSuccess() {
    }

    function onError(errorResponse) {
      $log.error(errorResponse.data);
    }
  }
}

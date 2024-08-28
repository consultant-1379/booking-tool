ProductFlavoursService.$inject = ['$resource', '$log'];
export default function ProductFlavoursService($resource, $log) {
  var ProductFlavour = $resource('/api/productFlavours/:productFlavourId', {
    productFlavourId: '@_id'
  }, {
    update: {
      method: 'PUT'
    }
  });

  angular.extend(ProductFlavour.prototype, {
    createOrUpdate: function () {
      var productFlavour = this;
      return createOrUpdate(productFlavour);
    }
  });
  return ProductFlavour;

  function createOrUpdate(productFlavour) {
    if (productFlavour._id) {
      return productFlavour.$update(onSuccess, onError);
    }
    return productFlavour.$save(onSuccess, onError);

    function onSuccess() {
    }

    function onError(errorResponse) {
      $log.error(errorResponse.data);
    }
  }
}

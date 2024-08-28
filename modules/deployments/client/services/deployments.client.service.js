DeploymentsService.$inject = ['$resource', '$log'];
export default function DeploymentsService($resource, $log) {
  var Deployment = $resource('/api/deployments/:deploymentId', {
    deploymentId: '@_id'
  }, {
    update: {
      method: 'PUT'
    }
  });

  angular.extend(Deployment.prototype, {
    createOrUpdate: function () {
      var deployment = this;
      return createOrUpdate(deployment);
    }
  });
  return Deployment;

  function createOrUpdate(deployment) {
    if (deployment._id) {
      return deployment.$update(onSuccess, onError);
    }
    return deployment.$save(onSuccess, onError);

    function onSuccess() {
    }

    function onError(errorResponse) {
      $log.error(errorResponse.data);
    }
  }
}

RolesService.$inject = ['$resource', '$log'];
export default function RolesService($resource, $log) {
  var Role = $resource('/api/roles/:roleId', {
    roleId: '@_id'
  }, {
    update: {
      method: 'PUT'
    }
  });

  angular.extend(Role.prototype, {
    createOrUpdate: function () {
      var role = this;
      return createOrUpdate(role);
    }
  });
  return Role;

  function createOrUpdate(role) {
    if (role._id) {
      return role.$update(onSuccess, onError);
    }
    return role.$save(onSuccess, onError);

    function onSuccess() {
    }

    function onError(errorResponse) {
      $log.error(errorResponse.data);
    }
  }
}

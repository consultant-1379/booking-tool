ProgramsService.$inject = ['$resource', '$log'];
export default function ProgramsService($resource, $log) {
  var Program = $resource('/api/programs/:programId', {
    programId: '@_id'
  }, {
    update: {
      method: 'PUT'
    }
  });

  angular.extend(Program.prototype, {
    createOrUpdate: function () {
      var program = this;
      return createOrUpdate(program);
    }
  });
  return Program;

  function createOrUpdate(program) {
    if (program._id) {
      return program.$update(onSuccess, onError);
    }
    return program.$save(onSuccess, onError);

    function onSuccess() {
    }

    function onError(errorResponse) {
      $log.error(errorResponse.data);
    }
  }
}

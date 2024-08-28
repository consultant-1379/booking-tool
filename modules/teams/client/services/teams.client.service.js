TeamsService.$inject = ['$resource', '$log'];
export default function TeamsService($resource, $log) {
  var Team = $resource('/api/teams/:teamId', {
    teamId: '@_id'
  }, {
    update: {
      method: 'PUT'
    }
  });

  angular.extend(Team.prototype, {
    createOrUpdate: function () {
      var team = this;
      return createOrUpdate(team);
    }
  });
  return Team;

  function createOrUpdate(team) {
    if (team._id) {
      return team.$update(onSuccess, onError);
    }
    return team.$save(onSuccess, onError);

    function onSuccess() {
    }

    function onError(errorResponse) {
      $log.error(errorResponse.data);
    }
  }
}

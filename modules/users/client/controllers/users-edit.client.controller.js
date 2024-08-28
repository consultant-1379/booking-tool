UsersEditController.$inject = ['$scope', '$state', 'user', 'Notification', '$window', 'allRoles', 'Authentication'];

export default function UsersEditController($scope, $state, user, Notification, $window, allRoles, Authentication) {
  var vm = this;
  vm.user = user;
  vm.roles = allRoles;
  vm.selectedRoles = [];
  vm.allRoleNames = allRoles.map(role => role.name);

  // Get roles which user possesses
  if (user.userRoles) {
    user.userRoles.forEach(roleId => {
      var foundRole = allRoles.find(role => role._id === roleId);
      vm.selectedRoles.push(foundRole.name);
    });
  }

  // Hide superAdmin role option from roles menu if user is not a superAdmin
  var isSuperAdmin = Authentication.user.userRoles.some((role) => ['superAdmin'].includes(role.name));
  if (!isSuperAdmin) {
    vm.allRoleNames = vm.allRoleNames.filter(roleName => !['superAdmin', 'admin'].includes(roleName));
  }

  $scope.allResourceMethods = ['view-page', 'put', 'post', 'delete'];
  $scope.userCreatedResourceMethods = ['put', 'delete'];

  // Toggle selection for permission methods
  $scope.optionSelected = function optionSelected(methodName, methodsKey, index) {
    var idx = vm.user.permissions[index][methodsKey].search(methodName);
    if (idx > -1) {
      vm.user.permissions[index][methodsKey] = vm.user.permissions[index][methodsKey].replace(methodName, '').trim();
    } else {
      vm.user.permissions[index][methodsKey] = vm.user.permissions[index][methodsKey].concat(' ', methodName).trim();
    }
  };

  // Permissions Variable
  if (!vm.user.permissions || vm.user.permissions.length === 0) {
    vm.user.permissions = [];
  }

  // Add Permission functions
  vm.addPermission = function () {
    vm.user.permissions.push({ resources: '', allResourceMethods: '', userCreatedResourceMethods: '' });
  };

  vm.removePermission = function (permissionIndex) {
    var permissions = vm.user.permissions[permissionIndex];
    if ($window.confirm(`Are you sure you want to remove permission for path : "${permissions.resources}"?`)) {
      vm.user.permissions.splice(permissionIndex, 1);
    }
  };

  vm.submitForm = async function () {
    try {
      vm.formSubmitting = true;
      user.userRoles = getRoleIdsFromNameList(vm.selectedRoles);
      await user.$update();
    } catch (err) {
      vm.formSubmitting = false;
      var message = err.data ? err.data.message : err.message;
      Notification.error({ message: message.replace(/\n/g, '<br/>'), title: '<i class="glyphicon glyphicon-remove"></i> User Update error!' });
      return;
    }
    $state.go('users.view', { userId: vm.user._id });
    Notification.success({ message: '<i class="glyphicon glyphicon-ok"></i> User update successful!' });
  };

  function getRoleIdsFromNameList(roleNameList) {
    var idList = [];
    roleNameList.forEach(name => {
      var role = allRoles.find(role => role.name === name);
      idList.push(role._id);
    });
    return idList;
  }
}

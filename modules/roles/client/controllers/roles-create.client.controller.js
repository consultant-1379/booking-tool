RolesCreateController.$inject = ['$scope', '$state', '$window', 'role', 'Notification', 'restoredata', 'creatingFromScratch'];
export default function RolesCreateController($scope, $state, $window, role, Notification, restoredata, creatingFromScratch) {
  var vm = this;
  vm.role = role;

  $scope.allResourceMethods = ['view-page', 'put', 'post', 'delete'];
  $scope.userCreatedResourceMethods = ['put', 'delete'];

  // Toggle selection for permission methods
  $scope.optionSelected = function optionSelected(methodName, methodsKey, index) {
    var idx = vm.role.pathsPermissions[index][methodsKey].search(methodName);
    if (idx > -1) {
      vm.role.pathsPermissions[index][methodsKey] = vm.role.pathsPermissions[index][methodsKey].replace(methodName, '').trim();
    } else {
      vm.role.pathsPermissions[index][methodsKey] = vm.role.pathsPermissions[index][methodsKey].concat(' ', methodName).trim();
    }
  };

  // Permissions Variable
  if (!vm.role.pathsPermissions || vm.role.pathsPermissions.length === 0) {
    vm.role.pathsPermissions = [];
  }

  // Add Permission functions
  vm.addPermission = function () {
    vm.role.pathsPermissions.push({ resources: '', allResourceMethods: '', userCreatedResourceMethods: '' });
  };

  vm.removePermission = function (permissionIndex) {
    var permission = vm.role.pathsPermissions[permissionIndex];
    if ($window.confirm(`Are you sure you want to remove permission for path : "${permission.resources}"?`)) {
      vm.role.pathsPermissions.splice(permissionIndex, 1);
    }
  };

  vm.submitForm = async function () {
    try {
      vm.formSubmitting = true;
      await vm.role.createOrUpdate();
    } catch (err) {
      vm.formSubmitting = false;
      var message = err.data ? err.data.message : err.message;
      Notification.error({
        message: message.replace(/\n/g, '<br/>'),
        title: `<i class="glyphicon glyphicon-remove"></i> Role ${vm.jobType} error!`
      });
      return;
    }
    $state.go('roles.view', { roleId: vm.role._id });
    Notification.success({ message: `<i class="glyphicon glyphicon-ok"></i> Role ${vm.jobType} successful!` });
  };

  if (restoredata) {
    Object.keys(restoredata).forEach(function (key) {
      vm.role[key] = restoredata[key];
    });
    vm.pageTitle = 'Restoring';
    vm.jobType = 'restoration';
    vm.submitForm();
  } else {
    vm.pageTitle = creatingFromScratch ? 'Creating' : 'Editing';
    vm.jobType = creatingFromScratch ? 'creation' : 'update';
  }
}

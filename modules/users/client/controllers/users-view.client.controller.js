UsersViewController.$inject = ['user', 'allRoles', 'Authentication'];
export default function UsersViewController(user, allRoles, Authentication) {
  var vm = this;
  vm.user = user;
  vm.roles = allRoles.filter((role) => user.userRoles.includes(role._id));

  var adminRoleIds = allRoles.filter(role => ['superAdmin', 'admin'].includes(role.name)).map(role => role._id);
  var isSuperAdmin = Authentication.user.userRoles.some((role) => ['superAdmin'].includes(role.name));
  var userHasAdminRole = user.userRoles.some(role => adminRoleIds.includes(role));
  var hasEditPermissions = Authentication.isAllowed('/users', 'put', true);
  vm.hasEditPermissions = isSuperAdmin || (hasEditPermissions && !userHasAdminRole);
}

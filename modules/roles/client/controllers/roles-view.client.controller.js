RolesViewController.$inject = ['role', 'allUsers', 'allRoles', 'allRoleLogs', 'Authentication'];
export default function RolesViewController(role, allUsers, allRoles, allRoleLogs, Authentication) {
  var vm = this;
  vm.role = role;
  role.history = allRoleLogs.find(log => log.associated_id === role._id);

  vm.dependentUsers = allUsers.filter(user => user.userRoles.includes(role._id));
  var isCreator = (role.history && role.history.createdBy.username === Authentication.user.username);

  // Can only edit admin and superAdmin roles if user is superAdmin
  var adminRoleIds = allRoles.filter(role => ['superAdmin', 'admin'].includes(role.name)).map(role => role._id);
  var isSuperAdmin = Authentication.user.userRoles.some((role) => ['superAdmin'].includes(role.name));
  var isAdminRole = adminRoleIds.includes(role._id);
  var hasEditPermissions = Authentication.isAllowed('/roles', 'put', isCreator);
  vm.hasEditPermissions = isSuperAdmin || (hasEditPermissions && !isAdminRole);
}

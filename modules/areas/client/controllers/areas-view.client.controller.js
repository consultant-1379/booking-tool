AreasViewController.$inject = ['area', 'logs', 'program', 'user',
  'dependentTeams', 'dependentDeployments', 'Authentication'];
export default function AreasViewController(
  area, logs, program, user,
  dependentTeams, dependentDeployments, Authentication
) {
  var vm = this;
  vm.logs = logs;
  vm.area = area;
  vm.program = program;
  vm.bookingAssigneeUser = user;
  vm.dependentTeams = dependentTeams;
  vm.dependentDeployments = dependentDeployments;

  var isCreator = (logs && logs.length > 0 && (logs[0].createdBy.username === Authentication.user.username));
  vm.hasEditPermissions = Authentication.isAllowed('/areas', 'put', isCreator);
}

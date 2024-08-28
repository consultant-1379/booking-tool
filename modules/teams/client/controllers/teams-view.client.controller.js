TeamsViewController.$inject = [
  'team', 'allUsers', 'area',
  'dependentDeployments', 'Authentication'
];
export default function TeamsViewController(
  team, allUsers, area,
  dependentDeployments, Authentication
) {
  var vm = this;
  vm.team = team;
  vm.area = area;
  vm.team.adminPrimary = allUsers.find(user => user._id === vm.team.admin_IDs[0]);
  vm.team.adminSecondary = allUsers.find(user => user._id === vm.team.admin_IDs[1]);
  vm.team.users = allUsers.filter(user => vm.team.users.includes(user._id));
  vm.dependentDeployments = dependentDeployments;
  vm.hasEditPermissions = Authentication.isAllowed('/teams', 'put', false);
}

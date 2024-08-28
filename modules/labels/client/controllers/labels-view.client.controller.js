LabelsViewController.$inject = ['label', 'dependentDeployments', 'allLabelLogs', 'Authentication'];
export default function LabelsViewController(label, dependentDeployments, allLabelLogs, Authentication) {
  var vm = this;
  vm.label = label;
  label.history = allLabelLogs.find(log => log.associated_id === label._id);
  vm.dependentDeployments = dependentDeployments;

  // Permissions
  label.history = allLabelLogs.find(log => log.associated_id === label._id);
  var isCreator = (label.history && label.history.createdBy.username === Authentication.user.username);
  vm.hasEditPermissions = Authentication.isAllowed('/labels', 'put', isCreator);
}

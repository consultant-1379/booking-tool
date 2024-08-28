var moment = require('moment');

HardwareViewController.$inject = ['hardware', 'allDeployments', 'program', 'allHardwareLogs', 'Authentication'];
export default function HardwareViewController(hardware, allDeployments, program, allHardwareLogs, Authentication) {
  var vm = this;
  vm.hardware = hardware;
  vm.program = program;

  // Permissions
  hardware.history = allHardwareLogs.find(log => log.associated_id === hardware._id);
  var isCreator = (hardware.history && hardware.history.createdBy.username === Authentication.user.username);
  vm.hasEditPermissions = Authentication.isAllowed('/hardware', 'put', isCreator);

  if (hardware.freeStartDate) {
    var freeDate = moment(hardware.freeStartDate);
    var todaysDate = moment();
    var daysFree = todaysDate.diff(freeDate, 'days');
    vm.hardware.daysFree = daysFree;
    vm.hardware.freeStartDate = moment(hardware.freeStartDate).format('YYYY-MM-DD HH:mm');
  } else {
    allDeployments.find(function (deployment) {
      deployment.products.find(function (product) {
        if (product.hardware_ids.includes(hardware._id)) {
          vm.deployment = deployment;
          vm.product = product;
          return true;
        }
        return false;
      });
      return (vm.deployment);
    });
  }
}

ProductFlavoursCreateController.$inject = ['$state', 'productFlavour', 'Notification', 'restoredata'];
export default function ProductFlavoursCreateController($state, productFlavour, Notification, restoredata) {
  var vm = this;
  vm.productFlavour = productFlavour;

  vm.submitForm = async function () {
    try {
      vm.formSubmitting = true;
      await vm.productFlavour.createOrUpdate();
    } catch (err) {
      vm.formSubmitting = false;
      var message = err.data ? err.data.message : err.message;
      Notification.error({
        message: message.replace(/\n/g, '<br/>'),
        title: `<i class="glyphicon glyphicon-remove"></i> Product-Flavour ${vm.jobType} error!`
      });
      return;
    }
    $state.go('productFlavours.view', { productFlavourId: vm.productFlavour._id });
    Notification.success({ message: `<i class="glyphicon glyphicon-ok"></i> Product-Flavour ${vm.jobType} successful!` });
  };

  if (restoredata) {
    Object.keys(restoredata).forEach(function (key) {
      vm.productFlavour[key] = restoredata[key];
    });
    vm.pageTitle = 'Restoring';
    vm.jobType = 'restoration';
    vm.submitForm();
  } else {
    vm.pageTitle = 'Creating';
    vm.jobType = 'creation';
  }
}

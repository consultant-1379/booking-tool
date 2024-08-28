LabelsCreateController.$inject = ['$state', 'label', 'Notification', 'restoredata', 'creatingFromScratch'];
export default function LabelsCreateController($state, label, Notification, restoredata, creatingFromScratch) {
  var vm = this;
  vm.label = label;

  vm.submitForm = async function () {
    try {
      vm.formSubmitting = true;
      await vm.label.createOrUpdate();
    } catch (err) {
      vm.formSubmitting = false;
      var message = err.data ? err.data.message : err.message;
      Notification.error({
        message: message.replace(/\n/g, '<br/>'),
        title: `<i class="glyphicon glyphicon-remove"></i> Label ${vm.jobType} error!`
      });
      return;
    }
    $state.go('labels.view', { labelId: vm.label._id });
    Notification.success({ message: `<i class="glyphicon glyphicon-ok"></i> Label ${vm.jobType} successful!` });
  };

  if (restoredata) {
    Object.keys(restoredata).forEach(function (key) {
      vm.label[key] = restoredata[key];
    });
    vm.pageTitle = 'Restoring';
    vm.jobType = 'restoration';
    vm.submitForm();
  } else {
    vm.pageTitle = creatingFromScratch ? 'Creating' : 'Editing';
    vm.jobType = creatingFromScratch ? 'creation' : 'update';
  }
}

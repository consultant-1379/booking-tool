import _ from 'lodash';
var $ = require('jquery');
require('select2')();

HardwareCreateController.$inject = ['$scope', '$state', 'Notification', 'creatingFromScratch', 'hardware', 'restoredata', 'allPrograms'];
export default function HardwareCreateController($scope, $state, Notification, creatingFromScratch, hardware, restoredata, allPrograms) {
  var vm = this;
  vm.hardware = hardware;
  vm.allPrograms = _.clone(allPrograms);
  vm.urlregex = '^(https?://)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[-0-9a-z]{0,61}[0-9a-z])?)*)(.*)$';

  vm.submitForm = async function () {
    try {
      vm.formSubmitting = true;
      await vm.hardware.createOrUpdate();
    } catch (err) {
      vm.formSubmitting = false;
      var message = err.data ? err.data.message : err.message;
      Notification.error({
        message: message.replace(/\n/g, '<br/>'),
        title: `<i class="glyphicon glyphicon-remove"></i> Hardware ${vm.jobType} error!`
      });
      return;
    }
    $state.go('hardware.view', { hardwareId: vm.hardware._id });
    Notification.success({ message: `<i class="glyphicon glyphicon-ok"></i> Hardware ${vm.jobType} successful!` });
  };

  if (restoredata) {
    Object.keys(restoredata).forEach(function (key) {
      vm.hardware[key] = restoredata[key];
    });
    vm.pageTitle = 'Restoring';
    vm.jobType = 'restoration';
    vm.submitForm();
  } else {
    vm.pageTitle = creatingFromScratch ? 'Creating' : 'Editing';
    vm.jobType = creatingFromScratch ? 'creation' : 'update';
  }


  $(function () {
    $('#program-select').select2({
      placeholder: '--Select Program--',
      allowClear: true
    });
    $('#program-select').on('select2:select select2:unselecting', async function () {
      var valueIsEmpty = $(this).val() === null || $(this).val() === '';
      if (valueIsEmpty) $(this).data('unselecting', true);
      vm.hardware.program_id = (valueIsEmpty) ? null : $(this).val().replace('string:', '');
      _.defer(() => $scope.$apply());
    });
  });
}

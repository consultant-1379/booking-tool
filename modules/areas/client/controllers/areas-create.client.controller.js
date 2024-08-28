import _ from 'lodash';
import { userCompare, capitalizeFirstLetter } from '../../../core/client/controllers/helpers.client.controller';
var $ = require('jquery');
require('select2')();

AreasCreateController.$inject = [
  '$scope', '$window', '$state', 'area', 'allUsers', 'allPrograms',
  'creatingFromScratch', 'Notification', 'Authentication', 'restoredata'
];
export default function AreasCreateController(
  $scope, $window, $state, area, allUsers, allPrograms,
  creatingFromScratch, Notification, Authentication, restoredata
) {
  var vm = this;
  vm.area = area;
  vm.programs = allPrograms;
  vm.isSmokeTestUser = (Authentication.user.username === 'dttadm100');
  vm.users = allUsers.sort(userCompare);
  vm.permissionTypes = ['This RA Only', 'All RAs Within Program'];

  vm.clearBookingAssignee = async function () {
    vm.area.bookingAssigneeUser_id = null;
  };

  $(function () {
    setSelect2('#bookingAssigneeUser-select', 'User');
    $('#bookingAssigneeUser-select').on('select2:select select2:unselecting', async function () {
      var valueIsEmpty = $(this).val() === null || $(this).val() === '';
      if (valueIsEmpty) $(this).data('unselecting', true);
      vm.area.bookingAssigneeUser_id = (valueIsEmpty) ? null : $(this).val().replace('string:', '');
      _.defer(() => $scope.$apply());
    });
  });

  function setSelect2(selectId, placeholderName) {
    $(selectId).select2({
      placeholder: `--Select ${placeholderName}--`,
      allowClear: true
    });
  }

  vm.submitForm = async function () {
    try {
      if (vm.jobType === 'update') {
        var updateReason = $window.prompt('Provide Reason for Requirement Area Update');
        if (!updateReason || updateReason.length < 10) throw new Error('Must provide reason (10 chars min) for change.');
        vm.area.updateReason = updateReason;
      }
      vm.formSubmitting = true;
      await vm.area.createOrUpdate();
    } catch (err) {
      vm.formSubmitting = false;
      var message = err.data ? err.data.message : err.message;
      Notification.error({
        message: message.replace(/\n/g, '<br/>'),
        title: `<i class="glyphicon glyphicon-remove"></i> Requirement Area ${vm.jobType} error!`
      });
      return;
    }
    $state.go('areas.view', { areaId: vm.area._id });
    Notification.success({ message: `<i class="glyphicon glyphicon-ok"></i> Requirement Area ${vm.jobType} successful!` });
  };

  if (restoredata) {
    Object.keys(restoredata).forEach(function (key) {
      vm.area[key] = restoredata[key];
    });
    vm.pageTitle = 'Restoring';
    vm.jobType = 'restoration';
    vm.submitForm();
  } else {
    vm.pageTitle = creatingFromScratch ? 'Creating' : 'Editing';
    vm.jobType = creatingFromScratch ? 'creation' : 'update';
  }
}

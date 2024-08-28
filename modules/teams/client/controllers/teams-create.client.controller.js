import _ from 'lodash';
import { userCompare } from '../../../core/client/controllers/helpers.client.controller';
var $ = require('jquery');
require('select2')();

TeamsCreateController.$inject = ['$scope', '$state', '$window', 'team', 'allUsers', 'allRoles', 'allAreas',
  'creatingFromScratch', 'Notification', 'Authentication', 'restoredata'];
export default function TeamsCreateController(
  $scope, $state, $window, team, allUsers, allRoles, allAreas, creatingFromScratch,
  Notification, Authentication, restoredata
) {
  var vm = this;
  vm.team = team;
  vm.users = allUsers;
  vm.areas = allAreas;
  vm.states = ['active', 'inactive'];
  vm.Authentication = Authentication;
  vm.isSmokeTestUser = (Authentication.user.username === 'dttadm100');
  var adminRoleIds = allRoles.filter(role => ['superAdmin', 'admin'].includes(role.name)).map(role => role._id);
  vm.admins = allUsers.filter(user => user.userRoles.some(role => adminRoleIds.includes(role))).sort(userCompare);
  if (creatingFromScratch && !restoredata) {
    vm.team.state = vm.states[0];
    vm.team.admin_IDs = [];
    vm.team.users = [];
  }

  vm.submitForm = async function () {
    vm.team.admin_IDs = vm.team.admin_IDs.filter(el => el !== undefined);
    try {
      vm.formSubmitting = true;
      await vm.team.createOrUpdate();
    } catch (err) {
      vm.formSubmitting = false;
      var message = err.data ? err.data.message : err.message;
      Notification.error({
        message: message.replace(/\n/g, '<br/>'),
        title: `<i class="glyphicon glyphicon-remove"></i> Team ${vm.jobType} error!`
      });
      return;
    }
    $state.go('teams.view', { teamId: vm.team._id });
    Notification.success({ message: `<i class="glyphicon glyphicon-ok"></i> Team ${vm.jobType} successful!` });
  };

  if (restoredata) {
    Object.keys(restoredata).forEach(function (key) {
      vm.team[key] = restoredata[key];
    });
    vm.pageTitle = 'Restoring';
    vm.jobType = 'restoration';
    vm.submitForm();
  } else {
    vm.pageTitle = creatingFromScratch ? 'Creating' : 'Editing';
    vm.jobType = creatingFromScratch ? 'creation' : 'update';
  }
  vm.currentUserNames = getNamesFromUserIDs(vm.team.users);

  function getNamesFromUserIDs(currentUsersIDs) {
    return vm.users.filter(user => currentUsersIDs.includes(user._id)).map(user => user.displayName);
  }

  function getIDFromSignum(signum) {
    return vm.users.filter(user => user.username === signum)[0]._id;
  }

  vm.addUser = function () {
    try {
      isUserInDB(vm.signum.toLowerCase());
      vm.team.users.push(getIDFromSignum(vm.signum.toLowerCase()));
      vm.currentUserNames = getNamesFromUserIDs(vm.team.users);
      vm.signum = '';
      return;
    } catch (err) {
      var message = err.data ? err.data.message : err.message;
      Notification.error({
        message: message.replace(/\n/g, '<br/>'),
        title: '<i class="glyphicon glyphicon-remove"></i> Team User Error!'
      });
    }
  };

  vm.removeUser = function (user) {
    if ($window.confirm('Are you sure you want to remove this user from the team?')) {
      vm.team.users.splice(vm.team.users.indexOf(user), 1);
      vm.currentUserNames.splice(vm.currentUserNames.indexOf(user), 1);
    }
  };

  function isUserInDB(username) {
    for (var index in vm.users) {
      if (vm.users[index].username === username) {
        return true;
      }
    }
    var message = 'Username not in database. Users must have logged in once before they can be added to a team.';
    throw new Error(message);
  }

  function setSelect2(selectId, placeholderName) {
    $(selectId).select2({
      placeholder: `--Select ${placeholderName}--`,
      allowClear: true
    });
  }

  $(function () {
    setSelect2('#area-select', 'Requirement Area');
    $('#area-select').on('select2:select select2:unselecting', async function () {
      var valueIsEmpty = $(this).val() === null || $(this).val() === '';
      if (valueIsEmpty) $(this).data('unselecting', true);
      vm.team.area_id = (valueIsEmpty) ? null : $(this).val().replace('string:', '');
      _.defer(() => $scope.$apply());
    });
    if (!vm.isSmokeTestUser) {
      $('#select2-area-select-container').prop('title', 'Provided by Team Inventory Tool');
      $('#select2-area-select-container').css('cursor', 'not-allowed');
    }
    setSelect2('#adminPrimary-select', 'Primary Admin');
    $('#adminPrimary-select').on('select2:select select2:unselecting', async function () {
      var valueIsEmpty = $(this).val() === null || $(this).val() === '';
      if (valueIsEmpty) $(this).data('unselecting', true);
      vm.team.admin_IDs[0] = (valueIsEmpty) ? undefined : $(this).val().replace('string:', '');
      waitToSetAdminSecondarySelect();
      _.defer(() => $scope.$apply());
    });
    setAdminSecondarySelect();
  });

  function waitToSetAdminSecondarySelect() {
    var existCondition = setInterval(function () {
      if ($('#adminSecondary-select').length) {
        clearInterval(existCondition);
        setAdminSecondarySelect();
      }
    }, 100); // check every 100ms
  }

  function setAdminSecondarySelect() {
    setSelect2('#adminSecondary-select', 'Secondary Admin');
    $('#adminSecondary-select').on('select2:select select2:unselecting', async function () {
      var valueIsEmpty = $(this).val() === null || $(this).val() === '';
      if (valueIsEmpty) $(this).data('unselecting', true);
      vm.team.admin_IDs[1] = (valueIsEmpty) ? undefined : $(this).val().replace('string:', '');
      if (valueIsEmpty) vm.team.admin_IDs.splice(-1, 1);
      _.defer(() => $scope.$apply());
    });
  }
}

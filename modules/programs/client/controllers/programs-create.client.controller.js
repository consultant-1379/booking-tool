ProgramsCreateController.$inject = ['$state', '$http', 'program', 'Notification', 'restoredata'];
export default function ProgramsCreateController($state, $http, program, Notification, restoredata) {
  var vm = this;
  vm.program = program;

  vm.submitForm = async function () {
    try {
      vm.formSubmitting = true;
      await vm.program.createOrUpdate();
    } catch (err) {
      vm.formSubmitting = false;
      var errorMessage = err.data ? err.data.message : err.message;
      Notification.error({
        message: errorMessage.replace(/\n/g, '<br/>'),
        title: `<i class="glyphicon glyphicon-remove"></i> Program ${vm.jobType} error!`
      });
      return;
    }
    var message = `<i class="glyphicon glyphicon-ok"></i> Program ${vm.jobType} successful!<br>`;
    try {
      await $http.post('/api/updateAreasAndTeamsData').then(function (res) {
        if (res.status !== 200) throw new Error('Team Inventory Tool currently not available, Associated Teams and RAs will be updated automatically within next 24 hours');
      });
      $state.go('programs.view', { programId: vm.program._id });
      message += ' Associated Teams and RAs updated successfully!';
    } catch (teamAndRaError) {
      message += teamAndRaError.message;
    }
    Notification.success({
      message: message
    });
  };

  if (restoredata) {
    Object.keys(restoredata).forEach(function (key) {
      vm.program[key] = restoredata[key];
    });
    vm.pageTitle = 'Restoring';
    vm.jobType = 'restoration';
    vm.submitForm();
  } else {
    vm.pageTitle = 'Creating';
    vm.jobType = 'creation';
  }
}

ErrorController.$inject = ['$stateParams'];

export default function ErrorController($stateParams) {
  var vm = this;
  vm.errorMessage = null;

  // Display custom message if it was set
  if ($stateParams.message) vm.errorMessage = $stateParams.message;
}

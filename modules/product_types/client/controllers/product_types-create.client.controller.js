import 'angular-bootstrap-multiselect';

ProductTypesCreateController.$inject = [
  '$state', '$window', 'productType', 'allFlavours', 'creatingFromScratch',
  'Notification', 'restoredata', 'allDeployments'
];
export default function ProductTypesCreateController(
  $state, $window, productType, allFlavours, creatingFromScratch,
  Notification, restoredata, allDeployments
) {
  var vm = this;
  vm.fieldApplicableFor = ['Cloud', 'Physical', 'Both'];
  vm.hasDependentDeployments = false;
  if (allDeployments) {
    vm.hasDependentDeployments = allDeployments.find(function (deployment) {
      var foundDeployment = deployment.products.find(product => product.product_type_name === productType.name);
      return (foundDeployment);
    });
  }

  vm.productType = productType;
  vm.allFlavours = allFlavours.map(flavour => flavour.name);

  vm.submitForm = async function () {
    try {
      vm.formSubmitting = true;
      await vm.productType.createOrUpdate();
    } catch (err) {
      vm.formSubmitting = false;
      var message = err.data ? err.data.message : err.message;
      Notification.error({
        message: message.replace(/\n/g, '<br/>'),
        title: `<i class="glyphicon glyphicon-remove"></i> Product-Type ${vm.jobType} error!`
      });
      return;
    }
    $state.go('productTypes.view', { productTypeId: vm.productType._id });
    Notification.success({ message: `<i class="glyphicon glyphicon-ok"></i> Product-Type ${vm.jobType} successful!` });
  };

  if (restoredata) {
    Object.keys(restoredata).forEach(function (key) {
      vm.productType[key] = restoredata[key];
    });
    vm.pageTitle = 'Restoring';
    vm.jobType = 'restoration';
    vm.submitForm();
  } else {
    if (creatingFromScratch) {
      vm.productType.flavours = [];
      vm.productType.mandatoryConfigKeys = [];
    }
    vm.pageTitle = creatingFromScratch ? 'Creating' : 'Editing';
    vm.jobType = creatingFromScratch ? 'creation' : 'update';
  }

  // Configuration Fields functions
  vm.addConfigurationField = function () {
    vm.productType.mandatoryConfigKeys.push({});
  };

  vm.removeConfigurationField = function (productTypeConfiguration) {
    var productConfigurationIndex = vm.productType.mandatoryConfigKeys.indexOf(productTypeConfiguration);
    if ($window.confirm('Are you sure you want to delete this Configuration Field?')) {
      vm.productType.mandatoryConfigKeys.splice(productConfigurationIndex, 1);
    }
  };
}

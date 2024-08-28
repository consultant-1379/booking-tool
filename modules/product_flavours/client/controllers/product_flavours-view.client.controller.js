ProductFlavoursViewController.$inject = ['productFlavour', 'dependentProductTypes'];
export default function ProductFlavoursViewController(productFlavour, dependentProductTypes) {
  var vm = this;
  vm.productFlavour = productFlavour;
  vm.dependentProductTypes = dependentProductTypes;
}

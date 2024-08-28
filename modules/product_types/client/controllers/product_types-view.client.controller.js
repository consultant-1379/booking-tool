ProductTypesViewController.$inject = ['productType', 'allFlavours', 'allDeployments', 'allProductTypeLogs', 'Authentication'];
export default function ProductTypesViewController(productType, allFlavours, allDeployments, allProductTypeLogs, Authentication) {
  var vm = this;
  vm.productType = productType;
  vm.dependentDeployments = allDeployments.filter(function (deployment) {
    var productNames = deployment.products.map(product => product.product_type_name);
    return (productNames.indexOf(productType.name) !== -1);
  });
  vm.flavours = allFlavours.filter(flavour => vm.productType.flavours.includes(flavour.name));

  // Permissions
  productType.history = allProductTypeLogs.find(log => log.associated_id === productType._id);
  var isCreator = (productType.history && productType.history.createdBy.username === Authentication.user.username);
  vm.hasEditPermissions = Authentication.isAllowed('/productTypes', 'put', isCreator);
}

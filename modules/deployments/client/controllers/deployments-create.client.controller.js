import _ from 'lodash';
import { asyncForEach, floatingSaveButton, jiraIssueValidation, userCompare, capitalizeFirstLetter } from '../../../core/client/controllers/helpers.client.controller';
var $ = require('jquery');
require('select2')();

DeploymentsCreateController.$inject = [
  '$scope', '$http', '$state', 'Authentication', 'deployment', 'creatingFromScratch', 'Notification',
  '$window', 'allDeployments', 'allTeams', 'allAreas', 'allPrograms', 'clonedata',
  'allHardware', 'restoredata', 'allProductTypes', 'allBookings', 'allUsers', 'allLabels'
];

export default function DeploymentsCreateController(
  $scope, $http, $state, Authentication, deployment, creatingFromScratch, Notification,
  $window, allDeployments, allTeams, allAreas, allPrograms, clonedata,
  allHardware, restoredata, allProductTypes, allBookings, allUsers, allLabels
) {
  var vm = this;
  // Deployment Variables
  vm.creatingFromScratch = creatingFromScratch;
  vm.deployment = deployment;
  vm.allPrograms = allPrograms;
  vm.allUsers = _.clone(allUsers.sort(userCompare));
  vm.currentUser = allUsers.filter(user => user.username === Authentication.user.username)[0]; // Set Active User
  vm.userIsAdmin = Authentication.user.userRoles.some((role) => ['superAdmin', 'admin'].includes(role.name));
  vm.allDeployments = _.clone(allDeployments);
  vm.allHardwareAvailable = _.clone(allHardware);
  vm.deploymentStatusTypes = ['Free', 'In Review', 'Blocked/In Maintenance', 'In Use', 'Booking Disabled'];
  vm.disabledProducts = [];
  vm.allLabels = _.clone(allLabels);
  vm.allLabelNames = allLabels.map(label => label.name);
  vm.allSpocUserNames = _.uniq(allUsers.map(user => user.displayName));
  vm.selectedLabels = [];
  vm.selectedSpocUsers = [];
  vm.showCreateButton = false;
  var freeProgramHardware = [];

  vm.getHardwareName = function (hwId) {
    if (typeof hwId === 'string' || hwId instanceof String) {
      var hardware = allHardware.find(hw => hw._id.toString() === hwId.toString());
      if (hardware) return hardware.name;
    }
  };

  if (deployment.label_ids) {
    deployment.label_ids.forEach(function (labelId) {
      var foundLabel = allLabels.find(label => label._id === labelId);
      vm.selectedLabels.push(foundLabel.name);
    });
  }

  if (deployment.spocUser_ids) {
    deployment.spocUser_ids = _.uniq(deployment.spocUser_ids);
    deployment.spocUser_ids.forEach(function (spocUserId) {
      var foundSpocUser = allUsers.find(user => user._id === spocUserId);
      vm.selectedSpocUsers.push(foundSpocUser.displayName);
    });
  }

  vm.getFreeProductHW = function () {
    // Get Hardware not already used by products
    var freeHardwareIds = freeProgramHardware.filter(function (hw) {
      var alreadyUsed = deployment.products.some(product => product.hardware_ids.includes(hw._id));
      return !alreadyUsed;
    }).map(hw => hw._id);

    vm.availableHardware = [];
    deployment.products.forEach(function (product, productIndex) {
      var freeHardwareIdsForProduct = _.concat(freeHardwareIds, product.hardware_ids);
      vm.availableHardware[productIndex] = freeHardwareIdsForProduct.map(hwId => allHardware.find(hw => hwId === hw._id));
    });
  };

  function getFreeProgramHW() {
    // Get HW used in other Deployment-Product
    var otherDeployments = vm.allDeployments.filter(otherDepl => otherDepl._id !== vm.deployment._id);
    var otherDeploymentsUsedHW = otherDeployments.map(depl => depl.products.map(product => product.hardware_ids)).flat(2);
    // Filter out hardware being used by other Deployments and from other Programs
    freeProgramHardware = allHardware.filter(hw => hw.program_id === vm.deployment.program_id && !otherDeploymentsUsedHW.includes(hw._id)).flat();
    vm.getFreeProductHW();
  }

  // Jira Issues Variable
  if (!vm.deployment.jira_issues || vm.deployment.jira_issues.length === 0) {
    vm.deployment.jira_issues = [];
  }

  // Area Variables
  vm.getAreas = function () {
    vm.areas = allAreas.filter(area => area.program_id === vm.deployment.program_id);
  };
  if (vm.deployment.program_id) vm.getAreas();

  // Get associated data for a Program
  vm.getProgramAssociatedData = function () {
    vm.getAreas();
    deployment.products.forEach(product => { product.hardware_ids = []; });
    getFreeProgramHW();
  };

  // Team Variables
  vm.getTeams = function () {
    vm.teams = allTeams.filter(team => team.area_id === vm.deployment.area_id);
    if (!vm.teams.find(team => team._id === vm.deployment.team_id)) {
      vm.deployment.team_id = null;
    }
  };
  if (vm.deployment.area_id) vm.getTeams();

  // Product Variables
  if (!vm.deployment.products || vm.deployment.products.length === 0) {
    vm.deployment.products = [];
  }

  vm.productTypes = allProductTypes;
  vm.infrastructureTypes = ['Physical', 'Cloud', 'vCenter'];

  // Product Data variables
  vm.urlregex = '^(https?://)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[-0-9a-z]{0,61}[0-9a-z])?)*)(.*)$';

  // Clone populate
  var fieldsToAutoPopulate = ['status', 'products', 'area_id', 'program_id', 'team_id'];

  processURLParameters();
  // Products functions
  vm.addProduct = function () {
    vm.deployment.products.push({
      hardware_ids: [], links: [], configuration: [], admins_only: false
    });
    vm.disabledProducts.push(false);
    vm.getFreeProductHW();
  };

  vm.removeProduct = function (product) {
    var productIndex = vm.deployment.products.indexOf(product);
    if ($window.confirm('Are you sure you want to delete this Product?')) {
      vm.deployment.products.splice(productIndex, 1);
      vm.disabledProducts.splice(productIndex, 1);
      vm.getFreeProductHW();
    }
    if (!creatingFromScratch) {
      vm.deployment.products.forEach(function (product) {
        var productIndex = vm.deployment.products.indexOf(product);
        vm.updateProductConfigFields(productIndex);
      });
    }
  };

  vm.getValidFlavours = function (productTypeName) {
    var productType = vm.productTypes.find(pt => pt.name === productTypeName);
    if (!productType) return [];
    return productType.flavours;
  };

  // Hardware functions
  vm.addHardware = function (product) {
    var productIndex = vm.deployment.products.indexOf(product);
    vm.deployment.products[productIndex].hardware_ids.push('');
  };

  vm.removeHardware = function (product, productHardware) {
    var productIndex = vm.deployment.products.indexOf(product);
    var productHardwareIndex = vm.deployment.products[productIndex].hardware_ids.indexOf(productHardware);
    if ($window.confirm('Are you sure you want to delete this Hardware?')) {
      vm.deployment.products[productIndex].hardware_ids.splice(productHardwareIndex, 1);
    }
    vm.hardwareDuplicateCheck();
  };

  // Product Datas functions
  vm.addProductData = function (product) {
    var productIndex = vm.deployment.products.indexOf(product);
    vm.deployment.products[productIndex].links.push({});
  };

  vm.removeProductData = function (product, productData) {
    var productIndex = vm.deployment.products.indexOf(product);
    var productDataIndex = vm.deployment.products[productIndex].links.indexOf(productData);
    var confirmMsg = 'Are you sure you want to delete this Product Data?';
    if ($window.confirm(confirmMsg)) {
      vm.deployment.products[productIndex].links.splice(productDataIndex, 1);
    }
  };

  // Product Configuration functions
  vm.addProductConfiguration = function (product) {
    var productIndex = vm.deployment.products.indexOf(product);
    vm.deployment.products[productIndex].configuration.push({});
  };

  vm.removeProductConfiguration = function (product, configurationData, needUserConfirmation) {
    var productIndex = vm.deployment.products.indexOf(product);
    var productConfigurationIndex = vm.deployment.products[productIndex].configuration.indexOf(configurationData);
    if (!needUserConfirmation || ($window.confirm('Are you sure you want to delete this Product Configuration?'))) {
      vm.deployment.products[productIndex].configuration.splice(productConfigurationIndex, 1);
    }
  };

  async function processURLParameters() {
    await window.location.search;
    var fullQueryString = window.location.search.substring(1);
    var queryString = fullQueryString;
    if (fullQueryString.includes('cloneData')) queryString = fullQueryString.replace('cloneData', '');
    if (fullQueryString.includes('restoreData')) queryString = fullQueryString.replace('restoreData', '');

    var queries = queryString.split('&');
    var keyPair = {};
    var options = ['addProduct', 'editProduct'];
    for (var i = 0; i < queries.length; i += 1) {
      var optionKey = queries[i].split('=')[0];
      var optionValues = queries[i].split('=')[1];
      if (optionKey && !options.includes(optionKey)) {
        Notification.error({
          message: `${optionKey} is not a valid key`,
          title: '<i class="glyphicon glyphicon-remove"></i> URL Parameters error!'
        });
      } else if (optionKey in keyPair) {
        Notification.error({
          message: `Duplicate key: ${optionKey}`,
          title: '<i class="glyphicon glyphicon-remove"></i> URL Parameters error!'
        });
      } else {
        keyPair[optionKey] = optionValues;
      }
    }
    var errorMessageTitle = '<i class="glyphicon glyphicon-remove"></i> Deployments redirect error!';
    for (var key in keyPair) {
      if (options.indexOf(key) > -1) {
        if (key === 'addProduct') {
          if (keyPair[key] === 'true') {
            $([document.documentElement, document.body]).animate({
              scrollTop: $('#add-product').offset().top
            });
            vm.addProduct();
          } else if (keyPair[key] === 'false') {
            Notification.error({
              message: `${key} value is false. "Add Product" is not selected.`,
              title: errorMessageTitle
            });
          } else {
            Notification.error({
              message: `${key} value must be true or false`,
              title: errorMessageTitle
            });
          }
        } else if (key === 'editProduct') {
          if (vm.deployment.products[keyPair[key]]) {
            var productIndexId = `#product_${keyPair[key]}`;
            $([document.documentElement, document.body]).animate({
              scrollTop: $(productIndexId).offset().top - 100
            });
          } else {
            Notification.error({
              message: `${key} value must be valid Product Index`,
              title: errorMessageTitle
            });
          }
        } else {
          Notification.error({
            message: `${key} value must be valid`,
            title: errorMessageTitle
          });
        }
      }
    }
    if (vm.deployment.products) {
      vm.deployment.products.forEach(function (value, index) {
        var existCondition = setInterval(function () {
          if ($(`#products${index}-productType`).length) {
            clearInterval(existCondition);
            setProductsSelect(index);
          }
        }, 100); // check every 100ms
      });
    }
  }

  $(function () {
    floatingSaveButton();
    var selectOptions = ['program', 'area', 'status', 'team'];
    selectOptions.forEach(function (option) {
      setSelect2(`#${option}-select`, capitalizeFirstLetter(option));
    });
    $('#program-select').on('select2:select select2:unselecting', async function () {
      var valueIsEmpty = $(this).val() === null || $(this).val() === '';
      if (valueIsEmpty) $(this).data('unselecting', true);
      vm.deployment.program_id = (valueIsEmpty) ? null : $(this).val().replace('string:', '');
      vm.getProgramAssociatedData();
      _.defer(() => $scope.$apply());
    });
    $('#area-select').on('select2:select select2:unselecting', async function () {
      var valueIsEmpty = $(this).val() === null || $(this).val() === '';
      if (valueIsEmpty) $(this).data('unselecting', true);
      vm.deployment.area_id = (valueIsEmpty) ? null : $(this).val().replace('string:', '');
      vm.getTeams();
      _.defer(() => $scope.$apply());
    });
    $('#status-select').on('select2:select select2:unselecting', async function () {
      var valueIsEmpty = $(this).val() === null || $(this).val() === '';
      if (valueIsEmpty) $(this).data('unselecting', true);
      vm.deployment.status = (valueIsEmpty) ? null : $(this).val().replace('string:', '');
      _.defer(() => $scope.$apply());
    });
    $('#team-select').on('select2:select select2:unselecting', async function () {
      var valueIsEmpty = $(this).val() === null || $(this).val() === '';
      if (valueIsEmpty) $(this).data('unselecting', true);
      vm.deployment.team_id = (valueIsEmpty) ? null : $(this).val().replace('string:', '');
      _.defer(() => $scope.$apply());
    });
    $('#add-product').on('click', function () {
      vm.deployment.products.forEach(function (value, index) {
        setProductsSelect(index);
      });
    });
  });

  function setSelect2(selectId, placeholderName) {
    $(selectId).select2({
      placeholder: `--Select ${placeholderName}--`,
      allowClear: true
    });
  }

  async function setProductsSelect(index) {
    var productTypeSelect = `#products${index}-productType`;
    setSelect2(productTypeSelect, 'Product-Type');
    $(productTypeSelect).on('select2:select select2:unselecting', async function () {
      var valueIsEmpty = $(this).val() === null || $(this).val() === '';
      if (valueIsEmpty) $(this).data('unselecting', true);
      vm.deployment.products[index].product_type_name = (valueIsEmpty) ? null : $(this).val().replace('string:', '');
      vm.productTypeChangeHandler(index);
      _.defer(() => $scope.$apply());
    });
    var flavourTypeSelect = `#products${index}-flavour_name`;
    setSelect2(flavourTypeSelect, 'Product-Flavour');
    $(flavourTypeSelect).on('select2:select select2:unselecting', async function () {
      var valueIsEmpty = $(this).val() === null || $(this).val() === '';
      if (valueIsEmpty) $(this).data('unselecting', true);
      vm.deployment.products[index].flavour_name = (valueIsEmpty) ? null : $(this).val().replace('string:', '');
      _.defer(() => $scope.$apply());
    });
    var infrastructureSelect = `#products${index}-infrastructure`;
    setSelect2(infrastructureSelect, 'Infrastructure-Type');
    $(infrastructureSelect).on('select2:select select2:unselecting', async function () {
      var valueIsEmpty = $(this).val() === null || $(this).val() === '';
      if (valueIsEmpty) $(this).data('unselecting', true);
      vm.deployment.products[index].infrastructure = (valueIsEmpty) ? null : $(this).val().replace('string:', '');
      vm.updateProductConfigFields(index);
      _.defer(() => $scope.$apply());
    });
  }

  // Submit Form Function
  vm.submitForm = async function () {
    var deploymentProgram = vm.allPrograms.find(program => program._id === vm.deployment.program_id);
    if (deploymentProgram.name === 'Unassigned') {
      if (!$window.confirm('Are you sure you want to put this Deployment to \'Unassigned\' Program/RA?\r\n' +
        'Note: This will make the Deployment unbookable.')) {
        return;
      }
    }
    vm.deployment.products.forEach(function (product) {
      if (product.location === '') product.location = undefined;
      product.links.forEach(function (productData) {
        if (productData.url === '') productData.url = undefined;
      });
    });
    try {
      vm.deployment.label_ids = [];
      vm.selectedLabels.forEach(function (selectedLabel) {
        var foundLabel = vm.allLabels.find(label => label.name === selectedLabel);
        vm.deployment.label_ids.push(foundLabel._id);
      });

      vm.deployment.spocUser_ids = [];
      vm.selectedSpocUsers.forEach(function (selectedSpocUser) {
        var foundSpocUser = vm.allUsers.find(user => user.displayName === selectedSpocUser);
        vm.deployment.spocUser_ids.push(foundSpocUser._id);
        vm.deployment.spocUser_ids = _.uniq(vm.deployment.spocUser_ids);
      });
      vm.formSubmitting = true;
      delete vm.deployment.__v;
      vm.deployment.products.forEach(function (product) {
        if (product.isLocked) delete product.isLocked;
      });

      await vm.deployment.createOrUpdate();
    } catch (err) {
      vm.formSubmitting = false;
      var message = err.data ? err.data.message : err.message;
      Notification.error({
        message: message.replace(/\n/g, '<br/>'),
        title: `<i class="glyphicon glyphicon-remove"></i> Deployment ${vm.jobType} error!`
      });
      return;
    }
    $state.go('deployments.view', { deploymentId: vm.deployment._id });
    Notification.success({ message: `<i class="glyphicon glyphicon-ok"></i> Deployment ${vm.jobType} successful!` });
  };

  vm.updateProductConfigFields = async function (productIndex) {
    var product = vm.deployment.products[productIndex],
      configFieldsToDisable = [],
      isStrictConfiguration;

    // If productType and Infrastructure is selected
    if (product.product_type_name && product.infrastructure) {
      var productTypeSelected = vm.productTypes.find(pt => pt.name === product.product_type_name);
      isStrictConfiguration = productTypeSelected.configKeysAreStrict;
      await asyncForEach(productTypeSelected.mandatoryConfigKeys, async function (key) {
        var addConfigField = true;
        if ((product.infrastructure === key.infrastructure) || (key.infrastructure === 'Both')) {
          var currentNumOfConfigs = product.configuration.length;
          if (product.configuration) {
            product.configuration.forEach(function (configuration) {
              if (configuration.key_name === key.name) {
                addConfigField = false;
                configFieldsToDisable.push(configuration);
              }
            });
          }
          if (addConfigField) {
            vm.addProductConfiguration(product);
            product.configuration[currentNumOfConfigs].key_name = key.name;
            var findConfig = vm.deployment.products[productIndex].configuration.find(pt => pt.key_name === key.name);
            configFieldsToDisable.push(findConfig);
          }
        } else {
          product.configuration.forEach(function (configuration) {
            if (configuration.key_name === key.name) {
              vm.removeProductConfiguration(product, configuration, false);
            }
          });
        }
      });
      $scope.$apply();
    }
    await disableProductConfigFields(productIndex, configFieldsToDisable, isStrictConfiguration);
    if (!creatingFromScratch && product._id) {
      var productUsedByBooking = [];
      productUsedByBooking = allBookings.find(booking => (booking.product_id === product._id) && !booking.isExpired);
      if (productUsedByBooking) disableFieldsForProduct(productIndex);
    }
  };

  vm.productTypeChangeHandler = async function (productIndex) {
    if (vm.deployment.products[productIndex].configuration) {
      vm.deployment.products[productIndex].configuration = [];
    }
    await vm.updateProductConfigFields(productIndex);
  };

  function disableFieldsForProduct(productIndex) {
    vm.disabledProducts[productIndex] = true;
  }

  async function disableProductConfigFields(productIndex, configFieldsToDisable, isStrictConfiguration) {
    await asyncForEach(configFieldsToDisable, function async(config) {
      var productConfigurationIndex = vm.deployment.products[productIndex].configuration.indexOf(config);
      document.getElementById(`products[${productIndex}].configuration[${productConfigurationIndex}].key_name`).disabled = true;
      document.getElementById(`remove-product-configuration[${productIndex}][${productConfigurationIndex}]`).style.visibility = 'hidden';
    });
    document.getElementById(`add-product-configuration-[${productIndex}]`).style.visibility = (isStrictConfiguration) ? 'hidden' : 'visible';
  }

  if (clonedata) {
    clonedata.products.forEach(function (product) {
      delete product.purpose;
      delete product.jenkinsJob;
      product.hardware_ids = [];
      if (product.links) {
        product.links.forEach(function (link) {
          link.link_name = 'temp';
          delete link.url;
        });
      }
      if (product.configuration) {
        var currentProductType = vm.productTypes.find(pt => pt.name === product.product_type_name);
        var clonedConfigurations = [];
        product.configuration.forEach(function (config) {
          var isMandatoryKey = currentProductType.mandatoryConfigKeys.find(mk => mk.name === config.key_name);
          if (!isMandatoryKey) {
            var tempConfig = { key_name: 'temp', key_value: '' };
            clonedConfigurations.push(tempConfig);
          }
        });
        product.configuration = clonedConfigurations;
      }
    });
    Object.keys(clonedata).forEach(function (key) {
      if (fieldsToAutoPopulate.includes(key)) {
        vm.deployment[key] = clonedata[key];
      }
    });
    vm.getAreas();
    vm.getTeams();
    vm.getFreeProductHW();
    vm.pageTitle = 'Creating';
    vm.jobType = 'creation';
    // Populate Mandatory Keys For All Products
    clonedata.products.forEach(function (product) {
      var productIndex = vm.deployment.products.indexOf(product);
      vm.updateProductConfigFields(productIndex);
    });
  } else if (restoredata) {
    Object.keys(restoredata).forEach(function (key) {
      vm.deployment[key] = restoredata[key];
    });
    vm.pageTitle = 'Restoring';
    vm.jobType = 'restoration';
    vm.submitForm();
  } else {
    vm.pageTitle = creatingFromScratch ? 'Creating' : 'Editing';
    vm.jobType = creatingFromScratch ? 'creation' : 'update';
    if (!creatingFromScratch) {
      vm.deployment.products.forEach(function (product) {
        vm.disabledProducts.push(false);
        var productIndex = vm.deployment.products.indexOf(product);
        vm.updateProductConfigFields(productIndex);
      });
    }
  }

  getFreeProgramHW();

  // JIRA Issue functions
  vm.addJiraIssue = function () {
    vm.deployment.jira_issues.push('');
  };

  vm.removeJiraIssue = function (jiraIssueIndex) {
    var jiraIssue = vm.deployment.jira_issues[jiraIssueIndex];
    if ($window.confirm(`Are you sure you want to remove this JIRA Issue ${jiraIssueIndex + 1}: "${jiraIssue}"?`)) {
      vm.deployment.jira_issues.splice(jiraIssueIndex, 1);
    }
  };

  vm.jiraIssueValidation = async function ($index) {
    vm.deployment.jira_issues = vm.deployment.jira_issues.map(jira => jira.toUpperCase());
    var jiraIssue = vm.deployment.jira_issues[$index];

    var elementReference = $scope.form['jira_issues[' + $index + ']'];
    await jiraIssueValidation($http, Notification, elementReference, jiraIssue);

    // Checking for duplicates
    var notDuplicateJira = (vm.deployment.jira_issues.filter((issue) => (issue === jiraIssue)).length === 1);
    elementReference.$setValidity('jiraDuplicate', notDuplicateJira);
    _.defer(function () { $scope.$apply(); });
  };

  vm.deployment.products.forEach(function (product) {
    if (product.admins_only && !vm.userIsAdmin) product.isLocked = true;
  });
}

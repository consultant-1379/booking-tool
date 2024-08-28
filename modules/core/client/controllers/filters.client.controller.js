var _ = require('lodash');
require('select2')();

var moment = require('moment');
var helperController = require('../../../core/client/controllers/helpers.client.controller');

module.exports = function ($scope, $window, $state, $timeout, Notification, vm) {
  var module = {};
  var valueComparisons = {
    '>=': function (a, b) { return moment(a).isSameOrAfter(moment(b)); },
    '<=': function (a, b) { return moment(a).isSameOrBefore(moment(b)); },
    '===': function (a, b) { return a === b; }
  };
  var successIcon = '<i class="glyphicon glyphicon-ok"></i>';
  var errorIcon = '<i class="glyphicon glyphicon-remove"></i>';
  var findArtifact = helperController.findArtifact;
  vm.showNumResultsFound = false;
  vm.setFilterSelect2 = function (filters) {
    filters.forEach(function (filter) {
      var filterID = `#${filter.name}Select`;
      $(filterID).select2({
        placeholder: `--Select ${filter.heading}--`,
        allowClear: true
      });
      $(filterID).on('select2:select select2:unselecting', async function () {
        if ($(this).val() === null || $(this).val() === '') {
          $(this).data('unselecting', true);
          vm[filter.name] = undefined;
        } else {
          vm[filter.name] = (filter.name === 'yearFilter') ? Number($(this).val().replace('number:', '')) : $(this).val().replace('string:', '');
        }
        vm.updateViewForFilter(filter.name, vm[filter.name]);
        if (filter.name === 'areaFilter' || !vm.programFilter) {
          vm.currentUser.area_id = vm.areaFilter;
          if (vm.areaFilter === undefined) vm.currentUser.area_id = null;
          var cloneUser = _.cloneDeep(vm.currentUser);
          // Remove any keys we don't want to update
          Object.keys(cloneUser).forEach(key => {
            if (!['_id', 'area_id', 'filters'].includes(key)) {
              cloneUser[key] = undefined;
            }
          });
          await cloneUser.$update();
        }
        _.defer(() => $scope.$apply());
      });
    });
  };

  function filterArtifacts(artifacts, filter) {
    if (!filter.value) return artifacts;
    var splitKey = filter.key.split('.');
    return artifacts.filter(function (artifact) {
      if (filter.key === 'label_ids') {
        var labelList = artifact[filter.key];
        if (artifact.deployment) labelList = artifact.deployment[filter.key];
        return labelList && labelList.includes(filter.value.toString());
      } else if (filter.childEle) {
        var childObjects = artifact[filter.key];
        return childObjects && childObjects.some(childArtifact => childArtifact[filter.childEle] === filter.value.toString());
      }
      var keyValue = artifact[splitKey[0]];
      if (!keyValue) return false;
      if (splitKey.length === 2) keyValue = keyValue[splitKey[1]];
      if (splitKey.length === 3) keyValue = keyValue[splitKey[1]][splitKey[2]];

      var operator = filter.operator || '===';
      return valueComparisons[operator](filter.value, keyValue);
    });
  }

  // Return Artifacts that are contained within each artifact filter list
  vm.getFilteredArtifacts = function (allArtifacts, filterAttributes, startDate, endDate) {
    var filteredArtifactsByKeys = filterAttributes.map(filter => filterArtifacts(allArtifacts, filter));
    var filteredArtifacts = allArtifacts;
    filteredArtifactsByKeys.forEach(function (attribute) {
      filteredArtifacts = filteredArtifacts.filter(artifact => attribute.includes(artifact));
    });
    return filteredArtifacts;
  };

  // Information Pop-Up to Inform Users to Bookmark the Page
  vm.saveFiltersAsBookmark = () => $window.alert('Press Ctrl+D to bookmark this page with selected filters.');

  // Save Current Filter to User Profile
  vm.saveFiltersToProfile = async function () {
    var newCustomFilterName = $window.prompt('Give the new filter a name:');
    if (newCustomFilterName) {
      try {
        var newCustomFilterParams = vm.getFiltersObject();
        if (Object.values(newCustomFilterParams).every(param => (!param))) {
          return Notification.error({
            title: `${errorIcon} Custom-Filter creation error!`,
            message: 'Select a value for at least one filter parameter.'
          });
        }

        vm.currentUser.newFilter = {
          name: newCustomFilterName,
          artifactType: vm.artifactType.toLowerCase(),
          parameters: newCustomFilterParams
        };
        vm.formSubmitting = true;
        vm.currentUser = await vm.currentUser.$updateFilters();
        vm.customFilters = vm.currentUser.filters ? vm.currentUser.filters.filter(f => f.artifactType === vm.artifactType.toLowerCase()) : [];
      } catch (err) {
        vm.formSubmitting = false;
        var message = err.data ? err.data.message : err.message;
        Notification.error({
          message: message.replace(/\n/g, '<br/>'),
          title: `${errorIcon} Custom-Filter creation error!`
        });
        return;
      }
      $timeout(function () {
        $scope.$apply();
        Notification.success({ message: `${successIcon} Custom-Filter created successfully!` });
      });
    }
  };

  // Remove Current Filter from User Profile
  vm.customFilterDelete = async function () {
    var customFilter = findArtifact(vm.customFilters, vm.customFilterId);
    if ($window.confirm(`Are you sure you want to delete custom-filter "${customFilter.name}"?`)) {
      try {
        vm.currentUser.removeFilter = vm.customFilterId;
        vm.formSubmitting = true;
        vm.currentUser = await vm.currentUser.$updateFilters();
        vm.customFilters = vm.currentUser.filters ? vm.currentUser.filters.filter(f => f.artifactType === vm.artifactType.toLowerCase()) : [];
        vm.customFilterClear();
      } catch (err) {
        vm.formSubmitting = false;
        var message = err.data ? err.data.message : err.message;
        Notification.error({
          message: message.replace(/\n/g, '<br/>'),
          title: `${errorIcon} Custom-Filter '${customFilter.name}' deletion error!`
        });
        return;
      }
      $timeout(function () {
        $scope.$apply();
        Notification.success({ message: `${successIcon} Custom-Filter '${customFilter.name}' deleted successfully!` });
      });
    }
  };

  // Get Object Containing List of all filters
  vm.getFiltersObject = function () {
    return {
      areaFilter: vm.areaFilter,
      teamFilter: vm.teamFilter,
      deploymentFilter: vm.deploymentFilter,
      productTypeFilter: vm.productTypeFilter,
      createdByFilter: vm.createdByFilter,
      programFilter: vm.programFilter,
      statusTypeFilter: vm.statusTypeFilter,
      labelFilter: vm.labelFilter,
      startTimeAfterFilter: vm.startTimeAfterFilter,
      endTimeBeforeFilter: vm.endTimeBeforeFilter,
      emptyDeploymentsFilter: vm.emptyDeploymentsFilter,
      sharedBookingsFilter: vm.sharedBookingsFilter
    };
  };

  // Update Document Title Based on Filters
  // --------------------------------------
  vm.updatePageTitle = async function () {
    var filterAttributes = [];
    if (vm.programFilter) filterAttributes.push('Program: ' + findArtifact(vm.allPrograms, vm.programFilter).name);
    if (vm.areaFilter) filterAttributes.push('RA: ' + findArtifact(vm.allAreas, vm.areaFilter).name);
    if (vm.teamFilter) filterAttributes.push('Team: ' + findArtifact(vm.allTeams, vm.teamFilter).name);
    if (vm.statusTypeFilter) filterAttributes.push(`Status: ${vm.statusTypeFilter}`);
    if (vm.startTimeAfterFilter) filterAttributes.push(`Started after: ${vm.startTimeAfterFilter}`);
    if (vm.endTimeBeforeFilter) filterAttributes.push(`Ended before: ${vm.endTimeBeforeFilter}`);
    if (vm.deploymentFilter) {
      if (vm.artifactType === 'Deployment') {
        filterAttributes.push(`Deployment Name contains: ${vm.deploymentFilter}`);
      } else {
        filterAttributes.push('Deployment: ' + findArtifact(vm.allDeployments, vm.deploymentFilter).name);
      }
    }
    if (vm.productTypeFilter) filterAttributes.push('Product-Type: ' + findArtifact(vm.allProductTypes, vm.productTypeFilter).name);
    if (vm.labelFilter) filterAttributes.push('Label: ' + findArtifact(vm.allLabels, vm.labelFilter).name);
    if (vm.createdByFilter) filterAttributes.push(`Created By: ${vm.createdByFilter}`);
    if (vm.emptyDeploymentsFilter) filterAttributes.push('Empty Deployments shown');
    if (vm.sharedBookingsFilter) filterAttributes.push('Shared Bookings shown');

    var baseTitle = (env === 'development') ? 'DEV: ' : ''; // eslint-disable-line no-undef
    document.title = `${baseTitle}DTT ${vm.artifactType}s`;
    if (filterAttributes.length > 0) document.title += ` for ${filterAttributes.join(', ')}`;
  };

  // Update URL Params, Page Title and Visible-Artifacts for specified filter
  vm.updateViewForFilter = function (filterParam, filterValue, isSearchField) {
    if (filterParam === 'programFilter') vm.areaFilter = undefined;
    if (filterParam === 'areaFilter' && filterValue) {
      vm.selectedRA = true;
      vm.associatedArea = vm.allAreas.find(area => area._id === filterValue);
      vm.programFilter = vm.associatedArea.program_id;
      $('#programFilterSelect').val(`string:${vm.programFilter}`).trigger('change');
      $state.go('.', { areaFilter: filterValue, programFilter: vm.programFilter });
    } else {
      $state.go('.', { [filterParam]: filterValue });
    }
    vm.updatePageTitle();
    if (isSearchField) {
      vm.filterTableByArtifactName(filterValue);
    } else {
      vm.setVisibleArtifacts();
    }
  };

  vm.filterTableByArtifactName = function (filterValue) {
    filterValue = filterValue || '';
    $('.table').DataTable().columns(0).search(filterValue).draw(); // eslint-disable-line
  };

  vm.updateFilterOptions = function () {
    // Give team program_id using area reference so that filtering will work with that key
    if (vm.allTeams && vm.allAreas) {
      vm.allTeams.forEach(function (team) {
        var associatedArea = vm.allAreas.find(area => area._id === team.area_id);
        if (associatedArea) team.program_id = associatedArea.program_id;
      });
    }

    // Reset filters to full options
    resetFilter('areaFilter', vm.allAreas);
    resetFilter('teamFilter', vm.allTeams);
    resetFilter('deploymentFilter', vm.allDeployments);

    // Reduce Dropdown Options based on other Artifact dropdown selection
    if (vm.programFilter) {
      reduceFilterOptions('areaFilter', vm.allAreas, 'program_id', 'programFilter');
      reduceFilterOptions('teamFilter', vm.allTeams, 'program_id', 'programFilter');
      reduceFilterOptions('deploymentFilter', vm.allDeployments, 'program_id', 'programFilter');
    }
    if (vm.areaFilter) {
      reduceFilterOptions('teamFilter', vm.allTeams, 'area_id', 'areaFilter');
      reduceFilterOptions('deploymentFilter', vm.allDeployments, 'area_id', 'areaFilter');
    }
  };

  function resetFilter(optName, artifactList) {
    if (vm.mainFilterOptions) vm.filterOptions = vm.mainFilterOptions;
    if (vm.additionalFilterOptions) vm.filterOptions = vm.additionalFilterOptions;
    var index = vm.filterOptions.findIndex(f => f.name === optName);
    if (index >= 0) vm.filterOptions[index].options = artifactList;
  }

  function reduceFilterOptions(optName, artifactList, optKey, filterKey) {
    if (vm.mainFilterOptions) {
      var i = vm.mainFilterOptions.findIndex(f => f.name === optName);
      if (i >= 0) vm.mainFilterOptions[i].options = artifactList.filter(options => options[optKey] === vm[filterKey]);
    }
    var index = vm.filterOptions.findIndex(f => f.name === optName);
    if (index >= 0) vm.filterOptions[index].options = artifactList.filter(options => options[optKey] === vm[filterKey]);
  }

  // Custom Filter On-Change Handler
  vm.customFilterChange = function () {
    if (vm.customFilterId) {
      var customFilter = findArtifact(vm.customFilters, vm.customFilterId);
      updateFilters(customFilter.parameters);
    }
  };

  // Custom Filter Clear Button Click Handler
  vm.customFilterClear = function () {
    vm.customFilterId = undefined;
    updateFilters();
  };

  // Update Selected Filters
  function updateFilters(filtersList = {}) {
    vm.programFilter = filtersList.programFilter;
    vm.areaFilter = filtersList.areaFilter;
    vm.teamFilter = filtersList.teamFilter;
    vm.deploymentFilter = filtersList.deploymentFilter;
    vm.productTypeFilter = filtersList.productTypeFilter;
    vm.createdByFilter = filtersList.createdByFilter;
    vm.statusTypeFilter = filtersList.statusTypeFilter;
    vm.labelFilter = filtersList.labelFilter;
    vm.startTimeAfterFilter = filtersList.startTimeAfterFilter;
    vm.endTimeBeforeFilter = filtersList.endTimeBeforeFilter;
    vm.emptyDeploymentsFilter = filtersList.emptyDeploymentsFilter;
    vm.sharedBookingsFilter = filtersList.sharedBookingsFilter;
    $state.go('.', vm.getFiltersObject());
    $('#programFilterSelect').val(`string:${vm.programFilter}`).trigger('change');
    $('#areaFilterSelect').val(`string:${vm.areaFilter}`).trigger('change');
    $('#teamFilterSelect').val(`string:${vm.teamFilter}`).trigger('change');
    $('#deploymentFilterSelect').val(`string:${vm.deploymentFilter}`).trigger('change');
    $('#productTypeFilterSelect').val(`string:${vm.productTypeFilter}`).trigger('change');
    $('#labelFilterSelect').val(`string:${vm.labelFilter}`).trigger('change');
    $('#createdByFilterSelect').val(`string:${vm.createdByFilter}`).trigger('change');
    $('#statusTypeFilterSelect').val(`string:${vm.statusTypeFilter}`).trigger('change');
    $('#emptyDeploymentsFilterSelect').val(`string:${vm.emptyDeploymentsFilter}`).trigger('change');
    $('#sharedBookingsFilterSelect').val(`string:${vm.sharedBookingsFilter}`).trigger('change');
    vm.setVisibleArtifacts();
    vm.updatePageTitle();
  }

  $(function () { // On Document Load
    // Setting RA Preference
    if (vm.areaFilter) {
      if (!$('#filters-panel').is(':visible')) vm.toggleFilterVisibility();
      vm.updateViewForFilter('areaFilter', vm.areaFilter);
    }
  });
  // Show / Hide Filter Options
  vm.toggleFilterVisibility = function () {
    $('#filter-toggle-button').html(($('#filters-panel').is(':visible')) ? 'Show Filters' : 'Hide Filters');
    vm.showNumResultsFound = !vm.showNumResultsFound;
    $('#filters-panel').slideToggle('slow');
  };

  // Return string with first letter in lowercase
  vm.firstLetterLowerCase = function (string) {
    return string.charAt(0).toLowerCase() + string.slice(1);
  };

  // Update Page-Title, Filters and Artifact Visibility if URL params exist
  if (
    vm.programFilter || vm.statusTypeFilter || vm.deploymentFilter || vm.productTypeFilter || vm.teamFilter || vm.areaFilter ||
    vm.createdByFilter || vm.startTimeAfterFilter || vm.endTimeBeforeFilter || vm.emptyDeploymentsFilter || vm.sharedBookingsFilter
  ) {
    vm.setVisibleArtifacts();
    vm.toggleFilterVisibility();
    vm.updatePageTitle();
  }
  return module;
};

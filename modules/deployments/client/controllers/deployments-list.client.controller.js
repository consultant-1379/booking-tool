import { saveAs } from 'file-saver';
import _ from 'lodash';
import { generateEmailElement, userCompare } from '../../../core/client/controllers/helpers.client.controller';
var jsonExport = require('jsonexport');
var $ = require('jquery');
var moment = require('moment');
var commonController = require('../../../core/client/controllers/common-list.client.controller');
var filtersController = require('../../../core/client/controllers/filters.client.controller');

DeploymentsListController.$inject = [
  'Authentication', '$state', '$scope', '$compile', '$window', '$timeout', 'Notification', 'allDeployments',
  'allAreas', 'allPrograms', 'allTeams', 'allProductTypes', 'allHardware', 'allUsers', 'allLabels', 'allDeploymentLogs',
  'allUserFilters', 'programFilter', 'areaFilter', 'teamFilter', 'statusTypeFilter', 'deploymentFilter', 'createdByFilter', 'labelFilter',
  'productTypeFilter'
];
export default function DeploymentsListController(
  Authentication, $state, $scope, $compile, $window, $timeout, Notification, allDeployments,
  allAreas, allPrograms, allTeams, allProductTypes, allHardware, allUsers, allLabels, allDeploymentLogs,
  allUserFilters, programFilter, areaFilter, teamFilter, statusTypeFilter, deploymentFilter, createdByFilter, labelFilter,
  productTypeFilter
) {
  document.title = window.documentOriginalTitle + ' Deployments'; // Set Page-Title
  var vm = this;
  vm.currentUser = allUserFilters.filter(user => user.username === Authentication.user.username)[0]; // Set Active User
  vm.artifactType = 'Deployment';
  vm.artifactTypeLower = vm.artifactType.toLowerCase() + 's';
  vm.resourcePath = `/${vm.artifactTypeLower}`;
  // Artifacts
  vm.allAreas = _.clone(allAreas);
  vm.allPrograms = _.clone(allPrograms);
  vm.allTeams = _.clone(allTeams);
  vm.allLogs = _.clone(allDeploymentLogs);
  vm.allLabels = _.clone(allLabels);
  vm.allProductTypes = _.clone(allProductTypes);
  vm.allDeployments = _.clone(allDeployments);
  vm.allStatusTypes = [
    { name: 'In Use', _id: 'In Use' },
    { name: 'In Review', _id: 'In Review' },
    { name: 'Blocked/In Maintenance', _id: 'Blocked/In Maintenance' },
    { name: 'Free', _id: 'Free' },
    { name: 'Booking Disabled', _id: 'Booking Disabled' }
  ];
  vm.customFilters = vm.currentUser.filters ? vm.currentUser.filters.filter(f => f.artifactType === 'deployment') : [];
  var allCreators = [];

  // Filters
  vm.programFilter = programFilter;
  vm.raPreference = (vm.currentUser.area_id) ? allAreas.filter(area => area._id === vm.currentUser.area_id)[0] : '';
  vm.areaFilter = (vm.raPreference && !areaFilter) ? vm.raPreference._id : areaFilter;
  vm.teamFilter = teamFilter;
  vm.statusTypeFilter = statusTypeFilter;
  vm.deploymentFilter = deploymentFilter;
  vm.createdByFilter = createdByFilter;
  vm.labelFilter = labelFilter;
  vm.productTypeFilter = productTypeFilter;
  vm.numArtifactsFound = vm.allDeployments.length;
  allDeployments = allDeployments.map(function (deployment) {
    // Mapping dependant Artifacts to a Deployment
    deployment.area = allAreas.find(area => area._id === deployment.area_id);
    deployment.program = allPrograms.find(program => program._id === deployment.program_id);
    deployment.team = allTeams.find(team => team._id === deployment.team_id);
    deployment.spocUsers = [];
    deployment.spocUser_ids.forEach(function (spocUserId) {
      deployment.spocUsers.push(allUsers.find(user => user._id === spocUserId));
    });
    deployment.history = allDeploymentLogs.find(log => log.associated_id === deployment._id);
    // Mapping additional attributes to each Product within a Deployment
    deployment.products.map(async function (product, pIndex) {
      product.productIndex = pIndex;
      product.product_type_id = await allProductTypes.find(pt => pt.name === product.product_type_name)._id;
      product.hardware = await allHardware.filter(hardware => product.hardware_ids.includes(hardware._id));
      return product;
    });
    if (deployment.timebox_data && deployment.timebox_data.timebox) {
      var timebox = moment(deployment.timebox_data.timebox, 'YYYY-MM-DD');
      var todaysDate = moment();
      var daysRemaining = timebox.diff(todaysDate, 'days');
      deployment.timebox_data.time_remaining = (String(daysRemaining).includes('-')) ? 0 : daysRemaining;
    }
    // Populating allUniqueCreatedByUsers array
    var creator = (deployment.history) ? deployment.history.createdBy.displayName : null;
    if (creator && !allCreators.includes(creator)) {
      allCreators.push(creator);
    }
    return deployment;
  });
  vm.visibleArtifacts = allDeployments;

  vm.allCreatedByUsers = allCreators.map(creator => { return { _id: creator, name: creator }; });
  vm.allCreatedByUsers.sort(userCompare);

  // Filter Dropdown Options
  vm.filterOptions = [
    { heading: 'Program', name: 'programFilter', options: vm.allPrograms },
    { heading: 'RA', name: 'areaFilter', options: vm.allAreas },
    { heading: 'Team', name: 'teamFilter', options: vm.allTeams },
    { heading: 'Status', name: 'statusTypeFilter', options: vm.allStatusTypes },
    { heading: 'Product-Type', name: 'productTypeFilter', options: vm.allProductTypes },
    { heading: 'Label', name: 'labelFilter', options: vm.allLabels },
    { heading: 'Created By', name: 'createdByFilter', options: vm.allCreatedByUsers }
  ];

  // Set Visible Deployments by those that intersect each filter
  vm.setVisibleArtifacts = function () {
    vm.updateFilterOptions();
    var filterAttributes = [
      { value: vm.areaFilter, key: 'area_id' },
      { value: vm.programFilter, key: 'program_id' },
      { value: vm.teamFilter, key: 'team_id' },
      { value: vm.statusTypeFilter, key: 'status' },
      { value: vm.createdByFilter, key: 'history.createdBy.displayName' },
      { value: vm.labelFilter, key: 'label_ids' },
      { value: vm.productTypeFilter, key: 'products', childEle: 'product_type_id' }
    ];

    vm.visibleArtifacts = vm.getFilteredArtifacts(allDeployments, filterAttributes);
    vm.numArtifactsFound = vm.visibleArtifacts.length;
    $timeout(function () {
      if ($.fn.DataTable.isDataTable('.table')) {
        $('.table').DataTable().clear().rows.add(vm.visibleArtifacts).draw(); // eslint-disable-line new-cap
      }
      vm.filterTableByArtifactName();
    });
  };

  vm.dataTableColumns = [
    {
      title: 'Name',
      width: '14%',
      data: null,
      render: function (data) {
        var htmlElement = `<a ui-sref="deployments.view({ deploymentId: '${data._id}' })">${data.name}</a>`;
        return $compile(htmlElement)($scope)[0].outerHTML;
      }
    },
    {
      title: 'Products',
      width: '14%',
      data: null,
      render: function (data) {
        if (data.products && data.products.length) {
          var output = '';
          data.products.forEach(function (product) {
            var htmlElement = `<div class="list-label clickable">
                                <a ui-sref="productTypes.view({ productTypeId: '${product.product_type_id}' })">
                                  ${product.product_type_name}
                                </a>
                              </div>`;
            output += $compile(htmlElement)($scope)[0].outerHTML;
          });
          return output;
        }
      }
    },
    {
      title: 'Program',
      width: '10%',
      data: null,
      render: function (data) {
        if (data.program_id) {
          var htmlElement = `<a ui-sref="programs.view({ programId: '${data.program_id}' })">${data.program.name}</a>`;
          return $compile(htmlElement)($scope)[0].outerHTML;
        }
      }
    },
    {
      title: 'RA',
      width: '10%',
      data: null,
      render: function (data) {
        if (data.area_id) {
          var htmlElement = `<a ui-sref="areas.view({ areaId: '${data.area_id}' })">${data.area.name}</a>`;
          return $compile(htmlElement)($scope)[0].outerHTML;
        }
      }
    },
    {
      title: 'Team',
      width: '7%',
      data: null,
      render: function (data) {
        if (data.team_id) {
          var htmlElement = `<a ui-sref="teams.view({ teamId: '${data.team_id}' })">${data.team.name}</a>`;
          return $compile(htmlElement)($scope)[0].outerHTML;
        }
      }
    },
    {
      title: 'Status',
      data: 'status',
      width: '5%'
    },
    {
      title: 'Timebox <i class="ebIcon ebIcon_info" title="Displayed in Day(s) Remaining and Timebox information is updated when a Deployment is edited"></i>',
      width: '7%',
      data: null,
      render: function (data) {
        if (data.timebox_data && data.timebox_data.timebox) {
          var htmlElement = `<p>${data.timebox_data.time_remaining}</p>`;
          return $compile(htmlElement)($scope)[0].outerHTML;
        }
      }
    },
    {
      title: 'SPOC(s)',
      width: '10%',
      data: null,
      render: function (data) {
        return (data.spocUser_ids.length) ? generateEmailElement('Deployment', data.name, data.spocUsers) : '-';
      }
    },
    {
      title: 'Last Modified',
      width: '7%',
      data: null,
      render: function (data) {
        var updates = (data.history) ? data.history.updates : [];
        if (updates.length) {
          var modifiedBy = updates[updates.length - 1].updatedBy.displayName;
          if (!modifiedBy) modifiedBy = 'UNKNOWN USER';
          var lastModified = moment(updates[updates.length - 1].updatedAt).format('YYYY-MM-DD');
          var htmlElement = `<div >${lastModified} <i class="ebIcon ebIcon_info" title="By: ${modifiedBy}"></i></div>`;
          return $compile(htmlElement)($scope)[0].outerHTML;
        }
      }
    },
    {
      title: 'Actions',
      orderable: false,
      searchable: false,
      width: '240px',
      data: null,
      render: function (data) {
        var isCreator = (data.history && (data.history.createdBy.username === Authentication.user.username));

        var bookingElement = (Authentication.isAllowed('/bookings', 'view-page', isCreator)) ? `<a class="btn btn-sm btn-book" ui-sref="bookings.calendar({ programFilter: '${data.program_id}', areaFilter: '${data.area_id}', deploymentFilter: '${data._id}' })">Bookings</a>` : '<a></a>'; // eslint-disable-line max-len
        var compiledBooking = $compile(bookingElement)($scope)[0].outerHTML;

        var viewElement = `<a class="btn btn-sm btn-info" ui-sref="deployments.view({ deploymentId: '${data._id}' })">View</a>`;
        var compiledView = $compile(viewElement)($scope)[0].outerHTML;

        var editElement = (Authentication.isAllowed(vm.resourcePath, 'put', isCreator)) ? `<a class="btn btn-sm btn-primary" ui-sref="deployments.edit({ deploymentId: '${data._id}' })">Edit</a>` : '<a></a>';
        var compiledEdit = $compile(editElement)($scope)[0].outerHTML;

        var deleteElement = (Authentication.isAllowed(vm.resourcePath, 'delete', isCreator)) ? '<a class="delete-button btn btn-sm btn-danger">Delete</a>' : '<a></a>'; // No compile needed on a non-angular element

        return `${compiledBooking}&nbsp;${compiledView}&nbsp;${compiledEdit}&nbsp;${deleteElement}`;
      }
    }
  ];

  commonController($scope, $window, Authentication, Notification, vm);
  filtersController($scope, $window, $state, $timeout, Notification, vm);

  vm.exportData = function () {
    var jsonObject = getDeploymentsData();
    var options = { fillGaps: true };
    jsonExport(jsonObject, options, function (err, csvData) {
      if (err) {
        Notification.error({
          message: err.message,
          title: '<i class="glyphicon glyphicon-remove"></i> Failed to Export Data!'
        });
        return;
      }
      csvData = updateHeaders(csvData);
      var blob = new Blob([csvData], { type: 'text/csv;charset=utf-8' });
      saveAs(blob, 'dtt_deployments_data.csv');
    });
  };

  function getDeploymentsData() {
    var finalDataOutput = [];
    var deploymentsData = _.cloneDeep(vm.visibleArtifacts);
    if (vm.filterDeploymentName) {
      deploymentsData = deploymentsData.filter(deployment => deployment.name.includes(vm.filterDeploymentName));
    }
    deploymentsData.forEach(function (deployment) {
      deployment = JSON.parse(angular.toJson(deployment));

      // Bind data to Deployment that doesnt exist in the list table
      deployment = getAdditionalExportData(deployment);

      // Prepare Product data for export
      deployment.products = deployment.products.map(function (product) {
        var productData = product.links.map(link => link.link_name);
        product.Data = (productData.length) ? productData.join(', ') : '-';

        var productHardwareNames = product.hardware.map(hardwareObj => hardwareObj.name);
        product.HardwareNames = (productHardwareNames.length) ? productHardwareNames.join(', ') : '-';

        product.purpose = (product.purpose) ? product.purpose : '-';
        product = _.omit(product, ['productIndex', 'hardware_ids', 'hardware', 'links', 'product_type_id']);
        return product;
      });

      // Map Label Ids to Label Names for Deployments
      var allFoundLabels = allLabels.filter(label => deployment.label_ids.includes(label._id));
      deployment.allLabelsNames = allFoundLabels.map(label => label.name);

      // Adding the data to final data output
      var deploymentData = {
        Deployment: deployment.name,
        Status: deployment.status,
        Purpose: deployment.purpose || '-',
        jira_issues: (deployment.jira_issues) ? deployment.jira_issues.join(', ') || '-' : '-',
        spoc: deployment.spoc || '-',
        Labels: (deployment.allLabelsNames) ? deployment.allLabelsNames.join(', ') || '-' : '-',
        Program: deployment.program.name,
        Area: deployment.area.name,
        Team: (deployment.team) ? deployment.team.name : '-',
        Product: deployment.products
      };

      finalDataOutput.push(deploymentData);
    });
    return finalDataOutput;
  }
  $(function () { // On Document Load
    vm.setFilterSelect2(vm.filterOptions);
  });

  function getAdditionalExportData(deployment) {
    deployment.spoc = '';
    var depSpocUsers = [];
    if (deployment.spocUsers) {
      deployment.spocUsers.forEach(function (spocUser) {
        depSpocUsers.push(`${spocUser.displayName} (${spocUser.username})`);
      });
      deployment.spoc = depSpocUsers.join(',');
    }
    return deployment;
  }

  function updateHeaders(csvInput) {
    var headerMap = {
      'Product.HardwareNames': 'Product Hardware',
      'Product.Data': 'Product Data',
      'Product.product_type_name': 'Product Type',
      'Product.purpose': 'Product Notes',
      'Product.flavour_name': 'Product Flavour',
      'Product.location': 'Product Location',
      'Product.infrastructure': 'Product Infrastructure',
      'Product.jenkinsJob': 'Product Jenkins Job',
      jira_issues: 'JIRA Issues',
      spoc: 'SPOC(s)'
    };
    for (var key in headerMap) {
      if (Object.prototype.hasOwnProperty.call(headerMap, key)) {
        csvInput = csvInput.replace(key, headerMap[key]);
      }
    }
    return csvInput;
  }
}

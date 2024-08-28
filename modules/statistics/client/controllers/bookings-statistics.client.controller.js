import $ from 'jquery';
import _ from 'lodash';
window.jQuery = $;
window.$ = $;
require('bootstrap-datetime-picker');
var Chart = require('chart.js');
var Moment = require('moment');
var MomentRange = require('moment-range');
var colormap = require('colormap');
var jsonExport = require('jsonexport');
var commonListController = require('../../../core/client/controllers/common-list.client.controller');
var filtersController = require('../../../core/client/controllers/filters.client.controller');
var moment = MomentRange.extendMoment(Moment);
BookingStatisticsListController.$inject = [
  '$timeout', '$compile', '$scope', '$state', '$http', '$window', '$location', 'Authentication', 'Notification',
  'allTeams', 'allAreas', 'allPrograms', 'allUserFilters', 'allDeployments', 'allProductTypes', 'teamFilter',
  'deploymentFilter', 'productTypeFilter', 'areaFilter', 'programFilter', 'startTimeAfterFilter', 'endTimeBeforeFilter',
  'emptyDeploymentsFilter', 'sharedBookingsFilter', 'statisticsFocus'
];
export default function BookingStatisticsListController(
  $timeout, $compile, $scope, $state, $http, $window, $location, Authentication, Notification,
  allTeams, allAreas, allPrograms, allUserFilters, allDeployments, allProductTypes, teamFilter,
  deploymentFilter, productTypeFilter, areaFilter, programFilter, startTimeAfterFilter, endTimeBeforeFilter,
  emptyDeploymentsFilter, sharedBookingsFilter, statisticsFocus
) {
  document.title = window.documentOriginalTitle + ' Booking Statistics'; // Set Page-Title
  var vm = this; // Initialize angular controller
  var statisticsModal;
  var statisticsCharts = [];
  var statisticsColors = colormap({ colormap: 'rainbow-soft', nshades: 11 }).slice(0, 10).reverse(); // Only Top 10 colors for Pie Charts
  var statisticsWideGraphs = ['line', 'bar'];
  vm.artifactType = 'Statistic';
  vm.artifactTypeLower = vm.artifactType.toLowerCase() + 's';
  vm.currentUser = allUserFilters.filter(user => user.username === Authentication.user.username)[0]; // Set Active User
  vm.customFilters = vm.currentUser.filters ? vm.currentUser.filters.filter(f => f.artifactType === 'statistic') : [];
  // Artifacts
  vm.allDeployments = _.clone(allDeployments);
  vm.allProductTypes = _.clone(allProductTypes);
  vm.allTeams = _.clone(allTeams);
  vm.allAreas = _.clone(allAreas);
  vm.allPrograms = _.clone(allPrograms);
  vm.allBooleanOptions = [{ _id: 'true', name: 'Show' }];
  // Filters
  vm.teamFilter = teamFilter;
  vm.deploymentFilter = deploymentFilter;
  vm.productTypeFilter = productTypeFilter;
  vm.raPreference = (vm.currentUser.area_id) ? allAreas.filter(area => area._id === vm.currentUser.area_id)[0] : '';
  vm.areaFilter = (vm.raPreference && !areaFilter) ? vm.raPreference._id : areaFilter;
  vm.programFilter = programFilter;
  vm.startTimeAfterFilter = startTimeAfterFilter;
  vm.endTimeBeforeFilter = endTimeBeforeFilter;
  vm.emptyDeploymentsFilter = emptyDeploymentsFilter;
  vm.sharedBookingsFilter = sharedBookingsFilter;

  // DateTime Formats
  // ----------------
  var dateTimeFormat = 'YYYY-MM-DD';

  /* *******************************
   FILTERS & URL-PARAMS RELATED CODE
   ******************************* */
  // Filter Dropdown Options
  vm.filterOptions = [
    { heading: 'Started After', name: 'startTimeAfterFilter', options: 'datepicker' },
    { heading: 'Ended Before', name: 'endTimeBeforeFilter', options: 'datepicker' },
    { heading: 'Program', name: 'programFilter', options: vm.allPrograms },
    { heading: 'RA', name: 'areaFilter', options: vm.allAreas },
    { heading: 'Team', name: 'teamFilter', options: vm.allTeams },
    { heading: 'Deployment', name: 'deploymentFilter', options: vm.allDeployments },
    { heading: 'Product-Type', name: 'productTypeFilter', options: vm.allProductTypes },
    { heading: 'Empty Deployments', name: 'emptyDeploymentsFilter', options: vm.allBooleanOptions },
    { heading: 'Shared Bookings', name: 'sharedBookingsFilter', options: vm.allBooleanOptions }
  ];

  // Set visible Bookings by those that intersect each filter
  vm.setVisibleArtifacts = async function () {
    vm.updateFilterOptions();
    vm.globalStatistics = await importStatistics();
    vm.visibleArtifacts = vm.globalStatistics.deployments;

    $timeout(function () {
      if ($.fn.DataTable.isDataTable('#statistics-table')) {
        $('#statistics-table').DataTable().clear().rows.add(vm.visibleArtifacts).draw(); // eslint-disable-line new-cap
      }
    });
  };

  /* ***************************
   DATE-TIME PICKER RELATED CODE
   ************************** */

  // DateTime Picker Constuctor
  // --------------------------
  var dateTimePickerOptions = {
    autoclose: true,
    minView: 'month',
    maxView: 'year',
    format: 'yyyy-mm-dd'
  };

  // DateTime Picker Initializer
  // ---------------------------
  async function initializeDateTimePickers() {
    // Clearing DateTimePicker
    $('#startTimeAfterFilterPicker').datetimepicker('remove');
    $('#endTimeBeforeFilterPicker').datetimepicker('remove');

    // Setting DateTimePicker
    $('#startTimeAfterFilterPicker').datetimepicker(dateTimePickerOptions);
    $('#endTimeBeforeFilterPicker').datetimepicker(dateTimePickerOptions);

    // Setting today as last selectable day
    $('#startTimeAfterFilterPicker').datetimepicker('setEndDate', moment().format(dateTimeFormat));
    $('#endTimeBeforeFilterPicker').datetimepicker('setEndDate', moment().format(dateTimeFormat));

    // DateTimePicker on-change handlers
    $('#startTimeAfterFilter').change(function () { datePickerChangeHandler('startTimeAfterFilter'); });
    $('#endTimeBeforeFilter').change(function () { datePickerChangeHandler('endTimeBeforeFilter'); });
  }

  async function datePickerChangeHandler(id) {
    vm[id] = getFormattedTimePickerMoment(`#${id}Picker`);
    vm.updateViewForFilter(id, vm[id]);
    await vm.setVisibleArtifacts();
    _.defer(() => $scope.$apply());
  }

  function getFormattedTimePickerMoment(elemId) {
    return moment($(elemId).data('datetimepicker').getDate().setHours(0, 0, 0, 0)).format(dateTimeFormat);
  }

  async function importStatistics() {
    var response = await $http.get('/api/statistics/bookings', {
      params: {
        deploymentFilter: vm.deploymentFilter,
        productTypeFilter: vm.productTypeFilter,
        areaFilter: vm.areaFilter,
        teamFilter: vm.teamFilter,
        programFilter: vm.programFilter,
        startTimeAfterFilter: vm.startTimeAfterFilter,
        endTimeBeforeFilter: vm.endTimeBeforeFilter,
        emptyDeploymentsFilter: vm.emptyDeploymentsFilter,
        sharedBookingsFilter: vm.sharedBookingsFilter
      }
    });
    return response.data;
  }

  vm.dataTableColumns = [
    {
      title: 'Deployment',
      data: null,
      render: function (data) {
        var htmlElement = `<a ui-sref="deployments.view({ deploymentId: '${data.deployment._id}' })">${data.deployment.name}</a>`;
        return $compile(htmlElement)($scope)[0].outerHTML;
      }
    },
    {
      title: 'Products',
      data: 'products'
    },
    {
      title: 'Program',
      data: null,
      render: function (data) {
        if (data.program) {
          var htmlElement = `<a ui-sref="programs.view({ programId: '${data.program._id}' })">${data.program.name}</a>`;
          return $compile(htmlElement)($scope)[0].outerHTML;
        }
      }
    },
    {
      title: 'RA',
      data: null,
      render: function (data) {
        if (data.area) {
          var htmlElement = `<a ui-sref="areas.view({ areaId: '${data.area._id}' })">${data.area.name}</a>`;
          return $compile(htmlElement)($scope)[0].outerHTML;
        }
      }
    },
    {
      title: 'Team',
      data: null,
      render: function (data) {
        if (data.team) {
          var htmlElement = `<a ui-sref="teams.view({ teamId: '${data.team._id}' })">${data.team.name}</a>`;
          return $compile(htmlElement)($scope)[0].outerHTML;
        }
      }
    },
    {
      title: 'Teams Booked',
      data: null,
      render: function (data) {
        if (data.teams) return data.teams.length;
      }
    },
    {
      title: 'Total Bookings',
      data: 'totalBookings'
    },
    {
      title: 'Total Duration',
      data: 'totalDuration'
    },
    {
      title: 'Avg Duration',
      data: 'averageDuration'
    },
    {
      title: 'Actions',
      orderable: false,
      searchable: false,
      width: '130px',
      data: null,
      render: function () {
        var viewTableElement = '<a class="view-statistics-button btn btn-sm btn-info">View Global Stats</a>'; // No compile needed on a non-angular element
        return `${viewTableElement}`;
      }
    }
  ];

  // Final Initializations
  commonListController($scope, $window, Authentication, Notification, vm);
  filtersController($scope, $window, $state, $timeout, Notification, vm);

  vm.openStatisticsModal = function (focusKey, deploymentId, teamId) {
    // Set up statistics attributes and url parameter
    vm.activeFocus = { key: focusKey, _id: deploymentId };
    var statisticsFocusBuilder = vm.activeFocus.key;
    if (vm.activeFocus.key === 'global') vm.statistics = vm.globalStatistics;
    else {
      // Deployment level
      if (!deploymentId) return $state.go('.', { statisticsFocus: null });
      statisticsFocusBuilder += `&${deploymentId}`;
      vm.statistics = vm.visibleArtifacts.find(artifact => artifact.deployment._id === deploymentId);
      // Team level
      if (vm.activeFocus.key === 'team') {
        if (!teamId) return $state.go('.', { statisticsFocus: null });
        statisticsFocusBuilder += `&${teamId}`;
        var teamStats = vm.statistics.teams.find(stats => stats.team._id === teamId);
        vm.statistics = _.merge(teamStats, { deployment: vm.statistics.deployment });
      }
    }
    if (!vm.statistics) return $state.go('.', { statisticsFocus: null });
    $state.go('.', { statisticsFocus: statisticsFocusBuilder });

    // Remove old Graphs and generate new ones
    $('#canvas-container').empty();
    statisticsCharts.forEach(chart => chart.destroy());
    statisticsCharts = [];
    generateStatisticsGraphs();

    // Finish
    statisticsModal.show();
    _.defer(() => $scope.$apply());
  };

  function generateStatisticsGraphs() {
    // Utilization Progress Bar
    createProgressBar('Utilization Chart', 'utilization-progress', vm.statistics.datesUtilization);
    // Daily Activity Line Chart
    createGraph('Daily Activity - # of Bookings', 'dailyActivity', 'activity', '', 'line');

    // The rest of the statistics are for Upper-Deployment and Global level statistics only
    if (vm.activeFocus.key === 'team') return;

    var dataPointHeaders = ['Total Bookings', 'Total Duration (days)', 'Average Duration (days)'];
    var artifactType = (vm.activeFocus.key === 'global') ? 'deployment' : 'team';
    var attrKeys = ['totalBookings', 'totalDuration', 'averageDuration'];

    // Deployment Usage - Multi-Bar Chart with a bar for each Data-Point Header
    createGraph(dataPointHeaders, artifactType, attrKeys, attrKeys[0], 'bar', 'Deployment Usage');
    // Global-Only - Pie Graph for each Data-Point Header
    dataPointHeaders.forEach((dpHeader, dpIndex) => createGraph(dpHeader, artifactType, attrKeys[dpIndex], attrKeys[dpIndex], 'pie'));
  }

  vm.closeStatisticsModal = function () {
    if ($location.search().statisticsFocus) $state.go('.', { statisticsFocus: null });
    vm.statistics = [];
    statisticsModal.hide();
  };

  $(async function () { // On Document Load
    vm.setFilterSelect2(vm.filterOptions);
    initializeDateTimePickers();
    await vm.setVisibleArtifacts();

    // Find Statistics Modal
    statisticsModal = $('#statistics-modal');
    // When the user clicks anywhere outside of the modal, close it
    window.onclick = function (event) {
      if (event.target === document.getElementById('statistics-modal')) {
        if (vm.activeFocus.key === 'deployment') vm.openStatisticsModal('global');
        else if (vm.activeFocus.key === 'team') vm.openStatisticsModal('deployment', vm.activeFocus._id);
        else vm.closeStatisticsModal();
      }
    };

    // Open Statistics-View Modal if statisticsFocus url param exists
    if (statisticsFocus) {
      statisticsFocus = statisticsFocus.split('&');
      if (statisticsFocus[0] === 'global') vm.openStatisticsModal(statisticsFocus[0]);
      else if (statisticsFocus[0] === 'deployment') vm.openStatisticsModal(statisticsFocus[0], statisticsFocus[1]);
      else if (statisticsFocus[0] === 'team') vm.openStatisticsModal(statisticsFocus[0], statisticsFocus[1], statisticsFocus[2]);
    }
  });

  function createProgressBar(header, elementId, progressBarData) {
    if (!progressBarData) return;
    $('#canvas-container').append($(`
      <div class="col-md-12">
        <h3 id="${elementId}-header">${header}</h3>
        <label id="${elementId}-subheader">
          ${Math.round((progressBarData.totalBookedRange / progressBarData.totalDateRange) * 100)}%
          (${progressBarData.totalBookedRange}/${progressBarData.totalDateRange}) days booked
          between: ${moment(progressBarData.firstDate).format(dateTimeFormat)} to ${moment(progressBarData.lastDate).format(dateTimeFormat)}
        </label>
        <progress value="${progressBarData.totalBookedRange}" max="${progressBarData.totalDateRange}" style="width: 0; min-width: 100%;"></progress>
      </div>
    `));
  }

  function createGraph(dataPointHeaders, artifactType, attrKeys, sortKey = '', chartType = 'bar', header) {
    // Clean up arguments
    var statObjects = (artifactType === 'dailyActivity') ? vm.statistics[artifactType] : vm.statistics[artifactType + 's'];
    if (!Array.isArray(dataPointHeaders)) dataPointHeaders = [dataPointHeaders];
    if (!Array.isArray(attrKeys)) attrKeys = [attrKeys];
    if (!header) header = dataPointHeaders.join(', ');

    // Sort the statistics for the graph
    var splitSortKey = sortKey.split('.');
    statObjects.sort(function (a, b) {
      a = (splitSortKey.length === 1) ? a[sortKey] : a[splitSortKey[0]][splitSortKey[1]];
      b = (splitSortKey.length === 1) ? b[sortKey] : b[splitSortKey[0]][splitSortKey[1]];
      if (a < b) return 1;
      return (b < a) ? -1 : 0;
    });

    // Create header and canvas elements
    var splitAttrKeys = attrKeys.map(attrKey => attrKey.split('.'));
    var elementId = splitAttrKeys.map(splitAttrKey => splitAttrKey[splitAttrKey.length - 1]).join('-') + '-' + chartType;
    $('#canvas-container').append($(`
      <div class="col-md-${statisticsWideGraphs.includes(chartType) ? '12' : '6'}">
        <h3 id="${elementId}-header">${header} ${chartType === 'pie' ? '- Top 10 Highlighted' : ''}</h3>
        <canvas id="${elementId}-canvas" width="400" height="${statisticsWideGraphs.includes(chartType) ? '1' : '2'}00"></canvas>
      </div>
    `));

    // Display chart data in canvas element
    var statisticsCanvas = document.getElementById(`${elementId}-canvas`).getContext('2d');
    var statisticsChart = new Chart(statisticsCanvas, {
      type: chartType,
      data: prepareGraphData(dataPointHeaders, artifactType, statObjects, splitAttrKeys, chartType),
      options: {
        scales: (chartType === 'pie') ? {} : {
          yAxes: [{
            ticks: {
              beginAtZero: true,
              precision: 0 // Hide Decimal Points
            }
          }]
        }
      }
    });
    statisticsCharts.push(statisticsChart);

    // Add Click Event handlers on charts for drill downs
    addChartClickEventHandlers(statisticsChart, elementId);
  }

  function prepareGraphData(dataPointHeaders, artifactType, statObjects, splitAttrKeys, chartType) {
    // Prepare the Data-Point Label names (e.g. deployment name)
    var dataPointLabels = (artifactType === 'dailyActivity') ? statObjects.map(obj => obj.dayName) : statObjects.map(obj => obj[artifactType].name);
    if (chartType === 'pie') dataPointLabels = dataPointLabels.slice(0, 10); // Only Highlight the Top 10 on pie charts
    var graphData = { labels: dataPointLabels, datasets: [] };

    splitAttrKeys.forEach(function (splitAttrKey, mapIndex) {
      // For each statistic key, populate a graph with a point for each statistic key value and their associated data point labels
      var dataset = {
        label: dataPointHeaders[mapIndex], // Not to be confused with data-point labels, this is the descriptor field to explain what the data is
        data: statObjects.map(obj => (splitAttrKey.length === 1) ? obj[splitAttrKey[0]] : obj[splitAttrKey[0]][splitAttrKey[1]]),
        backgroundColor: (chartType !== 'bar') ? statisticsColors : statisticsColors[mapIndex],
        borderColor: (chartType === 'line') ? statisticsColors : 'rgba(150, 150, 150, 1)'
      };
      if (chartType === 'line') {
        dataset.borderWidth = 4;
        dataset.fill = false;
      }
      graphData.datasets.push(dataset);
    });
    return graphData;
  }

  function addChartClickEventHandlers(statisticsChart, elementId) {
    $(`#${elementId}-canvas`).click(function (event) {
      if (vm.activeFocus.key === 'team') return; // drill down only supported from global and deployment level

      var activePoints = statisticsChart.getElementsAtEvent(event);
      if (!activePoints || !activePoints[0]) return; // no active point selected

      var chartData = activePoints[0]._chart.config.data;
      var idx = activePoints[0]._index;
      var artifactName = `${chartData.labels[idx]}`;
      if (!artifactName) return; // no artifact name found

      if (vm.activeFocus.key === 'global') {
        var foundDeploymentStats = vm.visibleArtifacts.find(deplStats => deplStats.deployment.name === artifactName);
        if (foundDeploymentStats) vm.openStatisticsModal('deployment', foundDeploymentStats.deployment._id);
      }
      if (vm.activeFocus.key === 'deployment') {
        var parentDeploymentStats = vm.visibleArtifacts.find(deplStats => deplStats.deployment._id === vm.activeFocus._id);
        if (!parentDeploymentStats) return;
        var foundTeamStats = parentDeploymentStats.teams.find(teamStats => teamStats.team.name === artifactName);
        if (foundTeamStats) vm.openStatisticsModal('team', parentDeploymentStats.deployment._id, foundTeamStats.team._id);
      }
    });
  }

  vm.exportStatisticsData = async function () {
    var response = await $http.get('/api/statistics/bookingsExport', {
      params: {
        deploymentFilter: vm.deploymentFilter,
        productTypeFilter: vm.productTypeFilter,
        areaFilter: vm.areaFilter,
        teamFilter: vm.teamFilter,
        programFilter: vm.programFilter,
        startTimeAfterFilter: vm.startTimeAfterFilter,
        endTimeBeforeFilter: vm.endTimeBeforeFilter,
        emptyDeploymentsFilter: vm.emptyDeploymentsFilter,
        sharedBookingsFilter: vm.sharedBookingsFilter
      }
    });
    // return response.data;
    var jsonObject = response.data;
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
      saveAs(blob, 'dtt_bookings_statistics_data.csv');
    });
  };

  function updateHeaders(csvInput) {
    var headerMap = {
      TotalBookings: 'Total Bookings',
      TotalDuration: 'Total Duration (Days)',
      TotalAverageDuration: 'Total Average Duration (Days)',
      UtilizationTotalBookedRange: 'Utilization Total Booked Range',
      UtilizationTotalDateRange: 'Utilization Total Date Range',
      UtilizationStartDate: 'Utilization Start Date',
      UtilizationEndDate: 'Utilization End Date',
      UtilizationPercentage: 'Utilization Percentage',
      BookingStartDate: 'Booking Start Date',
      BookingEndDate: 'Booking End Date'
    };
    for (var key in headerMap) {
      if (Object.prototype.hasOwnProperty.call(headerMap, key)) {
        csvInput = csvInput.replace(key, headerMap[key]);
      }
    }
    return csvInput;
  }
}

import _ from 'lodash';
import { removeDuplicateObjects } from '../../../core/client/controllers/helpers.client.controller';
var $ = require('jquery');
require('datatables')();
require('datatables.net-scroller')(window, $);

var dataTablesTemplate = require('../../../core/client/json/datatables_template.json');

HomeViewController.$inject = ['$scope', '$compile', 'SearchService', 'Notification', 'allLabels'];
export default function HomeViewController($scope, $compile, SearchService, Notification, allLabels) {
  var vm = this;
  var searchDeplByLabels = false;
  vm.placeholderText = 'Enter a Search-Value...';
  vm.scrollYheight = '65vh';

  vm.allArtifacts = [
    { name: 'All Artifacts' },
    { name: 'Areas', type: 'area' },
    { name: 'Bookings', type: 'booking' },
    { name: 'Deployments', type: 'deployment' },
    { name: 'Hardware', type: 'hardware' },
    { name: 'Product-Flavours', type: 'productFlavour' },
    { name: 'Product-Types', type: 'productType' },
    { name: 'Programs', type: 'program' },
    { name: 'Teams', type: 'team' },
    { name: 'Labels', type: 'label' }
  ];

  vm.allValueMatchTypes = [
    { name: 'Partial Value Match' },
    { name: 'Full Value Match', type: 'fullValue' },
    { name: 'Starts With', type: 'startsWith' },
    { name: 'Ends With', type: 'endsWith' },
    { name: 'By Label(s)', type: 'multipleLabels' }
  ];

  vm.valueSelectHandler = function () {
    vm.placeholderText = (vm.selectValueMatchType === 'multipleLabels') ? 'Enter Deployment Label(s) in a comma-separated list...' : 'Enter a Search-Value...';
  };

  vm.searchArtifacts = async function () {
    var multipleLabelsSelected = vm.selectValueMatchType === 'multipleLabels';
    var artifactIsDeployment = vm.selectArtifactType === 'deployment';
    searchDeplByLabels = (artifactIsDeployment && multipleLabelsSelected);

    if (!artifactIsDeployment && multipleLabelsSelected) {
      vm.selectArtifactType = 'deployment';
      searchDeplByLabels = true;
    }

    if (!vm.searchValue) {
      Notification.error({
        title: '<i class="glyphicon glyphicon-remove"></i> Search Error!',
        message: 'A value must be entered to perform an Artifact search.'
      });
      return;
    }

    try {
      vm.searchResults = await SearchService.query({
        searchParam: vm.searchValue,
        artifactParam: vm.selectArtifactType,
        valueMatchParam: vm.selectValueMatchType,
        caseSensitiveParam: vm.isSearchCaseSensitive
      }).$promise || 0;
    } catch (searchErr) {
      var message = searchErr.data ? searchErr.data.message : searchErr.message;
      Notification.error({
        title: '<i class="glyphicon glyphicon-remove"></i> Search Error!',
        message: `${message}`
      });
      return;
    }
    if (searchDeplByLabels) {
      var searchResultsArray = Array.from(new Set(vm.searchResults));
      vm.searchResults = [];
      searchResultsArray.forEach(async function (result) {
        var totalResults = Object.keys(result).length;
        var searchLabels = vm.searchValue.split(',').length;
        for (var i = 0; i < totalResults; i += 1) {
          if (result[i].label_ids.length >= searchLabels) vm.searchResults.push(result[i]);
        }
      });
      // Remove duplicates
      vm.searchResults = await removeDuplicateObjects(vm.searchResults);
      // Add label names
      vm.searchResults.forEach(function (deployment) {
        var allFoundLabels = allLabels.filter(lbl => deployment.label_ids.includes(lbl._id));
        deployment.allLabelNames = allFoundLabels.map(lbl => lbl.name);
      });
      var searchLabels = vm.searchValue.toUpperCase().split(',');
      vm.searchResults = vm.searchResults.filter(function (deployment) {
        return searchLabels.every(searchLabel => deployment.allLabelNames.includes(searchLabel.trim()));
      });
    }

    $scope.$apply();
    refreshAllTables();
  };

  function refreshAllTables() {
    $('.table').each(function () {
      if ($.fn.DataTable.isDataTable(this)) {
        $(this).dataTable().fnDestroy();
      }
    });

    var datatablesConstructor = {
      data: vm.searchResults,
      scrollY: vm.scrollYheight,
      columns: [
        {
          title: 'Artifact Name',
          data: null,
          render: function (data) {
            var value = (!searchDeplByLabels) ? data.parentObject.name : data.name;
            return '<strong>' + value + '</strong>';
          }
        },
        {
          title: 'Artifact Type',
          data: null,
          render: function (data) {
            if (!searchDeplByLabels) {
              var artifactType = data.parentObject.type;
              var artifactTypeReadable = artifactType.substring(0, 1).toUpperCase() + artifactType.substring(1, artifactType.length).replace(/([a-z])([A-Z])/g, '$1-$2');
              return artifactTypeReadable;
            }
            return 'Deployment';
          }
        },
        {
          title: 'Key',
          data: null,
          render: function (data) {
            return (!searchDeplByLabels) ? data.key : 'labels';
          }
        },
        {
          title: 'Value',
          data: null,
          render: function (data) {
            if (!searchDeplByLabels) {
              var value = (data.value) ? data.value.toString() : '';
              var startSearchIndex;
              if (vm.selectValueMatchType === 'endsWith') {
                startSearchIndex = vm.isSearchCaseSensitive ?
                  value.lastIndexOf(vm.searchValue) : value.toLowerCase().lastIndexOf(vm.searchValue.toLowerCase());
              } else {
                startSearchIndex = vm.isSearchCaseSensitive ?
                  value.indexOf(vm.searchValue) : value.toLowerCase().indexOf(vm.searchValue.toLowerCase());
              }
              var endSearchIndex = startSearchIndex + vm.searchValue.length;
              var valueResponse = value.slice(0, startSearchIndex) + '<strong>' +
                value.slice(startSearchIndex, endSearchIndex) + '</strong>' +
                value.slice(endSearchIndex, value.length);
              return valueResponse;
            }
            return data.allLabelNames;
          }
        },
        {
          title: 'Actions',
          width: '120px',
          data: null,
          render: function (data) {
            var artifactType = (!searchDeplByLabels) ? data.parentObject.type : 'deployment';
            var artifactId = (!searchDeplByLabels) ? data.parentObject._id : data._id;
            var viewType = '';
            var editType = '';
            var argType = '';

            switch (artifactType) {
              case 'booking':
                viewType = 's.calendar';
                editType = 's.calendar';
                argType = 'Focus';
                break;
              case 'hardware':
                viewType = '.view';
                editType = '.edit';
                argType = 'Id';
                break;
              default:
                viewType = 's.view';
                editType = 's.edit';
                argType = 'Id';
                break;
            }

            var viewElement = `<a class="btn btn-sm btn-info"
                                ui-sref="${artifactType}${viewType}({ ${artifactType}${argType}: '${artifactId}' })">
                                View
                              </a>`;
            var compiledView = $compile(viewElement)($scope)[0].outerHTML;

            var editElement = `<a class="btn btn-sm btn-primary"
                                ui-sref="${artifactType}${editType}({ ${artifactType}${argType}: '${artifactId}' })">
                                Edit
                              </a>`;
            var compiledEdit = $compile(editElement)($scope)[0].outerHTML;

            return `${compiledView}&nbsp;${compiledEdit}`;
          }
        }
      ]
    };
    $('.table').dataTable(_.merge(datatablesConstructor, dataTablesTemplate));
    $('.dataTables_scrollBody').css('height', vm.scrollYheight);
    _.defer(function () { $scope.$apply(); });
  }
}

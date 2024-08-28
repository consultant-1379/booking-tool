var _ = require('lodash');
var $ = require('jquery');
require('datatables')();
require('datatables.net-scroller')(window, $);

var dataTableTemplate = require('../../../core/client/json/datatables_template.json');

module.exports = function ($scope, $window, Authentication, Notification, vm) {
  var module = {};
  var table;
  vm.tableLoading = true;
  vm.authentication = Authentication;
  vm.isSmokeTestUser = (Authentication.user.username === 'dttadm100');
  vm.smokeTestOnly = (['teams', 'areas'].includes(vm.artifactTypeLower));
  vm.scrollYheight = '60vh';

  function refreshAllTables() {
    $('.table').each(function () {
      if ($.fn.DataTable.isDataTable(this)) {
        $(this).dataTable().fnDestroy();
      }
    });

    if (vm.artifactTypeLower === 'log') {
      // Handle for Log Tables
      prepareLogTable('#live-table', 'Last Modified', false);
      prepareLogTable('#deleted-table', 'Deleted', true);
    } else {
      // Handle for all other Tables
      var tableOptions = _.cloneDeep(dataTableTemplate);
      tableOptions.columns = vm.dataTableColumns;
      tableOptions.data = vm.visibleArtifacts;
      tableOptions.scrollY = vm.scrollYheight;
      table = $(`#${vm.artifactTypeLower}-table`).dataTable(tableOptions);
    }

    vm.tableLoading = false;
    $('.dataTables_scrollBody').css('height', vm.scrollYheight);
    $scope.$apply();
  }

  function prepareLogTable(tableElemId, actionType, isDeleted) {
    var tableOptions = _.cloneDeep(dataTableTemplate);
    tableOptions.data = vm.visibleArtifacts.filter(log => Object.keys(log).includes('deletedBy') === isDeleted);
    tableOptions.columns = _.cloneDeep(vm.dataTableColumns);
    tableOptions.columns[4].title = tableOptions.columns[4].title.replace('ACTION_TYPE', actionType);
    tableOptions.columns[5].title = tableOptions.columns[5].title.replace('ACTION_TYPE', actionType);
    tableOptions.scrollY = $(window).height() / 4;
    vm.scrollYheight = tableOptions.scrollY;
    $(tableElemId).dataTable(tableOptions);
  }

  function filterAllTables(value) {
    $('.table').DataTable().search(value).draw(); // eslint-disable-line new-cap
  }

  $(function () {
    refreshAllTables();

    $('#filter-field').on('keyup click', () => filterAllTables($('#filter-field').val()));

    $('.table').on('click', '.delete-button', function (e) {
      e.stopPropagation();
      var tr = $(this).parents('tr');
      var row = table.api().row(tr);
      var artifact = row.data();
      var artifactName = artifact.name;

      if ($window.confirm(`Are you sure you want to delete this ${vm.artifactType} "${artifactName}"?`)) {
        artifact.$delete()
          .then(successCallback)
          .catch(errorCallback);
      }

      function successCallback() {
        vm.visibleArtifacts.splice(vm.visibleArtifacts.indexOf(artifact), 1);
        Notification.success({ message: `<i class="glyphicon glyphicon-ok"></i> ${vm.artifactType} "${artifactName}" deleted successfully!` });
        row.remove().draw();
      }

      function errorCallback(res) {
        var message = res.data ? res.data.message : res.message;
        Notification.error({
          message: message.replace(/\n/g, '<br/>'),
          title: `<i class="glyphicon glyphicon-remove"></i> ${vm.artifactType} "${artifactName}" deletion failed!`,
          delay: 7000
        });
      }
    });

    $('.table').on('click', '.view-booking-button', function (e) {
      e.stopPropagation();
      var tr = $(this).parents('tr');
      var row = table.api().row(tr);
      var booking = row.data();
      vm.initializeBookingViewModal(booking._id);
    });

    $('.table').on('click', '.view-statistics-button', function (e) {
      e.stopPropagation();
      var tr = $(this).parents('tr');
      var row = table.api().row(tr);
      var statistics = row.data();
      vm.openStatisticsModal('deployment', statistics.deployment._id);
    });
  });
  return module;
};

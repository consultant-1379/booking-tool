import _ from 'lodash';
import { historyFormatDate } from '../../../core/client/controllers/helpers.client.controller';
import { getObjectLogWrapper } from '../../client/config/history.client.routes';
var $ = require('jquery');
var moment = require('moment');
require('datatables')();
require('datatables.net-scroller')(window, $);
var dateFormat = require('dateformat');
var dataTableTemplate = require('../../../core/client/json/datatables_template.json');


HistoryViewController.$inject = [
  '$scope', '$compile', '$state', '$stateParams', '$window', '$location', '$timeout',
  'log', 'allDeployments', 'emailFocus'
];
export default function HistoryViewController(
  $scope, $compile, $state, $stateParams, $window, $location, $timeout,
  log, allDeployments, emailFocus
) {
  var vm = this;
  var maxUpdatesToLoad = 100;
  log = log[0];
  $scope.loadUpdates = function () {
    var totalUpdatesToLoad = Math.min(vm.unloadedUpdates.length, maxUpdatesToLoad);
    var loadedUpdatesChunk = vm.unloadedUpdates.splice(0, totalUpdatesToLoad);
    vm.loadedUpdates = vm.loadedUpdates.concat(loadedUpdatesChunk);
    $scope.finishedLoading = (vm.unloadedUpdates.length === 0);
  };
  $scope.range = _.range;
  var table;
  var emailModal;

  vm.log = parseLogData(log, false);
  vm.log.updates = sortOfLogData(_.cloneDeep(vm.log.updates));
  vm.objType = $stateParams.objType.substring(0, $stateParams.objType.length - 1);
  vm.htmlViewArtifact = (vm.objType !== 'hardware') ? `${vm.objType}s` : vm.objType;
  // Dynamically set object type name: providing capital first letter and adding a hyphen before additional uppercase letters.
  vm.objectType = vm.objType.substring(0, 1).toUpperCase() + vm.objType.substring(1, vm.objType.length).replace(/([a-z])([A-Z])/g, '$1-$2');
  vm.bookingEmails = log.emails;
  vm.unloadedUpdates = _.cloneDeep(vm.log.updates);
  vm.loadedUpdates = [];
  vm.searchValue = '';
  $scope.loadUpdates();

  vm.successIcon = '<i class="fas fa-check-circle fa-lg"></i>';
  vm.errorIcon = '<i class="fas fa-times-circle fa-lg"></i>';

  vm.formatDate = function formatDate(dateTimeString) {
    return historyFormatDate(dateTimeString, 'view');
  };

  vm.downloadJSONFile = function (jsonObj, fileName) {
    var tempElement = document.createElement('a');
    tempElement.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(JSON.stringify(jsonObj, null, '\t')));
    tempElement.setAttribute('download', fileName);
    tempElement.style.display = 'none';
    document.body.appendChild(tempElement);
    tempElement.click();
    document.body.removeChild(tempElement);
  };

  vm.restoreObject = async function (jsonObj) {
    log = log[0] || log;
    var alertMessage = `Are you sure you want to restore this ${vm.objType}?`;
    if (log.deletedAt) {
      alertMessage += 'If restored, it will be created with a new id.';
    }
    if ($window.confirm(alertMessage)) {
      var crudState = (log.deletedAt || vm.objType === 'label') ? 'create' : 'edit';
      var currentObjType = (vm.objType === 'hardware') ? 'hardware' : `${vm.objType}s`;
      $state.go(`${currentObjType}.${crudState}`, { [`${vm.objType}Id`]: vm.log.associated_id, restoreData: jsonObj });
    }
  };

  vm.toggleAllVisibility = () => {
    $('[id^="update-container-"]').toggle(!$('#update-container-0').is(':visible'));
    $('[id^="update-button-"]').html(($('#update-container-0').is(':visible')) ? 'Hide Changes' : 'Show Changes');
  };

  vm.setDTTAdminLogs = async function () {
    var returnedLogs = await getObjectLogWrapper(undefined, undefined, vm.showDTTAdminLogs);
    vm.log = parseLogData(returnedLogs, false);
    vm.log.updates = sortOfLogData(_.cloneDeep(vm.log.updates));
    vm.objType = $stateParams.objType.substring(0, $stateParams.objType.length - 1);
    vm.htmlViewArtifact = `${vm.objType}${vm.objType !== 'hardware' ? 's' : ''}`;
    vm.objectType = `${vm.objType.substring(0, 1).toUpperCase()}${vm.objType.substring(1).replace(/([a-z])([A-Z])/g, '$1-$2')}`;
    vm.bookingEmails = log.emails;
    vm.loadedUpdates = [];
    vm.searchValue = '';
    vm.unloadedUpdates = _.cloneDeep(vm.log.updates);
    $scope.loadUpdates();
    $scope.$apply();
  };

  vm.toggleChildrenVisibility = function (objectId) {
    var trElems = $(`tr[id^="${objectId}-"]`);
    var firstElemVisible = trElems.first().is(':visible');
    trElems.toggle(!firstElemVisible);
    $(`span[id^="${objectId}-"][id$="-arrow-plus"]`).each(function () { $(this).toggle(firstElemVisible); });
    $(`span[id^="${objectId}-"][id$="-arrow-minus"]`).each(function () { $(this).toggle(!firstElemVisible); });
  };

  vm.toggleElemVisibility = objectId => {
    $(`#update-container-${objectId}`).toggle();
    $(`#update-button-${objectId}`).html(($('#update-container-' + objectId).is(':visible')) ? 'Hide Changes' : 'Show Changes');
  };

  vm.isRestoreButtonVisible = function (actionType, index) {
    switch (actionType) {
      case 'DELETED': return false;
      case 'CREATED': return (vm.log.deletedAt || vm.log.updates.length);
      case 'UPDATED': return (vm.log.deletedAt || index !== 0);
      default: return false;
    }
  };

  vm.getDeploymentFromSubject = function (subject) {
    try {
      var deploymentName = subject.split(' ')[0];
      var foundDeployment = allDeployments.find(deployment => deployment.name === deploymentName);
      return foundDeployment;
    } catch (err) {
      // Do Nothing
    }
  };

  function refreshAllTables() {
    $('#email-table').each(function () {
      if ($.fn.DataTable.isDataTable(this)) {
        $(this).dataTable().fnDestroy();
      }
    });

    // Handle for all other Tables
    var tableOptions = _.cloneDeep(dataTableTemplate);
    tableOptions.columns = vm.dataTableColumns;
    tableOptions.data = vm.visibleArtifacts;
    table = $(`#${vm.artifactTypeLower}-table`).dataTable(tableOptions);

    vm.tableLoading = false;
    $scope.$apply();
  }

  vm.createTable = function () {
    refreshAllTables();
    vm.dataEmailTableColumns = [
      {
        title: 'Action Type',
        width: '120px',
        data: 'actionType'
      },
      {
        title: 'Subject',
        data: 'subject'
      },
      {
        title: 'Recipients',
        data: null,
        render: function (data) {
          return (data.recipients.length) ? data.recipients.join(', ') : '-';
        }
      },
      {
        title: 'Deployment',
        data: null,
        render: function (data) {
          var foundDeployment = vm.getDeploymentFromSubject(data.subject);
          if (!foundDeployment) return 'Deployment not Found';
          var htmlElement = `<a class="deployment-column" ui-sref="deployments.view({ deploymentId: '${foundDeployment._id}' })">
          ${foundDeployment.name}</a>`;
          return $compile(htmlElement)($scope)[0].outerHTML;
        }
      },
      {
        title: 'Sent At',
        width: '150px',
        data: null,
        render: function (data) {
          var sentAt = dateFormat(data.sendTime, 'dd/mm/yy HH:MM').concat(' GMT');
          return sentAt;
        }
      },
      {
        title: 'Sent',
        width: '80px',
        data: null,
        render: function (data) {
          return (data.sentSuccessfully) ? vm.successIcon : vm.errorIcon;
        }
      },
      {
        title: 'Actions',
        orderable: false,
        searchable: false,
        width: '100px',
        data: null,
        render: function (data) {
          return `<a class="btn btn-sm btn-info" id="open-email-${data._id}">More Info</a>`;
          // return $compile(viewElement)($scope)[0].outerHTML;
        }
      }
    ];

    var tableOptions = _.cloneDeep(dataTableTemplate);
    delete tableOptions.scrollY;
    delete tableOptions.scroller;
    tableOptions.columns = vm.dataEmailTableColumns;
    tableOptions.data = vm.bookingEmails;
    table = $('#email-table').dataTable(tableOptions);
    $scope.$apply();
  };

  $scope.openMail = function (emailAddr, objName) {
    var tmpWindow = window.open(`mailto:${emailAddr}?subject=PDU OSS DTT Query Regarding ${vm.objectType} Object: ${objName}`, 'mail');
    tmpWindow.close();
  };

  vm.toggleEmailVisibility = function () {
    $('#email-card-body').toggle();
    $('#toggle-email-btn').html(($('#email-card-body').is(':visible')) ? 'Hide Booking Emails' : 'Show Booking Emails');
  };

  vm.openEmailModal = function (emailId) {
    vm.email = vm.bookingEmails.find(email => email._id === emailId);
    if (!vm.bookingEmails || !vm.email) {
      $state.go('.', { emailFocus: null });
      return;
    }
    vm.email.deployment = vm.getDeploymentFromSubject(vm.email.subject);
    if (!vm.email.deployment) vm.email.deployment = { name: 'Deployment Not Found', _id: '0000' };
    document.getElementById('email-message-body').innerHTML = vm.email.body;
    $state.go('.', { emailFocus: emailId });
    emailModal.show();
    $scope.$apply();
  };

  vm.closeEmailModal = function () {
    if ($location.search().emailFocus) $state.go('.', { emailFocus: null });
    vm.email = {};
    emailModal.hide();
  };

  $(() => {
    // Find Email Modal
    emailModal = $('#email-modal');

    // Create Email Table for Booking Log
    vm.createTable();

    $('[id^="open-email-"]').click(function () {
      var elemId = $(this).attr('id');
      var emailId = elemId.split('open-email-')[1];
      vm.openEmailModal(emailId);
    });

    // When the user clicks anywhere outside of the modal, close it
    var docEmailModal = document.getElementById('email-modal');
    window.onclick = function (event) {
      if (event.target === docEmailModal) vm.closeEmailModal();
    };

    // Merge each update log-cards tables
    $('[id^="update-container"]').each(function () {
      var updateTableBody = $(this).find('.parent-update-table-body').first();
      var tableRows = $(this).find('.child-change-table-body').children();
      for (var i = 0; i < tableRows.length; i += 1) {
        updateTableBody.append($(tableRows[i]));
      }
    });

    // Remove empty tables
    $('.child-change-table-body').each(function () {
      if ($(this).children().length === 0) $(this).closest('.log-card-body').remove();
    });

    // Open Email-View Modal if emailFocus url param exists
    if (emailFocus) {
      vm.openEmailModal(emailFocus);
    }
    cleanEmptyTableElements();
  });

  vm.clearSearch = function () {
    vm.searchValue = '';
    updateVisibleLogs(false);
  };

  // search key/value name in search field
  vm.filterLogs = function (searchType) {
    if (vm.searchValue === '') searchType = false;
    updateVisibleLogs(searchType);
  };

  // update the visible log depends on search type
  function updateVisibleLogs(searchType) {
    $timeout(function () {
      vm.log = parseLogData(vm.log, searchType);
      vm.loadedUpdates = sortOfLogData(_.cloneDeep(vm.log.updates));
      vm.unloadedUpdates = [];
      $scope.finishedLoading = true;
      $('[id^="update-container"]').each(function () {
        $(this).find('.parent-update-table-body').first().empty();
      });
      $scope.$apply();
      cleanEmptyTableElements();
    });
  }

  // clean the child table
  function cleanEmptyTableElements() {
    $('[id^="update-container"]').each(function () {
      var updateTableBody = $(this).find('.parent-update-table-body').first();
      var tableRows = $(this).find('.child-change-table-body').children();
      for (var i = 0; i < tableRows.length; i += 1) {
        updateTableBody.append($(tableRows[i]));
      }
    });
    // Remove empty tables
    $('.child-change-table-body').each(function () {
      if ($(this).children().length === 0) $(this).closest('.log-card-body').remove();
    });
  }

  // Parse the current object log info into the desired format for HTML output
  function parseLogData(log, searchType) {
    log = log[0] || log;
    var currentData = _.cloneDeep(log.originalData);
    log.isCreatedLogVisible = (!searchType);
    log.isDeletedLogVisible = (!searchType);
    for (var i = 0; i < log.updates.length; i += 1) {
      log.updates[i].index = i + 1;
      log.updates[i].isVisible = (!searchType);
      getUpdateChanges(log.updates[i], currentData, searchType);
      log.updates[i].currentData = _.cloneDeep(currentData);
    }
    log.currentData = currentData;
    return log;
  }

  // Get the changes made for each update
  function getUpdateChanges(update, currentData, searchType) {
    update.changes = [];
    for (var key in update.updateData) {
      if (Object.prototype.hasOwnProperty.call(update.updateData, key)) {
        var changeObj = getChange(currentData, update.updateData, key, searchType, update);
        update.changes.push(changeObj.change);
        currentData[key] = changeObj.current[key];
      }
    }
  }

  // Get an individual change from an update
  function getChange(current, update, key, searchType, topParentUpdate) {
    var change = {
      name: key,
      childChanges: [],
      isNew: false,
      isRemoved: false
    };
    current = current || {};
    var originalValue = current[key];
    var updateValue = update[key];
    var changeObj;
    var originalEqSearchValue;
    var updateEqSearchValue;

    if (searchType && topParentUpdate.isVisible === false) {
      if (searchType === 'key' && key.toLowerCase() === vm.searchValue.toLowerCase()) {
        topParentUpdate.isVisible = true;
      } else if (searchType === 'value') {
        if (originalValue && typeof originalValue !== 'undefined') {
          originalEqSearchValue = originalValue.toString().toLowerCase().includes(vm.searchValue.toLowerCase());
        }
        if (updateValue && typeof updateValue !== 'undefined') {
          updateEqSearchValue = updateValue.toString().toLowerCase().includes(vm.searchValue.toLowerCase());
        }
        topParentUpdate.isVisible = originalEqSearchValue || updateEqSearchValue;
      }
    }

    if (updateValue === 'REMOVED') {
      if (typeof originalValue === 'object') {
        change.isRemoved = true;
        for (var origKeyA in originalValue) {
          if (Object.prototype.hasOwnProperty.call(originalValue, origKeyA)) {
            changeObj = getChange(originalValue, { [origKeyA]: 'REMOVED' }, origKeyA, searchType, topParentUpdate);
            change.childChanges.push(changeObj.change);
            delete current[key];
          }
        }
      } else {
        change.origValue = originalValue || '-';
        change.newValue = 'REMOVED';
        delete current[key];
      }
    } else if (key !== 'links' && (typeof originalValue === 'object' || typeof updateValue === 'object')) {
      change.isNew = (typeof originalValue === 'undefined');
      for (var childKeyA in updateValue) {
        if (Object.prototype.hasOwnProperty.call(updateValue, childKeyA)) {
          changeObj = getChange(originalValue, updateValue, childKeyA, searchType, topParentUpdate);
          change.childChanges.push(changeObj.change);
          if (changeObj.current.constructor === Array) {
            current[key] = changeObj.current.filter(keyValue => keyValue != null);
          } else {
            current[key] = Object.assign(current[key] || {}, changeObj.current);
          }
        }
      }
    } else {
      change.origValue = originalValue || '-';
      change.newValue = updateValue;
      current[key] = updateValue;
    }

    if (current.links && !Array.isArray(current.links)) {
      // Modify current.links from object-of-objects to array-of-objects.
      current.links = Object.values(current.links);
    }

    if (change.childChanges.length < 1) delete change.childChanges;
    return { change: change, current: _.cloneDeep(current) };
  }

  function sortOfLogData(logUpdateData) {
    logUpdateData = logUpdateData.sort(function (left, right) {
      return moment.utc(right.updatedAt).diff(moment.utc(left.updatedAt));
    });
    return logUpdateData;
  }
}

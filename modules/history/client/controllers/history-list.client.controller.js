import _ from 'lodash';
import { generateEmailElement, historyFormatDate } from '../../../core/client/controllers/helpers.client.controller';
var $ = require('jquery');
var commonController = require('../../../core/client/controllers/common-list.client.controller');

HistoryListController.$inject = ['$window', 'Authentication', '$state', '$scope', '$compile', '$stateParams', 'logs'];
export default function HistoryListController($window, Authentication, $state, $scope, $compile, $stateParams, logs) {
  var vm = this;
  vm.artifactType = 'Historical Log';
  vm.artifactTypeLower = 'log';

  vm.objType = $stateParams.objType;
  // Dynamically set object type name: providing capital first letter and adding a hyphen before additional uppercase letters.
  vm.objectType = vm.objType.substring(0, 1).toUpperCase() + vm.objType.substring(1, vm.objType.length).replace(/([a-z])([A-Z])/g, '$1-$2');
  vm.visibleArtifacts = logs || [];
  vm.dataTableColumns = [
    {
      title: 'ID',
      data: 'associated_id'
    },
    {
      title: 'Name',
      data: null,
      render: function (data) {
        return '<strong>' + data.currentName + '</strong>';
      }
    },
    {
      title: 'Created At',
      data: null,
      render: function (data) {
        return historyFormatDate(data.createdAt);
      }
    },
    {
      title: 'Created By',
      data: null,
      render: function (data) {
        return generateEmailElement(vm.objectType, data.currentName, data.createdBy);
      }
    },
    {
      title: 'ACTION_TYPE At',
      data: null,
      render: function (data) {
        if (data.deletedAt) {
          return historyFormatDate(data.deletedAt);
        } else if (data.updates.length) {
          return historyFormatDate(data.updates[data.updates.length - 1].updatedAt);
        }
        return historyFormatDate(data.createdAt);
      }
    },
    {
      title: 'ACTION_TYPE By',
      data: null,
      render: function (data) {
        var user = data.createdBy;
        if (data.deletedBy) {
          user = data.deletedBy;
        } else if (data.updates.length !== 0) {
          user = data.updates[data.updates.length - 1].updatedBy;
        }
        return generateEmailElement(vm.objectType, data.currentName, user);
      }
    },
    {
      title: 'Action',
      orderable: false,
      searchable: false,
      width: '100px',
      data: null,
      render: function (data) {
        var viewElement =
          `<a id="view-log" class="btn btn-sm btn-info" ui-sref="logs.view({objType: '${vm.objType}', objId: '${data.associated_id}' })">View</a>`;
        var compiledView = $compile(viewElement)($scope)[0].outerHTML;
        return compiledView;
      }
    }
  ];

  commonController($scope, $window, Authentication, Notification, vm);
}

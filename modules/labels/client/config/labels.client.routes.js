import ListController from '../controllers/labels-list.client.controller';
import CreateController from '../controllers/labels-create.client.controller';
import ViewController from '../controllers/labels-view.client.controller';
import CommonListTemplate from '../../../core/client/views/common-list.view.html';
import CreateTemplate from '../views/labels-create.client.view.html';
import ViewTemplate from '../views/labels-view.client.view.html';

routeConfig.$inject = ['$stateProvider'];
export default function routeConfig($stateProvider) {
  $stateProvider
    .state('labels', {
      abstract: true,
      url: '/labels',
      template: '<ui-view/>'
    })

    .state('labels.list', {
      url: '',
      template: CommonListTemplate,
      controller: ListController,
      controllerAs: 'vm',
      resolve: {
        allLabels: getAllLabels,
        allLabelLogs: getAllLabelLogs
      }
    })
    .state('labels.create', {
      url: '/create?{restoreData:json}',
      template: CreateTemplate,
      controller: CreateController,
      controllerAs: 'vm',
      resolve: {
        label: newLabel,
        restoredata: getRestoreData,
        creatingFromScratch: function () { return true; }
      }
    })
    .state('labels.edit', {
      url: '/edit/{labelId}?{restoreData:json}?addProduct?editProduct',
      template: CreateTemplate,
      controller: CreateController,
      controllerAs: 'vm',
      resolve: {
        label: getLabel,
        restoredata: getRestoreData,
        clonedata: function () { return null; },
        creatingFromScratch: function () { return false; },
        allLabels: getAllLabels
      }
    })
    .state('labels.view', {
      url: '/view/{labelId}',
      template: ViewTemplate,
      controller: ViewController,
      controllerAs: 'vm',
      resolve: {
        label: getLabel,
        dependentDeployments: ['label', 'DeploymentsService', getDependentDeployments],
        allLabelLogs: getAllLabelLogs
      }
    });
}

getRestoreData.$inject = ['$stateParams'];
function getRestoreData($stateParams) {
  return $stateParams.restoreData;
}

getLabel.$inject = ['$stateParams', 'LabelsService'];
function getLabel($stateParams, LabelsService) {
  return LabelsService.get({
    labelId: $stateParams.labelId
  }).$promise;
}

getAllLabels.$inject = ['LabelsService'];
function getAllLabels(labelsService) {
  return labelsService.query().$promise;
}

newLabel.$inject = ['LabelsService'];
function newLabel(LabelsService) {
  return new LabelsService();
}

function getDependentDeployments(label, DeploymentsService) {
  return DeploymentsService.query({ q: 'label_ids=' + label._id, fields: '_id,name' }).$promise;
}

getAllLabelLogs.$inject = ['LabelsHistoryService'];
function getAllLabelLogs(LabelsHistoryService) {
  return LabelsHistoryService.query({ fields: 'associated_id,createdBy,updates/(updatedAt,updatedBy)' }).$promise;
}

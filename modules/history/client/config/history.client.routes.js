import ListController from '../controllers/history-list.client.controller';
import ListTemplate from '../views/history-list.client.view.html';
import ViewTemplate from '../views/history-view.client.view.html';
import ViewController from '../controllers/history-view.client.controller';
var $stateParamsGlobal;
var historyserviceGlobal;

routeConfig.$inject = ['$stateProvider'];
export default function routeConfig($stateProvider) {
  $stateProvider
    .state('logs', {
      abstract: true,
      url: '/logs',
      template: '<ui-view/>'
    })

    .state('logs.list', {
      url: '/{objType}',
      template: ListTemplate,
      controller: ListController,
      controllerAs: 'vm',
      resolve: {
        historyservice: getHistoryService,
        logs: ['historyservice', getObjectLogs]
      }
    })

    .state('logs.view', {
      url: '/{objType}/view/{objId}?emailFocus',
      params: { // dynamic params allow param-update without page-reload
        emailFocus: { dynamic: true }
      },
      template: ViewTemplate,
      controller: ViewController,
      controllerAs: 'vm',
      resolve: {
        historyservice: getHistoryService,
        log: ['$stateParams', 'historyservice', getObjectLogWrapper],
        allDeployments: getAllDeployments,
        emailFocus: getEmailFocus
      }
    });
}

getHistoryService.$inject = ['$state', '$stateParams', 'DeploymentsHistoryService', 'ProductTypesHistoryService', 'AreasHistoryService',
  'ProgramsHistoryService', 'FlavoursHistoryService', 'TeamsHistoryService', 'HardwaresHistoryService',
  'BookingsHistoryService', 'LabelsHistoryService', 'RolesHistoryService'];
function getHistoryService(
  $state, $stateParams, DeploymentsHistoryService, ProductTypesHistoryService, AreasHistoryService,
  ProgramsHistoryService, FlavoursHistoryService, TeamsHistoryService, HardwaresHistoryService,
  BookingsHistoryService, LabelsHistoryService, RolesHistoryService
) {
  switch ($stateParams.objType) {
    case 'deployments': return DeploymentsHistoryService;
    case 'productTypes': return ProductTypesHistoryService;
    case 'areas': return AreasHistoryService;
    case 'programs': return ProgramsHistoryService;
    case 'productFlavours': return FlavoursHistoryService;
    case 'teams': return TeamsHistoryService;
    case 'hardwares': return HardwaresHistoryService;
    case 'bookings': return BookingsHistoryService;
    case 'labels': return LabelsHistoryService;
    case 'roles': return RolesHistoryService;
    default: $state.go('not-found', { message: `Logs do not exist for object-type '${$stateParams.objType}'` });
  }
}

function getObjectLogs(historyservice) {
  return historyservice.query({ fields: 'associated_id,originalData(name,schema_id,version),currentName,createdAt,createdBy,deletedAt,deletedBy,updates/(updatedAt,updatedBy)' }).$promise;
}

function getObjectLog($stateParams, historyservice) {
  return historyservice.aggregate([
    {
      $match: {
        associated_id: $stateParams.objId
      }
    },
    {
      $project: {
        _id: 1,
        associated_id: 1,
        originalData: 1,
        createdAt: 1,
        createdBy: 1,
        currentName: 1,
        __v: 1,
        emails: 1,
        updates: {
          $filter: {
            input: '$updates',
            as: 'update',
            cond: {
              $ne: [
                '$$update.updatedBy.displayName',
                'DTT Admin'
              ]
            }
          }
        },
        deletedAt: 1,
        deletedBy: 1
      }
    }
  ]).$promise;
}

function getObjectLogWithDTT($stateParams, historyservice) {
  return historyservice.get({ objId: $stateParams.objId }).$promise;
}

export async function getObjectLogWrapper($stateParams, historyservice, showDTTAdminLogs = false) {
  if ($stateParams !== undefined && historyservice !== undefined) {
    $stateParamsGlobal = $stateParams;
    historyserviceGlobal = historyservice;
  }

  return showDTTAdminLogs
    ? getObjectLogWithDTT($stateParamsGlobal, historyserviceGlobal)
    : getObjectLog($stateParamsGlobal, historyserviceGlobal);
}

getAllDeployments.$inject = ['DeploymentsService'];
function getAllDeployments(deploymentsService) {
  return deploymentsService.query({ fields: '_id,name' }).$promise;
}

getEmailFocus.$inject = ['$stateParams'];
function getEmailFocus($stateParams) {
  return $stateParams.emailFocus;
}

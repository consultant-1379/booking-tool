import ListController from '../controllers/hardware-list.client.controller';
import CommonListTemplate from '../../../core/client/views/common-list.view.html';
import CreateController from '../controllers/hardware-create.client.controller';
import CreateTemplate from '../views/hardware-create.client.view.html';
import ViewController from '../controllers/hardware-view.client.controller';
import ViewTemplate from '../views/hardware-view.client.view.html';

routeConfig.$inject = ['$stateProvider'];
export default function routeConfig($stateProvider) {
  $stateProvider
    .state('hardware', {
      abstract: true,
      url: '/hardware',
      template: '<ui-view/>'
    })

    .state('hardware.list', {
      url: '',
      template: CommonListTemplate,
      controller: ListController,
      controllerAs: 'vm',
      resolve: {
        allHardware: getAllHardware,
        allHardwareLogs: getAllHardwareLogs,
        allDeployments: getAllDeployments,
        allPrograms: getAllPrograms
      }
    })

    .state('hardware.create', {
      url: '/create?{restoreData:json}',
      template: CreateTemplate,
      controller: CreateController,
      controllerAs: 'vm',
      resolve: {
        hardware: newHardware,
        restoredata: getRestoreData,
        allPrograms: getAllPrograms,
        creatingFromScratch: function () { return true; }
      }
    })

    .state('hardware.edit', {
      url: '/edit/{hardwareId}?{restoreData:json}',
      template: CreateTemplate,
      controller: CreateController,
      controllerAs: 'vm',
      resolve: {
        hardware: getHardware,
        restoredata: getRestoreData,
        allPrograms: getAllPrograms,
        creatingFromScratch: function () { return false; }
      }
    })

    .state('hardware.view', {
      url: '/view/{hardwareId}',
      template: ViewTemplate,
      controller: ViewController,
      controllerAs: 'vm',
      resolve: {
        hardware: getHardware,
        allHardwareLogs: getAllHardwareLogs,
        program: ['hardware', 'ProgramsService', getProgram],
        allDeployments: getAllDeployments
      }
    });
}

function getProgram(hardware, ProgramsService) {
  return ProgramsService.get({ programId: hardware.program_id }).$promise;
}

getRestoreData.$inject = ['$stateParams'];
function getRestoreData($stateParams) {
  return $stateParams.restoreData;
}

getHardware.$inject = ['$stateParams', 'HardwareService'];
function getHardware($stateParams, HardwareService) {
  return HardwareService.get({
    hardwareId: $stateParams.hardwareId
  }).$promise;
}

newHardware.$inject = ['HardwareService'];
function newHardware(HardwareService) {
  return new HardwareService();
}

getAllHardware.$inject = ['HardwareService'];
function getAllHardware(hardwareService) {
  return hardwareService.query().$promise;
}

getAllDeployments.$inject = ['DeploymentsService'];
function getAllDeployments(DeploymentsService) {
  return DeploymentsService.query({ fields: '_id,name,status,jira_issues,area_id,program_id,team_id,purpose,products(product_type_name,flavour_name,location,purpose,links,hardware_ids,infrastructure)' }).$promise;
}

getAllPrograms.$inject = ['ProgramsService'];
function getAllPrograms(ProgramsService) {
  return ProgramsService.query({ fields: '_id,name' }).$promise;
}

getAllHardwareLogs.$inject = ['HardwaresHistoryService'];
function getAllHardwareLogs(HardwaresHistoryService) {
  return HardwaresHistoryService.query({ fields: 'associated_id,createdBy,updates/(updatedAt,updatedBy)' }).$promise;
}

import ListController from '../controllers/programs-list.client.controller';
import CreateController from '../controllers/programs-create.client.controller';
import ViewController from '../controllers/programs-view.client.controller';
import CommonListTemplate from '../../../core/client/views/common-list.view.html';
import CreateTemplate from '../views/programs-create.client.view.html';
import ViewTemplate from '../views/programs-view.client.view.html';

routeConfig.$inject = ['$stateProvider'];
export default function routeConfig($stateProvider) {
  $stateProvider
    .state('programs', {
      abstract: true,
      url: '/programs',
      template: '<ui-view/>'
    })

    .state('programs.list', {
      url: '',
      template: CommonListTemplate,
      controller: ListController,
      controllerAs: 'vm',
      resolve: {
        allPrograms: getAllPrograms,
        allProgramLogs: getAllProgramLogs
      }
    })
    .state('programs.create', {
      url: '/create?{restoreData:json}',
      template: CreateTemplate,
      controller: CreateController,
      controllerAs: 'vm',
      resolve: {
        program: newProgram,
        restoredata: getRestoreData,
        creatingFromScratch: function () { return true; }
      }
    })
    .state('programs.view', {
      url: '/view/{programId}',
      template: ViewTemplate,
      controller: ViewController,
      controllerAs: 'vm',
      resolve: {
        program: getProgram,
        dependentAreas: ['program', 'AreasService', getDependentAreas],
        dependentDeployments: ['program', 'DeploymentsService', getDependentDeployments],
        dependentHardware: ['program', 'HardwareService', getDependentHardware],
        allProgramLogs: getAllProgramLogs
      }
    });
}

getRestoreData.$inject = ['$stateParams'];
function getRestoreData($stateParams) {
  return $stateParams.restoreData;
}

getProgram.$inject = ['$stateParams', 'ProgramsService'];
function getProgram($stateParams, ProgramsService) {
  return ProgramsService.get({
    programId: $stateParams.programId
  }).$promise;
}

getAllPrograms.$inject = ['ProgramsService'];
function getAllPrograms(programsService) {
  return programsService.query().$promise;
}

newProgram.$inject = ['ProgramsService'];
function newProgram(ProgramsService) {
  return new ProgramsService();
}

function getDependentAreas(program, AreasService) {
  return AreasService.query({ q: 'program_id=' + program._id, fields: '_id,name' }).$promise;
}

function getDependentDeployments(program, DeploymentsService) {
  return DeploymentsService.query({ q: 'program_id=' + program._id, fields: '_id,name' }).$promise;
}

function getDependentHardware(program, HardwareService) {
  return HardwareService.query({ q: 'program_id=' + program._id, fields: '_id,name' }).$promise;
}

getAllProgramLogs.$inject = ['ProgramsHistoryService'];
function getAllProgramLogs(ProgramsHistoryService) {
  return ProgramsHistoryService.query({ fields: 'associated_id,createdBy,updates/(updatedAt,updatedBy)' }).$promise;
}

import $ from 'jquery';
import _, { remove } from 'lodash';
require('datatables')();
require('datatables.net-scroller')(window, $);
var dataTablesTemplate = require('../../../core/client/json/datatables_template.json');
window.jQuery = $;
window.$ = $;
ProgramsViewController.$inject = ['$state', '$scope', '$compile', 'program', 'Notification', 'dependentAreas',
  'dependentDeployments', 'dependentHardware', '$window', 'allProgramLogs', 'Authentication'];
export default function ProgramsViewController(
  $state, $scope, $compile, program, Notification, dependentAreas,
  dependentDeployments, dependentHardware, $window, allProgramLogs, Authentication
) {
  var vm = this;
  vm.program = program;
  vm.dependentAreas = dependentAreas;
  vm.dependentDeployments = dependentDeployments;
  vm.dependentHardwares = dependentHardware;
  vm.infrastructureTypes = ['Physical', 'Cloud', 'vCenter'];
  var stsProjects = ['DETS'];
  var pduProjects = ['CIP', 'CIS'];
  vm.boards = ['CI_Framework', 'DE Test Services'];
  var pduComponents = ['DTT_Booking', 'TEaaS', 'CI Infra', 'CI Fwk'];
  var stsComponents = ['Application Services', 'Learning Services', 'Welab E2E', 'Youlab E2E'];
  // Temporary JIRA Template Object needed to interact with Create/Update Modal.
  vm.newJiraTemplate = {};
  vm.formSubmitting = true;
  vm.scrollYheight = '29vh';

  // Permissions
  program.history = allProgramLogs.find(log => log.associated_id === program._id);
  var isCreator = (program.history && program.history.createdBy.username === Authentication.user.username);
  vm.hasEditPermissions = Authentication.isAllowed('/programs', 'put', isCreator);

  vm.addCustomField = function (jiraTemplateIndex) {
    if (!jiraTemplateIndex) jiraTemplateIndex = vm.program.jira_templates.length;
    if (!vm.newJiraTemplate.custom_fields || vm.newJiraTemplate.custom_fields.length === 0) {
      vm.newJiraTemplate.custom_fields = [];
    }
    vm.newJiraTemplate.custom_fields.push({ key_name: '', key_value: '' });
  };

  vm.removeCustomField = function (customFieldIndex) {
    var customField = vm.newJiraTemplate.custom_fields[customFieldIndex];
    if ($window.confirm(`Are you sure you want to remove Custom Field ${customFieldIndex + 1}?`)) {
      vm.newJiraTemplate.custom_fields.splice(customFieldIndex, 1);
    }
  };

  vm.updateComponentsAndProjects = function () {
    vm.components = (vm.newJiraTemplate.jiraBoard && vm.newJiraTemplate.jiraBoard === 'CI_Framework') ? pduComponents : stsComponents;
    vm.projects = (vm.newJiraTemplate.jiraBoard && vm.newJiraTemplate.jiraBoard === 'CI_Framework') ? pduProjects : stsProjects;
  };

  vm.updateComponentsAndProjects();

  function refreshAllTables() {
    $('.jira-data-table').each(function () {
      if ($.fn.DataTable.isDataTable(this)) {
        $(this).dataTable().fnDestroy();
      }
    });
    var datatablesConstructor = {
      data: vm.program.jira_templates,
      scrollY: vm.scrollYheight,
      columns: [
        {
          title: 'Infrastructure-Type',
          width: '17%',
          data: 'infrastructure'
        },
        {
          title: 'JIRA Board',
          width: '17%',
          data: 'jiraBoard'
        },
        {
          title: 'Issue Type',
          width: '17%',
          data: 'issueType'
        },
        {
          title: 'Project',
          width: '17%',
          data: 'project'
        },
        {
          title: 'Components',
          width: '17%',
          data: null,
          render: function (data) {
            if (data.components) {
              var output = '';
              data.components.forEach(function (component) {
                output += `<div>
                            <span}>
                              ${component}
                            <span}>
                          </div>`;
              });
              return output;
            }
          }
        },
        {
          title: 'Custom Fields',
          width: '16%',
          data: null,
          render: function (data) {
            if (data.custom_fields) {
              var output = '';
              data.custom_fields.forEach(function (customField) {
                if (customField.key_name && customField.key_name) {
                  output += `<div>
                              <b>${customField.key_name}</b>${': ' + customField.key_value}
                          </div>`;
                }
              });
              return output;
            }
          }
        },
        {
          title: 'Actions',
          orderable: false,
          searchable: false,
          width: '12%',
          data: null,
          render: function (data, type, row, meta) {
            var editElement = `<a id="edit-jiratemp-${meta.row}" class="btn btn-sm btn-primary edit-button">Edit</a>`;
            var deleteElement = `<a id="delete-jiratemp-${meta.row}" class="delete-button btn btn-sm btn-danger">Delete</a>`;
            var compiledEditElem = $compile(editElement)($scope)[0].outerHTML;
            var compiledDeleteElem = $compile(deleteElement)($scope)[0].outerHTML;
            return `${compiledEditElem}&nbsp;${compiledDeleteElem}`;
          }
        }
      ]
    };
    var table = $('.jira-data-table').dataTable(_.merge(datatablesConstructor, dataTablesTemplate));
    $('.dataTables_scrollBody').css('height', vm.scrollYheight);
    _.defer(function () { $scope.$apply(); });
  }

  $('.table').on('click', '.edit-button', function (e) {
    e.stopPropagation();
    var tr = $(this).parents('tr');
    var jiraDetail = $('#jiraTable').dataTable().api().row(tr)
      .data();
    jiraDetail.isEditing = true;
    jiraDetail.rowIndex = tr.index();
    vm.initializeJiraTemplateViewModal(jiraDetail);
  });

  $('.table').on('click', '.delete-button', function (e) {
    e.stopPropagation();
    var tr = $(this).parents('tr');
    var rowData = $('#jiraTable').dataTable().api().data();
    var rowIndex = tr.index();
    if ($window.confirm(`Are you sure you want to delete JIRA Template ${rowIndex + 1} ?`)) {
      vm.program.jira_templates.splice(rowData, 1);
      vm.program.$update()
        .then(successCallback)
        .catch(errorCallback);
      vm.closeModals();
      refreshAllTables();
    }

    function successCallback() {
      Notification.success({ message: '<i class="glyphicon glyphicon-ok"></i> JIRA Template deleted successfully!' });
    }

    function errorCallback(res) {
      var message = res.data ? res.data.message : res.message;
      Notification.error({
        message: message.replace(/\n/g, '<br/>'),
        title: `<i class="glyphicon glyphicon-remove"></i> "${rowData}" deletion failed!`
      });
    }
  });
  $(function () {
    refreshAllTables();
  });

  var jiraTemplateModal = document.getElementById('jira-template-modal');

  vm.submitJiraTemplateForm = async function () {
    try {
      var index;
      if (!vm.newJiraTemplate.isEditing) {
        index = vm.program.jira_templates.length;
        vm.program.jira_templates.push({});
      } else {
        index = vm.newJiraTemplate.rowIndex;
      }
      vm.program.jira_templates[index].infrastructure = vm.newJiraTemplate.infrastructure;
      vm.program.jira_templates[index].jiraBoard = vm.newJiraTemplate.jiraBoard;
      vm.program.jira_templates[index].issueType = vm.newJiraTemplate.issueType;
      vm.program.jira_templates[index].project = vm.newJiraTemplate.project;
      vm.program.jira_templates[index].components = vm.newJiraTemplate.components;
      if (vm.newJiraTemplate.custom_fields) {
        vm.program.jira_templates[index].custom_fields = vm.newJiraTemplate.custom_fields;
      }
      delete vm.newJiraTemplate.rowIndex;
      delete vm.newJiraTemplate.isEditing;
      await vm.program.createOrUpdate();
      vm.newJiraTemplate.isEditing = false;
      vm.newJiraTemplate = {};
      vm.newJiraTemplate.custom_fields = [];
    } catch (err) {
      vm.formSubmitting = false;
      var errorMessage = err.data ? err.data.message : err.message;
      Notification.error({
        message: errorMessage.replace(/\n/g, '<br/>'),
        title: '<i class="glyphicon glyphicon-remove"></i> Program update error!'
      });

      return;
    }
    var message = '<i class="glyphicon glyphicon-ok"></i> Program update successful!<br>';
    Notification.success({
      message: message
    });
    refreshAllTables();
    $state.go('programs.view', { programId: vm.program._id });
    jiraTemplateModal.style.display = 'none';
  };

  vm.initializeJiraTemplateViewModal = async function (jiraDetail) {
    if (jiraDetail) vm.newJiraTemplate = jiraDetail;
    jiraTemplateModal.style.display = 'block';
    _.defer(() => $scope.$apply());
  };

  vm.closeModals = function () {
    jiraTemplateModal.style.display = 'none';
    vm.newJiraTemplate.isEditing = false;
    vm.newJiraTemplate = {};
    vm.newJiraTemplate.custom_fields = [];
  };
}

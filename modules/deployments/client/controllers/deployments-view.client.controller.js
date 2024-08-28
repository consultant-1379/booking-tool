import { data } from 'jquery';
import _ from 'lodash';
import { getJiraIssue } from '../../../core/client/controllers/helpers.client.controller';
import { generateEmailElement } from '../../../core/client/controllers/helpers.client.controller';
var $ = require('jquery');
require('datatables')();
require('datatables.net-scroller')(window, $);
var moment = require('moment');

var dataTablesTemplate = require('../../../core/client/json/datatables_template.json');
var bookingEndTimeFormat = 'DD/MM/YYYY';

DeploymentsViewController.$inject = [
  '$scope', '$http', '$compile', 'deployment', 'area', 'program', 'allLabels', 'allUsers',
  'team', 'allProductTypes', 'allProductFlavours', 'Notification', '$window', '$state', 'allHardware', 'allBookings',
  'allDeploymentLogs', 'Authentication'
];
export default function DeploymentsViewController(
  $scope, $http, $compile, deployment, area, program, allLabels, allUsers,
  team, allProductTypes, allProductFlavours, Notification, $window, $state, allHardware, allBookings,
  allDeploymentLogs, Authentication
) {
  var vm = this;
  vm.scrollYheight = '29vh';
  var table;
  var deploymentForClone = _.cloneDeep(deployment);

  // Permissions
  deployment.history = allDeploymentLogs.find(log => log.associated_id === deployment._id);
  var isCreator = (deployment.history && deployment.history.createdBy.username === Authentication.user.username);
  vm.hasEditPermissions = Authentication.isAllowed('/deployments', 'put', isCreator);
  vm.hasCreatePermissions = Authentication.isAllowed('/deployments', 'post', isCreator);

  // Deployment setup, finding the name of dependent Product-Flavours and Types
  deployment.products.map(function (product, pIndex) {
    product.productIndex = pIndex;
    product.type = allProductTypes.find(type => type.name === product.product_type_name);
    product.flavour = allProductFlavours.find(flavour => flavour.name === product.flavour_name);
    product.hardware = allHardware.filter(hardware => product.hardware_ids.includes(hardware._id));
    return product;
  });

  if (deployment.timebox_data.timebox) {
    var timebox = moment(deployment.timebox_data.timebox);
    var todaysDate = moment();
    var daysRemaining = timebox.diff(todaysDate, 'days');
    deployment.timebox_data.time_remaining = (String(daysRemaining).includes('-')) ? 0 : daysRemaining;
    deployment.timebox_data.timebox = moment(deployment.timebox_data.timebox).format('DD/MM/YY');
  }

  vm.deployment = deployment;
  vm.allLabels = _.clone(allLabels);
  vm.allUsers = _.clone(allUsers);

  allBookings.forEach(function (booking) {
    if (!booking.isExpired) {
      booking.endTime = moment(booking.endTime).subtract(1, 'days').format(bookingEndTimeFormat);
    }
  });

  function setBookingStatus(isStarted, isExpired) {
    var status = 'Expired';
    if (!isExpired) status = (isStarted) ? 'In Progress' : 'Pre-Booked';
    return status;
  }

  vm.dependentBookings = allBookings.filter(booking => booking.deployment_id.toString() === deployment._id.toString());
  vm.dependentBookings.forEach((booking) => { booking.status = setBookingStatus(booking.isStarted, booking.isExpired); });

  // JIRA
  getJiraData();

  // Setting dependent artifacts variables
  vm.area = area;
  vm.program = program;
  vm.team = team;
  vm.spocUsers = [];
  vm.allDeploymentLabels = [];

  if (vm.deployment.label_ids) {
    vm.deployment.label_ids.forEach(function (labelID) {
      var labelFound = vm.allLabels.find(label => label._id === labelID);
      vm.allDeploymentLabels.push(labelFound);
    });
  }

  if (vm.deployment.spocUser_ids) {
    vm.deployment.spocUser_ids.forEach(function (spocUserId) {
      var spocUserFound = vm.allUsers.find(user => user._id === spocUserId);
      vm.spocUsers.push(spocUserFound);
    });
  }

  vm.cloneObject = async function () {
    var alertMessage = `Are you sure you want to clone ${deployment.name}?`;
    if ($window.confirm(alertMessage)) {
      $state.go('deployments.create', { cloneData: deploymentForClone });
    }
  };

  function refreshAllTables() {
    $('.product-data-table').each(function () {
      if ($.fn.DataTable.isDataTable(this)) {
        $(this).dataTable().fnDestroy();
      }
    });

    var datatablesConstructor = {
      data: vm.deployment.products,
      scrollY: vm.scrollYheight,
      columns: [
        {
          title: 'Product-Type',
          width: '17%',
          data: null,
          render: function (data) {
            if (data.type) {
              var htmlElement = `<a ui-sref="productTypes.view({productTypeId: '${data.type._id}'})">${data.type.name}</a>`;
              return $compile(htmlElement)($scope)[0].outerHTML;
            }
          }
        },
        {
          title: 'ID',
          width: '9%',
          data: '_id'
        },
        {
          title: 'Flavour',
          width: '8%',
          data: null,
          render: function (data) {
            if (data.flavour) {
              var htmlElement = `<a ui-sref="productFlavours.view({productFlavourId: '${data.flavour._id}'})">${data.flavour.name}</a>`;
              return $compile(htmlElement)($scope)[0].outerHTML;
            }
          }
        },
        {
          title: '<span title="Mandatory fields associated with a Deployment\'s product(s) (SVC, EVT, etc).">Product Configuration <i class="ebIcon ebIcon_info"></i></span>',
          width: '17%',
          data: null,
          render: function (data) {
            if (data.configuration.length > 0) {
              var output = '';
              data.configuration.forEach(function (config) {
                var isLink = config.key_value.includes('http');
                output += `<div class="list-label clickable">
                            <${isLink ? 'a href="' + config.key_value + '"' : 'span'}>
                              <b>${config.key_name}</b>${isLink ? ' <i class="fas fa-link"></i>' : ': ' + config.key_value}
                            </${isLink ? 'a' : 'span'}>
                          </div>`;
              });
              return output;
            }
          }
        },
        {
          title: '<span title="Optional free-text fields associated with the product, such as supplementary data (DIT, DMT, file links).">Product Data <i class="ebIcon ebIcon_info"></i></span>',
          width: '17%',
          data: null,
          render: function (data) {
            if (data.links.length > 0) {
              var output = '';
              data.links.forEach(function (productData) {
                output += `<div class="list-label clickable">
                            <${productData.url ? 'a href="' + productData.url + '"' : 'span'}>
                              ${productData.link_name}${productData.url ? ' <i class="fas fa-link"></i>' : ''}
                            </${productData.url ? 'a' : 'span'}>
                          </div>`;
              });
              return output;
            }
          }
        },
        {
          title: 'Hardware',
          width: '17%',
          data: null,
          render: function (data) {
            if (data.hardware.length > 0) {
              var output = '';
              data.hardware.forEach(function (hardwareObj) {
                var htmlElement = `<div class="list-label clickable">
                                    <a ui-sref="hardware.view({ hardwareId: '${hardwareObj._id}' })">
                                      ${hardwareObj.name}
                                    </a>
                                  </div>`;
                output += $compile(htmlElement)($scope)[0].outerHTML;
              });
              return output;
            }
          }
        },
        {
          title: 'Infrastructure',
          width: '10%',
          data: 'infrastructure'
        },
        {
          title: 'Location',
          width: '10%',
          data: 'location'
        },
        {
          title: 'Jenkins Job',
          width: '10%',
          data: null,
          render: function (data) {
            if (data.jenkinsJob) {
              var output = `<a href="${data.jenkinsJob}"> Job Link <i class="fas fa-link"></i></a>`;
              return output;
            }
          }
        },
        {
          title: 'Notes',
          width: '10%',
          data: 'purpose'
        },
        {
          title: 'Actions',
          width: '70px',
          orderable: false,
          searchable: false,
          data: null,
          render: function (data) {
            var editElement = `<a class="btn btn-sm btn-primary"
                                ui-sref="deployments.edit({ deploymentId: '${vm.deployment._id}', editProduct: ${data.productIndex} })">
                                Edit
                              </a>`;
            var compiledEditElem = $compile(editElement)($scope)[0].outerHTML;
            return `${compiledEditElem}`;
          }
        }
      ]
    };

    table = $('.product-data-table').dataTable(_.merge(datatablesConstructor, dataTablesTemplate));
    $('.dataTables_scrollBody').css('height', vm.scrollYheight);
    _.defer(function () { $scope.$apply(); });
  }

  $(function () {
    refreshAllTables();

    if (vm.spocUsers.length) {
      var spocUsersEmailElement = generateEmailElement('Deployment', deployment.name, vm.spocUsers, true);
      $('#all-spoc-user-emails').html(spocUsersEmailElement);
      vm.spocUsers.forEach(function (spocUser, spocUserIndex) {
        var spocUserEmailElement = generateEmailElement('Deployment', deployment.name, spocUser);
        $(`#spoc-user-email-${spocUserIndex}`).html(spocUserEmailElement);
      });
    }
  });

  function getJiraData() {
    var jiraIssues = [];
    if (vm.deployment.jira_issues.length) {
      vm.deployment.jira_issues.forEach(function (jiraIssue) {
        // Get JIRA Data
        var jiraData = {};
        getJiraIssue($http, Notification, jiraIssue, jiraData);
        jiraIssues.push(jiraData);
      });
    }
    vm.jiraIssuesData = jiraIssues;
    _.defer(function () { $scope.$apply(); });
  }
}

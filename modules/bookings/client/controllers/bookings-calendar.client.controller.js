import $ from 'jquery';
import _ from 'lodash';
import { Calendar } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import { asyncForEach, getJiraIssue, jiraIssueValidation, findArtifact, capitalizeFirstLetter } from '../../../core/client/controllers/helpers.client.controller';
window.dayGridPlugin = dayGridPlugin;
window.timeGridPlugin = timeGridPlugin;
window.jQuery = $;
window.$ = $;
require('qtip2');
require('bootstrap-datetime-picker');
require('select2')();
var Moment = require('moment');
var MomentRange = require('moment-range');
var commonListController = require('../../../core/client/controllers/common-list.client.controller');
var filtersController = require('../../../core/client/controllers/filters.client.controller');
var moment = MomentRange.extendMoment(Moment);
var successIcon = '<i class="glyphicon glyphicon-ok"></i>';
var errorIcon = '<i class="glyphicon glyphicon-remove"></i>';
var ciPortalUrl = 'https://ci-portal.seli.wh.rnd.internal.ericsson.com';

BookingsListController.$inject = [
  '$http', '$compile', '$location', '$timeout', '$scope', '$state', '$window', 'Authentication', 'Notification', 'newBooking', 'allBookings',
  'allBookingLogs', 'allPrograms', 'allAreas', 'allTeams', 'allUserFilters', 'allDeployments', 'allProductTypes', 'allLabels', 'bookingFocus', 'programFilter',
  'areaFilter', 'teamFilter', 'createdByFilter', 'deploymentFilter', 'productTypeFilter', 'startTimeAfterFilter', 'endTimeBeforeFilter', 'labelFilter'
];
export default function BookingsListController(
  $http, $compile, $location, $timeout, $scope, $state, $window, Authentication, Notification, newBooking, allBookings,
  allBookingLogs, allPrograms, allAreas, allTeams, allUserFilters, allDeployments, allProductTypes, allLabels, bookingFocus, programFilter,
  areaFilter, teamFilter, createdByFilter, deploymentFilter, productTypeFilter, startTimeAfterFilter, endTimeBeforeFilter, labelFilter
) {
  document.title = window.documentOriginalTitle + ' Bookings'; // Set Page-Title
  var vm = this; // Initialize angular controller
  vm.calendarLoading = true;
  vm.artifactType = 'Booking';
  vm.artifactTypeLower = vm.artifactType.toLowerCase() + 's';
  vm.resourcePath = `/${vm.artifactTypeLower}`;
  vm.currentUser = allUserFilters.filter(user => user.username === Authentication.user.username)[0]; // Set Active User
  vm.userIsAdmin = Authentication.user.userRoles.some((role) => ['superAdmin', 'admin'].includes(role.name));
  vm.hasCreatePermission = false;
  vm.customFilters = vm.currentUser.filters ? vm.currentUser.filters.filter(f => f.artifactType === 'booking') : [];
  // Artifacts
  vm.visibleArtifacts = [];
  vm.allDeployments = _.clone(allDeployments);
  vm.allProductTypes = _.clone(allProductTypes);
  vm.allPrograms = _.clone(allPrograms);
  var unassignedProgram = vm.allPrograms.find(program => program.name === 'Unassigned');
  vm.allAreas = _.clone(allAreas);
  var unassignedArea = vm.allAreas.find(area => area.name.includes('Unassigned'));
  vm.allTeams = _.clone(allTeams);
  vm.allLabels = _.clone(allLabels);
  vm.allCreatedByUsers = [{ _id: true, name: 'Current User' }];
  vm.filteredModalDeployments = [];
  vm.selectedLabel = '';
  vm.selectedProductType = '';
  vm.filteredDeploymentsToggle = true;
  vm.jenkinsJobEnabled = false;
  vm.disabledJenkinsJobSettingsMsg = 'Disabled due to no Jenkins Job URL found in the selected Deployment-Product, to enable add Jenkins Job URL to the selected Product in the Deployment.';
  // Filters
  vm.programFilter = programFilter;
  vm.raPreference = (vm.currentUser.area_id) ? allAreas.filter(area => area._id === vm.currentUser.area_id)[0] : '';
  vm.areaFilter = (vm.raPreference && !areaFilter) ? vm.raPreference._id : areaFilter;
  vm.teamFilter = teamFilter;
  vm.deploymentFilter = deploymentFilter;
  vm.productTypeFilter = productTypeFilter;
  vm.createdByFilter = createdByFilter;
  vm.startTimeAfterFilter = startTimeAfterFilter;
  vm.endTimeBeforeFilter = endTimeBeforeFilter;
  vm.labelFilter = labelFilter;
  var allBookableDeployments = allDeployments.filter(depl => depl.status === 'Free' || depl.status === 'In Use');
  var currentDateCalendar = moment();
  var calendarMonday = currentDateCalendar.clone().startOf('isoWeek').add(3, 'hours');
  var currentWeekFormat = 'MMMM Do';
  vm.currentWeek = `${moment(calendarMonday).format(currentWeekFormat)} - ${moment(calendarMonday).add(6, 'days').format(currentWeekFormat)}`;
  vm.fitlerDeploymentsToggle = false;

  // ENM Product Drops and NSS Versions
  vm.allENMProductDrops = [];
  vm.allNSSVersions = [];
  async function getENMselectOptions() {
    // ENM Product Drops
    vm.allENMProductDrops = await $.getJSON(`${ciPortalUrl}/dropsInProduct/.json/?products=ENM`);
    vm.allENMProductDrops.Drops.unshift('LATEST GREEN', 'DON\'T CARE');
    // NSS Versions
    vm.allNSSVersions = await $.getJSON(`${ciPortalUrl}/getActiveDrops/?product=NETSIM`);
    vm.allNSSVersions.Drops.unshift('Currently not required', 'Currently not able to rollout', 'Latest Green');
  }
  // ENM Product Sets and Jenkins II
  vm.showENMProductSets = false;
  vm.allENMProductSets = [];
  vm.showAutomaticTriggerOption = false;

  // Testing Type Options
  vm.allTestingTypes = [
    'Not Applicable', 'Functional', 'Exploratory', 'Performance / Characteristics', 'Rollback',
    'Scalability', 'Stability', 'High Availability / Robustness',
    'Upgrade', 'Initial Install', 'Maintenance'
  ];

  // Jira Template Code
  vm.currentTemplateInfo = 'Please select a template from available options.';
  vm.allTemplates = [];
  function getCurrentBookingTemplates() {
    var associatedDepl = allDeployments.find(depl => depl._id === vm.booking.deployment_id);
    var associatedProgram = allPrograms.find(prog => prog._id === associatedDepl.program_id);
    // check if program has a template
    if (associatedProgram && associatedProgram.jira_templates.length !== 0) {
      var currentProduct = associatedDepl.products.find(prod => prod._id === vm.booking.product_id);
      // only populate templates if Deploymenth has a product
      if (currentProduct) vm.allTemplates = associatedProgram.jira_templates.filter(templ => templ.infrastructure === currentProduct.infrastructure);
    }
    vm.booking.useCustomJiraTemplate = (vm.allTemplates.length !== 0);
  }

  vm.jiraTemplateHandler = function () {
    vm.booking.jiraTemplate = {};
    vm.booking.jiraTemplate.jiraBoard = vm.selectedTemplate.jiraBoard;
    vm.booking.jiraTemplate.issueType = vm.selectedTemplate.issueType;
    vm.booking.jiraTemplate.project = vm.selectedTemplate.project;
    if (vm.selectedTemplate.components && vm.selectedTemplate.components.length !== 0) {
      vm.booking.jiraTemplate.components = vm.selectedTemplate.components;
    }
    if (vm.selectedTemplate.custom_fields && vm.selectedTemplate.custom_fields.length !== 0) {
      vm.booking.jiraTemplate.custom_fields = vm.selectedTemplate.custom_fields;
    }
    vm.currentTemplateInfo = populateTemplateInfo(vm.selectedTemplate);
  };

  function populateTemplateInfo(template) {
    var currentTeplateComponents = '';
    var currentTemplateCustomFields = '';
    if (template.components && template.components.length !== 0) {
      currentTeplateComponents += '\nComponents: ';
      template.components.forEach(function (component) {
        currentTeplateComponents += `| ${component} `;
      });
    }
    if (template.custom_fields && template.custom_fields.length !== 0) {
      currentTemplateCustomFields += '\nCustom Fields: ';
      template.custom_fields.forEach(function (field) {
        currentTemplateCustomFields += `| Key: ${field.key_name} Value: ${field.key_value}`;
      });
    }
    return `Jira Board: ${template.jiraBoard}\nProject: ${template.project}\nIssue Type: ${template.issueType}${currentTeplateComponents}${currentTemplateCustomFields}`; // eslint-disable-line max-len
  }

  function assignTemplateObjectToBooking() {
    getCurrentBookingTemplates();
    var currentIndex;
    vm.currentTemplateInfo = populateTemplateInfo(vm.booking.jiraTemplate);
    vm.allTemplates.forEach(function (templ, index) {
      var templateInfo = populateTemplateInfo(templ);
      // Check for template equality
      if (templateInfo === vm.currentTemplateInfo) { currentIndex = index; }
    });
    vm.selectedTemplate = vm.allTemplates[currentIndex];
  }

  /* *************************
   ARTIFACT LISTS RELATED CODE
   ************************* */

  // Sort bookings by oldest start-time
  // ---------------------------------------
  allBookings = allBookings.sort(function (a, b) {
    if (a.startTime < b.startTime) return -1;
    return (a.startTime > b.startTime) ? 1 : 0;
  });

  // DateTime Formats
  // ----------------
  var dateTimeEventFormat = 'Do MMM YYYY';
  var dateTimeFormat = 'YYYY-MM-DD';

  // Map additional attributes to each Booking
  // -----------------------------------------
  allBookings.forEach(function (booking) {
    // Map dependant Artifacts to a Booking
    booking.deployment = findArtifact(allDeployments, booking.deployment_id);
    booking.product = findArtifact(booking.deployment.products, booking.product_id);
    if (booking.product) booking.productType = findArtifact(allProductTypes, booking.product.product_type_name, 'name');
    booking.area = findArtifact(allAreas, booking.deployment.area_id);
    booking.program = findArtifact(allPrograms, booking.area.program_id);
    booking.team = findArtifact(allTeams, booking.team_id);
    booking.customTeamName = booking.customTeamName || '';
    if (booking.sharingWithBooking_id) {
      booking.sharingWith = findArtifact(allBookings, booking.sharingWithBooking_id);
    }
    var associatedLog = allBookingLogs.find(bookingLog => bookingLog.associated_id === booking._id);
    var numberOfBookingUpdates = (associatedLog) ? associatedLog.updates.length : null;
    // Map attributes required by fullcalendar.js
    booking.title = booking.deployment.name;
    booking.id = booking._id;
    booking.start = booking.startTime;
    booking.end = booking.endTime;
    booking.createdBy = (associatedLog) ? associatedLog.createdBy : 'UNKNOWN USER';
    booking.createdAt = (associatedLog) ? moment(associatedLog.createdAt).format(dateTimeFormat) : null;
    if (numberOfBookingUpdates) {
      var lastBookingUpdate = associatedLog.updates[numberOfBookingUpdates - 1];
      booking.updatedBy = lastBookingUpdate.updatedBy;
      booking.updatedAt = moment(lastBookingUpdate.updatedAt).format(dateTimeFormat);
    }

    booking.isENM = (booking.productType && booking.productType.name.includes('ENM'));
  });
  // Add Artifact-Lists to Controller
  // --------------------------------
  vm.allDeployments = allDeployments;

  // Filter Dropdown Options
  vm.mainFilterOptions = [
    { heading: 'Program', name: 'programFilter', options: vm.allPrograms },
    { heading: 'RA', name: 'areaFilter', options: vm.allAreas }
  ];
  vm.additionalFilterOptions = [
    { heading: 'Team', name: 'teamFilter', options: vm.allTeams },
    { heading: 'Deployment', name: 'deploymentFilter', options: vm.allDeployments },
    { heading: 'Product-Type', name: 'productTypeFilter', options: vm.allProductTypes },
    { heading: 'Label', name: 'labelFilter', options: vm.allLabels },
    { heading: 'Created By', name: 'createdByFilter', options: vm.allCreatedByUsers }
  ];

  /* ***************************
   DATE-TIME PICKER RELATED CODE
   ************************** */
  // DateTime Picker Constuctor
  // --------------------------
  var dateTimePickerOptions = {
    autoclose: true,
    minView: 'month',
    maxView: 'year',
    format: 'yyyy-mm-dd hh:ii',
    weekStart: 1
  };

  // DateTime Picker Initializer
  // ---------------------------
  async function initializeDateTimePickers(isTeamTimeModal) {
    // Initialize and Set Minimum Choosable Date-Times for Start and End Date
    delete vm.maxBookingAdvanceWeeks;
    delete vm.maxBookingDurationDays;
    var altText = (isTeamTimeModal) ? 'Alt' : '';
    // Clearing DateTimePicker
    $(`#startTimePicker${altText}`).datetimepicker('remove');
    $(`#endTimePicker${altText}`).datetimepicker('remove');

    // Disable/Enable span startdate calendar click
    $('[name="startTimeSpan"]').css('pointer-events', (vm.endDateModifiable && !vm.bookingIsModifiable) ? 'none' : 'auto');

    if (vm.bookingIsModifiable || vm.endDateModifiable) {
      // Setting DateTimePicker
      var startPickerOptions = _.clone(dateTimePickerOptions);
      startPickerOptions.container = `#startTimePicker${altText}`;
      $(`#startTimePicker${altText}`).datetimepicker(startPickerOptions);
      var endPickerOptions = _.clone(dateTimePickerOptions);
      endPickerOptions.container = `#endTimePicker${altText}`;
      $(`#endTimePicker${altText}`).datetimepicker(endPickerOptions);

      // Limiting the selectable Start and End DateTime Picker values
      $(`#startTimePicker${altText}`).datetimepicker('setStartDate', moment().format(dateTimeFormat));
      var endTimeMoment = (vm.booking.startTime) ? moment(vm.booking.startTime, dateTimeFormat) : moment();
      $(`#endTimePicker${altText}`).datetimepicker('setStartDate', endTimeMoment.format(dateTimeFormat));
    }
    if (vm.crudType !== 'creation' && vm.booking.endTime) {
      vm.booking.endTime = moment(vm.booking.endTime).subtract(1, 'days').format(dateTimeFormat);
    }
    if (vm.endDateModifiable) {
      await setAreaBookingRestrictions('team');
      updateTimePickerRestrictions(isTeamTimeModal);
      _.defer(() => $scope.$apply());
    }
  }

  function initializeDateTimePickersTable() {
    // Clearing DateTimePicker
    $('#startTimePickerFilter').datetimepicker('remove');
    $('#endTimePickerFilter').datetimepicker('remove');

    // Setting DateTimePicker
    var startPickerOptions = _.clone(dateTimePickerOptions);
    startPickerOptions.container = '#startTimePickerFilter';
    $('#startTimePickerFilter').datetimepicker(startPickerOptions);
    var endPickerOptions = _.clone(dateTimePickerOptions);
    endPickerOptions.container = '#endTimePickerFilter';
    $('#endTimePickerFilter').datetimepicker(endPickerOptions);
  }

  function startTimeChangeHandler(isTeamTimeModal) {
    var altText = (isTeamTimeModal) ? 'Alt' : '';
    vm.booking.startTime = getFormattedTimePickerMoment(`#startTimePicker${altText}`);
    $(`#endTimePicker${altText}`).datetimepicker('setStartDate', moment(vm.booking.startTime).format(dateTimeFormat));
    if (vm.booking.startTime >= vm.booking.endTime) vm.booking.endTime = null;

    updateTimePickerRestrictions(isTeamTimeModal);
    _.defer(() => $scope.$apply());
  }

  function endTimeChangeHandler(isTeamTimeModal) {
    var altText = (isTeamTimeModal) ? 'Alt' : '';
    vm.booking.endTime = getFormattedTimePickerMoment(`#endTimePicker${altText}`);
    _.defer(() => $scope.$apply());
  }

  function startTimeChangeHandlerTable() {
    vm.startTimeAfterFilter = getFormattedTimePickerMoment('#startTimePickerFilter');
    vm.updateViewForFilter('startTimeAfterFilter', vm.startTimeAfterFilter);
    vm.setVisibleArtifacts();
    _.defer(() => $scope.$apply());
  }

  function endTimeChangeHandlerTable() {
    vm.endTimeBeforeFilter = getFormattedTimePickerMoment('#endTimePickerFilter');
    vm.updateViewForFilter('endTimeBeforeFilter', vm.endTimeBeforeFilter);
    vm.setVisibleArtifacts();
    _.defer(() => $scope.$apply());
  }

  function getFormattedTimePickerMoment(elemId) {
    return moment($(elemId).data('datetimepicker').getDate().setHours(0, 0, 0, 0)).format(dateTimeFormat);
  }

  // JIRA Issue Validator
  vm.jiraIssueValidator = async function (scopeElement) {
    // eslint-disable-next-line no-unused-expressions
    (vm.booking.jiraMRBugReferenceIssue) ? await jiraIssueValidation($http, Notification, scopeElement, vm.booking.jiraMRBugReferenceIssue) : scopeElement.$setValidity('jiraValidation', true);
  };

  /* *************************
   BOOKING MODALS RELATED CODE
   ************************* */
  var bookingCrudModal = document.getElementById('booking-crud-modal');
  var bookingFindDeploymentModal = document.getElementById('booking-find-deployment-modal');
  var bookingDeploymentModal = document.getElementById('booking-deployment-modal');

  // Handler for closing modals
  vm.closeModals = function () {
    vm.booking = {};
    bookingCrudModal.style.display = 'none';
    bookingFindDeploymentModal.style.display = 'none';
    bookingDeploymentModal.style.display = 'none';
  };

  // Handler for returning to team/label/time selection modal
  vm.returnTofindDeploymentModal = function () {
    vm.booking = {};
    bookingDeploymentModal.style.display = 'none';
    bookingFindDeploymentModal.style.display = 'block';
  };

  // Event Handler for clicking outside modal boundaries
  window.onclick = function (event) {
    if (event.target === bookingCrudModal || event.target === bookingFindDeploymentModal) {
      if ($location.search().bookingFocus) $state.go('.', { bookingFocus: null });
      vm.closeModals();
    } else if (event.target === bookingDeploymentModal) {
      vm.returnTofindDeploymentModal();
    }
  };

  /* *******************************
   FILTERS & URL-PARAMS RELATED CODE
   ******************************* */
  // Set visible Bookings by those that intersect each filter
  vm.setVisibleArtifacts = function () {
    vm.updateFilterOptions();
    var filterAttributes = [
      { value: vm.programFilter, key: 'program._id' },
      { value: vm.areaFilter, key: 'area._id' },
      { value: vm.teamFilter, key: 'team._id' },
      { value: vm.deploymentFilter, key: 'deployment._id' },
      { value: vm.productTypeFilter, key: 'productType._id' },
      { value: vm.labelFilter, key: 'label_ids' },
      { value: vm.startTimeAfterFilter, key: 'startTime', operator: '<=' },
      { value: vm.endTimeBeforeFilter, key: 'endTime', operator: '>=' },
      { value: vm.createdByFilter ? vm.currentUser.username : '', key: 'createdBy.username' }
    ];
    vm.visibleArtifacts = vm.getFilteredArtifacts(allBookings, filterAttributes);
    if (vm.selectedView === 'week') {
      $timeout(function () {
        vm.calendar.removeAllEvents();
        initializeWeeklyCalendar();
        $scope.$apply();
      });
    } else if (vm.selectedView === 'month') {
      $timeout(function () {
        vm.calendar.removeAllEvents();
        vm.calendar.addEventSource(vm.visibleArtifacts);
        $scope.$apply();
        window.dispatchEvent(new Event('resize'));
      });
    } else {
      $timeout(function () {
        if ($.fn.DataTable.isDataTable('#bookings-table')) {
          $('#bookings-table').DataTable().clear().rows.add(vm.visibleArtifacts).draw(); // eslint-disable-line new-cap
        }
      });
    }
  };

  /* **********************************
   CALENDAR-INITIALIZATION RELATED CODE
   ********************************** */

  function getGeneratedLink(artifactType, artifactObject) {
    var artifactLink = `<a ui-sref="${artifactType}s.view({${artifactType}Id: '${artifactObject._id}'})">${artifactObject.name}</a>`;
    return $compile(artifactLink)($scope)[0].outerHTML;
  }

  function setViewHeader() {
    $('.fc-toolbar-title').html('');
    if (vm.selectedView !== 'table') {
      var currentMonthYear = vm.calendar.getDate();
      $('.fc-toolbar-title').html((vm.selectedView === 'week') ? vm.currentWeek : moment(currentMonthYear).format('MMMM YYYY'));
    }
  }

  function updateCalendarWeekMonth(val) {
    if (vm.selectedView === 'week') {
      vm.updateCalendarWeek(val);
    } else if (vm.selectedView === 'month') {
      vm.calendar.incrementDate({ months: val });
      vm.calendar.removeAllEvents();
      vm.calendar.addEventSource(vm.visibleArtifacts);
      $scope.$apply();
      window.dispatchEvent(new Event('resize'));
    }
    setViewHeader();
  }

  function updateViewType(view) {
    vm.calendar.removeAllEvents();
    vm.calendar.setOption('height', 65);
    vm.selectedView = view;
    // Toggle Element View
    $('#monthly-calendar table').toggle(view === 'month');
    $('#weekly-calendar').toggle(view === 'week');
    $('#bookings-table-container').toggle(view === 'table');
    // Set Header
    setViewHeader();
    // Refresh Calendar view if required
    if (view === 'week') {
      initializeWeeklyCalendar();
    } else {
      vm.setVisibleArtifacts();
      if (view === 'month') {
        vm.calendar.destroy();
        initializeMonthlyCalendar();
      }
    }
    _.defer(() => $scope.$apply());
  }

  vm.initializeBookingViewModal = function (bookingId) {
    var bookingForView = findArtifact(allBookings, bookingId);
    vm.booking = _.cloneDeep(bookingForView);
    $state.go('.', { bookingFocus: vm.booking._id });
    initializeBookingModal('update');
  };

  function initializeMonthlyCalendar() {
    var calendarEl = document.getElementById('monthly-calendar');
    vm.calendar = new Calendar(calendarEl, {
      plugins: [dayGridPlugin, timeGridPlugin],
      headerToolbar: {
        left: 'title',
        right: 'customPrevButton,customNextButton,customMonthButton,customWeekButton,customTableButton'
      },
      customButtons: {
        customMonthButton: {
          text: 'Month',
          click: () => updateViewType('month')
        },
        customWeekButton: {
          text: 'Week',
          click: () => updateViewType('week')
        },
        customTableButton: {
          text: 'Table',
          click: () => updateViewType('table')
        },
        customPrevButton: {
          icon: 'left-single-arrow',
          click: () => updateCalendarWeekMonth(-1)
        },
        customNextButton: {
          icon: 'right-single-arrow',
          click: () => updateCalendarWeekMonth(1)
        }
      },
      initialView: 'dayGridMonth',
      height: 700,
      timeZone: 'UTC',
      eventDisplay: 'block',
      firstDay: 1,
      allDaySlot: false,
      slotLabelFormat: 'ha',
      nowIndicator: true,
      events: vm.visibleArtifacts,
      displayEventEnd: true,
      eventClick: async function (eventInfo) {
        if (eventInfo.event.id) {
          vm.initializeBookingViewModal(eventInfo.event.id);
        }
      },
      eventDidMount: function (eventInfo) {
        var booking = eventInfo.event;
        var bookingExt = booking.extendedProps;
        // Booking Hover-Over Pop-Up
        if (booking.id) {
          var startDate = moment(booking.start);
          var endDate = moment(booking.end);
          var popUpFields = populatePopOutFields(bookingExt, booking);
          // Setup all html
          var htmlBookingFields = popUpFields.map(field => `<strong>${field.name}:</strong> ${field.value}<br>`).join('');
          var htmlShareableStatus = getBookingTypeHtml(bookingExt);
          $(eventInfo.el).qtip(populateQTip(bookingExt.jiraIssue, htmlShareableStatus, htmlBookingFields, false, ''));
          var htmlTimeDetails = `<strong>${popUpFields[3].value} ${(endDate.diff(startDate, 'days') > 1) ? ' - ' + popUpFields[4].value : ''} </strong>`;
          var htmlBookingDetails = `${bookingExt.deployment.name}  ${bookingExt.productType ? '(' + bookingExt.productType.name + ')' : ''}<br>
                                    RA: ${bookingExt.area.name}, Team: ${bookingExt.customTeamName || bookingExt.team.name}`;
          $(eventInfo.el).find('.fc-event-time').html('');
          $(eventInfo.el).find('.fc-event-title').html('');
          $(eventInfo.el).find('.fc-event-title').html(`${htmlTimeDetails}<br>${htmlShareableStatus}<br>${htmlBookingDetails}`);
        }
      }
    });
    vm.calendar.render();
    window.dispatchEvent(new Event('resize'));
    var extraEl = $('.fc-daygrid .fc-scrollgrid tbody').get(0).nextSibling;
    if (extraEl) extraEl.nodeValue = '';
    vm.calendarLoading = false;
    _.defer(() => $scope.$apply());
  }

  function populateHeaderCell(id, text) {
    $(`#${id}`).html(`<b>${text}</b>`);
  }

  function returnSharingBookings(shareableBooking) {
    var sharingBookings = allBookings.filter(booking => booking.bookingType === 'Sharing');
    return sharingBookings.filter(sharing => sharing.sharingWithBooking_id === shareableBooking._id
      && moment(sharing.startTime).add(2, 'hours').isAfter(shareableBooking.startTime)
      && moment(sharing.endTime).subtract(2, 'hours').isBefore(shareableBooking.endTime));
  }

  function populateBookingCell(id, booking, cellDate) {
    var sharingBookings = [];
    if (booking.bookingType === 'Shareable') sharingBookings = returnSharingBookings(booking);
    var teamName = (booking.team_id) ? allTeams.find(team => team._id === booking.team_id).name : `Loaned to: ${booking.customTeamName}`;
    var cell = $(`#${id}`);
    var html = `${getBookingTypeHtml(booking, false, sharingBookings.length > 0)}
                <br>Team: ${teamName}
                <br>${moment(booking.startTime).format('MMM DD')}-${moment(booking.endTime).subtract(1, 'days').format('MMM DD')}`;
    cell.html(html);
    cell.css('background-color', booking.backgroundColor ? booking.backgroundColor : '#66cbe5');
    cell.css('color', 'white');
    // qTip html
    var popUpFields = populatePopOutFields(booking, sharingBookings);
    var htmlShareableStatus = getBookingTypeHtml(booking, true);
    var htmlBookingFields = popUpFields.map(field => `<strong>${field.name}:</strong> ${field.value}<br>`).join('');
    var htmlSharingBookings = '';
    if (sharingBookings.length > 0) htmlSharingBookings = populateSharingBookingsHtmlFields(sharingBookings, cellDate);

    cell.qtip(populateQTip(booking.jiraIssue, htmlShareableStatus, htmlBookingFields, true, booking.bookingType === 'Shareable', cellDate, booking.deployment_id, htmlSharingBookings, sharingBookings));

    cell.on('click', function () {
      if (booking._id) {
        var bookingForUpdate = findArtifact(allBookings, booking.id);
        vm.booking = _.cloneDeep(bookingForUpdate);
        $state.go('.', { bookingFocus: vm.booking._id });
        initializeBookingModal('update');
      }
    });
  }

  function deleteAllQtipsOnTheDOM() {
    $("div:hidden[id*='qtip-']").each(function () {
      this.remove();
    });
  }

  function initializeWeeklyCalendar() {
    var formatDateTopRow = 'ddd Do MMM';
    deleteAllQtipsOnTheDOM();
    var table = $('#booking-table tbody')[0];
    var tableThead = $('#booking-table thead')[0];
    $(tableThead).empty();
    $(table).empty();

    var newRow = tableThead.insertRow(tableThead.rows.length);
    var deploymentNameCell = newRow.insertCell(-1);
    deploymentNameCell.id = 'header-deployment';
    populateHeaderCell(deploymentNameCell.id, 'Deployment');

    // Populate week days
    for (var h = 0; h < 7; h += 1) {
      var weekCell = newRow.insertCell(-1);
      weekCell.id = `day-${h}`;
      populateHeaderCell(weekCell.id, moment(calendarMonday).add(h, 'days').format(formatDateTopRow));
    }
    // Populate deployments
    allBookableDeployments.forEach(function (deployment) {
      var deploymentBookings = vm.visibleArtifacts.filter(book => deployment._id === book.deployment_id);
      if (deploymentBookings && deploymentBookings.length !== 0) {
        var newRow = table.insertRow(table.rows.length);
        var deploymentCell = newRow.insertCell(-1);
        deploymentCell.id = `${deployment.name}`;
        populateHeaderCell(deploymentCell.id, deployment.name);
        deploymentCell.style.color = 'white';
        deploymentCell.style.backgroundColor = '#78C0A8';

        // For each Booking cell
        for (var i = 0; i < 7; i += 1) {
          var freeCell = true;
          var bookingCell = newRow.insertCell(-1);
          var currentCellDate = moment(calendarMonday).add(i, 'days');
          var cellDate = moment(currentCellDate).format(dateTimeFormat);
          bookingCell.style.cursor = 'pointer';
          // eslint-disable-next-line no-loop-func
          deploymentBookings.forEach(function (booking) {
            if (booking.bookingType !== 'Sharing' && currentCellDate.isBetween(booking.startTime, booking.endTime)) {
              freeCell = false;
              var deploymentNameForId = (booking.bookingType === 'Sharing') ? deployment.name + '-s' : deployment.name;
              bookingCell.id = `${cellDate}-${deploymentNameForId}`;
              populateBookingCell(bookingCell.id, booking, cellDate);
            }
          });

          if (freeCell) {
            bookingCell.id = cellDate;
            $(bookingCell).qtip({
              content: {
                text: `<hr>Book for: ${bookingCell.id}<hr>`
              },
              style: { classes: 'qtip-bootstrap' },
              position: {
                my: 'right center',
                at: 'left center'
              },
              hide: {
                delay: 200,
                fixed: true,
                effect: function () { $(this).fadeOut(250); }
              }
            });
            $(bookingCell).on('click', function () {
              if (!vm.booking) vm.booking = {};
              vm.booking.deployment_id = deployment._id;
              initializeBookingModal('creation', false);
              var dateSelectedFromCell = this.id;
              vm.booking.startTime = dateSelectedFromCell;
            });
          }
        }
      }
    });
  }

  function populateSharingBookingsHtmlFields(sharingBookings, cellDate) {
    var html = `<hr><i class="fa fa-user-friends"></i><strong> Sharing Bookings (${sharingBookings.length})</strong><br><hr>`;
    sharingBookings.forEach(function (sharingBooking) {
      var sharingTeam = allTeams.find(team => team._id === sharingBooking.team_id);
      html += `<strong>Team:</strong> ${getGeneratedLink('team', sharingTeam)}<br>
      <strong>Start:</strong> ${moment(sharingBooking.startTime).format('MMM Do')}<br>
      <strong>Finish:</strong> ${moment(sharingBooking.endTime).subtract(1, 'day').format('MMM Do')}<br>
      <button class="btn btn-xs btn-warning" id="${sharingBooking._id}-${cellDate}">View</button><hr>`;
    });
    return html;
  }

  function populatePopOutFields(booking, bookingEventInfo) {
    var compiledDeploymentLink = getGeneratedLink('deployment', booking.deployment);
    var compiledAreaLink = getGeneratedLink('area', booking.area);
    var compiledTeamLink = (booking.customTeamName) ? `Loaned to: ${booking.customTeamName}` : getGeneratedLink('team', booking.team);
    // Format Booking Dates
    var startDate = (bookingEventInfo.length === 0) ? booking.start : bookingEventInfo.start;
    var formattedStartTime = moment(startDate, dateTimeFormat).format(dateTimeEventFormat);
    var endDate = (bookingEventInfo.length === 0) ? booking.end : bookingEventInfo.end;
    var formattedEndTime = moment(endDate, dateTimeFormat).subtract(1, 'day').format(dateTimeEventFormat);
    var creator = (!booking.createdBy.username) ? 'Unknown User' : `${booking.createdBy.displayName} (${booking.createdBy.username})`;

    var popUpFields = [
      { name: 'Deployment', value: compiledDeploymentLink },
      { name: 'Area', value: compiledAreaLink },
      { name: 'Team', value: compiledTeamLink },
      { name: 'Start', value: formattedStartTime },
      { name: 'Finish', value: formattedEndTime },
      { name: 'Creator', value: `${creator}` },
      { name: 'JIRA MR/Bug Link', value: booking.jiraMRBugReferenceIssue },
      { name: 'Testing Type', value: booking.testingType }
    ];

    if (!booking.jiraMRBugReferenceIssue) delete popUpFields[6];

    if (booking.enmProductSetDrop) popUpFields.push({ name: 'ENM Drop Version', value: booking.enmProductSetDrop });
    if (booking.enmProductSetVersion) popUpFields.push({ name: 'ENM Product Set Version', value: booking.enmProductSetVersion });
    if (booking.additionalJenkinsUsers) popUpFields.push({ name: 'Additional Jenkins Users', value: booking.additionalJenkinsUsers.split(',').join(', ') });
    if (booking.infrastructure !== 'vCenter') popUpFields.push({ name: 'Jenkins Job Trigger', value: (booking.automaticJenkinsIITrigger) ? 'Automatic' : 'Manual' });
    if (booking.infrastructure !== 'vCenter') popUpFields.push({ name: 'Jenkins Job Type', value: booking.jenkinsJobType });
    if (booking.description) popUpFields.push({ name: 'Additional Requirements', value: booking.description });
    return popUpFields;
  }

  function getBookingTypeHtml(booking, forCellqTip, sharingBookings) {
    switch (booking.bookingType) {
      case 'Single':
        return `<strong><i class="fa fa-user"></i> Single${(!forCellqTip) ? '' : ' Booking'}</strong>`;
      case 'Shareable':
        return `<strong><i class="fa fa-users"></i> Shareable${(!forCellqTip) ? `${(sharingBookings) ? '<br>+ Sharing <i class="fa fa-user-friends"></i>' : ''}` : ' Booking'}</strong>`;
      case 'Sharing':
        return `<strong><i class="fa fa-user-friends"></i> Sharing ${(!forCellqTip) ? '' : `with ${booking.sharingWith.team.name}`} </strong>`;
      default: // do nothing
    }
  }

  function populateQTip(
    bookingJira, htmlBookingType, htmlBookingFields, pbtView, isShareable,
    cellDate, deploymentId, htmlSharingBookings, sharingBookings
  ) {
    return {
      id: `${cellDate}-${deploymentId}-qtip`,
      overwrite: true,
      content: {
        title: `Booking for ${bookingJira}`,
        text: `<hr>${htmlBookingType}<hr>
      ${htmlBookingFields}${(isShareable) ? `<br><button id="${cellDate}-${deploymentId}-create" class="btn btn-xs btn-success">Create Sharing Booking</button>` : ''}
      ${(pbtView && sharingBookings.length > 0) ? `<br><div ng-hide="!vm.weeklyCalendar" style="overflow-y: auto; height: ${(sharingBookings.length === 1) ? '160px' : '200px'};">${htmlSharingBookings}</div>` : ''}`
      },
      style: { classes: 'qtip-bootstrap' },
      position: {
        my: (pbtView) ? 'right center' : 'bottom center',
        at: (pbtView) ? 'left center' : 'top center'
      },
      hide: {
        delay: 200,
        fixed: true,
        effect: function () { $(this).fadeOut(250); }
      },
      events: {
        show: function () {
          if (pbtView) {
            if (isShareable) {
              onClickCreateButton(cellDate, deploymentId);
            }
            for (var i = 0; i < sharingBookings.length; i += 1) {
              $(`#${sharingBookings[i]._id}-${cellDate}`).on('click', function () {
                var bookingIdSplit = this.id.split('-');
                var bookingForUpdate = findArtifact(allBookings, bookingIdSplit[0]);
                vm.booking = _.cloneDeep(bookingForUpdate);
                $state.go('.', { bookingFocus: bookingIdSplit[0] });
                initializeBookingModal('update');
              });
            }
          }
        }
      }
    };
  }

  function onClickCreateButton(cellDate, deploymentId) {
    $(`#${cellDate}-${deploymentId}-create`).on('click', function () {
      initializeBookingModal('creation', true);
      vm.booking.deployment_id = deploymentId;
      vm.booking.startTime = cellDate;
      vm.booking.bookingType = 'Shareable';
      $('#deployment-select').val(`string:${vm.booking.deployment_id}`).trigger('change');
    });
  }

  /* ************************
   BOOKING-MODAL RELATED CODE
   ************************ */
  // Handler for when Dropdown Program and RA is chosen
  vm.filterBookingDeploymentOptions = async function (filterKey) {
    var filterValue = (filterKey === 'program_id') ? vm.modalDeploymentByProgramFilter : vm.modalDeploymentByRAFilter;
    if (filterKey === 'program_id') {
      vm.modalDeploymentByRAFilter = undefined;
      vm.filteredAreas = allAreas.filter(area => area.program_id === vm.modalDeploymentByProgramFilter);
    }
    var filteredDeployments = [];
    if (vm.crudType === 'creation') {
      filteredDeployments = allDeployments;
      if (unassignedProgram || unassignedArea) {
        filteredDeployments = allDeployments.filter(depl => depl.program_id !== unassignedProgram._id || depl.area_id !== unassignedArea._id);
      }
      var filteredDepsList = filteredDeployments.filter(deployment => deployment[filterKey] === filterValue);
      if (vm.booking.deployment_id) {
        var isBookable = filteredDepsList.find(deployment => deployment._id === vm.booking.deployment_id);
        if (!isBookable) delete vm.booking.deployment_id;
      }
      vm.filteredModalDeployments = (!filterValue) ? filteredDeployments : filteredDepsList;
    } else {
      filteredDeployments = allDeployments.filter(deployment => deployment[filterKey] === filterValue);
      vm.filteredModalDeployments = (!filterValue) ? allDeployments : filteredDeployments;
    }
  };

  function clearFieldsForENM() {
    vm.bookingIsENM = false;
    vm.booking.automaticJenkinsIITrigger = null;
    vm.booking.jenkinsJobType = undefined;
  }
  // Handler for when Dropdown Deployment is chosen
  vm.bookingDeploymentUpdateHandler = async function (onlyHandleConfigFields) {
    vm.booking.product_id = null;
    clearFieldsForENM();
    if (!vm.findByDeploymentModal) validateDeploymentStatus();
    else validateDeploymentStatusAlt();
    setBookingProductOptions();
    if (!onlyHandleConfigFields) {
      setBookingTeamOptions();
      await setAreaBookingRestrictions('deployment');
      updateTimePickerRestrictions(false);
    }
    await getBookingConfigFields();
  };

  // Handler for when Dropdown Product is chosen
  vm.bookingProductUpdateHandler = async function () {
    if (!vm.booking.product_id) { return; }
    var bookingProduct = vm.bookingProductOptions.find(product => product._id === vm.booking.product_id);

    getCurrentBookingTemplates();
    if (!bookingProduct.product_type_name.includes('ENM')) clearFieldsForENM();
    else {
      vm.bookingIsENM = true;
      vm.jenkinsJobEnabled = (bookingProduct.jenkinsJob !== undefined && bookingProduct.jenkinsJob !== '');
      if (!vm.jenkinsJobEnabled && !vm.booking.enmProductSetDrop) {
        vm.booking.enmProductSetDrop = 'DON\'T CARE';
        $('#enmProductSetDrop-select, enmProductSetDropAlt-select').val(`string:${vm.booking.enmProductSetDrop}`).trigger('change');
      }
      vm.booking.jenkinsJobType = vm.booking.jenkinsJobType || 'II';
      var infraIsVCenter = bookingProduct.infrastructure === 'vCenter';
      vm.showAutomaticTriggerOption = !infraIsVCenter;
      var jenkinsURLisValid = true;
      if (bookingProduct.jenkinsJob && vm.crudType === 'creation') {
        // check url
        var encodedUrl = encodeURIComponent(bookingProduct.jenkinsJob);
        await $http({ method: 'GET', url: `/api/jenkinsURLValidation/${encodedUrl}` }).then(response => {
          jenkinsURLisValid = response.data.isURLValid;
          if (!response.data.isURLValid) {
            Notification.error({
              message: JSON.stringify('\'Trigger Jenkins Job\' option is now set to \'Manual\'.To enable Automatic Trigger, please ensure Jenkins URL is valid for selected Product.'),
              title: '<i class="glyphicon glyphicon-remove"></i> Jenkins Job URL is invalid.'
            });
          }
        }).catch(error => {
          Notification.error({
            message: JSON.stringify('Booking \'Trigger Jenkins Job\' option is now set to \'Manual\'.To enable Automatic Trigger, please ensure Jenkins URL is valid for selected Product.'),
            title: `<i class="glyphicon glyphicon-remove"></i> Jenkins Job URL is invalid. ${error}`
          });
        });
      }
      vm.booking.automaticJenkinsIITrigger = !infraIsVCenter && vm.crudType === 'creation' && jenkinsURLisValid;
      vm.automaticJenkinsIITriggerDisabled = jenkinsURLisValid;
    }
    await getBookingConfigFields();
    _.defer(() => $scope.$apply());
  };

  // Handler for when Dropdown Team is chosen
  vm.bookingTeamTimeUpdateHandler = async function () {
    await setAreaBookingRestrictions('team');
    updateTimePickerRestrictions(true);
  };

  // Get Start & End Date restrictions; Set by RA
  async function setAreaBookingRestrictions(artifactTypeToFilterBy) {
    try {
      var associatedArtifact;
      if (artifactTypeToFilterBy === 'deployment' && vm.booking.deployment_id) {
        associatedArtifact = findArtifact(allDeployments, vm.booking.deployment_id);
      } else if (artifactTypeToFilterBy === 'team' && vm.booking.team_id) {
        associatedArtifact = findArtifact(allTeams, vm.booking.team_id);
      }
      if (associatedArtifact && associatedArtifact.area_id) {
        var associatedArea = findArtifact(allAreas, associatedArtifact.area_id);
        vm.maxBookingAdvanceWeeks = associatedArea.maxBookingAdvanceWeeks;
        vm.maxBookingDurationDays = associatedArea.maxBookingDurationDays;
      }
    } catch (errSettingRestrictions) {
      Notification.error({
        message: errSettingRestrictions.message,
        title: `${errorIcon} Failed to set Booking Restrictions!`
      });
    }
  }

  // Update Start & End Date Pickers with restrictions; Set by RA
  function updateTimePickerRestrictions(isTeamTimeModal) {
    if (vm.bookingIsModifiable || vm.endDateModifiable) {
      var altText = (isTeamTimeModal) ? 'Alt' : '';
      var maxBookingAdvancePoint;
      var maxBookingDurationPoint;
      var maxEndTime;

      if (vm.maxBookingAdvanceWeeks) {
        // Handle initialize max booking advance
        maxBookingAdvancePoint = moment().add(vm.maxBookingAdvanceWeeks, 'weeks');
        maxEndTime = _.cloneDeep(maxBookingAdvancePoint);
        $(`#startTimePicker${altText}`).datetimepicker('setEndDate', maxBookingAdvancePoint.format(dateTimeFormat));
      }
      if (vm.maxBookingDurationDays && vm.booking.startTime) {
        maxBookingDurationPoint = moment(vm.booking.startTime).add(vm.maxBookingDurationDays, 'days');
        maxEndTime = maxBookingDurationPoint;
      }
      if (maxBookingAdvancePoint && maxBookingDurationPoint) {
        // Assign Max End Time as the Earlier Date of the 2
        maxEndTime = (maxBookingAdvancePoint.isBefore(maxBookingDurationPoint)) ? maxBookingAdvancePoint : maxBookingDurationPoint;
      }
      if (maxEndTime) {
        $(`#endTimePicker${altText}`).datetimepicker('setEndDate', maxEndTime.format(dateTimeFormat));
        if (moment(vm.booking.endTime).isAfter(maxEndTime)) vm.booking.endTime = null;
      }
    }
  }

  // Reduce Available Booking-Teams; Set by Deployment
  function setBookingTeamOptions(crudType) {
    vm.bookingTeamOptions = [];
    if (!vm.booking.deployment_id) return;
    var associatedDeployment = findArtifact(allDeployments, vm.booking.deployment_id);
    if (!associatedDeployment) return;
    var teamsForRA = allTeams.filter(team => team.area_id === associatedDeployment.area_id);
    vm.bookingTeamOptions = (associatedDeployment.crossRASharing) ? allTeams : teamsForRA;
    if (unassignedArea && associatedDeployment.area_id === unassignedArea._id) vm.bookingTeamOptions = allTeams;
    vm.customTeamDisabled = (!associatedDeployment.crossRASharing);
    if (vm.customTeamDisabled) vm.customTeam = false;
    if (crudType === 'update') {
      vm.customTeamDisabled = true;
      vm.customTeam = (vm.booking.customTeamName);
    }
    _.defer(() => $scope.$apply());
  }

  // Reduce Available Booking-Products; Set by Deployment
  function setBookingProductOptions() {
    vm.showProductOptions = false;
    if (vm.booking.deployment_id) {
      var associatedDeployment = findArtifact(allDeployments, vm.booking.deployment_id);
      vm.bookingProductOptions = [];
      associatedDeployment.products.forEach(function (product) {
        vm.bookingProductOptions.push(product);
      });
      if (vm.bookingProductOptions.length > 0) {
        vm.showProductOptions = true;
      }
    }
  }

  function validateDeploymentStatus() {
    vm.bookingDeplStatusIsValid = true;
    if (vm.booking.deployment_id) {
      var bookingDeployment = allDeployments.find(deployment => deployment._id === vm.booking.deployment_id);
      vm.bookingDeplStatusIsValid = (bookingDeployment.status === 'Free' || bookingDeployment.status === 'In Use');
      vm.invalidDeplStatusMessage = (!vm.bookingDeplStatusIsValid) ?
        `NOTE: Booking cannot be ${(vm.crudType === 'creation') ? 'created' : 'updated'}, whilst Deployment status is "${bookingDeployment.status}"` : '';
      $scope.crudForm['deployment-select'].$setValidity('badDeplStatus', vm.bookingDeplStatusIsValid);
    }
  }

  function validateDeploymentStatusAlt() {
    var bookingDeplStatusIsValidAlt = true;
    if (vm.booking.deployment_id && !vm.customTeam) {
      var bookingDeployment = allDeployments.find(deployment => deployment._id === vm.booking.deployment_id);
      var team = allTeams.find(team => team._id === vm.booking.team_id);
      var teamRA = allAreas.find(area => area._id === team.area_id);
      var deploymentRA = allAreas.find(area => area._id === bookingDeployment.area_id);
      bookingDeplStatusIsValidAlt = bookingDeployment && (teamRA._id.toString() === deploymentRA._id.toString() || bookingDeployment.crossRASharing);
    }
    $scope.deploymentForm['deploymentAlt-select'].$setValidity('badDeplStatusAlt', bookingDeplStatusIsValidAlt);
  }

  vm.initializeBookingModal = initializeBookingModal;

  // Initialize Modal for Booking CRUD Operations
  async function initializeBookingModal(crudType, createFromQtip) {
    if (!vm.allENMProductDrops) await getENMselectOptions();
    vm.crudType = crudType;
    vm.jiraIssueDisplay = {};
    vm.jiraMRBugIssueDisplay = {};
    vm.customConfiguration = false;
    vm.customTeam = false;
    vm.bookingDeplStatusIsValid = true;
    vm.bookingIsModifiable = true;
    vm.bookingIsDeletable = true;
    vm.bookingIsENM = false;
    vm.bookingTitleMessage = 'NOTE: Ensure all values are correct as Booking CANNOT be modified once it has commenced.';
    vm.findByDeploymentModal = false;
    vm.jenkinsJobEnabled = false;
    switch (crudType) {
      case 'creation': {
        $('#deployment-select').val('').trigger('change');
        // New Booking
        var associatedDeplProduct;
        var associatedDeployment;
        var associatedProductType = (vm.productTypeFilter) ? await vm.allProductTypes.find(pt => pt._id === vm.productTypeFilter) : '';
        if (vm.deploymentFilter && associatedProductType) {
          associatedDeployment = await allDeployments.find(depl => depl._id === vm.deploymentFilter);
          associatedDeplProduct = await associatedDeployment.products.find(dp => dp.product_type_name === associatedProductType.name);
        }
        vm.booking = {
          deployment_id: (vm.booking && vm.booking.deployment_id) ? vm.booking.deployment_id : vm.deploymentFilter,
          product_id: (associatedDeplProduct) ? associatedDeplProduct._id : undefined,
          team_id: vm.teamFilter,
          automaticJenkinsIITrigger: true,
          configurationType: 'Inherited'
        };
        await getBookingConfigFields();
        vm.shareableToggle = createFromQtip;
        vm.shareableToggleIsEnabled = true;
        vm.showENMProductSets = false;
        vm.bookingDeploymentDropdownOptions = allDeployments;
        vm.allENMProductSets = [];
        vm.bookingProductOptions = [];
        vm.endDateModifiable = true;
        if (!associatedDeployment && vm.booking.deployment_id) {
          associatedDeployment = await allDeployments.find(depl => depl._id === vm.booking.deployment_id);
        }
        if (associatedDeployment && associatedDeployment.products) {
          waitToSetDeploymentProductSelect();
          setBookingProductOptions();
          if (vm.booking.product_id === undefined && associatedProductType) {
            associatedDeplProduct = await associatedDeployment.products.find(dp => dp.product_type_name === associatedProductType.name);
            vm.booking.product_id = (associatedDeplProduct) ? associatedDeplProduct._id : undefined;
          }
          $('#deployment-select').val(`string:${vm.booking.deployment_id}`).trigger('change');
        }
        if (vm.booking.product_id) {
          vm.bookingProductUpdateHandler();
          if (vm.bookingIsENM) waitToSetENMformSelect();
        }
        break;
      }
      case 'update': {
        // Pre-Existing Booking
        setBookingProductOptions();
        vm.bookingProductUpdateHandler();
        vm.shareableToggle = (vm.booking.bookingType === 'Sharing' || vm.booking.bookingType === 'Shareable');
        vm.shareableToggleIsEnabled = false;
        vm.showENMProductSets = false;
        vm.showAutomaticTriggerOption = !(vm.booking.infrastructure === 'vCenter');
        vm.endDateModifiable = !vm.booking.isExpired;
        vm.customTeam = (vm.booking.customTeamName);
        if (vm.booking.bookingType === 'Sharing' && vm.booking.isStarted) vm.endDateModifiable = false;
        // Get associated JIRA Issues Info
        if (vm.booking.jiraIssue) {
          await getJiraIssue($http, Notification, vm.booking.jiraIssue, vm.jiraIssueDisplay);
        }
        if (vm.booking.jiraMRBugReferenceIssue) {
          await getJiraIssue($http, Notification, vm.booking.jiraMRBugReferenceIssue, vm.jiraMRBugIssueDisplay);
        }
        // Get Product Set Versions if Product Drop is ENM
        if (vm.booking.enmProductSetDrop && vm.booking.enmProductSetDrop.includes('ENM')) {
          $(async function () { await populateENMProductSetVersions(); });
        }

        vm.customConfiguration = (vm.booking.configurationType === 'Custom');

        vm.booking.startTime = moment(vm.booking.startTime).format(dateTimeFormat);
        vm.booking.endTime = moment(vm.booking.endTime).format(dateTimeFormat);

        if (moment(vm.booking.startTime).isBefore(moment())) {
          // Booking is non modifiable if booking has already started
          var messageStart = !vm.endDateModifiable ? 'Cannot modify Booking' : 'Only Booking \'End Date\' can be modified';
          vm.bookingTitleMessage = `${messageStart}: Booking already commenced.`;
          vm.bookingIsModifiable = false;
          if (vm.booking.isExpired) vm.bookingTitleMessage = 'Cannot modify Booking. It has expired.';
        }
        var isOwnBooking = vm.booking.createdBy.username === vm.currentUser.username;
        var isTeamBooking = await isInTeam(vm.currentUser._id, vm.booking.team_id);
        var isSpocUser = vm.booking.deployment.spocUser_ids.includes(vm.currentUser._id);
        var isAllowedModify = Authentication.isAllowed(vm.resourcePath, 'put', isOwnBooking);
        var isPermittedToModify = (isAllowedModify || isTeamBooking || isSpocUser);
        if (!isPermittedToModify) {
          vm.bookingIsModifiable = false;
          vm.endDateModifiable = false;
          vm.bookingTitleMessage = 'Cannot modify Booking: You must be its creator, the Deployment SPOC or member of assigned team.';
        }

        var isAllowedDelete = Authentication.isAllowed(vm.resourcePath, 'delete', isOwnBooking);
        var isPermittedToDelete = (isAllowedDelete || isTeamBooking || isSpocUser);
        if (!isPermittedToDelete) {
          vm.bookingIsDeletable = false;
          vm.bookingTitleMessage = 'Cannot delete Booking: You must be its creator, the Deployment SPOC or member of assigned team.';
        }
        if (!isPermittedToDelete && !isAllowedModify) {
          vm.bookingTitleMessage = 'Cannot modify/delete Booking: You must be its creator, the Deployment SPOC or member of assigned team.';
        }
        if (vm.booking.isStarted && vm.booking.bookingType === 'Sharing') vm.endDateModifiable = false;
        assignTemplateObjectToBooking();

        if (vm.booking.product_id) waitToSetDeploymentProductSelect('1081');

        if (vm.bookingIsENM) {
          waitToSetENMformSelect();
          $('#enmProductSetDrop-select').val(`string:${vm.booking.enmProductSetDrop}`).trigger('change');
          if (vm.booking.nssVersion === 'undefined' || vm.booking.nssVersion === undefined) {
            delete vm.booking.nssVersion;
            $('#nssVersion-select').val('').trigger('change');
          } else {
            $('#nssVersion-select').val(`string:${vm.booking.nssVersion}`).trigger('change');
          }
        }
        if (vm.booking.enmProductSetVersion) {
          waitToSetProductSetVersionSelect();
          $('#enmProductSetVersion-select').val(`string:${vm.booking.enmProductSetVersion}`).trigger('change');
        }
        if (vm.booking.testingType) $('#testingType-select').val(`string:${vm.booking.testingType}`).trigger('change');
        break;
      }
      default: {
        Notification.error({
          title: `${errorIcon} Failed to Open Booking Modal!`,
          message: 'CRUD Operation type not selected.'
        });
      }
    }
    vm.filteredAreas = allAreas;
    vm.modalDeploymentByRAFilter = undefined;
    vm.modalDeploymentByProgramFilter = undefined;
    validateDeploymentStatus();
    setBookingTeamOptions(crudType);
    vm.filterBookingDeploymentOptions();
    setBookingProductOptions();
    initializeDateTimePickers();
    if (vm.bookingIsModifiable && vm.booking.deployment_id) {
      await setAreaBookingRestrictions('deployment');
      updateTimePickerRestrictions();
    }
    _.defer(() => $scope.$apply());
    bookingCrudModal.style.display = 'block';
  }

  // Open Booking-View Modal if bookingFocus url param exists
  if (bookingFocus) {
    vm.booking = findArtifact(allBookings, bookingFocus);
    if (vm.booking) initializeBookingModal('update');
  }

  async function getBookingConfigFields() {
    vm.booking.configuration = [];
    vm.booking.infrastructure = 'None';
    if (vm.booking.deployment_id && vm.booking.product_id) {
      var associatedDeployment = findArtifact(allDeployments, vm.booking.deployment_id);
      if (associatedDeployment) {
        var deplProduct = findArtifact(associatedDeployment.products, vm.booking.product_id);
        if (deplProduct) {
          vm.booking.configuration = _.cloneDeep(deplProduct.configuration);
          vm.booking.infrastructure = deplProduct.infrastructure;
          return true;
        }
        return false;
      }
    }
    _.defer(() => $scope.$apply());
  }

  vm.setToggleIsShareable = function () {
    vm.booking.bookingType = (vm.shareableToggle) ? 'Shareable' : 'Single';
  };

  vm.setToggleIsCustomTeam = function () {
    if (!vm.customTeam) vm.booking.customTeamName = undefined;
    if (vm.customTeam) {
      vm.booking.team_id = undefined;
      vm.filteredDeploymentsToggle = false;
    }
  };

  vm.setToggleCustomConfiguration = function () {
    vm.booking.configurationType = vm.customConfiguration ? 'Custom' : 'Inherited';
    if (!vm.customConfiguration) {
      getBookingConfigFields();
    }
    _.defer(() => $scope.$apply());
  };

  // Initialize Modal for Booking by Date and Team/Label/ProductType
  vm.initializefindDeploymentModal = async function () {
    vm.crudType = 'creation';
    vm.bookingIsModifiable = true;
    vm.shareableToggle = false;
    vm.shareableToggleIsEnabled = true;
    vm.customTeam = false;
    vm.filteredDeploymentsToggle = true;
    vm.customConfiguration = false;
    vm.endDateModifiable = true;
    vm.bookingTitleMessage = 'NOTE: Ensure all values are correct as Booking CANNOT be modified once it has commenced.';
    vm.findByDeploymentModal = true;
    vm.jenkinsJobEnabled = false;
    vm.booking = {
      team_id: vm.teamFilter,
      automaticJenkinsIITrigger: true,
      configurationType: 'Inherited'
    };
    $('#findTeamSelect').val(`string:${vm.teamFilter}`).trigger('change');
    vm.bookingDeploymentDropdownOptions = [];
    vm.bookingTeamOptions = allTeams;
    vm.selectedLabel = vm.labelFilter;
    vm.selectedProductType = vm.productTypeFilter;
    $('#findLabelSelect').val(`string:${vm.selectedLabel}`).trigger('change');
    $('#findProductTypeSelect').val(`string:${vm.selectedProductType}`).trigger('change');
    initializeDateTimePickers(true);
    bookingFindDeploymentModal.style.display = 'block';
    _.defer(() => $scope.$apply());
  };

  // Validator to check if current user is in specified team
  async function isInTeam(userId, teamId) {
    var teamObj = findArtifact(allTeams, teamId);
    if (teamObj) {
      return (teamObj.admin_IDs.includes(userId) || teamObj.users.includes(userId));
    }
  }

  /* ******************************
   BOOKING-CRUD SUBMIT RELATED CODE
   ****************************** */

  // Create/Update Booking
  vm.submitBookingForm = async function () {
    _.defer(() => $scope.$apply());
    vm.notificationBooking = {};
    var crudBooking = vm.booking;
    try {
      vm.formSubmitting = true;
      if (vm.crudType === 'creation') {
        crudBooking = newBooking;
        for (var key in vm.booking) {
          if (Object.prototype.hasOwnProperty.call(vm.booking, key)) {
            crudBooking[key] = vm.booking[key];
          }
        }
      }
      await crudBooking.createOrUpdate();
      successfulCrudNotify(vm.crudType);
    } catch (crudError) {
      vm.formSubmitting = false;
      errorCrudNotify(vm.crudType, crudError);
    }
  };

  // Delete Booking
  vm.deleteBooking = async function () {
    if ($window.confirm('Are you sure you want to delete this Booking?')) {
      try {
        await vm.booking.$delete();
        successfulCrudNotify('deleted');
      } catch (deletionError) {
        errorCrudNotify('deleted', deletionError);
      }
    }
  };

  // Reduce Available Deployments; Set by team/label/productType and Dates chosen in part 1/2 of Find Deployment form
  vm.submitFindDeploymentForm = async function () {
    try {
      setBookingProductOptions();
      var deploymentsCanBeBooked = allDeployments.filter(deployment => !(deployment.status === 'In Review' || deployment.status === 'Blocked/In Maintenance' || deployment.status === 'Booking Disabled'));
      // remove suffix for all
      allDeployments.forEach(deployment => delete deployment.suffix);
      var deploymentsFound = [];
      if (!vm.customTeam) {
        vm.bookingTeamObject = findArtifact(allTeams, vm.booking.team_id);
        if (!vm.bookingTeamObject.area_id) {
          throw new Error(`No free Deployments found: Team "${vm.bookingTeamObject.name}" must be associated with an Area first.`);
        }
        vm.bookingAreaObject = findArtifact(allAreas, vm.bookingTeamObject.area_id);
      }
      deploymentsFound = (vm.filteredDeploymentsToggle) ? deploymentsCanBeBooked.filter(deployment => (deployment.area_id === vm.bookingAreaObject._id) || deployment.crossRASharing) : deploymentsCanBeBooked; // eslint-disable-line max-len
      if (vm.customTeam) deploymentsFound = deploymentsFound.filter(deployment => deployment.crossRASharing);
      if (deploymentsFound.length === 0 && !vm.customTeam) {
        throw new Error(`No free Deployments found: Area "${vm.bookingAreaObject.name}" must have associated Deployments.`);
      }

      if (vm.selectedLabel) {
        vm.bookingLabelObject = findArtifact(allLabels, vm.selectedLabel);
        deploymentsFound = await deploymentsFound.filter(function (deployment) {
          return (deployment.label_ids.includes(vm.bookingLabelObject._id));
        });
        if (deploymentsFound.length === 0) {
          throw new Error(`No free Deployments found: Label "${vm.bookingLabelObject.name}" must have associated Deployments.`);
        }
      }

      if (vm.selectedProductType) {
        vm.bookingProductTypeObject = findArtifact(allProductTypes, vm.selectedProductType);
        var filtDepl = [];
        deploymentsFound.forEach(function (deployment) {
          if (deployment.products.length !== 0) {
            deployment.products.forEach(function (product) {
              if (product.product_type_name === vm.bookingProductTypeObject.name) filtDepl.push(deployment);
            });
          }
        });
        deploymentsFound = filtDepl;
        if (deploymentsFound.length === 0) {
          throw new Error(`No free Deployments found for Product Type "${vm.bookingProductTypeObject.name}"`);
        }
      }

      // Add sufix if outside RA and filterDeploymentsToggle is disabled
      if (!vm.filteredDeploymentsToggle) {
        deploymentsFound.forEach(function (depl) {
          depl.suffix = (!vm.customTeam && depl.area_id.toString() !== vm.bookingAreaObject._id.toString()) ? `    || NOTE: Doesnt belong to RA: ${vm.bookingAreaObject.name}` : '';
          if (!depl.crossRASharing && depl.suffix !== '') depl.suffix += ' || CROSS RA SHARING DISABLED';
        });
      }

      vm.bookingDeploymentDropdownOptions = [];
      var thisBookingRange = moment.range(vm.booking.startTime, vm.booking.endTime);
      await asyncForEach(deploymentsFound, async function (deployment) {
        try {
          await asyncForEach(allBookings, async function (otherBooking) {
            if (otherBooking.deployment_id === deployment._id) {
              var otherBookingRange = moment.range(otherBooking.startTime, otherBooking.endTime);
              if (otherBooking.bookingType === 'Shareable' && otherBookingRange.contains(thisBookingRange)) {
                deployment.isShareable = true;
              } else if (thisBookingRange.overlaps(otherBookingRange)) {
                throw new Error();
              }
            }
          });
          vm.bookingDeploymentDropdownOptions.push(deployment);
        } catch (err) { /* Do Nothing */ }
      });
      if (vm.bookingDeploymentDropdownOptions.length === 0) {
        throw new Error(`No free Deployments found for Team "${(vm.customTeam) ? vm.booking.customTeamName : vm.bookingTeamObject.name}" within times specified.`); // eslint-disable-line max-len
      }
      bookingFindDeploymentModal.style.display = 'none';
      bookingDeploymentModal.style.display = 'block';
      _.defer(() => $scope.$apply());
    } catch (err) {
      var message = err.data ? err.data.message : err.message;
      Notification.error({
        title: `${errorIcon} Booking creation error!`,
        message: message.replace(/\n/g, '<br>')
      });
    }
  };

  vm.enmDropsVersionSelected = async function () {
    var chosenDrop = vm.booking.enmProductSetDrop;
    vm.booking.enmProductSetVersion = undefined;
    if (chosenDrop === 'LATEST GREEN' || chosenDrop === 'DON\'T CARE') {
      vm.showENMProductSets = false;
    } else {
      await populateENMProductSetVersions();
    }
  };

  vm.updateCalendarWeek = async function (weeks) {
    calendarMonday.add(weeks, 'weeks');
    setCurrentWeekText();
    initializeWeeklyCalendar();
  };

  function setCurrentWeekText() {
    vm.currentWeek = `${moment(calendarMonday).format(currentWeekFormat)} - ${moment(calendarMonday).add(6, 'days').format(currentWeekFormat)}`;
  }

  vm.dataTableColumns = [
    {
      title: 'Deployment',
      width: '150px',
      data: null,
      render: function (data) {
        var htmlElement = `<a ui-sref="deployments.view({ deploymentId: '${data.deployment._id}' })">${data.deployment.name}</a>`;
        return $compile(htmlElement)($scope)[0].outerHTML;
      }
    },
    {
      title: 'Product',
      width: '100px',
      data: null,
      render: function (data) {
        if (data.product) {
          return $compile(`<span>${data.product.product_type_name}</a>`)($scope)[0].outerHTML;
        }
      }
    },
    {
      title: 'Start Date',
      width: '100px',
      data: null,
      render: function (data) {
        return moment(data.startTime).format(dateTimeFormat);
      }
    },
    {
      title: 'End Date',
      width: '100px',
      data: null,
      render: function (data) {
        return moment(data.endTime).format(dateTimeFormat);
      }
    },
    {
      title: 'Sharing',
      width: '60px',
      data: 'bookingType'
    },
    {
      title: 'Program',
      width: '100px',
      data: null,
      render: function (data) {
        if (data.program) {
          return $compile(`<a ui-sref="programs.view({ programId: '${data.program._id}' })">${data.program.name}</a>`)($scope)[0].outerHTML;
        }
      }
    },
    {
      title: 'RA',
      width: '100px',
      data: null,
      render: function (data) {
        if (data.area) {
          return $compile(`<a ui-sref="areas.view({ areaId: '${data.area._id}' })">${data.area.name}</a>`)($scope)[0].outerHTML;
        }
      }
    },
    {
      title: 'Team',
      width: '100px',
      data: null,
      render: function (data) {
        if (data.team_id) return $compile(`<a ui-sref="teams.view({ teamId: '${data.team._id}' })">${data.team.name}</a>`)($scope)[0].outerHTML;
        return $compile(`<a">Loaned to: ${data.customTeamName}</a>`)($scope)[0].outerHTML;
      }
    },
    {
      title: 'JIRA Issue',
      width: '100px',
      data: 'jiraIssue'
    },
    {
      title: 'Requirements',
      width: '150px',
      data: 'description'
    },
    {
      title: 'Created By',
      width: '80px',
      data: null,
      render: function (data) {
        if (data.createdBy) return data.createdBy.username;
      }
    },
    {
      title: 'Actions',
      orderable: false,
      searchable: false,
      width: '160px',
      data: null,
      render: function () {
        var viewElement = '<a class="btn btn-sm btn-info view-booking-button">View</a>';
        var editElement = '<a class="btn btn-sm btn-primary view-booking-button">Edit</a>';
        var deleteElement = '<a class="delete-button btn btn-sm btn-danger">Delete</a>'; // No compile needed on a non-angular element
        return `${viewElement}&nbsp;${editElement}&nbsp;${deleteElement}`;
      }
    }
  ];

  // Final Initializations
  commonListController($scope, $window, Authentication, Notification, vm);
  filtersController($scope, $window, $state, $timeout, Notification, vm);

  vm.enteringTeamName = function () {
    vm.teamSelected = vm.booking.customTeamName !== '' || vm.booking.customTeamName !== undefined;
  };

  $(async function () { // On Document Load
    vm.hasCreatePermission = Authentication.isAllowed(vm.resourcePath, 'post', true);
    await getENMselectOptions();
    vm.allFilters = [];
    vm.mainFilterOptions.forEach(function (filter) {
      vm.allFilters.push(filter);
    });
    vm.additionalFilterOptions.forEach(function (filter) {
      vm.allFilters.push(filter);
    });
    vm.setFilterSelect2(vm.allFilters);
    var findOptions = ['Team', 'Label', 'ProductType'];
    findOptions.forEach(function (option) {
      var filterSelect = `#find${option}Select`;
      $(filterSelect).select2({
        placeholder: `--Select ${option}--`,
        allowClear: true
      });
    });
    $('#findTeamSelect').on('select2:select select2:unselecting', async function () {
      if ($(this).val() === null || $(this).val() === '') {
        $(this).data('unselecting', true);
        delete vm.booking.team_id;
        vm.teamSelected = false;
      } else {
        vm.booking.team_id = $(this).val().replace('string:', '');
        vm.teamSelected = true;
      }
      vm.bookingTeamTimeUpdateHandler();
      _.defer(() => $scope.$apply());
    });
    $('#findLabelSelect').on('select2:select select2:unselecting', async function () {
      if ($(this).val() === null || $(this).val() === '') {
        $(this).data('unselecting', true);
        vm.selectedLabel = undefined;
      } else {
        vm.selectedLabel = $(this).val().replace('string:', '');
      }
      _.defer(() => $scope.$apply());
    });
    $('#findProductTypeSelect').on('select2:select select2:unselecting', async function () {
      if ($(this).val() === null || $(this).val() === '') {
        $(this).data('unselecting', true);
        vm.selectedProductType = undefined;
      } else {
        vm.selectedProductType = $(this).val().replace('string:', '');
      }
      _.defer(() => $scope.$apply());
    });
    initializeMonthlyCalendar();
    initializeDateTimePickersTable();
    updateViewType('month');
    // DateTimePicker on-change handlers
    $('#startTime').change(function () { startTimeChangeHandler(false); });
    $('#endTime').change(function () { endTimeChangeHandler(false); });
    $('#startTimeAlt').change(function () { startTimeChangeHandler(true); });
    $('#endTimeAlt').change(function () { endTimeChangeHandler(true); });
    $('#startTimeAfterFilter').change(function () { startTimeChangeHandlerTable(); });
    $('#endTimeBeforeFilter').change(function () { endTimeChangeHandlerTable(); });

    // eslint-disable-next-line no-undef
    if (env === 'development') {
      $('#startTime').prop('readonly', false);
      $('#startTimeAlt').prop('readonly', false);
      $('#endTime').prop('readonly', false);
      $('#endTimeAlt').prop('readonly', false);
    }

    var selectOptions = ['deployment', 'team', 'testingType'];
    selectOptions.forEach(opt => setSelect2(`#${opt}-select`, capitalizeFirstLetter(opt)));
    setSelect2('#deploymentAlt-select', 'Deployment');
    setSelect2('#teamAlt-select', 'Team');
    setSelect2('#testingTypeAlt-select', 'TestingType');

    $('#deployment-select').on('select2:select select2:unselecting', async function () {
      var valueIsEmpty = $(this).val() === null || $(this).val() === '';
      if (valueIsEmpty) $(this).data('unselecting', true);
      vm.booking.deployment_id = (valueIsEmpty) ? null : $(this).val().replace('string:', '');
      await vm.bookingDeploymentUpdateHandler();
      if (vm.showProductOptions) waitToSetDeploymentProductSelect();
      _.defer(() => $scope.$apply());
    });

    $('#deploymentAlt-select').on('select2:select select2:unselecting', async function () {
      var valueIsEmpty = $(this).val() === null || $(this).val() === '';
      if (valueIsEmpty) $(this).data('unselecting', true);
      vm.booking.deployment_id = (valueIsEmpty) ? null : $(this).val().replace('string:', '');
      await vm.bookingDeploymentUpdateHandler(true);
      if (vm.showProductOptions) waitToSetDeploymentProductSelect();
      _.defer(() => $scope.$apply());
    });

    $('#team-select, #teamAlt-select').on('select2:select select2:unselecting', async function () {
      var valueIsEmpty = $(this).val() === null || $(this).val() === '';
      if (valueIsEmpty) $(this).data('unselecting', true);
      vm.booking.team_id = (valueIsEmpty) ? null : $(this).val().replace('string:', '');
      _.defer(() => $scope.$apply());
    });

    $('#testingType-select, #testingTypeAlt-select').on('select2:select select2:unselecting', async function () {
      var valueIsEmpty = $(this).val() === null || $(this).val() === '';
      if (valueIsEmpty) $(this).data('unselecting', true);
      vm.booking.testingType = (valueIsEmpty) ? undefined : $(this).val().replace('string:', '');
      _.defer(() => $scope.$apply());
    });
  });

  function setJiraFormSelect() {
    setSelect2('#template-select', 'Template');
    setSelect2('#templateAlt-select', 'Template');
    $('#template-select, #templateAlt-select').on('select2:select select2:unselecting', async function () {
      var valueIsEmpty = $(this).val() === null || $(this).val() === '';
      if (valueIsEmpty) $(this).data('unselecting', true);
      vm.selectedTemplate = (valueIsEmpty) ? undefined : getTemplateByHashKey($(this).val());
      vm.jiraTemplateHandler();
      _.defer(() => $scope.$apply());
    });
  }

  function getTemplateByHashKey(key) {
    var toReturn;
    for (var i = 0; i < vm.allTemplates.length; i += 1) {
      if (vm.allTemplates[i].$$hashKey === key) toReturn = vm.allTemplates[i];
    }
    return toReturn;
  }

  function setDeploymentProductSelect() {
    setSelect2('#bookingProduct-select', 'Deployment-Product');
    setSelect2('#bookingProductAlt-select', 'Deployment-Product');
    $('#bookingProduct-select, #bookingProductAlt-select').on('select2:select select2:unselecting', async function () {
      var valueIsEmpty = $(this).val() === null || $(this).val() === '';
      if (valueIsEmpty) $(this).data('unselecting', true);
      vm.booking.product_id = (valueIsEmpty) ? null : $(this).val().replace('string:', '');
      vm.bookingProductUpdateHandler();
      if (vm.bookingIsENM) waitToSetENMformSelect();
      if (vm.booking.useCustomJiraTemplate) waitToSetJiraFormSelect();
      _.defer(() => $scope.$apply());
    });
  }

  function waitToSetDeploymentProductSelect() {
    var existCondition = setInterval(function () {
      if ($('#bookingProduct-select, #bookingProductAlt-select').length) {
        clearInterval(existCondition);
        // do nothing
        setDeploymentProductSelect();
      }
    }, 100); // check every 100ms
  }

  function waitToSetENMformSelect() {
    var existCondition = setInterval(function () {
      if ($('#enmProductSetDrop-select, #enmProductSetDropAlt-select').length) {
        clearInterval(existCondition);
        setENMformSelect();
      }
    }, 100); // check every 100ms
  }

  function waitToSetJiraFormSelect() {
    var existCondition = setInterval(function () {
      if ($('#template-select, #templateAlt-select').length) {
        clearInterval(existCondition);
        setJiraFormSelect();
      }
    }, 100); // check every 100ms
  }

  function setENMformSelect() {
    setSelect2('#enmProductSetDrop-select', 'ENM Product Drop');
    setSelect2('#nssVersion-select', 'NSS Version');
    setSelect2('#enmProductSetDropAlt-select', 'ENM Product Drop');
    setSelect2('#nssVersionAlt-select', 'NSS Version');
    $('#enmProductSetDrop-select, #enmProductSetDropAlt-select').on('select2:select select2:unselecting', async function () {
      var valueIsEmpty = $(this).val() === null || $(this).val() === '';
      if (valueIsEmpty) $(this).data('unselecting', true);
      vm.booking.enmProductSetDrop = (valueIsEmpty) ? undefined : $(this).val().replace('string:', '');
      vm.enmDropsVersionSelected();
      if (!vm.showENMProductSets) waitToSetProductSetVersionSelect();
      _.defer(() => $scope.$apply());
    });
    $('#nssVersion-select, #nssVersionAlt-select').on('select2:select select2:unselecting', async function () {
      var valueIsEmpty = $(this).val() === null || $(this).val() === '';
      if (valueIsEmpty) $(this).data('unselecting', true);
      vm.booking.nssVersion = (valueIsEmpty) ? undefined : $(this).val().replace('string:', '');
      _.defer(() => $scope.$apply());
    });

    if (!vm.jenkinsJobEnabled) {
      $('#select2-enmProductSetDrop-select-container, #select2-enmProductSetDropAlt-select-container').prop('title', vm.disabledJenkinsJobSettingsMsg);
      $('#select2-enmProductSetDrop-select-container, #select2-enmProductSetDropAlt-select-container').css('cursor', 'not-allowed');
      $('#select2-nssVersion-select-container, #select2-nssVersionAlt-select-container').prop('title', vm.disabledJenkinsJobSettingsMsg);
      $('#select2-nssVersion-select-container, #select2-nssVersionAlt-select-container').css('cursor', 'not-allowed');
    }
  }

  function waitToSetProductSetVersionSelect() {
    var existCondition = setInterval(function () {
      if ($('#enmProductSetVersion-select, #enmProductSetVersionAlt-select').length) {
        clearInterval(existCondition);
        setEnmProductSetVersionSelect();
      }
    }, 100); // check every 100ms
  }

  function setEnmProductSetVersionSelect() {
    setSelect2('#enmProductSetVersion-select', 'ENM Product Set Version');
    setSelect2('#enmProductSetVersionAlt-select', 'ENM Product Set Version');
    $('#enmProductSetVersion-select, #enmProductSetVersionAlt-select').on('select2:select select2:unselecting', async function () {
      var valueIsEmpty = $(this).val() === null || $(this).val() === '';
      if (valueIsEmpty) $(this).data('unselecting', true);
      vm.booking.enmProductSetVersion = (valueIsEmpty) ? undefined : $(this).val().replace('string:', '');
      _.defer(() => $scope.$apply());
    });
  }

  function setSelect2(selectId, placeholderName) {
    $(selectId).select2({
      placeholder: `--Select ${placeholderName}--`,
      allowClear: true
    });
  }

  /* *****************
   ADDITIONAL FUNCTION
   ***************** */

  async function populateENMProductSetVersions() {
    vm.allENMProductSets = await getENMProductSetVersions();
    vm.allENMProductSets.unshift({ version: 'LATEST GREEN' }, { version: 'DON\'T CARE' });
    vm.showENMProductSets = true;
    $scope.$apply();
  }

  async function getENMProductSetVersions() {
    var versionDrop = vm.booking.enmProductSetDrop.slice(4);
    return $.getJSON(`${ciPortalUrl}/api/productSet/ENM/drop/${versionDrop}/versions/?format=json`);
  }

  function successfulCrudNotify(crudType) {
    Notification.success({ message: `${successIcon} Booking ${crudType} successfully!` });
    $state.transitionTo($state.current, { bookingFocus: null }, { reload: true, inherit: true, notify: false });
  }

  function errorCrudNotify(crudType, error) {
    var errMessage = error.data ? error.data.message : error.message;
    Notification.error({
      title: `${errorIcon} Booking ${crudType} error!`,
      message: errMessage.replace(/\n/g, '<br/>')
    });
  }
}

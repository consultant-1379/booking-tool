var $ = require('jquery');
var moment = require('moment');

export async function removeDuplicateObjects(objectArray) {
  return objectArray.filter(function (obj, objIndex, parentArr) {
    return objIndex === parentArr.findIndex(otherObj => otherObj._id === obj._id);
  });
}

export async function asyncForEach(array, callBack) {
  for (var i = 0; i < array.length; i += 1) {
    await callBack(array[i], i, array); //eslint-disable-line
  }
}

export function floatingSaveButton() {
  var $formWindow = $(window),
    floatSaveButton = $('.float-save-button'),
    mainSaveButton = $('#main-save-button');

  if (!(mainSaveButton.offset().top > $formWindow.height())) {
    if (floatSaveButton.prop('disabled')) {
      floatSaveButton.removeClass('disable-save-button');
    }
    floatSaveButton.css({ display: 'none' });
  }

  $formWindow.resize(function () {
    checkMainSaveButtonLocation($formWindow, mainSaveButton, floatSaveButton);
  });

  $formWindow.scroll(function () {
    checkMainSaveButtonLocation($formWindow, mainSaveButton, floatSaveButton);
  });
}

export function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function checkMainSaveButtonLocation($formWindow, mainSaveButton, floatSaveButton) {
  var topOfElement = mainSaveButton.offset().top;
  var bottomOfElement = mainSaveButton.offset().top + mainSaveButton.outerHeight();
  var bottomOfScreen = $formWindow.scrollTop() + $formWindow.innerHeight();
  var topOfScreen = $formWindow.scrollTop();

  if ((bottomOfScreen > topOfElement) && (topOfScreen < bottomOfElement)) {
    if (floatSaveButton.prop('disabled')) floatSaveButton.removeClass('disable-save-button');
    floatSaveButton.css({ display: 'none' });
  } else {
    if (floatSaveButton.prop('disabled')) floatSaveButton.addClass('disable-save-button');
    floatSaveButton.css({ display: 'block' });
  }
}

export function generateEmailElement(objectType, objectName, userList, isDeploymentView) {
  if (typeof userList === 'string') return 'UNKNOWN USER';
  if (!Array.isArray(userList)) userList = [userList];
  userList = userList.filter(user => user && user.email && user.displayName);
  if (!userList || userList.length === 0) return 'UNKNOWN USER';

  var userEmails = userList.map(user => user.email).join(';');
  var emailSubject = `PDU OSS DTT Query Regarding ${objectType} Object: ${objectName}`;
  var emailElement = `<a class="log-action-link" href="mailto:${userEmails}?Subject=${emailSubject}">
                  <strong>&#9993;</strong>&nbsp;`;
  if (userList.length > 1 && isDeploymentView) {
    emailElement += 'All SPOCs';
  } else {
    emailElement += `${userList[0].displayName} (${userList[0].username.toUpperCase()})`;
    if (userList.length > 1) emailElement += `+${userList.length - 1}`;
  }
  emailElement += '</a>';
  return emailElement;
}

export async function jiraIssueValidation($http, Notification, scopeElemReference, jiraIssue) {
  $http({ method: 'GET', url: `/api/jiraIssueValidation/${jiraIssue}` }).then(successCallback, errorCallback);

  function successCallback(response) {
    if (response.data.valid === true) {
      Notification.success({ message: `<i class="glyphicon glyphicon-ok"></i> JIRA Issue: ${jiraIssue} is valid` });
    } else if (response.data.valid === false) {
      Notification.error({
        message: response.data.errorMessages.join(', '),
        title: `<i class="glyphicon glyphicon-remove"></i> JIRA Issue: ${jiraIssue} is invalid`
      });
    } else {
      Notification.error({
        message: JSON.stringify(response.data.errorMessage),
        title: `<i class="glyphicon glyphicon-remove"></i> An error occurred while checking the JIRA Issue: ${jiraIssue}`
      });
    }
    scopeElemReference.$setValidity('jiraValidation', (response.data.valid === true));
  }

  function errorCallback(response) {
    var message = response.data ? response.data.message : response.message;
    Notification.error({
      message: JSON.stringify(message),
      title: `<i class="glyphicon glyphicon-remove"></i> An error occurred while checking the JIRA Issue: ${jiraIssue}`
    });
    scopeElemReference.$setValidity('jiraValidation', false);
  }
}

export async function getJiraIssue($http, Notification, jiraIssue, referenceObject) {
  referenceObject.issue = jiraIssue;
  referenceObject.summary = 'Not available';
  referenceObject.status = 'Not available';
  referenceObject.team = 'Not available';
  delete referenceObject.viewUrl;
  $http({ method: 'GET', url: `/api/jiraIssueValidation/${jiraIssue}` }).then(successCallback, errorCallback);

  function successCallback(response) {
    if (response.data.valid === true) {
      referenceObject.summary = response.data.summary;
      referenceObject.status = response.data.status;
      referenceObject.team = response.data.team;
      referenceObject.viewUrl = response.data.viewUrl;
    } else if (response.data.valid === false) {
      var errorMessage = response.data.errorMessages.join(', ');
      referenceObject.summary = `ERROR: ${errorMessage}`;
    }
  }

  function errorCallback(response) {
    Notification.error({
      message: JSON.stringify(response),
      title: `<i class="glyphicon glyphicon-remove"></i> Issue getting JIRA Issue: ${jiraIssue} data`
    });
  }
}

export function findArtifact(artifactList, artifactId, key = '_id') {
  return artifactList.find(artifact => artifact[key] === artifactId);
}

export function userCompare(a, b) {
  // Use toUpperCase() to ignore character casing
  const aName = (a.displayName) ? a.displayName.toUpperCase() : a.name.toUpperCase();
  const bName = (b.displayName) ? b.displayName.toUpperCase() : b.name.toUpperCase();
  if (aName > bName) return 1;
  if (aName < bName) return -1;
  return 0;
}

export function historyFormatDate(dateTimeString, pageType) {
  if (dateTimeString.startsWith('1970')) return 'UNKNOWN DATE';
  var dateToEuropeanFormatOptionsView = {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: false
  };
  var timeToEuropeanFormatOptionsList = {
    hour: 'numeric', minute: 'numeric', hour12: false
  };
  var dateObj = new Date(dateTimeString);
  if (pageType === 'view') {
    return `${dateObj.toLocaleString('en-GB', dateToEuropeanFormatOptionsView)} GMT`;
  }
  return `${moment(dateObj).format('YYYY-MM-DD')}, ${dateObj.toLocaleTimeString('en-GB', timeToEuropeanFormatOptionsList)}`;
}

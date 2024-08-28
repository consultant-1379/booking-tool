var JiraClient = require('jira-connector'),
  dttUrl = (process.env.NODE_ENV === 'secure' ? 'https://' : 'http://') + process.env.DTT_URL;

module.exports.getJiraClient = function (eTeamsJira) {
  var buff = Buffer.from(`${process.env.DTT_USERNAME}:${process.env.DTT_PASSWORD}`);
  var auth = buff.toString('base64');
  var jiraUrl = (eTeamsJira) ? process.env.JIRA_URL_ETEAMS : process.env.JIRA_URL;
  var jira = new JiraClient({
    host: jiraUrl,
    basic_auth: {
      base64: auth
    }
  });
  return jira;
};

module.exports.addJiraCommentToParentBooking = async function (booking, crudType) {
  // Update Parent Bookings JIRA Issue with comment about 'sharing' Booking
  var jiraComment = `DTT Child Booking ${dttUrl}/bookings?bookingFocus=${booking._id} `;
  switch (crudType) {
    case 'create': jiraComment += 'is now sharing this Booking.'; break;
    case 'update': jiraComment += 'has been updated.'; break;
    case 'delete': jiraComment += 'has been deleted and is no longer sharing with this Booking.'; break;
    default: // Do Nothing
  }
  await module.exports.addJiraComment(booking, jiraComment, crudType);
};

module.exports.createJiraIssue = async function (booking, jiraFields) {
  if (process.env.NODE_ENV === 'production' && booking[Symbol.for('triggerJiraUpdate')]) {
    var jiraClient = module.exports.getJiraClient(true);
    var newIssue = await jiraClient.issue.createIssue({ fields: jiraFields });
    booking.jiraIssue = newIssue.key;
  }
};

module.exports.transitionIssue = async function (booking, status) {
  if (process.env.NODE_ENV === 'production' && booking.jiraIssue && !booking.jiraIssue.includes('CIS') && booking[Symbol.for('triggerJiraUpdate')]) {
    var jiraClient = module.exports.getJiraClient(isJiraETeams(booking));
    try {
      var transitionCode = await getJiraTransitionCode(status);
      await jiraClient.issue.transitionIssue({ issueKey: booking.jiraIssue, transition: { id: transitionCode } });
    } catch (error) {
      throw new Error(`Error transitioning ${booking.jiraIssue} to status: '${status}'. Error:${error}`);
    }
  }
};

module.exports.addJiraComment = async function (booking, jiraComment, crudType, jiraFields) {
  if (process.env.NODE_ENV === 'production' && booking.jiraIssue && !booking.jiraIssue.includes('CIS') && booking[Symbol.for('triggerJiraUpdate')]) {
    try {
      // For Bookings with a JIRA Issue - post a comment specifying changes made
      var jiraClient = module.exports.getJiraClient(isJiraETeams(booking));
      await jiraClient.issue.addComment({ issueId: booking.jiraIssue, body: jiraComment });
    } catch (error) {
      var errorObject = module.exports.processJiraError(error, crudType);
      if (errorObject) throw errorObject;
      // If error is due to Issue Not Existing, create Issue instead
      if (jiraFields) {
        await module.exports.createJiraIssue(booking, jiraFields);
      }
    }
  }
};

module.exports.deleteJiraIssue = async function (booking) {
  // do not delete CIS issues
  if (process.env.NODE_ENV === 'production' && booking.jiraIssue && !booking.jiraIssue.includes('CIS')) {
    var jiraClient = module.exports.getJiraClient(isJiraETeams(booking));
    await jiraClient.issue.deleteIssue({ issueId: booking.jiraIssue });
  }
};

module.exports.processJiraError = function (error, crudType) {
  // If standard error object, handle accordingly
  if (error instanceof Error) {
    // If Booking has no JIRA Issue ID, return undefined; Otherwise, return the error
    return (error.message.includes('Missing Issue ID')) ? undefined : error;
  }

  // If JIRA Issue doesnt exist, return undefined;
  if (error && error.includes('Issue Does Not Exist')) return;

  // Otherwise, prepare and return the error(s)
  var errorInfo = 'Unknown Error';
  var errorObj = JSON.parse(error);
  if (errorObj && errorObj.body) {
    if (errorObj.body.errorMessages && errorObj.body.errorMessages.length > 0) {
      errorInfo = errorObj.body.errorMessages.join(', ');
    } else if (errorObj.body.errors) {
      errorInfo = errorObj.body.errors.toString();
    }
  }
  return new Error(`Failed to ${crudType} JIRA issue: ${errorInfo})`);
};

async function getJiraTransitionCode(status) {
  switch (status) {
    case 'open':
      return 11;
    case 'inProgress':
      return 21;
    case 'closed':
      return 51;
    default: // do nothing
  }
}

function isJiraETeams(booking) {
  var eTeamsIssueTypes = process.env.JIRA_PREFIX_ETEAMS.split(',');
  var currentPrefix = (booking.jiraIssue) ? booking.jiraIssue.split('-')[0] : 'NA';
  var isETeamsIssue = eTeamsIssueTypes.includes(currentPrefix);
  return isETeamsIssue;
}

var fs = require('fs'),
  webdriver = require('selenium-webdriver'),
  moment = require('moment'),
  MomentRange = require('moment-range'),
  momentExtended = MomentRange.extendMoment(moment),
  dateFormat = 'YYYY-MM-DD',
  request = require('request-promise'),
  By = webdriver.By,
  adminSignum = 'eednuts',
  deploymentPurpose = 'Testing Deployment Purpose Textarea',
  productNotes = 'Testing Product Notes Textarea',
  exportDataFile = '/opt/SmokeTest/dtt_deployments_data.csv',
  exportDataFile2 = '/opt/SmokeTest/dtt_bookings_statistics_data.csv',
  baseUrl = `http://${process.env.BASE_URL}/`,
  testUsername = process.env.TEST_USERNAME,
  testPassword = process.env.TEST_PASSWORD,
  loginUrl = `${baseUrl}authentication/signin`,
  chromeCapabilities = webdriver.Capabilities.chrome(),
  chromeOptions = {
    args: ['--no-sandbox', '--window-size=1600,1800'],
    prefs: {
      'download.default_directory': '/opt/SmokeTest/'
    }
  };

require('should');
require('selenium-webdriver/testing');
require('mocha-clean');

var response,
  driver,
  element,
  alertElement,
  dttAdminInformation,
  programREST1,
  programREST2,
  programREST3,
  areaREST1,
  areaREST2,
  areaREST3,
  teamREST1,
  teamREST2,
  teamREST3,
  teamREST4,
  productFlavourREST1,
  productFlavourREST2,
  productTypeREST1,
  productTypeREST2,
  productTypeREST3,
  hardwareREST1,
  hardwareREST2,
  hardwareREST3,
  hardwareREST4,
  labelREST1,
  labelREST2,
  deploymentREST1,
  deploymentREST2,
  bookingREST1,
  bookingREST2,
  roleREST1;

var today = moment();

chromeCapabilities.set('chromeOptions', chromeOptions);
const until = webdriver.until;
const MAX_RETRIES = 0;

const statusTypes = {
  FREE: 'Free',
  IN_USE: 'In Use',
  IN_REVIEW: 'In Review',
  BLOCKED_IN_MAINTENANCE: 'Blocked/In Maintenance',
  BOOKING_DISABLED: 'Booking Disabled'
};

const infraTypes = {
  PHYSICAL: 'Physical',
  CLOUD: 'Cloud',
  VCENTER: 'VCenter'
};

const componentTypes = {
  OPENSTACK_TEEAAS: 'DTT_Booking',
  TEAAS: 'TEaaS',
  CI_INFRA: 'CI Infra',
  CI_FWK: 'CI Fwk'
};

// Initializing Dates for Booking Date-Pickers
function addDaysAndGenerateDatePickerString(daysToAdd) {
  return (moment().add(daysToAdd, 'days')).format(dateFormat);
}

var bookingStartTime = addDaysAndGenerateDatePickerString(-3);
var bookingSharedTime = addDaysAndGenerateDatePickerString(-2);
var bookingEndTime = addDaysAndGenerateDatePickerString(-1);
var wcBookingStartTime = addDaysAndGenerateDatePickerString(1);
var wcBookingEndTime = addDaysAndGenerateDatePickerString(2);

// Health Check Related Information
var testFailures = [];
var artifactTypes = ['bookings', 'deployments', 'hardware', 'productTypes', 'productFlavours', 'teams', 'areas', 'programs', 'labels'];

async function deleteAllHealthArtifactsREST() {
  console.log('\n\tRemoving all A_Health_ artifacts'); // eslint-disable-line no-console
  await asyncForEach(artifactTypes, async function (artifactType) {
    console.log(`\n\tRemoving ${artifactType} Health-Check Artifacts`); // eslint-disable-line no-console
    response = await request.get(`${baseUrl}api/${artifactType}/`).auth(testUsername, testPassword);
    var foundArtifacts = JSON.parse(response);
    var filteredArtifacts;
    if (artifactType !== 'bookings') {
      filteredArtifacts = foundArtifacts.filter(artifact => artifact.name.startsWith('A_Health_'));
    } else {
      response = await request.get(`${baseUrl}api/deployments/`).auth(testUsername, testPassword);
      var foundDeployments = JSON.parse(response);
      // Filter for Health-Check Deployments
      var filteredDeployments = foundDeployments.filter(deployment => deployment.name.startsWith('A_Health_'));
      // Filter for Bookings that are only associated with Health-Check Deployments
      filteredArtifacts = foundArtifacts.filter(function (booking) {
        return filteredDeployments.some(deployment => deployment._id === booking.deployment_id);
      });
    }
    await asyncForEach(filteredArtifacts, async foundArtifact => deleteArtifactREST(artifactType, foundArtifact));
    console.log(`\tRemoved ${filteredArtifacts.length} ${artifactType} Health-Check Artifacts`); // eslint-disable-line no-console
  });
}

async function asyncForEach(array, callBack) {
  for (var i = 0; i < array.length; i += 1) {
    await callBack(array[i], i, array); //eslint-disable-line
  }
}

var testErrorNumber = 0;
async function takeScreenshot(name) {
  testErrorNumber += 1;
  var screenshotData = await driver.takeScreenshot();
  var base64Data = screenshotData.replace(/^data:image\/png;base64,/, '');
  fs.writeFile(`images/${testErrorNumber}_${name}.png`, base64Data, 'base64', function () { });
}

async function writeTestReport() {
  var testReport = (testFailures.length === 0) ? 'All tests passed, Smoke-Tests successful' : `Failed tests:\n*${testFailures.join('\n*')}`;
  await fs.writeFile('images/testReport.txt', testReport, err => {
    if (err) console.log('Error occurred while writing testReport.txt: ' + err); // eslint-disable-line no-console
  });
}

// ------------
// UI FUNCTIONS
// ------------
function getTableId(objType) {
  // add -table and if URL is provided: only get first part of objType
  return objType.split('/')[0] + '-table';
}

async function clickAndSendKey(keyName, keyValue, elementBy = 'name') {
  var validIdentifiers = ['name', 'id'];
  if (!validIdentifiers.includes(elementBy)) {
    throw new Error(`Invalid element identifier '${elementBy}', must be one of: ${validIdentifiers.join(', ')}`);
  }
  await driver.wait(until.elementLocated(By[elementBy](keyName)), 20000);
  var element = await driver.findElement(By[elementBy](keyName));
  await element.click();
  await element.sendKeys(keyValue);
  await element.sendKeys(webdriver.Key.ENTER);
  await driver.sleep(500);
}

async function clickElementAndSendKey(keyName, keyValue, elementBy = 'name', scroll = false) {
  var validIdentifiers = ['name', 'id'];
  if (!validIdentifiers.includes(elementBy)) {
    throw new Error(`Invalid element identifier '${elementBy}', must be one of: ${validIdentifiers.join(', ')}`);
  }
  await driver.wait(until.elementLocated(By[elementBy](keyName)), 20000);
  var element = await driver.findElement(By[elementBy](keyName));
  if (scroll) await driver.executeScript('arguments[0].scrollIntoView(true);', element);
  await driver.executeScript('arguments[0].click()', element);
  await element.sendKeys(keyValue + webdriver.Key.ENTER);
  await driver.sleep(500);
}

async function clickElement(keyValue, acceptPopUp) {
  await driver.wait(until.elementLocated(keyValue), 10000);
  var element = await driver.findElement(keyValue);
  await driver.executeScript('arguments[0].click()', element);
  if (acceptPopUp) await driver.switchTo().alert().accept();
}

async function validateValueByName(byName, attribute, checkValue) {
  var value = await driver.findElement(By.name(byName)).getAttribute(attribute);
  if (!value.includes(checkValue)) throw new Error(`Expected value ${checkValue} was not equal to actual value ${value}`);
}

async function removeFile(fileName) {
  try {
    fs.unlinkSync(fileName);
  } catch (err) {
    // try-catch required to stop an error to be thrown by deletion failure.
    console.log(err); // eslint-disable-line no-console
  }
}

function getActionButtonColumn(objType) {
  if (objType.startsWith('logs/')) return 7;

  switch (objType) {
    case 'bookings': return 12;
    case 'statistics/bookings': // unique URL for Booking statistics
    case 'deployments': return 10;
    case 'deploymentProducts': return 11;
    case 'products': return 9;
    case 'hardware': return 8;
    case 'areas': return 6;
    case 'teams': return 5;
    case 'users': return 4;
    default: return 2;
  }
}

function getKeyValueColumn(fieldName) {
  switch (fieldName) {
    case 'averageDuration': return 9;
    case 'totalDuration': return 8;
    case 'totalBookings': return 7;
    case 'totalTeams': return 6;
    default: return 1;
  }
}

async function performActionOnTableItem(objType, objName, actionType, colNo, tableId = getTableId(objType), area, program = undefined) {
  await findTableItem(objType, objName, 1, colNo, tableId, area, program);
  await clickElement(By.xpath(`//td[contains(.,"${objName}")]/../td[${getActionButtonColumn(objType)}]/a[contains(.,"${actionType}")]`));
  if (actionType === 'Delete') {
    await driver.switchTo().alert().accept();
    await driver.wait(until.elementLocated(By.id(tableId)), 30000);
  }
}

async function select2DropdownSelect(idValue, searchedValue) {
  await driver.sleep(500);
  await driver.wait(until.elementLocated(By.id(`select2-${idValue}-container`)), 5000);
  await driver.findElement(By.id(`select2-${idValue}-container`)).click();
  await driver.sleep(500);
  await driver.wait(until.elementLocated(By.className('select2-search__field')), 10000);
  await driver.findElement(By.className('select2-search__field')).sendKeys(searchedValue + webdriver.Key.ENTER);
  await driver.sleep(500);
}

async function findTableItem(objType, findValue, expectedTotal, colNo, tableId = getTableId(objType), area, program = undefined) {
  await openArtifactListView(objType, tableId, area, program);
  await doesElementExistInTable(findValue, tableId, expectedTotal, colNo);
}

async function openArtifactListView(objType, tableId = getTableId(objType), area, program = undefined) {
  await driver.get(baseUrl + objType);
  if (objType.split('/')[0] === 'logs') tableId = 'live-table';
  await driver.wait(until.elementLocated(By.id(tableId)), 30000);
  if (objType === 'bookings' && area) {
    if (program) await selectFilterOption('select2-programFilterSelect-container', program);
    await driver.sleep(500);
    await selectFilterOption('select2-areaFilterSelect-container', area);
    await driver.findElement(By.xpath('//button[contains(.,"Table")]')).click();
  }
}

async function doesElementExistInTable(findValue, tableId, expectedTotal, colNo = 1) {
  await doesElementExist(By.xpath(`//td[${colNo}]/*[self::a or self::strong][contains(.,"${findValue}")]`), tableId, expectedTotal);
}

async function doesElementExist(findBy, parentId, expectedTotal, verifyDisplayProperty = true) {
  switch (typeof expectedTotal) {
    case 'number': break;
    case 'boolean':
      expectedTotal = (expectedTotal) ? 1 : 0;
      break;
    default: expectedTotal = 1;
  }
  try {
    var parentElement = (parentId) ? await driver.findElement(By.id(parentId)) : driver;
    var foundElements = await parentElement.findElements(findBy);
    var displayedElements = foundElements.length;
    if (verifyDisplayProperty) {
      var foundElementPromises = [];
      await asyncForEach(foundElements, function (foundElement) {
        foundElementPromises.push(foundElement.isDisplayed());
      });
      var foundElementResults = await Promise.all(foundElementPromises);
      displayedElements = foundElementResults.filter(elem => elem).length;
    }

    if (displayedElements !== expectedTotal) throw new Error(`Found ${displayedElements} element(s), expected ${expectedTotal}.`);
  } catch (err) {
    throw new Error(`Error occurred while verifying element(s) with key-value '${findBy}' exists: ${err.message}`);
  }
}

async function viewWeeklyCalendarBooking(area, deploymentName, bookingDate) {
  await openArtifactListView('bookings', 'create-booking-button');
  await driver.wait(until.elementLocated(By.id('select2-areaFilterSelect-container')), 5000);
  await selectFilterOption('select2-areaFilterSelect-container', area);
  var elementId = bookingDate + '-' + deploymentName;
  await driver.wait(until.elementLocated(By.xpath('//button[contains(.,"Week")]')), 20000);
  await clickElement(By.xpath('//button[contains(.,"Week")]'));
  var currentDay = new Date().getDay();
  if (currentDay === 0) { // If Sunday, Change Weekly Calendar to next week
    await driver.wait(until.elementLocated(By.className('fc-customNextButton-button fc-button fc-button-primary')), 3000).click();
  }
  await driver.sleep(500);
  await driver.wait(until.elementLocated(By.id(elementId)), 5000);
  await driver.findElement(By.id(elementId)).click();
  await driver.wait(until.elementLocated(By.xpath('//h2[contains(.,"Viewing")]')), 5000);
}

async function viewItem(objType, objName, colNo, area, program = undefined) {
  await performActionOnTableItem(objType, objName, 'View', colNo, getTableId(objType), area, program);
  var headerSize = (objType === 'bookings') ? 2 : 1;
  await driver.wait(until.elementLocated(By.xpath(`//h${headerSize}[contains(.,"Viewing")]`)), 5000);
}

async function editItem(objType, objName, colNo, area = undefined, program = undefined) {
  await performActionOnTableItem(objType, objName, 'Edit', colNo, area, program);
  await driver.wait(until.elementLocated(By.xpath('//h1[contains(.,"Editing")]')), 5000);
}

async function deleteItem(objType, objName, colNo, expectedToDelete = true, area, program = undefined) {
  var tableId = getTableId(objType);
  await performActionOnTableItem(objType, objName, 'Delete', colNo, tableId, area, program);
  var elemToFind = (expectedToDelete) ? '//div[contains(.,"deleted successfully!")]' : '//h3[contains(.,"deletion failed!")]';
  await driver.wait(until.elementLocated(By.xpath(elemToFind)), 5000);
  var objsToFind = (expectedToDelete) ? 0 : 1;
  (await findTableItem(objType, objName, objsToFind, colNo, tableId, area, program));
}

async function showAllFilters() {
  await clickElement(By.xpath('//button[contains(.,"Show Filters")]'));
  await driver.sleep(2000);
}

async function selectFilterOption(filterId, filterValue) {
  await driver.sleep(500);
  await driver.wait(until.elementLocated(By.id(filterId)), 5000);
  await driver.findElement(By.id(filterId)).click();
  await driver.wait(until.elementLocated(By.className('select2-search__field')), 5000);
  await driver.findElement(By.className('select2-search__field')).sendKeys(`${filterValue}` + webdriver.Key.ENTER);
}

async function findFilterOption(filterId, filterValue, shouldFind = true) {
  await driver.wait(until.elementLocated(By.id(filterId)), 5000);
  await clickElement(By.id(filterId));
  await doesElementExist(By.css(`[label="${filterValue}"]`), null, shouldFind);
}

async function verifyFilterOption(tableId, artifactName1, artifactName2, filterId, filterValue) {
  await showAllFilters();
  // Check Table Before Filter
  await doesElementExistInTable(artifactName1, tableId);
  await doesElementExistInTable(artifactName2, tableId);

  // Select Filter Option from Filter Dropdown
  await selectFilterOption(filterId, filterValue);

  // Check Table After Filter
  await doesElementExistInTable(artifactName1, tableId);
  await doesElementExistInTable(artifactName2, tableId, false);
}

async function viewStatisticalGraphs(deploymentName) {
  if (deploymentName) {
    // View Deployment Statistics
    await performActionOnTableItem('statistics/bookings', deploymentName, 'View Global Stats', 1);
    await driver.wait(until.elementLocated(By.xpath(`//h2[contains(.,"Booking Statistics for Deployment '${deploymentName}'")]`)), 5000);
  } else {
    // View Global Statistics
    await openArtifactListView('statistics/bookings');
    await clickElement(By.id('global-stats-button'));
    await driver.wait(until.elementLocated(By.xpath('//h2[contains(.,"Booking Statistics for all Deployments")]')), 5000);
  }
}

async function toggleDTTAdminLogs() {
  var toggleButtonLocator = '/html/body/div[1]/section/section/section/ui-view/section/div[1]/div/div[2]/toggle/div/div/label[2]';
  var toggleButton = await driver.findElement(By.xpath(toggleButtonLocator));
  await toggleButton.click();
}

async function restoreLogArtifact(objType, objName, deleted = false, version = 'CREATED-0') {
  await viewLogItem(objType, objName, deleted);
  await toggleDTTAdminLogs();
  await driver.findElement(By.id(`restore-${version}`)).click();
  await driver.switchTo().alert().accept();
  // Verify restore
  await driver.wait(until.elementLocated(By.xpath('//div[contains(.,"restoration successful")]')), 5000);
  (await driver.findElement(By.xpath('//div[contains(.,"restoration successful")]')).isDisplayed()).should.equal(true);
  await driver.wait(until.elementLocated(By.xpath(`//h1[contains(.,"'${objName}")]`)), 5000);
  await driver.findElement(By.xpath(`//h1[contains(.,"'${objName}")]`));
}

async function viewLogItem(objType, objName, deleted = false) {
  var tableId = (deleted) ? 'live-table' : 'deleted-table';
  await performActionOnTableItem(`logs/${objType}`, objName, 'View', 2, tableId);
  await driver.wait(until.elementLocated(By.xpath(`//h1[contains(.,"Log '${objName}'")]`)), 5000);
}

async function viewSupportDocs(href) {
  await driver.get(baseUrl);
  await driver.findElement(By.xpath('//a[contains(.,"Help")]')).click();
  await clickElement(By.css(`[href="/${href}"]`));
}

async function verifySupportDocs(waitKey, findKey) {
  await driver.getAllWindowHandles().then(async function gotWindowHandles(allHandles) {
    await driver.switchTo().window(allHandles[1]);
    await driver.wait(until.elementLocated(waitKey), 30000);
    await doesElementExist(findKey, false, 1, false);
    await driver.close();
    await driver.switchTo().window(allHandles[0]);
  });
}

async function openArtifactCreateView(objType) {
  await driver.get(`${baseUrl}${objType}/create`);
  await driver.wait(until.elementLocated(By.xpath('//h1[contains(.,"Creating")]')), 5000);
}

async function openArtifactEditView(objType, userId) {
  await driver.get(`${baseUrl}${objType}/edit/${userId}`);
  await driver.wait(until.elementLocated(By.xpath('//h1[contains(.,"Editing")]')), 5000);
}

async function newAreaSetup(name, programName) {
  await openArtifactCreateView('areas');
  await driver.findElement(By.id('name')).sendKeys(name);
  // Add Program
  await clickAndSendKey('program', programName);
  await clickSaveButton('Area creation');
}

async function newProgramSetup(name) {
  await openArtifactCreateView('programs');
  await driver.findElement(By.id('name')).sendKeys(name);
  await clickSaveButton('Program creation');
}

async function newLabelSetup(name) {
  await openArtifactCreateView('labels');
  await driver.findElement(By.id('name')).sendKeys(name);
  await clickSaveButton('Label creation');
}

async function newProductTypeSetup(name, productFlavour, configuration, isStrict) {
  await openArtifactCreateView('productTypes');
  await driver.findElement(By.id('name')).sendKeys(name);
  await driver.findElement(By.css('[ng-class="classesBtn"]')).click();
  await driver.findElement(By.xpath(`//a[contains(.,"${productFlavour}")]`)).click();
  await driver.findElement(By.id('name')).click();
  if (isStrict) {
    await driver.findElement(By.id('strict-toggle')).click();
  }
  if (configuration && configuration.length > 0) {
    var configIndex = 0;
    await asyncForEach(configuration, async function (config) {
      await driver.findElement(By.id('add-product-configuration')).click();
      await driver.findElement(By.name(`productType.mandatoryConfigKeys[${configIndex}].name`)).sendKeys(config.name);
      await clickAndSendKey(`productType.mandatoryConfigKeys[${configIndex}].infrastructure`, config.infrastructure);
      await driver.findElement(By.xpath('//body')).click();
      configIndex += 1;
    });
  }
  await clickSaveButton('Product-Type creation');
}

async function newProductFlavourSetup(name) {
  await openArtifactCreateView('productFlavours');
  await driver.findElement(By.id('name')).sendKeys(name);
  await clickSaveButton('Product-Flavour creation');
}

// startTime, endTime in the form of 2020-01-01
async function newBookingSetup(
  deploymentName, productTypeName, teamName, startTime, endTime, shareable, testingType, description,
  executeSave = true, jenkinsJobType, enmDropVersion, enmProductSet, jiraIssue, nssVersion, useCustomJiraTemplate = false
) {
  await openArtifactListView('bookings', 'create-booking-button');
  await clickElement(By.id('create-booking-button'));
  await clickElement(By.id('create-booking-by-deployment-button'));
  // Associated Artifacts
  await select2DropdownSelect('deployment-select', deploymentName);
  await driver.sleep(500);
  if (productTypeName) {
    await select2DropdownSelect('bookingProduct-select', productTypeName);
  }
  if (teamName.includes('custom')) {
    await driver.wait(until.elementLocated(By.id('booking-crud-modal')), 5000);
    await driver.findElement(By.id('booking-crud-modal')).click();
    await driver.sleep(1000);
    await driver.wait(until.elementLocated(By.name('customTeamToggle')), 5000);
    await driver.findElement(By.name('customTeamToggle')).click();
    await driver.sleep(800);
    await clickAndSendKey('customTeam', teamName);
  } else {
    await driver.sleep(500);
    await select2DropdownSelect('team-select', teamName);
  }

  // Sharing Status
  if (shareable) {
    await driver.sleep(500);
    await driver.wait(until.elementLocated(By.name('sharingType')), 5000);
    await driver.findElement(By.name('sharingType')).click();
    await driver.sleep(500);
  }
  // Choose Dates
  await driver.findElement(By.id('startTime')).sendKeys(startTime + webdriver.Key.TAB);
  await driver.findElement(By.id('endTime')).sendKeys(endTime + webdriver.Key.TAB);
  await driver.sleep(2000);

  // Additional Information
  await select2DropdownSelect('testingType-select', testingType);
  await driver.sleep(1000);
  await clickElementAndSendKey('bookingDescription', description, 'id', true);
  // ENM Specific Fields
  if (productTypeName && productTypeName.includes('ENM')) {
    await driver.wait(until.elementLocated(By.name('additionalJenkinsUsers')), 5000);
    await driver.findElement(By.name('additionalJenkinsUsers')).sendKeys('eistpav');
    if (jiraIssue) {
      await driver.wait(until.elementLocated(By.name('jiraMRBugReferenceIssue')), 5000);
      await driver.findElement(By.name('jiraMRBugReferenceIssue')).sendKeys(jiraIssue + webdriver.Key.TAB);
      await driver.sleep(2000);
    }
    await select2DropdownSelect('enmProductSetDrop-select', enmDropVersion);
    if (enmProductSet) {
      await select2DropdownSelect('enmProductSetVersion-select', enmProductSet);
    }
    if (jenkinsJobType) {
      await driver.wait(until.elementLocated(By.name(jenkinsJobType)), 5000);
      await driver.findElement(By.name(jenkinsJobType)).click();
      (await driver.findElement(By.name('jenkins-trigger-div')).getAttribute('title')).should.equal('');
    }
    await select2DropdownSelect('nssVersion-select', nssVersion);
  }
  if (useCustomJiraTemplate) {
    await driver.sleep(2000);
    await select2DropdownSelect('template-select', 'JIRA');
  }
  if (executeSave) {
    await clickSaveButton('Booking creation', 'save-booking-button');
  }
}

async function newBookingFindSetup(
  deploymentName, productTypeName, shareable, testingType, description,
  executeSave = true, jenkinsJobType, enmDropVersion, enmProductSet, jiraIssue, nssVersion
) {
  // Associated Artifacts
  await select2DropdownSelect('deploymentAlt-select', deploymentName);
  // Product
  await driver.sleep(500);
  await select2DropdownSelect('bookingProductAlt-select', productTypeName);
  // Sharing Status
  if (shareable) await clickElement(By.name('sharingType'));
  // Additional Information
  await driver.sleep(500);
  await select2DropdownSelect('testingTypeAlt-select', testingType);
  await clickElementAndSendKey('bookingDescriptionAlt', description, 'id');
  // ENM Specific Fields
  if (productTypeName && productTypeName.includes('ENM')) {
    await clickElementAndSendKey('additionalJenkinsUsersAlt', 'eistpav', 'id');
    if (jiraIssue) {
      await clickElementAndSendKey('jiraMRBugReferenceIssueAlt', jiraIssue, 'id');
      await driver.sleep(2000);
    }
    await driver.sleep(500);
    await select2DropdownSelect('enmProductSetDropAlt-select', enmDropVersion);
    await driver.sleep(500);
    if (enmProductSet) {
      await select2DropdownSelect('enmProductSetVersionAlt-select', enmProductSet);
    }
    if (jenkinsJobType) await clickElement(By.name(jenkinsJobType));
    await select2DropdownSelect('nssVersionAlt-select', nssVersion);
  }
  if (executeSave) {
    await clickSaveButton('Booking creation', 'save-booking-button');
  }
}

// startTime, endTime in the form of 2020-01-01
async function newFindDeploymentSetup(teamName, startTime, endTime, labelName, productType, customTeam, showAllDeployments = false) {
  await openArtifactListView('bookings', 'create-booking-button');
  await clickElement(By.id('create-booking-button'));
  await clickElement(By.id('find-booking-time-button'));
  // Select Team
  if (!customTeam) await select2DropdownSelect('findTeamSelect', teamName);
  if (customTeam) {
    await driver.sleep(500);
    await driver.wait(until.elementLocated(By.name('customTeamToggleAlt')), 5000);
    await driver.findElement(By.name('customTeamToggleAlt')).click();
    await driver.sleep(500);
    await clickElementAndSendKey('customTeam', customTeam, 'id');
  }
  if (productType) {
    // Select ProductType
    await driver.sleep(500);
    await select2DropdownSelect('findProductTypeSelect', productType);
  }
  if (labelName) {
    // Select Label
    await driver.sleep(500);
    await select2DropdownSelect('findLabelSelect', labelName);
  }

  if (showAllDeployments) {
    await driver.sleep(500);
    await driver.wait(until.elementLocated(By.name('filteredDeplAlt')), 5000);
    await driver.findElement(By.name('filteredDeplAlt')).click();
    await driver.sleep(500);
  }

  // Choose Dates
  await driver.findElement(By.id('startTimeAlt')).sendKeys(startTime + webdriver.Key.TAB);
  await driver.findElement(By.id('endTimeAlt')).sendKeys(endTime + webdriver.Key.TAB);
  // Find button
  await driver.wait(until.elementLocated(By.id('find-bookings-by-time')), 5000);
  await driver.findElement(By.id('find-bookings-by-time')).click();
}

async function newDeploymentSetup(
  name, programName, labelName, areaName, status = statusTypes.IN_REVIEW, crossRaSharing,
  products = [], teamName, deploymentPurpose, jiraIssues, spocUser, executeSave = true, unassignedDeployment, fakeJenkinsURL = false
) {
  await openArtifactCreateView('deployments');
  // Add Name
  await driver.findElement(By.name('name')).sendKeys(name);
  // Add Program
  await driver.sleep(1000);
  await select2DropdownSelect('program-select', programName);
  // Add Label
  if (labelName) await driver.findElement(By.name('newLabels')).sendKeys(labelName);
  // Add Area
  await driver.sleep(500);
  await driver.wait(until.elementLocated(By.id('select2-area-select-container')), 20000);
  var element = await driver.findElement(By.id('select2-area-select-container'));
  await driver.executeScript('arguments[0].scrollIntoView(true);', element);
  await select2DropdownSelect('area-select', areaName);
  // Add Status
  await driver.sleep(500);
  await driver.wait(until.elementLocated(By.id('select2-status-select-container')), 20000);
  element = await driver.findElement(By.id('select2-status-select-container'));
  await driver.executeScript('arguments[0].scrollIntoView(true);', element);
  await select2DropdownSelect('status-select', status);
  // Toggle Cross RA Sharing
  if (crossRaSharing) {
    await driver.wait(until.elementLocated(By.name('crossRASharing')), 5000);
    await driver.findElement(By.name('crossRASharing')).click();
  }
  // Add Team
  if (teamName) {
    await driver.sleep(500);
    await select2DropdownSelect('team-select', teamName);
  }
  // Add SPOC User
  if (spocUser) {
    var multiSelect = await driver.findElement(By.id('spoc_users'), 5000);
    await driver.findElement(By.id('spoc_users')).click();
    await multiSelect.findElement(By.xpath("//*[@id='spoc_users']/div/ul/*/div/input[@type='text']")).sendKeys(spocUser);
    await multiSelect.findElement(By.xpath(`//*[@id='spoc_users']/div/ul/*/a[contains(.,"${spocUser}")]`)).click();
    await driver.findElement(By.id('spoc_users')).click();
  }
  // Add Deployment Purpose
  if (deploymentPurpose) await clickAndSendKey('purpose', deploymentPurpose);
  // Add Products
  if (products && products.length > 0) {
    var productIndex = 0;
    await asyncForEach(products, async function (product) {
      await addNewProduct(
        productIndex, product.typeName, product.flavourName,
        product.infrastructure, true, product.purpose, product.hardware, product.data, fakeJenkinsURL
      );
      productIndex += 1;
    });
  }
  // Add JIRA Issues
  if (jiraIssues && jiraIssues.length > 0) {
    var jiraIssueIndex = 0;
    await asyncForEach(jiraIssues, async function (jiraIssue) {
      await clickElement(By.id('add-jira'));
      await driver.sleep(500);
      await driver.findElement(By.name(`jira_issues[${jiraIssueIndex}]`)).sendKeys(jiraIssue);
      await driver.findElement(By.xpath('//body')).click();
      await driver.wait(until.elementLocated(By.className('ui-notification')), 15000);
      await driver.wait(until.elementLocated(By.xpath(`//div[contains(.,"JIRA Issue: ${jiraIssue} is valid")]`)), 15000);
      (await driver.findElement(By.xpath(`//div[contains(.,"JIRA Issue: ${jiraIssue} is valid")]`)).isDisplayed()).should.equal(true);
      jiraIssueIndex += 1;
    });
  }

  if (executeSave) {
    await clickSaveButton('Deployment creation', null, null, null, unassignedDeployment);
    // Validate Products were added
    if (products && products.length > 0) {
      await asyncForEach(products, async function (product) {
        (await driver.findElement(By.xpath(`//td[contains(.,"${product.typeName}")]`)).isDisplayed()).should.equal(true);
        (await driver.findElement(By.xpath(`//td[contains(.,"${product.flavourName}")]`)).isDisplayed()).should.equal(true);
        if (product.hardware && product.hardware.length > 0) {
          await asyncForEach(product.hardware, async function (hardware) {
            (await driver.findElement(By.xpath(`//td[contains(.,"${hardware}")]`)).isDisplayed()).should.equal(true);
          });
        }
        if (product.data && product.data.length > 0) {
          await asyncForEach(product.data, async function (data) {
            (await driver.findElement(By.xpath(`//td[contains(.,"${data}")]`)).isDisplayed()).should.equal(true);
          });
        }
      });
    }
  }
}

async function newTeamSetup(name, area, adminPrimary = 'DTT Admin') {
  await openArtifactCreateView('teams');
  await driver.findElement(By.id('name')).sendKeys(name);
  await select2DropdownSelect('area-select', area);
  await select2DropdownSelect('adminPrimary-select', adminPrimary);
  await driver.sleep(500);
  await select2DropdownSelect('adminSecondary-select', 'Jimmy Casey');
  await clickSaveButton('Team creation');
}

async function addJiraTemplate() {
  var infrastructure = 'Physical';
  var board = 'CI_Framework';
  var project = 'Continuous Integration Services';

  await driver.wait(until.elementLocated(By.id('create-jira-button')), 5000);
  await driver.findElement(By.id('create-jira-button')).click();
  await driver.findElement(By.id('jiraTemplate.infrastructure')).sendKeys(infrastructure);
  await driver.findElement(By.id('jiraTemplate.board')).sendKeys(board);
  await driver.findElement(By.id('jiraTemplate.issueType')).sendKeys('Test');
  await driver.findElement(By.id('jiraTemplate.project')).sendKeys(project);
  await driver.findElement(By.xpath('//*[@id="jira-template-modal"]/div/div[2]/form/fieldset/div[3]/button')).click();
  await driver.sleep(1500);
  await driver.wait(until.elementLocated(By.xpath('//div[contains(.,"update successful")]')), 10000);
}

async function addNewProduct(
  productIndex, productTypeName, productFlavourName, infrastructure = infraTypes.CLOUD,
  jenkinsJob = true, purpose, hardwares, datas, fakeJenkinsURL = false
) {
  await clickElement(By.id('add-product'));
  // Add Product-Type
  await select2DropdownSelect(`products${productIndex}-productType`, productTypeName);
  await driver.sleep(500);
  // Add Product-Flavour
  await select2DropdownSelect(`products${productIndex}-flavour_name`, productFlavourName);
  await driver.sleep(500);
  // Add Infrastructure
  await select2DropdownSelect(`products${productIndex}-infrastructure`, infrastructure);
  // Add Jenkins Job
  if (jenkinsJob) {
    var jenkinsURL = (fakeJenkinsURL) ? 'fakeUrl' : 'testingTrigger2';
    await driver.findElement(By.name(`products[${productIndex}].jenkinsJob`))
      .sendKeys(`https://fem13s11-eiffel004.eiffel.gic.ericsson.se:8443/jenkins/job/${jenkinsURL}/`);
  }

  if (purpose) {
    // Add Product Purpose Notes
    await clickAndSendKey(`products[${productIndex}].purpose`, purpose);
  }
  if (hardwares && hardwares.length > 0) {
    // Add Hardware
    await asyncForEach(hardwares, async function (hardware) {
      await addHardwareToProduct(productIndex, hardware);
    });
  }
  if (datas && datas.length > 0) {
    // Add Product Data
    var dataIndex = 0;
    await asyncForEach(datas, async function (data) {
      await addNewProductData(productIndex, dataIndex, data);
      dataIndex += 1;
    });
  }
}

async function addNewProductData(productIndex, index, linkName, urlName = 'http://www.ericsson.se/link') {
  await clickElement(By.id('add-product-data'));
  await driver.wait(until.elementLocated(By.name(`products[${productIndex}].links[${index}].link_name`)), 5000);
  // Add Product Data Name
  await driver.findElement(By.name(`products[${productIndex}].links[${index}].link_name`)).sendKeys(linkName);
  // Add Product Data Url
  await driver.findElement(By.name(`products[${productIndex}].links[${index}].url`)).sendKeys(urlName);
}

async function newHardwareSetup(hardwareName, programName, hwDeploymentId) {
  await openArtifactCreateView('hardware');
  await driver.findElement(By.id('hardwareName')).sendKeys(hardwareName);
  await driver.findElement(By.id('deploymentId')).sendKeys(hwDeploymentId);
  await select2DropdownSelect('program-select', programName);
  await driver.wait(until.elementLocated(By.id('hardwareUrl')), 5000);
  await driver.findElement(By.id('hardwareUrl')).click();
  await clickSaveButton('Hardware creation');
}

async function addHardwareToProduct(productIndex, hardwareName) {
  await driver.wait(until.elementLocated(By.name(`products[${productIndex}].hardware`)), 5000);
  var productHardwareList = await driver.findElement(By.id(`products[${productIndex}].hardware`));
  await productHardwareList.findElement(By.css(`[label="${hardwareName}"]`)).click();
}

async function addPermission(permissionObj, index) {
  await driver.wait(until.elementLocated(By.id('add-permission')), 10000);
  await driver.sleep(500);
  await driver.findElement(By.id('add-permission')).click();
  await driver.sleep(500);
  await driver.wait(until.elementLocated(By.name(`permissions${index}-resources`)), 10000);
  await driver.findElement(By.name(`permissions${index}-resources`)).click();
  await driver.findElement(By.name(`permissions${index}-resources`)).sendKeys(permissionObj.resources);
  await driver.sleep(500);

  // Tick method boxes
  var ids = permissionObj.resourceMethodIds;
  for (var idIndex = 0; idIndex < ids.length; idIndex += 1) {
    await driver.findElement(By.id(`permissions${index}-${ids[idIndex]}`)).click(); //eslint-disable-line
  }

  await driver.sleep(500);
}

async function removePermissionAtIndex(resourcePath, index) {
  await driver.sleep(500);
  await driver.wait(until.elementLocated(By.id(`remove-permission[${index}]`)), 5000);
  await driver.findElement(By.id(`remove-permission[${index}]`)).click();
  await driver.sleep(500);
  alertElement = await driver.switchTo().alert().getText();
  alertElement.should.containEql(`Are you sure you want to remove permission for path : "${resourcePath}"?`);
  await driver.switchTo().alert().accept();
}

async function addRoleToUserRoleList(roleName) {
  await driver.sleep(500);
  await driver.wait(until.elementLocated(By.id('roles')), 5000);
  await driver.findElement(By.id('roles')).click();
  await driver.sleep(500);
  await driver.wait(until.elementLocated(By.xpath(`//a[contains(.,"${roleName}")]`)), 10000);
  await driver.findElement(By.xpath(`//a[contains(.,"${roleName}")]`)).click();
  await driver.sleep(500);
}

async function newRoleSetup(roleName, permissionsList) {
  // View roles page
  await openArtifactCreateView('roles');
  driver.wait(until.elementLocated(By.id('name')), 5000);
  await driver.findElement(By.id('name')).sendKeys(roleName);

  // Wait for add permission button
  await driver.sleep(500);
  await driver.wait(until.elementLocated(By.id('add-permission')), 5000);

  // Add permissions
  for (var i = 0; i < permissionsList.length; i += 1) {
    await addPermission(permissionsList[i], i); //eslint-disable-line
  }
  await clickSaveButton();
}

async function clickSaveButton(successMessage, uniqueId, requiresReason, updateReason, unassignedDeployment) {
  await driver.wait(until.elementLocated(By.xpath('//button[contains(.,"Save")]')), 5000);
  var saveBtnSelector = (uniqueId) ? By.id(uniqueId) : By.xpath('//button[contains(.,"Save")]');
  await clickElement(saveBtnSelector);
  if (requiresReason) {
    var alertElement = await driver.switchTo().alert();
    if (updateReason) await alertElement.sendKeys(updateReason);
    await alertElement.accept();
  }
  if (unassignedDeployment) {
    await driver.switchTo().alert().accept();
  }
  if (successMessage) {
    if (!uniqueId) await driver.wait(until.elementLocated(By.xpath('//h1[contains(.,"Viewing")]')), 10000);
    await driver.wait(until.elementLocated(By.xpath(`//div[contains(.,"${successMessage} successful")]`)), 5000);
    (await driver.findElement(By.xpath(`//div[contains(.,"${successMessage} successful")]`)).isDisplayed()).should.equal(true);
  }
}

async function performHomePageSearch(searchResultsTotal, searchValueParam, objTypeParam, valueMatchParam, caseSensitiveParam = false) {
  // 1. Open Home-Page
  await driver.get(baseUrl);
  await driver.wait(until.elementLocated(By.xpath('//h1[contains(.,"Welcome")]')), 30000);
  await driver.sleep(1000);

  // 2. Handle Search-Value Param Input field
  await driver.findElement(By.id('search-value-input-field')).sendKeys(searchValueParam);

  // 3. Handle Artifact-Type Param Dropdown
  if (objTypeParam) {
    await driver.wait(until.elementLocated(By.id('artifact-filter-select')), 5000);
    await driver.findElement(By.id('artifact-filter-select')).click();
    await driver.findElement(By.css(`[value="string:${objTypeParam}"]`)).click();
  }

  // 4. Handle Value-Match-Type Param Dropdown
  if (valueMatchParam) {
    await driver.wait(until.elementLocated(By.id('value-match-select')), 5000);
    await driver.findElement(By.id('value-match-select')).click();
    await driver.findElement(By.css(`[value="string:${valueMatchParam}"]`)).click();
  }

  // 5. Handle Case-Sensitive Param Toggle
  var caseSensitiveElem = await driver.findElement(By.css('[ng-model="vm.isSearchCaseSensitive"]'));
  var isCaseSensitiveElemSelected = await caseSensitiveElem.isSelected();
  if (isCaseSensitiveElemSelected !== caseSensitiveParam) {
    await caseSensitiveElem.click();
  }
  (await caseSensitiveElem.isSelected()).should.equal(caseSensitiveParam);

  // 6. Perform Search Operation
  await clickElement(By.id('search-artifacts-button'));

  // 7. Check Results Panel is Diplayed and Check Search-Result Count
  await driver.wait(until.elementLocated(By.id('search-results-panel')), 30000);
  (await driver.findElement(By.id('search-results-count')).getText()).should.equal(searchResultsTotal.toString());
}

// --------------
// REST FUNCTIONS
// --------------
async function dttSignInREST(username, password) {
  try {
    response = await request.post(`${baseUrl}api/auth/signin`).form({ username: username, password: password });
    response = JSON.parse(response);
    return response;
  } catch (requestErr) {
    throw new Error(`Failed to sign-in for username ${username}. Received message with status ${requestErr.message}`);
  }
}

async function getArtifactIdREST(artifactType, findKey, findValue) {
  response = await request.get(`${baseUrl}api/${artifactType}?q=${findKey}=${findValue}`).auth(testUsername, testPassword);
  var artifactsFound = JSON.parse(response);
  if (artifactsFound && artifactsFound.length > 0) {
    return artifactsFound[0]._id;
  }
}

function handleErrorREST(errObj, userMessage, safeMode) {
  if (!errObj.message.startsWith('404') || errObj.message.includes('id does not exist')) {
    if (!safeMode) throw new Error(`${userMessage} Received message with status ${errObj.message}`);
  }
}

async function deleteArtifactREST(artifactType, artifact, artifactName, deleteLogs, safeMode) {
  var artifactId;
  try {
    if (artifact) {
      artifactId = artifact._id;
    } else if (artifactType && artifactType === 'bookings') {
      var deploymentId = await getArtifactIdREST('deployments', 'name', artifactName);
      artifactId = await getArtifactIdREST(artifactType, 'deployment_id', deploymentId);
    } else if (artifactName) {
      artifactId = await getArtifactIdREST(artifactType, 'name', artifactName);
    }
  } catch (idErr) {
    handleErrorREST(idErr, `Failed to get ID for ${artifactType} artifact.`, safeMode);
  }
  try {
    response = await request.delete(`${baseUrl}api/${artifactType}/${artifactId}`).auth(testUsername, testPassword);
  } catch (delErr) {
    handleErrorREST(delErr, `Failed to delete ${artifactType} artifact.`, safeMode);
  }
  try {
    if (deleteLogs) await request.delete(`${baseUrl}api/logs/${artifactType}`).auth(testUsername, testPassword);
  } catch (logErr) {
    handleErrorREST(logErr, `Failed to delete ${artifactType} artifact logs.`, safeMode);
  }
}

async function createArtifactREST(artifactType, artifactData) {
  try {
    response = await request.post(`${baseUrl}api/${artifactType}`).auth(testUsername, testPassword).form(artifactData);
    response = JSON.parse(response);
    return response;
  } catch (requestErr) {
    throw new Error(`Failed to create ${artifactType} artifact. Received message with status ${requestErr.message}`);
  }
}

function createProgramREST(name) {
  return createArtifactREST('programs', { name: name });
}

function createAreaREST(name, programId) {
  return createArtifactREST('areas', { name: name, program_id: programId });
}

function createTeamREST(name, areaId, adminPrimary = dttAdminInformation._id) {
  return createArtifactREST('teams', { name: name, area_id: areaId, admin_IDs: [adminPrimary] });
}

function createLabelREST(name) {
  return createArtifactREST('labels', { name: name });
}

function createProductFlavourREST(name) {
  return createArtifactREST('productFlavours', { name: name });
}

function createRoleREST(name, pathsPermissions) {
  return createArtifactREST('roles', { name: name, pathsPermissions: pathsPermissions });
}

function createProductTypeREST(name, productFlavours, configuration, configIsStrict) {
  return createArtifactREST('productTypes', {
    name: name,
    flavours: productFlavours,
    mandatoryConfigKeys: configuration,
    configKeysAreStrict: configIsStrict
  });
}

function createHardwareREST(name, programId, hwDeploymentId) {
  return createArtifactREST('hardware', { name: name, program_id: programId, hw_deployment_id: hwDeploymentId });
}

function createDeploymentREST(
  name, programId, areaId, status = statusTypes.IN_REVIEW,
  products = [], crossRASharing = false, teamId, labelIds, purpose, jiraIssues, spocUserIds,
) {
  return createArtifactREST('deployments', {
    name: name,
    program_id: programId,
    area_id: areaId,
    team_id: teamId,
    label_ids: labelIds,
    status: status,
    products: products,
    purpose: purpose,
    jira_issues: jiraIssues,
    spocUser_ids: spocUserIds,
    crossRASharing: crossRASharing
  });
}

function createBookingREST(
  name, deploymentId, productId, teamId, startTime, endTime, shareable, testingType,
  description, jenkinsJobType, enmDropVersion, enmProductSet, jiraIssue, nssVersion
) {
  return createArtifactREST('bookings', {
    name: name,
    deployment_id: deploymentId,
    product_id: productId,
    team_id: teamId,
    infrastructure: 'Cloud',
    startTime: startTime,
    endTime: endTime,
    shareable: shareable,
    testingType: testingType,
    description: description,
    jenkinsJobType: jenkinsJobType,
    enmDropVersion: enmDropVersion,
    enmProductSet: enmProductSet,
    jiraIssue: jiraIssue,
    nssVersion: nssVersion
  });
}

describe('PDU OSS Deployment Tracking Tool Smoke Tests', function () {
  before(async function () {
    this.timeout(250000);
    try {
      driver = await new webdriver.Builder()
        .forBrowser('chrome')
        .withCapabilities(chromeCapabilities)
        .build();
      // Get DTT Admin Information from API
      dttAdminInformation = await dttSignInREST(testUsername, testPassword);

      // Log in test user first
      console.log(`Navigating to login address: ${loginUrl}`); // eslint-disable-line no-console
      await driver.get(loginUrl);
      await driver.wait(until.elementLocated(By.name('username')), 30000);
      await driver.findElement(By.name('username')).sendKeys(testUsername);
      await driver.findElement(By.name('password')).sendKeys(testPassword);
      await clickElement(By.css('[class="ebBtn eaLogin-formButton"]'));
      await driver.wait(until.elementLocated(By.xpath('//h1[contains(.,"Welcome")]')), 30000);
      console.log('Login complete.'); // eslint-disable-line no-console
      await deleteAllHealthArtifactsREST();
    } catch (beforeAllError) {
      await takeScreenshot('before_initial');
      throw beforeAllError;
    }
  });

  describe('Header @healthtest', function () {
    this.timeout(100000);
    this.retries(MAX_RETRIES);
    it('should get title of DTT', async function () {
      await driver.get(baseUrl);
      (await driver.getTitle()).should.containEql('PDU OSS DTT');
    });

    it('should get header of Bookings page', async function () {
      await openArtifactListView('bookings', 'create-booking-button');
      (await driver.findElement(By.xpath('//h1[contains(.,"Deployment Bookings")]')).isDisplayed()).should.equal(true);
    });

    it('should get header of Deployments page', async function () {
      await openArtifactListView('deployments');
      (await driver.findElement(By.xpath('//h1[contains(.,"Deployments")]')).isDisplayed()).should.equal(true);
    });

    it('should get header of Requirement Areas page', async function () {
      await openArtifactListView('areas');
      (await driver.findElement(By.xpath('//h1[contains(.,"Requirement Areas")]')).isDisplayed()).should.equal(true);
    });

    it('should get header of Product-Types page', async function () {
      await openArtifactListView('productTypes');
      (await driver.findElement(By.xpath('//h1[contains(.,"Product-Types")]')).isDisplayed()).should.equal(true);
    });

    it('should get header of Product-Flavours page', async function () {
      await openArtifactListView('productFlavours');
      (await driver.findElement(By.xpath('//h1[contains(.,"Product-Flavours")]')).isDisplayed()).should.equal(true);
    });

    it('should get header of Teams page', async function () {
      await openArtifactListView('teams');
      (await driver.findElement(By.xpath('//h1[contains(.,"Teams")]')).isDisplayed()).should.equal(true);
    });

    it('should get header of Labels page', async function () {
      await openArtifactListView('labels');
      (await driver.findElement(By.xpath('//h1[contains(.,"Labels")]')).isDisplayed()).should.equal(true);
    });

    it('should get header of Users page', async function () {
      await openArtifactListView('users');
      (await driver.findElement(By.xpath('//h1[contains(.,"Users")]')).isDisplayed()).should.equal(true);
    });

    it('should get header of Hardware page', async function () {
      await openArtifactListView('hardware');
      (await driver.findElement(By.xpath('//h1[contains(.,"Hardwares")]')).isDisplayed()).should.equal(true);
    });

    it('should get header of Bookings logs page', async function () {
      await openArtifactListView('logs/bookings');
      (await driver.findElement(By.xpath('//h1[contains(.,"Bookings Historical Logs")]')).isDisplayed()).should.equal(true);
    });

    it('should get header of Deployments logs page', async function () {
      await openArtifactListView('logs/deployments');
      (await driver.findElement(By.xpath('//h1[contains(.,"Deployments Historical Logs")]')).isDisplayed()).should.equal(true);
    });

    it('should get header of Product-Types logs page', async function () {
      await openArtifactListView('logs/productTypes');
      (await driver.findElement(By.xpath('//h1[contains(.,"Product-Types Historical Logs")]')).isDisplayed()).should.equal(true);
    });

    it('should get header of Areas logs page', async function () {
      await openArtifactListView('logs/areas');
      (await driver.findElement(By.xpath('//h1[contains(.,"Areas Historical Logs")]')).isDisplayed()).should.equal(true);
    });

    it('should get header of Product-Flavours logs page', async function () {
      await openArtifactListView('logs/productFlavours');
      (await driver.findElement(By.xpath('//h1[contains(.,"Product-Flavours Historical Logs")]')).isDisplayed()).should.equal(true);
    });

    it('should get header of Team logs page', async function () {
      await openArtifactListView('logs/teams');
      (await driver.findElement(By.xpath('//h1[contains(.,"Teams Historical Logs")]')).isDisplayed()).should.equal(true);
    });

    it('should get header of Booking Statistics page', async function () {
      await openArtifactListView('statistics/bookings', 'statistics-table');
      (await driver.findElement(By.xpath('//h1[contains(.,"Deployment Booking Statistics")]')).isDisplayed()).should.equal(true);
    });
  });

  describe('Home-Page Search @healthtest', function () {
    this.timeout(250000);
    this.retries(MAX_RETRIES);
    var beforeSuccessful = false;

    // Artifact Details
    var programName = 'A_Health_programs_search';
    var areaName = 'A_Health_area1_sample';
    var areaName2 = 'A_Health_area2_Sample';
    var areaName3 = 'A_Health_area3';
    var productFlavourName = 'A_Health_prodFlav_sample';
    var deploymentName1Label = 'A_Health_depl_1_Label';
    var deploymentName2Label2 = 'A_Health_depl_2_Labels';

    var labelName1 = 'A_HEALTH_LBL_1';
    var labelName2 = 'A_HEALTH_LBL_2';

    before(async function () {
      labelREST1 = await createLabelREST(labelName1);
      labelREST2 = await createLabelREST(labelName2);
      programREST1 = await createProgramREST(programName);
      areaREST1 = await createAreaREST(areaName, programREST1._id);
      areaREST2 = await createAreaREST(areaName2, programREST1._id);
      areaREST3 = await createAreaREST(areaName3, programREST1._id);
      productFlavourREST1 = await createProductFlavourREST(productFlavourName);

      deploymentREST1 = await createDeploymentREST(
        deploymentName1Label, programREST1._id, areaREST1._id,
        statusTypes.IN_REVIEW, undefined, false, undefined, [labelREST1]
      );

      deploymentREST2 = await createDeploymentREST(
        deploymentName2Label2, programREST1._id, areaREST1._id,
        statusTypes.IN_REVIEW, undefined, false, undefined, [labelREST1, labelREST2]
      );

      beforeSuccessful = true;
    });

    it('should find no Artifacts when the search value is \'InvalidValue\'', async function () {
      await performHomePageSearch(0, 'InvalidValue');

      // Check that the table is empty
      await driver.wait(until.elementLocated(By.className('dataTables_empty')), 5000);
      (await driver.findElement(By.className('dataTables_empty')).getText()).should.equal('No data available in table');
    });

    it('should find 3 Artifacts when the search value is \'Sample\' and additional parameters are default', async function () {
      await performHomePageSearch(3, 'Sample');

      // Find Expected Results in Table
      (await driver.findElement(By.xpath(`//td[contains(.,"${areaName}")]`)).isDisplayed()).should.equal(true);
      (await driver.findElement(By.xpath(`//td[contains(.,"${areaName2}")]`)).isDisplayed()).should.equal(true);
      (await driver.findElement(By.xpath('//td[contains(.,"Area")]')).isDisplayed()).should.equal(true);

      (await driver.findElement(By.xpath(`//td[contains(.,"${productFlavourName}")]`)).isDisplayed()).should.equal(true);
      (await driver.findElement(By.xpath('//td[contains(.,"Product-Flavour")]')).isDisplayed()).should.equal(true);
    });

    it('should only find 2 Area Artifacts when the search value is \'Sample\' and the Artifact-Type parameter is set to \'Area\'', async function () {
      await performHomePageSearch(2, 'Sample', 'area');

      // Find Expected Results in Table
      (await driver.findElement(By.xpath(`//td[contains(.,"${areaName}")]`)).isDisplayed()).should.equal(true);
      (await driver.findElement(By.xpath(`//td[contains(.,"${areaName2}")]`)).isDisplayed()).should.equal(true);
      (await driver.findElement(By.xpath('//td[contains(.,"Area")]')).isDisplayed()).should.equal(true);
    });

    it('should only find the 1 Product-Flavour Artifact when the search value is \'Sample\' and the Artifact-Type parameter is set to \'Product-Flavour\'', async function () {
      await performHomePageSearch(1, 'Sample', 'productFlavour');

      // Find Expected Results in Table
      (await driver.findElement(By.xpath(`//td[contains(.,"${productFlavourName}")]`)).isDisplayed()).should.equal(true);
      (await driver.findElement(By.xpath('//td[contains(.,"Product-Flavour")]')).isDisplayed()).should.equal(true);
    });

    it('should find the 9 Artifacts beginning with \'A_Health\' when the search value is \'A_Health\' and the Value-Match parameter is set to \'Starts With\'', async function () {
      await performHomePageSearch(9, 'A_Health', null, 'startsWith');

      // Find Expected Results in Table
      (await driver.findElement(By.xpath(`//td[contains(.,"${areaName}")]`)).isDisplayed()).should.equal(true);
      (await driver.findElement(By.xpath('//td[contains(.,"Area")]')).isDisplayed()).should.equal(true);
      (await driver.findElement(By.xpath(`//td[contains(.,"${productFlavourName}")]`)).isDisplayed()).should.equal(true);
      (await driver.findElement(By.xpath('//td[contains(.,"Product-Flavour")]')).isDisplayed()).should.equal(true);
    });

    it('should only find the 3 Artifacts ending with \'Sample\' when the search value is \'Sample\' and the Value-Match parameter is set to \'Ends With\'', async function () {
      await performHomePageSearch(3, 'Sample', null, 'endsWith');

      // Find Expected Results in Table
      (await driver.findElement(By.xpath(`//td[contains(.,"${areaName2}")]`)).isDisplayed()).should.equal(true);
      (await driver.findElement(By.xpath('//td[contains(.,"area")]')).isDisplayed()).should.equal(true);
    });

    it('should only find the 1 Area Artifact named \'A_Health_area3\' when the search value is \'A_Health_area3\' and the Value-Match parameter is set to \'Full Value Match\'', async function () {
      await performHomePageSearch(1, 'A_Health_area3', null, 'fullValue');

      // Find Expected Results in Table
      (await driver.findElement(By.xpath(`//td[contains(.,"${areaName3}")]`)).isDisplayed()).should.equal(true);
      (await driver.findElement(By.xpath('//td[contains(.,"Area")]')).isDisplayed()).should.equal(true);
    });

    it('should find 1 Artifact when the search value is \'Sample\' and Case-Sensitive parameter is set to true', async function () {
      await performHomePageSearch(1, 'Sample', null, null, true);

      // Find Expected Results in Table
      (await driver.findElement(By.xpath(`//td[contains(.,"${areaName2}")]`)).isDisplayed()).should.equal(true);
      (await driver.findElement(By.xpath('//td[contains(.,"Area")]')).isDisplayed()).should.equal(true);
    });

    it('should find 1 Deployment when the search value is \'A_HEALTH_LBL_1, A_HEALTH_LBL_2\'', async function () {
      await performHomePageSearch(1, 'A_HEALTH_LBL_1,A_HEALTH_LBL_2', 'deployment', 'multipleLabels');
      // Find Expected Results in Table
      (await driver.findElement(By.xpath(`//td[contains(.,"${deploymentName2Label2}")]`)).isDisplayed()).should.equal(true);
    });

    it('should find 2 Deployments when the search value is \'A_HEALTH_LBL_1\'', async function () {
      await performHomePageSearch(2, 'A_HEALTH_LBL_1', 'deployment', 'multipleLabels');
      // Find Expected Results in Table
      (await driver.findElement(By.xpath(`//td[contains(.,"${deploymentName1Label}")]`)).isDisplayed()).should.equal(true);
      (await driver.findElement(By.xpath(`//td[contains(.,"${deploymentName2Label2}")]`)).isDisplayed()).should.equal(true);
    });

    after(async function () {
      if (!beforeSuccessful) {
        await takeScreenshot('before_homepage_search');
      }
      try {
        await deleteArtifactREST('deployments', deploymentREST1, false, false, true);
        await deleteArtifactREST('deployments', deploymentREST2, false, false, true);
        await deleteArtifactREST('productFlavours', productFlavourREST1, false, false, true);
        await deleteArtifactREST('areas', areaREST1, false, false, true);
        await deleteArtifactREST('areas', areaREST2, false, false, true);
        await deleteArtifactREST('areas', areaREST3, false, false, true);
        await deleteArtifactREST('programs', programREST1, false, false, true);
        await deleteArtifactREST('labels', labelREST1, false, false, true);
        await deleteArtifactREST('labels', labelREST2, false, false, true);
      } catch (afterError) {
        await takeScreenshot('after_homepage_search');
        throw afterError;
      }
    });
  });

  describe('Special Functionality', function () {
    this.timeout(200000);
    this.retries(MAX_RETRIES);
    var beforeSuccessful = false;
    // Artifact Details
    var programName = 'A_Health_prog1_F';
    var areaName = 'A_Health_area1_F';
    var teamName = 'A_Health_team1_F';
    var productFlavourName = 'A_Health_prodFlav1_F';
    var productTypeName = 'A_Health_prodType1_F';
    var deploymentName = 'A_Health_depl1_F';

    var programName2 = 'A_Health_prog2_F';
    var areaName2 = 'A_Health_area2_F';
    var teamName2 = 'A_Health_team2_F';
    var productTypeName2 = 'A_Health_prodType2_F';
    var deploymentName2 = 'A_Health_depl2_F';
    var areaName3 = 'A_Health_area3';
    var labelName = 'A_HEALTH_LABEL';

    before(async function () {
      // Create Artifacts
      programREST1 = await createProgramREST(programName);
      areaREST1 = await createAreaREST(areaName, programREST1._id);
      teamREST1 = await createTeamREST(teamName, areaREST1._id);
      labelREST1 = await createLabelREST(labelName);

      productFlavourREST1 = await createProductFlavourREST(productFlavourName);
      productTypeREST1 = await createProductTypeREST(productTypeName, [productFlavourName]);
      var deploymentProducts = [{
        product_type_name: productTypeName,
        flavour_name: productFlavourName,
        infrastructure: infraTypes.CLOUD,
        admins_only: false
      }];
      deploymentREST1 = await createDeploymentREST(
        deploymentName, programREST1._id, areaREST1._id, statusTypes.FREE,
        deploymentProducts, false, undefined, [labelREST1]
      );

      bookingREST1 = await createBookingREST(
        deploymentName, deploymentREST1._id, deploymentREST1.products[0]._id, teamREST1._id,
        bookingStartTime, bookingEndTime, undefined, 'Not Applicable', 'Smoke Test'
      );

      // Create Second set of Artifacts
      programREST2 = await createProgramREST(programName2);
      areaREST2 = await createAreaREST(areaName2, programREST2._id);
      teamREST2 = await createTeamREST(teamName2, areaREST2._id);
      productTypeREST2 = await createProductTypeREST(productTypeName2, [productFlavourName]);

      var deploymentProducts2 = [{
        product_type_name: productTypeName2,
        flavour_name: productFlavourName,
        infrastructure: infraTypes.CLOUD,
        admins_only: false
      }];
      deploymentREST2 = await createDeploymentREST(
        deploymentName2, programREST2._id, areaREST2._id, statusTypes.FREE,
        deploymentProducts2
      );

      bookingREST2 = await createBookingREST(
        deploymentName2, deploymentREST2._id, deploymentREST2.products[0]._id, teamREST2._id,
        bookingStartTime, bookingEndTime, undefined, 'Not Applicable', 'Smoke Test'
      );

      // Ensure Bookings have updated statuses
      await request.post(`${baseUrl}api/updateStartedBookings`).auth(testUsername, testPassword);
      await request.post(`${baseUrl}api/updateExpiredBookings`).auth(testUsername, testPassword);
      beforeSuccessful = true;

      areaREST3 = await createAreaREST(areaName3, programREST1._id);
    });

    describe('Filter Functionality', function () {
      it('should save user Area preference filter from deployment page in the current session', async function () {
        // Select area from Deployments List Page
        await openArtifactListView('deployments');
        await showAllFilters();
        await driver.wait(until.elementLocated(By.id('select2-areaFilterSelect-container')), 5000);
        await selectFilterOption('select2-areaFilterSelect-container', areaName);
        await doesElementExistInTable(deploymentName, 'deployments-table');

        // Check same RA is shown in the other pages
        await openArtifactListView('bookings');
        await findFilterOption('select2-areaFilterSelect-container', areaName);
        await openArtifactListView('statistics/bookings');
        await driver.sleep(1000);
        await findFilterOption('select2-areaFilterSelect-container', areaName);
        await openArtifactListView('products');
        await findFilterOption('select2-areaFilterSelect-container', areaName);
      });

      it('should save user Area preference filter from booking page in the current session', async function () {
        // Select area from Bookings Page
        await openArtifactListView('bookings', 'create-booking-button', areaName, programName);
        await doesElementExistInTable(deploymentName, 'bookings-table');

        // Check same RA is shown in the other pages
        await openArtifactListView('deployments');
        await findFilterOption('select2-areaFilterSelect-container', areaName);
        await openArtifactListView('statistics/bookings');
        await driver.sleep(1000);
        await findFilterOption('select2-areaFilterSelect-container', areaName);
        await openArtifactListView('products');
        await findFilterOption('select2-areaFilterSelect-container', areaName);
      });

      it('should save user Area preference filter from Statistics page in the current session', async function () {
        // Select area from Statistics Page
        await openArtifactListView('statistics/bookings');
        await showAllFilters();
        await driver.wait(until.elementLocated(By.id('select2-areaFilterSelect-container')), 5000);
        await selectFilterOption('select2-areaFilterSelect-container', areaName);
        await doesElementExistInTable(deploymentName, 'statistics-table');

        // Check same RA is shown in the other pages
        await openArtifactListView('deployments');
        await findFilterOption('select2-areaFilterSelect-container', areaName);
        await openArtifactListView('statistics/bookings');
        await driver.sleep(1000);
        await findFilterOption('select2-areaFilterSelect-container', areaName);
        await openArtifactListView('products');
        await findFilterOption('select2-areaFilterSelect-container', areaName);
      });

      it('should save user Area preference filter from Products page in the current session', async function () {
        // Select area from Products Page
        await openArtifactListView('products');
        await showAllFilters();
        await driver.wait(until.elementLocated(By.id('select2-areaFilterSelect-container')), 5000);
        await selectFilterOption('select2-areaFilterSelect-container', areaName);
        await doesElementExistInTable(deploymentName, 'products-table', 1, 3);

        // Check same RA is shown in the other pages
        await openArtifactListView('deployments');
        await findFilterOption('select2-areaFilterSelect-container', areaName);
        await openArtifactListView('statistics/bookings');
        await driver.sleep(1000);
        await findFilterOption('select2-areaFilterSelect-container', areaName);
        await openArtifactListView('statistics/bookings');
        await findFilterOption('select2-areaFilterSelect-container', areaName);
      });

      it('should filter Area and Team dropdown options when a Program is selected from the Program filter', async function () {
        // Deployments List Page
        await openArtifactListView('deployments');
        await showAllFilters();

        // Check other Filter Options
        await findFilterOption('select2-areaFilterSelect-container', areaName2);
        await findFilterOption('select2-teamFilterSelect-container', teamName2);

        // Select Program Filter
        await selectFilterOption('select2-programFilterSelect-container', programName);

        // Check other Filter Options
        await findFilterOption('select2-areaFilterSelect-container', areaName2, false);
        await findFilterOption('select2-teamFilterSelect-container', teamName2, false);
      });

      it('should filter Team dropdown options when an Area is selected from the Area filter', async function () {
        // Deployments List Page
        await openArtifactListView('deployments');
        await showAllFilters();

        // Check other Filter Options
        await findFilterOption('select2-teamFilterSelect-container', teamName2);

        // Select Area Filter
        await driver.wait(until.elementLocated(By.id('select2-areaFilterSelect-container')), 5000);
        await selectFilterOption('select2-areaFilterSelect-container', areaName);

        // Check other Filter Options
        await findFilterOption('select2-teamFilterSelect-container', teamName2, false);
      });

      it('should filter Deployments by a Program using the Program filter', async function () {
        // Deployments List Page
        await openArtifactListView('deployments');
        await verifyFilterOption('deployments-table', deploymentName, deploymentName2, 'select2-programFilterSelect-container', programName);
      });

      it('should filter Deployments by a Product-Type using the Product-Type filter', async function () {
        // Deployments List Page
        await openArtifactListView('deployments');
        await verifyFilterOption('deployments-table', deploymentName, deploymentName2, 'select2-productTypeFilterSelect-container', productTypeName);
      });

      it('should filter Deployments by a Label using the Label filter', async function () {
        // Deployments List Page
        await openArtifactListView('deployments');
        await verifyFilterOption('deployments-table', deploymentName, deploymentName2, 'select2-labelFilterSelect-container', labelName);
      });

      it('should filter Bookings by Team using the Team filter', async function () {
        // Get a Booking Report using a filter
        await openArtifactListView('bookings', 'create-booking-button', areaName);
        await findFilterOption('select2-teamFilterSelect-container', teamName);
      });

      it('should filter Bookings by Program using the Program filter', async function () {
        // Get a Booking Report using a filter
        await openArtifactListView('bookings', 'create-booking-button', areaName);
        await findFilterOption('select2-programFilterSelect-container', programName);
      });

      it('should filter Bookings by RA using the RA filter', async function () {
        // Get a Booking Report using a filter
        await openArtifactListView('bookings', 'create-booking-button', areaName);
        await findFilterOption('select2-areaFilterSelect-container', areaName);
      });

      it('should filter Bookings by Deployment using the Deployment filter', async function () {
        // Get a Booking Report using a filter
        await openArtifactListView('bookings', 'create-booking-button', areaName);
        await findFilterOption('select2-deploymentFilterSelect-container', deploymentName);
      });

      it('should filter Bookings by Product-Type using the Product-Type filter', async function () {
        // Get a Booking Report using a filter
        await openArtifactListView('bookings', 'create-booking-button', areaName);
        await findFilterOption('select2-productTypeFilterSelect-container', productTypeName);
      });

      it('should filter Bookings by Deployment Label using the Label filter', async function () {
        // Get a Booking Report using a filter
        await openArtifactListView('bookings', 'create-booking-button', areaName);
        await findFilterOption('select2-labelFilterSelect-container', labelName);
      });

      afterEach(async function () {
        // Reset RA selection
        await driver.wait(until.elementLocated(By.className('select2-selection__clear')), 3000).click();
      });
    });

    describe('Deployment Booking Statistics', function () {
      it('should be able to get Booking statistics for a Deployment', async function () {
        // Booking Statistics List Page
        await openArtifactListView('statistics/bookings', 'statistics-table');
        // Verify Statistics are Valid
        var statisticsTable = await driver.findElement(By.id('statistics-table'));
        var statisticsRow = await statisticsTable.findElement(By.xpath(`//td[1]/a[contains(.,"${deploymentName}")]/ancestor::tr`));
        (await statisticsRow.findElement(By.xpath(`./td[${getKeyValueColumn('totalTeams')}]`)).getText()).should.equal('1');
        (await statisticsRow.findElement(By.xpath(`./td[${getKeyValueColumn('totalBookings')}]`)).getText()).should.equal('1');
        (await statisticsRow.findElement(By.xpath(`./td[${getKeyValueColumn('totalDuration')}]`)).getText()).should.equal('3');
        (await statisticsRow.findElement(By.xpath(`./td[${getKeyValueColumn('averageDuration')}]`)).getText()).should.equal('3');
      });

      it('should be able to get statistical graphs for a Deployment', async function () {
        // Booking Statistics List Page
        await openArtifactListView('statistics/bookings', 'statistics-table');
        // Verify Team Usage Graph is Present
        await viewStatisticalGraphs(deploymentName);
      });
    });

    after(async function () {
      if (!beforeSuccessful) {
        await takeScreenshot('before_special_functionality');
      }
      try {
        // Remove 1st set of artifacts
        await deleteArtifactREST('bookings', bookingREST1, false, false, true);
        await deleteArtifactREST('deployments', deploymentREST1, false, false, true);
        await deleteArtifactREST('productTypes', productTypeREST1, false, false, true);
        await deleteArtifactREST('productFlavours', productFlavourREST1, false, false, true);
        await deleteArtifactREST('teams', teamREST1, false, false, true);
        await deleteArtifactREST('areas', areaREST1, false, false, true);
        await deleteArtifactREST('programs', programREST1, false, false, true);
        await deleteArtifactREST('labels', labelREST1, false, false, true);

        // Remove 2nd set of artifacts
        await deleteArtifactREST('bookings', bookingREST2, false, false, true);
        await deleteArtifactREST('deployments', deploymentREST2, false, false, true);
        await deleteArtifactREST('productTypes', productTypeREST2, false, false, true);
        await deleteArtifactREST('teams', teamREST2, false, false, true);
        await deleteArtifactREST('areas', areaREST2, false, false, true);
        await deleteArtifactREST('programs', programREST2, false, false, true);
      } catch (afterError) {
        await takeScreenshot('after_filter_functionality');
        throw afterError;
      }
    });
  });

  describe('Create', function () {
    this.timeout(300000);
    this.retries(MAX_RETRIES);
    var beforeOuterSuccessful = false;
    // Program Details
    var programName = 'A_Health_prog_Cr';
    // Area Details
    var areaName = 'A_Health_area_Cr';
    var areaName2 = 'A_Health_area2_Cr';
    // Product-Flavour Details
    var productFlavourName = 'A_Health_prodFlav_Cr';
    // Product-Type Details
    var productTypeName = 'A_Health_prodType1_Cr_ENM';
    var productTypeName2 = 'A_Heatlh_prodType2_Cr_noDepl';
    var productTypeWithConfigName = 'A_Health_prodType2_Cr_wConf';
    var productConfig = [
      { name: 'cloudField', infrastructure: infraTypes.CLOUD },
      { name: 'physicalField', infrastructure: infraTypes.PHYSICAL }
    ];
    // Hardware Details
    var hardwareName1 = 'A_Health_HW_Cr';
    var hardwareName2 = 'A_Health_HW2_Cr';
    var hardwareName3 = 'A_Health_HW3_Cr';
    var hardwareName4 = 'A_Health_HW4_Cr';
    // Team Details
    var teamName = 'A_Health_team1_Cr';
    var teamName2 = 'A_Health_team2_Cr';
    var teamName3 = 'A_Health_team3_Cr';
    var teamName4 = 'A_Heath_team4_Cr_diffRA';

    // Label Details
    var labelName = 'A_HEALTH_LBL_CR';
    // Deployment Details
    var deploymentName = 'A_Health_depl_Cr';
    var deploymentName2 = 'A_Health_depl2_Cr';

    var deploymentProduct = [
      {
        typeName: productTypeName,
        flavourName: productFlavourName,
        hardware: [hardwareName1, hardwareName2],
        data: ['test', 'newData']
      }
    ];

    var deploymentProduct2 = [
      {
        typeName: productTypeName,
        flavourName: productFlavourName,
        data: ['test2', 'newData2']
      }
    ];

    before(async function () {
      programREST1 = await createProgramREST(programName);
      areaREST1 = await createAreaREST(areaName, programREST1._id);
      teamREST1 = await createTeamREST(teamName, areaREST1._id);
      teamREST2 = await createTeamREST(teamName2, areaREST1._id);
      productFlavourREST1 = await createProductFlavourREST(productFlavourName);
      productTypeREST1 = await createProductTypeREST(productTypeName, [productFlavourName]);
      productTypeREST2 = await createProductTypeREST(productTypeWithConfigName, [productFlavourName], productConfig);
      productTypeREST3 = await createProductTypeREST(productTypeName2, [productFlavourName]);
      hardwareREST1 = await createHardwareREST(hardwareName1, programREST1._id, 'deploymentId');
      hardwareREST2 = await createHardwareREST(hardwareName2, programREST1._id, 'deploymentId');
      labelREST1 = await createLabelREST(labelName);
      beforeOuterSuccessful = true;
    });

    describe('Hardware', function () {
      var individualHardwareName = 'A_Health_HW_Cr_sngl';

      it('should create Hardware and see it in Hardware list @healthtest', async function () {
        // Save and Confirm
        await newHardwareSetup(individualHardwareName, programName, 'deploymentId');
        (await driver.findElement(By.xpath('//th[contains(.,"Day(s)")]')).isDisplayed()).should.equal(true);
        await findTableItem('hardware', individualHardwareName);
        // Delete
        await deleteItem('hardware', individualHardwareName);
      });
    });


    describe('Area', function () {
      var individualAreaName = 'A_Health_area_Cr_sngl';
      it('should create Area and see it in Areas list @healthtest', async function () {
        // Save and Confirm
        await newAreaSetup(individualAreaName, programName);
        await findTableItem('areas', individualAreaName);
        // Delete
        await deleteItem('areas', individualAreaName);
      });
    });

    describe('Program', function () {
      var individualProgramName = 'A_Health_prog_Cr_sngl';
      it('should create Program and see it in Programs list @healthtest', async function () {
        // Save and Confirm
        await newProgramSetup(individualProgramName);
        await findTableItem('programs', individualProgramName);
        // Delete
        await deleteItem('programs', individualProgramName);
      });

      it('should update Teams and RAs after Program creation', async function () {
        var individualProgramName = 'A_Health_Program_cr';
        await newProgramSetup(individualProgramName);
        (await driver.findElement(By.xpath('//div[contains(.," Associated Teams and RAs updated successfully!")]')).isDisplayed()).should.equal(true);
        // Delete
        await deleteItem('programs', individualProgramName);
      });
    });

    describe('Label', function () {
      var individualLabelName = 'A_HEALTH_LBL_CR_SNGL';
      it('should create Label and see it in Labels list @healthtest', async function () {
        // Save and Confirm
        await newLabelSetup(individualLabelName);
        await findTableItem('labels', individualLabelName);
        // Delete
        await deleteItem('labels', individualLabelName);
      });
    });

    describe('Product-Flavour', function () {
      var individualFlavourName = 'A_Health_prodFlav_Cr_sngl';
      it('should create Product-Flavour and see it in Product-Flavours list @healthtest', async function () {
        // Save and Confirm
        await newProductFlavourSetup(individualFlavourName);
        await findTableItem('productFlavours', individualFlavourName);
        // Delete
        await deleteItem('productFlavours', individualFlavourName);
      });
    });

    describe('Product-Type', function () {
      var individualTypeName = 'A_Health_prodType_Cr_sngl';
      it('should create Product-Type and see it in Product-Types list', async function () {
        // Save and Confirm
        await newProductTypeSetup(individualTypeName, productFlavourName);
        await findTableItem('productTypes', individualTypeName);
        // Delete
        await deleteItem('productTypes', individualTypeName);
      });

      it('should create Product-Type with mandatory fields and see it in Product-Types view page with fields visible @healthtest', async function () {
        // Save and Confirm
        await newProductTypeSetup(individualTypeName, productFlavourName, productConfig);
        await driver.wait(until.elementLocated(By.xpath('//td[contains(.,"cloudField")]')), 5000);
        (await driver.findElement(By.xpath('//td[contains(.,"cloudField")]')).isDisplayed()).should.equal(true);
        await driver.wait(until.elementLocated(By.xpath('//td[contains(.,"physicalField")]')), 5000);
        (await driver.findElement(By.xpath('//td[contains(.,"physicalField")]')).isDisplayed()).should.equal(true);
        await findTableItem('productTypes', individualTypeName);
        // Delete
        await deleteItem('productTypes', individualTypeName);
      });
    });

    describe('Team', function () {
      it('should create Team with Users and see in Teams list', async function () {
        var teamName = 'A_Health_team_admUsersAssoc';
        await openArtifactCreateView('teams');
        // Add Admins
        await driver.wait(until.elementLocated(By.xpath('//h1[contains(.,"Creating")]')), 5000);
        await driver.findElement(By.id('name')).sendKeys(teamName);
        await select2DropdownSelect('area-select', areaName);
        await select2DropdownSelect('adminPrimary-select', 'DTT Admin');
        await driver.sleep(500);
        await select2DropdownSelect('adminSecondary-select', 'Jimmy Casey');
        // Users
        await driver.findElement(By.id('signum')).sendKeys('eavrbra');
        await driver.findElement(By.css('[ng-click="vm.addUser()"]')).click();
        await driver.findElement(By.xpath('//td[contains(.,"Avril Brady")]'));
        await driver.findElement(By.id('signum')).sendKeys('eednuts');
        await driver.findElement(By.css('[ng-click="vm.addUser()"]')).click();
        await driver.findElement(By.xpath('//td[contains(.,"Stephen Dunne D")]'));
        // Save and Confirm
        await clickSaveButton('Team creation');
        (await driver.findElement(By.xpath(`//p[contains(.,"${areaName}")]`)).isDisplayed()).should.equal(true);
        (await driver.findElement(By.xpath('//p[contains(.,"DTT Admin")]')).isDisplayed()).should.equal(true);
        (await driver.findElement(By.xpath('//p[contains(.,"Jimmy Casey")]')).isDisplayed()).should.equal(true);
        (await driver.findElement(By.xpath('//p[contains(.,"Avril Brady")]')).isDisplayed()).should.equal(true);
        (await driver.findElement(By.xpath('//p[contains(.,"Stephen Dunne D")]')).isDisplayed()).should.equal(true);
        await findTableItem('teams', teamName);
        // Delete
        await deleteItem('teams', teamName);
      });
    });

    describe('Deployment', function () {
      this.timeout(100000);
      var clonedDeploymentName = 'A_Health_depl_Cl';

      it('should create Deployment and see it in Deployments list', async function () {
        // Save and Confirm
        await newDeploymentSetup(deploymentName, programName, false, areaName);
        await findTableItem('deployments', deploymentName);
        // Delete
        await deleteItem('deployments', deploymentName);
      });

      it('should create Deployment with Products', async function () {
        var deploymentProducts = [
          {
            typeName: productTypeName,
            flavourName: productFlavourName,
            hardware: [hardwareName1, hardwareName2],
            data: ['test', 'newData'],
            admins_only: false
          },
          {
            typeName: productTypeName,
            flavourName: productFlavourName,
            admins_only: false
          }
        ];
        // Save and Confirm
        await newDeploymentSetup(
          deploymentName, programName, false, areaName, statusTypes.FREE, false,
          deploymentProducts, teamName, deploymentPurpose
        );
        await findTableItem('deployments', deploymentName);
        // Delete
        await deleteItem('deployments', deploymentName);
      });

      it('should display warning message when selecting Deployment status as \'In Review\' or \'Blocked/In Maintenance\' or \'Booking Disabled\'', async function () {
        await openArtifactCreateView('deployments');
        // Check Status Message
        await driver.wait(until.elementLocated(By.id('select2-status-select-container')), 20000);
        var element = await driver.findElement(By.id('select2-status-select-container'));
        await driver.executeScript('arguments[0].scrollIntoView(true);', element);
        await select2DropdownSelect('status-select', statusTypes.BLOCKED_IN_MAINTENANCE);
        await validateValueByName('status-label', 'innerHTML', 'Status - NOTE: Deployment will be unbookable with current status.');
        await select2DropdownSelect('status-select', statusTypes.FREE);
        await validateValueByName('status-label', 'innerHTML', 'Status');
        await select2DropdownSelect('status-select', statusTypes.IN_REVIEW);
        await validateValueByName('status-label', 'innerHTML', 'Status - NOTE: Deployment will be unbookable with current status.');
        await select2DropdownSelect('status-select', statusTypes.BOOKING_DISABLED);
        await validateValueByName('status-label', 'innerHTML', 'Status - NOTE: Deployment will be unbookable with current status.');
      });

      it('should create Deployment with Products and Hardware and check that hardware has dependent Deployment in view hardware page', async function () {
        var deploymentProducts = [
          {
            typeName: productTypeName,
            flavourName: productFlavourName,
            hardware: [hardwareName1, hardwareName2],
            data: ['test', 'newData'],
            admins_only: false
          },
          {
            typeName: productTypeName,
            flavourName: productFlavourName,
            admins_only: false
          }
        ];
        // Create and Confirm
        await newDeploymentSetup(
          deploymentName, programName, false, areaName, statusTypes.FREE,
          false, deploymentProducts, teamName, deploymentPurpose
        );
        await findTableItem('deployments', deploymentName);
        // Check Hardware page
        await viewItem('hardware', hardwareName1);
        await driver.wait(until.elementLocated(By.name('dependent-deployment')), 5000);
        await validateValueByName('dependent-deployment', 'innerHTML', deploymentName);
        // Delete
        await deleteItem('deployments', deploymentName);
      });

      it('should create Deployment with a Label and see the Deployment in Dependant Deployments in the Labels view page', async function () {
        // Save and Confirm
        await newDeploymentSetup(deploymentName, programName, labelName, areaName);
        await findTableItem('deployments', deploymentName);
        // Check Label page
        await viewItem('labels', labelName);
        await driver.wait(until.elementLocated(By.name('dependent-deployment')), 5000);
        await validateValueByName('dependent-deployment', 'innerHTML', deploymentName);
        // Delete
        await deleteItem('deployments', deploymentName);
      });

      it('should create Deployment with SPOC User, Products & JIRA Issues @healthtest', async function () {
        // Save and Confirm
        await newDeploymentSetup(deploymentName, programName, false, areaName, statusTypes.FREE, false, null, teamName, deploymentPurpose, null, 'DTT Admin');
        // Find Deployment in table
        await findTableItem('deployments', deploymentName);
        // Delete
        await deleteItem('deployments', deploymentName);
      });
      it('should create Deployment with Products and JIRA Issues', async function () {
        var deploymentProducts = [
          {
            typeName: productTypeName,
            flavourName: productFlavourName,
            hardware: [hardwareName1, hardwareName2],
            data: ['test', 'newData'],
            admins_only: false
          },
          {
            typeName: productTypeName,
            flavourName: productFlavourName,
            admins_only: false
          }
        ];
        // Now Save and Confirm
        await newDeploymentSetup(deploymentName, programName, false, areaName, statusTypes.FREE, false, deploymentProducts, teamName, deploymentPurpose, ['CIP-29934', 'GTEC-7866']);
        // Find Deployment in table
        await findTableItem('deployments', deploymentName);
        // Delete
        await deleteItem('deployments', deploymentName);
      });

      it('should create Deployment with the Unassigned Program/RA', async function () {
        var progRaName = 'Unassigned';
        var programREST2 = await createProgramREST(progRaName);
        var areaREST2 = await createAreaREST(progRaName, programREST2._id);
        // Now Save and Confirm
        await newDeploymentSetup(
          deploymentName, progRaName, false, progRaName,
          statusTypes.FREE, false, null,
          teamName, deploymentPurpose, ['CIP-29934', 'CIP-29795'],
          null, true, true
        );
        // Find Deployment in table
        await findTableItem('deployments', deploymentName);
        // Delete
        await deleteItem('deployments', deploymentName);
      });

      it('should not create Deployment until the invalid JIRA Issue is removed', async function () {
        await newDeploymentSetup(deploymentName, programName, false, areaName, statusTypes.FREE, false, [], null, null, null, null, false);
        // Add JIRA
        await clickElement(By.id('add-jira'));
        await driver.findElement(By.name('jira_issues[0]')).sendKeys('InvalidJiraIssue');
        await driver.findElement(By.xpath('//body')).click();
        await driver.wait(until.elementLocated(By.className('ui-notification')), 5000);
        (await driver.findElement(By.xpath('//p[contains(.,"Provide a valid JIRA Issue")]')).isDisplayed()).should.equal(true);
        (await driver.findElement(By.xpath('//button[contains(.,"Save")]')).getAttribute('disabled')).should.equal('true');
        // Remove JIRA
        await clickElement(By.id('remove-jira[0]'));
        alertElement = await driver.switchTo().alert().getText();
        alertElement.should.containEql('Are you sure you want to remove this JIRA Issue 1: "INVALIDJIRAISSUE"?');
        await driver.switchTo().alert().accept();
        // Save and Confirm
        await clickSaveButton('Deployment creation');
        await findTableItem('deployments', deploymentName);
        // Delete
        await deleteItem('deployments', deploymentName);
      });

      it('should not create a Deployment and throw an invalidation message until Product Data is renamed from TEMP', async function () {
        await newDeploymentSetup(deploymentName, programName, false, areaName, statusTypes.FREE, false, [], teamName, deploymentPurpose, ['CIP-29934', 'CIP-29795'], null, null, null, null, false);
        await addNewProduct(0, productTypeName, productFlavourName, infraTypes.PHYSICAL, true, null, [hardwareName1], ['TEMP']);
        // Try Save
        (await driver.findElement(By.xpath('//button[contains(.,"Save")]')).getAttribute('disabled')).should.equal('true');
        element = await driver.findElement(By.name('products[0].links[0].link_name'));
        await element.clear();
        await element.sendKeys('notTemp');
        // Save and Confirm
        await clickSaveButton('Deployment creation');
        await findTableItem('deployments', deploymentName);
        // Delete
        await deleteItem('deployments', deploymentName);
      });

      it('should not create Deployment until the duplicate JIRA Issue is removed', async function () {
        await newDeploymentSetup(deploymentName, programName, false, areaName, statusTypes.IN_USE, false, [], null, null, ['CIP-29934'], null, false);
        // Add Second JIRA
        await clickElement(By.id('add-jira'));
        await driver.findElement(By.name('jira_issues[1]')).sendKeys('CIP-29934');
        await driver.findElement(By.xpath('//body')).click();
        await driver.wait(until.elementLocated(By.xpath('//p[contains(.,"You cannot add the same JIRA Issue multiple times")]')), 5000);
        (await driver.findElement(By.xpath('//p[contains(.,"You cannot add the same JIRA Issue multiple times")]')).isDisplayed()).should.equal(true);
        (await driver.findElement(By.xpath('//button[contains(.,"Save")]')).getAttribute('disabled')).should.equal('true');
        // Remove JIRA
        await clickElement(By.id('remove-jira[1]'));
        alertElement = await driver.switchTo().alert().getText();
        alertElement.should.containEql('Are you sure you want to remove this JIRA Issue 2: "CIP-29934"?');
        await driver.switchTo().alert().accept();
        // Save and Confirm
        await clickSaveButton('Deployment creation');
        await findTableItem('deployments', deploymentName);
        // Delete
        await deleteItem('deployments', deploymentName);
      });

      it('should create Deployment using clone feature and see it in the Deployments list', async function () {
        await newDeploymentSetup(deploymentName, programName, false, areaName);
        // Clone Deployment
        await clickElement(By.xpath('//button[contains(.,"Clone")]'), true);
        await driver.wait(until.elementLocated(By.xpath('//h1[contains(.,"Creating")]')), 10000);
        await driver.findElement(By.name('name')).sendKeys(clonedDeploymentName);
        // Save and Confirm
        await clickSaveButton('Deployment creation');
        await findTableItem('deployments', clonedDeploymentName);
        // Delete
        await deleteItem('deployments', deploymentName);
        await deleteItem('deployments', clonedDeploymentName);
      });

      it('should create Deployment with Product using clone feature and see it in the Deployments list', async function () {
        // New Deployment
        var deploymentProducts = [{
          typeName: productTypeName,
          flavourName: productFlavourName,
          hardware: [hardwareName1, hardwareName2],
          data: ['test', 'newData'],
          admins_only: false
        }];
        await newDeploymentSetup(deploymentName, programName, false, areaName, statusTypes.IN_REVIEW, false, deploymentProducts, teamName);
        // Clone Deployment
        await clickElement(By.xpath('//button[contains(.,"Clone")]'), true);
        await driver.wait(until.elementLocated(By.xpath('//h1[contains(.,"Creating")]')), 10000);
        await driver.findElement(By.id('name')).sendKeys(clonedDeploymentName);
        // Update Product Data
        await driver.findElement(By.name('products[0].links[0].link_name')).sendKeys('productData0');
        await driver.findElement(By.name('products[0].links[0].url')).sendKeys('https://www.url-0.com');
        await driver.findElement(By.name('products[0].links[1].link_name')).sendKeys('productData1');
        await driver.findElement(By.name('products[0].links[1].url')).sendKeys('https://www.url-1.com');
        // Save and Confirm
        await clickSaveButton('Deployment creation');
        await findTableItem('deployments', deploymentName);
        await findTableItem('deployments', clonedDeploymentName);
        // Delete
        await deleteItem('deployments', deploymentName);
        await deleteItem('deployments', clonedDeploymentName);
      });

      it('product-type based configuration fields name should be disabled when creating a Deployment', async function () {
        var deplProductsWithConfig = [{
          typeName: productTypeWithConfigName,
          flavourName: productFlavourName,
          infrastructure: infraTypes.PHYSICAL,
          admins_only: false
        }];
        await newDeploymentSetup(
          deploymentName, programName, false, areaName, statusTypes.FREE,
          false, deplProductsWithConfig, null, null, null, null, false
        );
        (await driver.findElement(By.name('products[0].configuration[0].key_name')).getAttribute('disabled')).should.equal('true');
      });

      it('configuration fields name should be disabled when cloning a Deployment', async function () {
        await newDeploymentSetup(deploymentName, programName, false, areaName);
        // Edit Deployment
        await editItem('deployments', deploymentName);
        // Add Product with configuration
        await addNewProduct(0, productTypeWithConfigName, productFlavourName, infraTypes.PHYSICAL);
        await driver.findElement(By.name('products[0].configuration[0].key_value')).sendKeys('123Physical');
        await clickElement(By.xpath('//button[contains(.,"Save")]'));
        await driver.wait(until.elementLocated(By.xpath('//h1[contains(.,"Viewing")]')), 10000);
        await clickElement(By.xpath('//button[contains(.,"Clone")]'), true);
        await driver.wait(until.elementLocated(By.xpath('//h1[contains(.,"Creating")]')), 10000);
        (await driver.findElement(By.name('products[0].configuration[0].key_name')).getAttribute('disabled')).should.equal('true');
        // Delete
        await deleteItem('deployments', deploymentName);
      });

      it('configuration fields should change when changing from physical to cloud when creating a Deployment', async function () {
        await newDeploymentSetup(deploymentName, programName, false, areaName);
        // Edit Deployment
        await editItem('deployments', deploymentName);
        // Add Product with configuration
        await addNewProduct(0, productTypeWithConfigName, productFlavourName, infraTypes.PHYSICAL);
        var value = await driver.findElement(By.name('products[0].configuration[0].key_name')).getAttribute('value');
        await value.should.equal('physicalField');
        await select2DropdownSelect('products0-infrastructure', infraTypes.CLOUD);
        await driver.sleep(500);
        value = await driver.findElement(By.name('products[0].configuration[0].key_name')).getAttribute('value');
        await value.should.equal('cloudField');
        // Delete
        await deleteItem('deployments', deploymentName);
      });

      it('configuration fields that are not mandatory, shouldnt be deleted when switching between infrastructure', async function () {
        await newDeploymentSetup(deploymentName, programName, false, areaName);
        // Edit Deployment
        await editItem('deployments', deploymentName);
        // Add Product with configuration
        await addNewProduct(0, productTypeWithConfigName, productFlavourName, infraTypes.PHYSICAL);
        // Add extra configuration
        await driver.wait(until.elementLocated(By.id('add-product-configuration-[0]')), 5000);
        await driver.findElement(By.id('add-product-configuration-[0]')).click();
        await driver.sleep(1000);
        await driver.findElement(By.name('products[0].configuration[1].key_name')).sendKeys('extraField');
        var value = await driver.findElement(By.name('products[0].configuration[0].key_name')).getAttribute('value');
        await value.should.equal('physicalField');
        value = await driver.findElement(By.name('products[0].configuration[1].key_name')).getAttribute('value');
        await value.should.equal('extraField');
        await select2DropdownSelect('products0-infrastructure', infraTypes.CLOUD);
        await driver.sleep(500);
        value = await driver.findElement(By.name('products[0].configuration[0].key_name'), 5000).getAttribute('value');
        await value.should.equal('extraField');
        value = await driver.findElement(By.name('products[0].configuration[1].key_name'), 5000).getAttribute('value');
        await value.should.equal('cloudField');
        // Delete
        await deleteItem('deployments', deploymentName);
      });

      afterEach(async function () {
        if (this.currentTest.state === 'failed') {
          await takeScreenshot(`${this.currentTest.title}_0`.replace(/ /g, '_'));
          await deleteArtifactREST('deployments', null, deploymentName, false, true);
          await deleteArtifactREST('deployments', null, clonedDeploymentName, false, true);
        }
      });
    });

    describe('Booking', function () {
      this.timeout(150000);
      var deploymentSimple = 'A_Health_depl_smpl';
      var deploymentBlocked = 'A_Health_depl_blocked';
      var deploymentCrossRAEnabled = 'A_Health_depl_cross_RA';
      var labelName2 = 'A_HEALTH_LBL_2';
      var progRaName = 'A_Health_CrossRA';
      var deploymentCustomTeam = 'A_Health_deployments_customTeam';

      before(async function () {
        programREST2 = await createProgramREST(progRaName);
        areaREST2 = await createAreaREST(progRaName, programREST2._id);
        deploymentREST1 = await createDeploymentREST(
          deploymentCustomTeam, programREST2._id, areaREST2._id, statusTypes.FREE,
          [], true
        );

        labelREST2 = await createLabelREST(labelName2);
        await newDeploymentSetup(
          deploymentName, programName, labelName, areaName, statusTypes.FREE,
          false, deploymentProduct, teamName, deploymentPurpose
        );
        await newDeploymentSetup(deploymentSimple, programName, false, areaName, statusTypes.FREE);
        await newDeploymentSetup(deploymentBlocked, programName, false, areaName, statusTypes.BLOCKED_IN_MAINTENANCE);
      });

      it('should throw an error and put automatic jenkins job to manual if selected Product has invalid jenkins url', async function () {
        await openArtifactCreateView('deployments');
        // Add Name
        await driver.findElement(By.name('name')).sendKeys('deployment2');
        // Add Program
        await driver.sleep(1000);
        await select2DropdownSelect('program-select', programName);
        // Add Area
        await driver.sleep(500);
        await driver.wait(until.elementLocated(By.id('select2-area-select-container')), 20000);
        var element = await driver.findElement(By.id('select2-area-select-container'));
        await driver.executeScript('arguments[0].scrollIntoView(true);', element);
        await select2DropdownSelect('area-select', areaName);
        // Add Status
        await driver.sleep(500);
        await driver.wait(until.elementLocated(By.id('select2-status-select-container')), 20000);
        element = await driver.findElement(By.id('select2-status-select-container'));
        await driver.executeScript('arguments[0].scrollIntoView(true);', element);
        await select2DropdownSelect('status-select', statusTypes.FREE);
        // Add Team
        await driver.sleep(500);
        await select2DropdownSelect('team-select', teamName);
        // Add Product
        await addNewProduct(
          0, deploymentProduct[0].typeName, deploymentProduct[0].flavourName,
          deploymentProduct[0].infrastructure, true, deploymentProduct[0].purpose, false, false, true
        );
        await clickSaveButton('Deployment creation', null, null, null, false);
        await driver.sleep(1000);

        // Booking
        await openArtifactListView('bookings', 'create-booking-button');
        await clickElement(By.id('create-booking-button'));
        await clickElement(By.id('create-booking-by-deployment-button'));
        // Associated Artifacts
        await select2DropdownSelect('deployment-select', 'deployment2');
        await driver.sleep(500);
        await select2DropdownSelect('bookingProduct-select', productTypeName);
        await driver.sleep(500);

        // error div
        (await driver.findElement(By.xpath('//div[contains(.,"Jenkins Job URL is invalid.")]')).isDisplayed()).should.equal(true);
        var automaticJenkinsToggle = await driver.findElement(By.name('jenkinsJobTrigger'));
        // true = Automatic, false = manual
        (await driver.executeScript('return angular.element(arguments[0]).scope().vm.booking.automaticJenkinsIITrigger;', automaticJenkinsToggle)).should.equal(false);
        // automatic trigger disabled
        (await driver.findElement(By.name('jenkinsJobTrigger')).getAttribute('disabled')).should.equal('true');

        await deleteItem('deployments', 'deployment2');
      });

      it('should create Booking with Find Available Deployments and see it in Table View', async function () {
        await newFindDeploymentSetup(teamName, bookingStartTime, bookingEndTime, false, false, false);
        await driver.wait(until.elementLocated(By.id('change-search-input')), 30000);
        await driver.wait(until.elementLocated(By.name('deploymentForm')), 5000);
        await driver.findElement(By.name('deploymentForm')).click();
        await newBookingFindSetup(
          deploymentName, productTypeName, false, 'Initial Install', 'Smoke Test',
          true, 'jobTypeUG', 'ENM:20.08', 'LATEST GREEN', 'CIP-43547', 'None'
        );
        // Verify Booking
        await openArtifactListView('bookings', 'create-booking-button', areaName);
        (await driver.findElement(By.xpath(`//div[contains(.,"${deploymentName}")]`)).isDisplayed()).should.equal(true);
        // Delete
        await deleteItem('bookings', deploymentName, 1, true, areaName);
      });

      it('should create Booking with Find Available Deployments for a custom Team and see it in Table View', async function () {
        await newDeploymentSetup(deploymentCrossRAEnabled, programName, false, areaName, statusTypes.FREE, true, deploymentProduct2);
        await newFindDeploymentSetup(false, bookingStartTime, bookingEndTime, false, false, 'someCustomTeam');
        await driver.wait(until.elementLocated(By.id('change-search-input')), 30000);
        await driver.wait(until.elementLocated(By.name('deploymentForm')), 5000);
        await driver.findElement(By.name('deploymentForm')).click();
        await newBookingFindSetup(
          deploymentCrossRAEnabled, productTypeName, false, 'Initial Install', 'Smoke Test',
          true, 'jobTypeUG', 'ENM:20.08', 'LATEST GREEN', 'CIP-43547', 'None'
        );
        // Verify Booking
        await openArtifactListView('bookings', 'create-booking-button', areaName);
        (await driver.findElement(By.xpath(`//div[contains(.,"${deploymentName}")]`)).isDisplayed()).should.equal(true);
        // Delete
        await deleteItem('bookings', deploymentCrossRAEnabled, 1, true, areaName);
        await deleteItem('deployments', deploymentCrossRAEnabled);
      });

      it('should create Booking with Find Available Deployments with a Label and see it in Table View', async function () {
        await newFindDeploymentSetup(teamName, bookingStartTime, bookingEndTime, labelName, false, false, false);
        await driver.wait(until.elementLocated(By.id('change-search-input')), 30000);
        await driver.wait(until.elementLocated(By.name('deploymentForm')), 5000);
        await driver.findElement(By.name('deploymentForm')).click();
        await newBookingFindSetup(
          deploymentName, productTypeName, false, 'Initial Install', 'Smoke Test',
          true, 'jobTypeUG', 'ENM:20.08', 'LATEST GREEN', 'CIP-43547', 'None'
        );
        // Verify Booking
        await openArtifactListView('bookings', 'create-booking-button', areaName);
        (await driver.findElement(By.xpath(`//div[contains(.,"${deploymentName}")]`)).isDisplayed()).should.equal(true);
        // Delete
        await deleteItem('bookings', deploymentName, 1, true, areaName);
      });

      it('should create Booking with Find Available Deployments with a Product Type and see it in Table View', async function () {
        await newDeploymentSetup(deploymentCrossRAEnabled, programName, false, areaName, statusTypes.FREE, true, deploymentProduct2);
        await newFindDeploymentSetup(teamName, bookingStartTime, bookingEndTime, false, 'A_Health_prodType1_Cr_ENM', false);
        await driver.wait(until.elementLocated(By.id('change-search-input')), 30000);
        await driver.wait(until.elementLocated(By.name('deploymentForm')), 5000);
        await driver.findElement(By.name('deploymentForm')).click();
        await driver.sleep(500);
        await newBookingFindSetup(
          deploymentCrossRAEnabled, productTypeName, false, 'Initial Install', 'Smoke Test',
          true, 'jobTypeUG', 'ENM:20.08', 'LATEST GREEN', 'CIP-43547', 'None'
        );
        // Verify Booking
        await openArtifactListView('bookings', 'create-booking-button', areaName);
        (await driver.findElement(By.xpath(`//div[contains(.,"${deploymentCrossRAEnabled}")]`)).isDisplayed()).should.equal(true);
        // Delete
        await deleteItem('bookings', deploymentCrossRAEnabled, 1, true, areaName);
        await deleteItem('deployments', deploymentCrossRAEnabled);
      });

      it('should not create Booking with Find Available Deployments for a Deployment with cross RA sharing disabled', async function () {
        // create team with a different RA from Deployment A_Health_CrossRA / A_Health_area_Cr
        teamREST4 = await createTeamREST(teamName4, areaREST2._id);
        await newFindDeploymentSetup(teamName4, bookingStartTime, bookingEndTime, false, false, false, true);
        await driver.wait(until.elementLocated(By.id('change-search-input')), 30000);
        await driver.wait(until.elementLocated(By.name('deploymentForm')), 5000);
        await driver.findElement(By.name('deploymentForm')).click();
        await newBookingFindSetup(
          deploymentName, productTypeName, false, 'Initial Install', 'Smoke Test',
          false, 'jobTypeUG', 'ENM:20.08', 'LATEST GREEN', 'CIP-43547', 'None'
        );
        // check if save button disabled
        await validateValueByName('save-booking-button-alt', 'disabled', 'true');
        await deleteArtifactREST('teams', teamREST4, false, false, true);
      });

      it('should not create a Booking with Find Available Deployments using a Label with no associated Deployments', async function () {
        await newFindDeploymentSetup(teamName, bookingStartTime, bookingEndTime, labelName2, false, false);
        await driver.wait(until.elementLocated(By.className('ui-notification')), 5000);

        (await driver.findElement(By.xpath(`//div[contains(.,"${labelName2}")]`)).isDisplayed()).should.equal(true);
      });

      it('should not create a Booking with Find Available Deployments using a ProductType with no associated Deployments', async function () {
        await newFindDeploymentSetup(teamName, bookingStartTime, bookingEndTime, false, productTypeName2, false);
        await driver.wait(until.elementLocated(By.className('ui-notification')), 5000);
        (await driver.findElement(By.xpath(`//div[contains(.,"${productTypeName2}")]`)).isDisplayed()).should.equal(true);
      });

      it('should create single Booking without Product and see it in the monthly Calendar', async function () {
        await newBookingSetup(deploymentSimple, undefined, teamName, bookingStartTime, bookingEndTime, false, 'Not Applicable', 'Smoke Test');
        // Verify Booking
        await viewItem('bookings', deploymentSimple, 1, areaName);
        await validateValueByName('deployment-select', 'innerHTML', deploymentSimple);
        await validateValueByName('team-select', 'innerHTML', teamName);
        await validateValueByName('booking-description', 'value', 'Smoke Test');
        // Delete
        await deleteItem('bookings', deploymentSimple, 1, true, areaName);
      });

      it('should not create multiple single Bookings on the same day', async function () {
        var endDate = addDaysAndGenerateDatePickerString(-2);
        var range = momentExtended.range(bookingStartTime, endDate);
        var timeRange = `${range.start.format(dateFormat)} - ${range.end.format(dateFormat)}`;
        await newBookingSetup(deploymentSimple, undefined, teamName, bookingStartTime, endDate, false, 'Not Applicable', 'Smoke Test');
        // Verify Booking
        await viewItem('bookings', deploymentSimple, 1, areaName);
        await validateValueByName('deployment-select', 'innerHTML', deploymentSimple);
        await validateValueByName('team-select', 'innerHTML', teamName);
        await validateValueByName('booking-description', 'value', 'Smoke Test');

        // Attempt to Create another single day booking on the same day
        await openArtifactListView('bookings', 'create-booking-button');
        await clickElement(By.id('create-booking-button'));
        await clickElement(By.id('create-booking-by-deployment-button'));
        await select2DropdownSelect('deployment-select', deploymentSimple);
        await select2DropdownSelect('team-select', teamName);
        await driver.sleep(1000);
        await select2DropdownSelect('testingType-select', 'Not Applicable');
        await clickAndSendKey('booking-description', 'Smoke Test');

        // Choose Dates
        await driver.findElement(By.id('startTime')).sendKeys(bookingStartTime);
        await driver.findElement(By.id('startTime')).sendKeys(webdriver.Key.TAB);
        await driver.findElement(By.id('endTime')).sendKeys(endDate);
        await driver.findElement(By.id('endTime')).sendKeys(webdriver.Key.TAB);
        await driver.wait(until.elementLocated(By.name('booking-description')), 5000);
        await driver.findElement(By.name('booking-description')).click();

        // Try Save Booking
        await clickElement(By.id('save-booking-button'));
        await driver.sleep(1000);

        // Await Error Message
        (await driver.findElement(By.xpath(`//div[contains(.,"(${timeRange}) of another Booking")]`)).isDisplayed()).should.equal(true);

        // Delete
        await deleteItem('bookings', deploymentSimple, 1, true, areaName);
      });

      it('should not create booking when start date intersects with current booking end date', async function () {
        var endDate = addDaysAndGenerateDatePickerString(1);
        var endDatePlusOne = addDaysAndGenerateDatePickerString(2);
        var range = momentExtended.range(bookingStartTime, endDate);
        var timeRange = `${range.start.format(dateFormat)} - ${range.end.format(dateFormat)}`;
        await newBookingSetup(deploymentSimple, undefined, teamName, bookingStartTime, endDate, false, 'Not Applicable', 'Smoke Test');
        // Verify Booking
        await viewItem('bookings', deploymentSimple, 1, areaName);
        await validateValueByName('deployment-select', 'innerHTML', deploymentSimple);
        await validateValueByName('team-select', 'innerHTML', teamName);
        await validateValueByName('booking-description', 'value', 'Smoke Test');

        // Attempt to Create another single day booking on the same day
        await openArtifactListView('bookings', 'create-booking-button', areaName);
        await clickElement(By.id('create-booking-button'));
        await clickElement(By.id('create-booking-by-deployment-button'));
        await select2DropdownSelect('deployment-select', deploymentSimple);
        await driver.sleep(500);
        await select2DropdownSelect('team-select', teamName);
        await driver.sleep(1000);
        await select2DropdownSelect('testingType-select', 'Not Applicable');
        await clickAndSendKey('booking-description', 'Smoke Test');

        // Choose Dates
        // Using start time same day as current booking end time
        await driver.findElement(By.id('startTime')).sendKeys(endDate);
        await driver.findElement(By.id('startTime')).sendKeys(webdriver.Key.TAB);
        await driver.findElement(By.id('endTime')).sendKeys(endDatePlusOne);
        await driver.findElement(By.id('endTime')).sendKeys(webdriver.Key.TAB);
        await driver.wait(until.elementLocated(By.name('booking-description')), 5000);
        await driver.findElement(By.name('booking-description')).click();

        // Try Save Booking
        await clickElement(By.id('save-booking-button'));
        await driver.sleep(1000);

        // Await Error Message
        (await driver.findElement(By.xpath(`//div[contains(.,"(${timeRange}) of another Booking")]`)).isDisplayed()).should.equal(true);

        // Delete
        await deleteItem('bookings', deploymentSimple, 1, true, areaName);
      });

      it('should not create booking when end date intersects with current booking start date', async function () {
        var startDate = addDaysAndGenerateDatePickerString(-4);
        var range = momentExtended.range(bookingStartTime, bookingEndTime);
        var timeRange = `${range.start.format(dateFormat)} - ${range.end.format(dateFormat)}`;
        await newBookingSetup(deploymentSimple, undefined, teamName, bookingStartTime, bookingEndTime, false, 'Not Applicable', 'Smoke Test');
        // Verify Booking
        await viewItem('bookings', deploymentSimple, 1, areaName);
        await validateValueByName('deployment-select', 'innerHTML', deploymentSimple);
        await validateValueByName('team-select', 'innerHTML', teamName);
        await validateValueByName('booking-description', 'value', 'Smoke Test');

        // Attempt to Create another single day booking on the same day
        await openArtifactListView('bookings', 'create-booking-button');
        await clickElement(By.id('create-booking-button'));
        await clickElement(By.id('create-booking-by-deployment-button'));
        await select2DropdownSelect('deployment-select', deploymentSimple);
        await driver.sleep(2000);
        await select2DropdownSelect('team-select', teamName);
        await driver.sleep(2000);
        await select2DropdownSelect('testingType-select', 'Not Applicable');
        await clickAndSendKey('booking-description', 'Smoke Test');

        // Choose Dates
        await driver.findElement(By.id('startTime')).sendKeys(startDate);
        await driver.findElement(By.id('startTime')).sendKeys(webdriver.Key.TAB);
        // Using end time same day as current booking start time
        await driver.findElement(By.id('endTime')).sendKeys(bookingStartTime);
        await driver.findElement(By.id('endTime')).sendKeys(webdriver.Key.TAB);
        await driver.wait(until.elementLocated(By.name('booking-description')), 5000);
        await driver.findElement(By.name('booking-description')).click();

        // Try Save Booking
        await clickElement(By.id('save-booking-button'));
        await driver.sleep(1000);

        // Await Error Message
        (await driver.findElement(By.xpath(`//div[contains(.,"(${timeRange}) of another Booking")]`)).isDisplayed()).should.equal(true);

        // Delete
        await deleteItem('bookings', deploymentSimple, 1, true, areaName);
      });

      it('should create single Booking without Product and see it in the weekly Calendar', async function () {
        // Create a Booking so Deployment will show up
        await newBookingSetup(deploymentSimple, undefined, teamName, wcBookingStartTime, wcBookingEndTime, false, 'Not Applicable', 'Smoke Test');
        // Verify Booking
        await viewWeeklyCalendarBooking(areaName, deploymentSimple, wcBookingStartTime);
        await validateValueByName('deployment-select', 'innerHTML', deploymentSimple);
        await validateValueByName('team-select', 'innerHTML', teamName);
        await validateValueByName('booking-description', 'value', 'Smoke Test');
        // Delete
        await deleteItem('bookings', deploymentSimple, 1, true, areaName);
      });

      it('should create single Booking without Jira MR Link and see it in the Calendar', async function () {
        await newBookingSetup(
          deploymentName, productTypeName, teamName, bookingStartTime, bookingEndTime, false, 'Initial Install', 'Smoke Test',
          true, 'jobTypeUG', 'ENM:20.08', 'LATEST GREEN', false, 'None'
        );
        // Verify Booking
        await viewItem('bookings', deploymentName, 1, areaName);
        await validateValueByName('deployment-select', 'innerHTML', deploymentName);
        await validateValueByName('team-select', 'innerHTML', teamName);
        await validateValueByName('jobTypeUG', 'checked', 'true');
        await validateValueByName('enmDropVersion-select', 'innerHTML', 'ENM:20.08');
        await validateValueByName('enmProductSet-select', 'innerHTML', 'LATEST GREEN');
        await validateValueByName('testingType-select', 'innerHTML', 'Initial Install');
        await validateValueByName('booking-description', 'value', 'Smoke Test');
        // Delete
        await deleteItem('bookings', deploymentName, 1, true, areaName);
      });

      // it('should create single Booking and see sent-email created in Booking log view email-table', async function () {
      //   await newBookingSetup(deploymentSimple, undefined, teamName, bookingStartTime, bookingEndTime, false, 'Not Applicable', 'Smoke Test');
      //   // Verify Booking
      //   await viewItem('bookings', deploymentSimple, 1, areaName);
      //   await clickElement(By.xpath('//a[contains(.,"View Log")]'));
      //   await driver.wait(until.elementLocated(By.xpath('//h1[contains(.,"Booking Log")]')), 5000);
      //   // Verify Email
      //   var emailTable = await driver.findElement(By.id('email-table'));
      //   var emailSubject = `${deploymentSimple} Booking CREATED`;
      //   (await emailTable.findElement(By.xpath(`//td[contains(.,"${emailSubject}")]`)).isDisplayed()).should.equal(true);
      //   // Delete
      //   await deleteItem('bookings', deploymentSimple, 1, true, areaName);
      // });

      it('should create single Booking using weekly view without Product and see it in the weekly Calendar', async function () {
        var bookingStartEndTime = today.clone().startOf('isoWeek').add(3, 'hours').add(4, 'days')
          .format(dateFormat);
        var startEndTime = moment(bookingStartEndTime).subtract(1, 'days')
          .format(dateFormat);
        // Create a Booking so Deployment will show up
        await newBookingSetup(
          deploymentName, productTypeName, teamName, startEndTime, startEndTime, false, 'Initial Install', 'Smoke Test',
          true, 'jobTypeUG', 'ENM:20.08', 'LATEST GREEN', 'CIP-33636', 'None'
        );
        await openArtifactListView('bookings', 'create-booking-button', areaName);
        await clickElement(By.xpath('//button[contains(.,"Week")]'));
        await driver.sleep(500);
        await driver.wait(until.elementLocated(By.id(bookingStartEndTime)), 20000);
        var element = await driver.findElement(By.id(bookingStartEndTime));
        await element.click();
        await select2DropdownSelect('deployment-select', deploymentName);
        await select2DropdownSelect('team-select', teamName2);
        await driver.sleep(500);
        await driver.wait(until.elementLocated(By.id('bookingProduct-select')), 5000);
        await select2DropdownSelect('bookingProduct-select', productTypeName);
        await driver.findElement(By.id('endTime')).sendKeys(bookingStartEndTime);
        await select2DropdownSelect('testingType-select', 'Initial Install');
        await clickElementAndSendKey('bookingDescription', 'Smoke Test', 'id', true);
        await driver.findElement(By.name('additionalJenkinsUsers')).sendKeys('eistpav');
        await clickElementAndSendKey('jiraMRBugReferenceIssue', 'CIP-33636', 'id', true);
        await driver.sleep(2000);
        await driver.wait(until.elementLocated(By.id('enmProductSetDrop-select')), 5000);
        await select2DropdownSelect('enmProductSetDrop-select', 'ENM:20.08');
        await driver.sleep(1000);
        await driver.wait(until.elementLocated(By.id('enmProductSetVersion-select')), 5000);
        await select2DropdownSelect('enmProductSetVersion-select', 'LATEST GREEN');
        await driver.findElement(By.name('jobTypeUG')).click();
        element = await driver.wait(until.elementLocated(By.xpath('//button[contains(.,"Save")]')), 5000);
        await clickSaveButton('Booking creation', 'save-booking-button');
        await driver.sleep(1000);
        await clickElement(By.xpath('//button[contains(.,"Week")]'));
        await driver.sleep(1000);
        await driver.wait(until.elementLocated(By.id(`${bookingStartEndTime}-${deploymentName}`)), 20000);
        element = await driver.findElement(By.id(`${bookingStartEndTime}-${deploymentName}`));
        await element.click();
        await validateValueByName('deployment-select', 'innerHTML', deploymentName);
        await validateValueByName('team-select', 'innerHTML', teamName);

        await deleteItem('bookings', teamName2, 8, true, areaName);
        await deleteItem('bookings', teamName, 8, true, areaName);
      });

      it('should create single Booking with ENM Product and see it in the Calendar', async function () {
        await newBookingSetup(
          deploymentName, productTypeName, teamName, bookingStartTime, bookingEndTime, false, 'Initial Install', 'Smoke Test',
          true, 'jobTypeUG', 'ENM:20.08', 'LATEST GREEN', 'CIP-33636', 'None'
        );
        // Verify Booking
        await viewItem('bookings', deploymentName, 1, areaName);
        await validateValueByName('deployment-select', 'innerHTML', deploymentName);
        await validateValueByName('team-select', 'innerHTML', teamName);
        await validateValueByName('jobTypeUG', 'checked', 'true');
        await validateValueByName('enmDropVersion-select', 'innerHTML', 'ENM:20.08');
        await validateValueByName('enmProductSet-select', 'innerHTML', 'LATEST GREEN');
        await validateValueByName('testingType-select', 'innerHTML', 'Initial Install');
        await validateValueByName('jiraMRBugReferenceIssue', 'value', 'CIP-33636');
        await validateValueByName('booking-description', 'value', 'Smoke Test');
        // Delete
        await deleteItem('bookings', deploymentName, 1, true, areaName);
      });

      it('should create Booking and see it in Associated Deployment view page', async function () {
        // Check there is no associated Bookings with the Deployment
        await viewItem('deployments', deploymentName);
        (await driver.findElement(By.name('dependent-bookings')).getAttribute('innerHTML')).includes('None').should.equal(true);

        await newBookingSetup(
          deploymentName, productTypeName, teamName, bookingStartTime, bookingEndTime, false, 'Initial Install', 'Smoke Test', true,
          'jobTypeUG', 'ENM:20.08', 'LATEST GREEN', 'CIP-33636', 'None'
        );
        // Verify Booking
        await viewItem('bookings', deploymentName, 1, areaName);
        await validateValueByName('deployment-select', 'innerHTML', deploymentName);
        await validateValueByName('team-select', 'innerHTML', teamName);
        await validateValueByName('jobTypeUG', 'checked', 'true');
        await validateValueByName('enmDropVersion-select', 'innerHTML', 'ENM:20.08');
        await driver.sleep(1000);
        await validateValueByName('enmProductSet-select', 'innerHTML', 'LATEST GREEN');
        await validateValueByName('testingType-select', 'innerHTML', 'Initial Install');
        await validateValueByName('jiraMRBugReferenceIssue', 'value', 'CIP-33636');
        await validateValueByName('booking-description', 'value', 'Smoke Test');

        // Check that Deployment now has dependent bookings
        await viewItem('deployments', deploymentName);
        (await driver.findElement(By.name('dependent-bookings')).getAttribute('innerHTML')).includes('None').should.equal(false);
        await deleteItem('bookings', deploymentName, 1, true, areaName);
      });

      it('should not create a Booking that uses dates between a shareable Booking until its made shareable as well', async function () {
        // Create Single Booking
        await newBookingSetup(
          deploymentName, productTypeName, teamName, bookingStartTime, bookingEndTime, true, 'Initial Install', 'Smoke Test',
          true, undefined, 'ENM:20.08', 'LATEST GREEN', 'CIP-33636', 'None'
        );

        // Try Creating Booking in between dates
        await openArtifactListView('bookings', 'create-booking-button', areaName);
        await clickElement(By.id('create-booking-button'));
        await clickElement(By.id('create-booking-by-deployment-button'));
        await select2DropdownSelect('deployment-select', deploymentName);

        await driver.sleep(500);
        await select2DropdownSelect('bookingProduct-select', productTypeName);
        await driver.sleep(5000);
        await select2DropdownSelect('team-select', teamName2);
        await driver.findElement(By.name('additionalJenkinsUsers')).sendKeys('eistpav');
        await select2DropdownSelect('enmProductSetDrop-select', 'ENM:20.08');
        await driver.sleep(1000);
        await select2DropdownSelect('enmProductSetVersion-select', 'LATEST GREEN');
        await clickElementAndSendKey('jiraMRBugReferenceIssue', 'CIP-33636', 'id', true);
        await driver.sleep(2000);
        await select2DropdownSelect('testingType-select', 'Initial Install');
        await clickAndSendKey('booking-description', 'Create-Description');
        // Choose Dates
        await driver.findElement(By.id('startTime')).sendKeys(bookingSharedTime);
        await driver.findElement(By.id('startTime')).sendKeys(webdriver.Key.TAB);
        await driver.findElement(By.id('endTime')).sendKeys(bookingSharedTime);
        await driver.findElement(By.id('endTime')).sendKeys(webdriver.Key.TAB);
        await driver.findElement(By.name('booking-description')).click();
        await clickElement(By.id('save-booking-button'));
        await driver.sleep(1000);
        await driver.wait(until.elementLocated(By.className('ui-notification')), 5000);
        await driver.wait(until.elementLocated(By.xpath('//div[contains(.,"set booking-type to")]')), 5000);
        // Change to Shareable
        await driver.findElement(By.name('sharingType')).click();
        await driver.sleep(500);
        // Save again
        await clickElement(By.id('save-booking-button'));
        await driver.sleep(1000);
        // delete sharing and shareable bookings
        await deleteItem('bookings', teamName2, 8, true, areaName);
        await deleteItem('bookings', teamName, 8, true, areaName);
      });

      it('should not create a Booking that uses dates between a shareable Booking and same team until its team is changed', async function () {
        // Create Single Booking
        await newBookingSetup(
          deploymentName, productTypeName, teamName, bookingStartTime, bookingEndTime, true, 'Initial Install', 'Smoke Test',
          true, undefined, 'ENM:20.08', 'LATEST GREEN', 'CIP-33636', 'None'
        );
        // Try Creating Booking in between dates
        await openArtifactListView('bookings', 'create-booking-button', areaName);
        await clickElement(By.id('create-booking-button'));
        await clickElement(By.id('create-booking-by-deployment-button'));
        await select2DropdownSelect('deployment-select', deploymentName);
        await driver.sleep(500);
        await select2DropdownSelect('bookingProduct-select', productTypeName);
        await driver.sleep(500);
        await select2DropdownSelect('team-select', teamName);
        await driver.findElement(By.name('additionalJenkinsUsers')).sendKeys('eistpav');
        await select2DropdownSelect('enmProductSetDrop-select', 'ENM:20.08');
        await driver.sleep(1000);
        await driver.wait(until.elementLocated(By.name('sharingType')), 5000);
        await driver.findElement(By.name('sharingType')).click();
        await select2DropdownSelect('enmProductSetVersion-select', 'LATEST GREEN');
        await clickElementAndSendKey('jiraMRBugReferenceIssue', 'CIP-33636', 'id', true);
        await driver.sleep(5000);
        await select2DropdownSelect('testingType-select', 'Initial Install');
        await clickAndSendKey('booking-description', 'Create-Description');
        // Choose Dates
        await driver.sleep(1000);
        await driver.findElement(By.id('startTime')).sendKeys(bookingSharedTime);
        await driver.findElement(By.id('startTime')).sendKeys(webdriver.Key.TAB);
        await driver.findElement(By.id('endTime')).sendKeys(bookingSharedTime);
        await driver.findElement(By.id('endTime')).sendKeys(webdriver.Key.TAB);
        await driver.wait(until.elementLocated(By.name('booking-description')), 5000);
        await driver.findElement(By.name('booking-description')).click();
        await clickElement(By.id('save-booking-button'));
        await driver.sleep(1000);
        await driver.wait(until.elementLocated(By.className('ui-notification')), 5000);
        await driver.wait(until.elementLocated(By.xpath('//div[contains(.,"The selected team already has a Parent-Booking for this")]')), 5000);
        await select2DropdownSelect('team-select', teamName2);
        // Save again
        await clickElement(By.id('save-booking-button'));
        await driver.sleep(1000);
        // Delete sharing and shareable bookings
        await deleteItem('bookings', teamName2, 8, true, areaName);
        await deleteItem('bookings', teamName, 8, true, areaName);
      });

      it('should not create single Booking when Deployment status is \'In Review\' or \'Blocked/In Maintenance\'', async function () {
        await openArtifactListView('bookings', 'create-booking-button', areaName);
        await clickElement(By.id('create-booking-button'));
        await clickElement(By.id('create-booking-by-deployment-button'));
        await select2DropdownSelect('deployment-select', deploymentBlocked);
        await driver.sleep(1000);
        await select2DropdownSelect('team-select', teamName);
        await validateValueByName('deploymentMessages', 'innerHTML', 'NOTE: Booking cannot be created, whilst Deployment');
        await driver.sleep(1000);
        await select2DropdownSelect('testingType-select', 'Initial Install');
        // Choose Dates
        await driver.findElement(By.id('startTime')).sendKeys(bookingStartTime);
        await driver.findElement(By.id('startTime')).sendKeys(webdriver.Key.TAB);
        await driver.findElement(By.id('endTime')).sendKeys(bookingEndTime);
        await driver.findElement(By.id('endTime')).sendKeys(webdriver.Key.TAB);
        await driver.wait(until.elementLocated(By.name('booking-description')), 5000);
        await driver.findElement(By.name('booking-description')).click();
        // Save button disabled
        (await driver.findElement(By.id('save-booking-button')).getAttribute('disabled')).should.equal('true');
        await deleteItem('deployments', deploymentBlocked);
      });

      it('should create single Booking with custom team name and see it in the Calendar', async function () {
        await newBookingSetup(deploymentCustomTeam, undefined, 'customTeamName', bookingStartTime, bookingEndTime, false, 'Not Applicable', 'Smoke Test');
        // Verify Booking
        await viewItem('bookings', deploymentCustomTeam, 1, progRaName, progRaName);
        await validateValueByName('deployment-select', 'innerHTML', deploymentCustomTeam);
        await validateValueByName('customTeam', 'value', 'customTeamName');
        await validateValueByName('booking-description', 'value', 'Smoke Test');
        // Delete
        await deleteItem('bookings', deploymentCustomTeam, 1, true, progRaName, progRaName);
      });

      it('should create single Booking with custom team name and see it in weekly calendar', async function () {
        await newBookingSetup(deploymentCustomTeam, undefined, 'customTeamName', wcBookingStartTime, wcBookingEndTime, false, 'Not Applicable', 'Smoke Test');
        // Verify Booking
        await viewWeeklyCalendarBooking(progRaName, deploymentCustomTeam, wcBookingStartTime);
        await validateValueByName('deployment-select', 'innerHTML', deploymentCustomTeam);
        await validateValueByName('customTeam', 'value', 'customTeamName');
        // Delete
        await deleteItem('bookings', deploymentCustomTeam, 1, true, progRaName, progRaName);
      });

      it('should create sharing Booking for a custom team and see it in the Calendar ', async function () {
        await newBookingSetup(deploymentCustomTeam, undefined, teamName, wcBookingStartTime, wcBookingEndTime, true, 'Not Applicable', 'Smoke Test');
        // Verify Booking
        await viewItem('bookings', deploymentCustomTeam, 1, progRaName, progRaName);
        await validateValueByName('deployment-select', 'innerHTML', deploymentCustomTeam);
        await validateValueByName('booking-description', 'value', 'Smoke Test');
        // Create sharing Booking with custom team
        await newBookingSetup(deploymentCustomTeam, undefined, 'customTeamName', wcBookingStartTime, wcBookingEndTime, true, 'Not Applicable', 'Smoke Test Sharing');
        // Delete
        await openArtifactListView('bookings', 'create-booking-button', progRaName, progRaName);
        await clickElement(By.xpath('//td[contains(.,"Loaned to: customTeamName")]/../td[12]/a[contains(.,"Delete")]'));
        await driver.switchTo().alert().accept();
        await deleteItem('bookings', teamName, 8, true, progRaName, progRaName);
      });

      it('should create sharing Booking for another team and see it in the Calendar ', async function () {
        var deploymentSimple = 'A_Health_deployments_smpl2';
        await newDeploymentSetup(deploymentSimple, programName, false, areaName, statusTypes.FREE, true);
        await newBookingSetup(deploymentSimple, undefined, teamName, wcBookingStartTime, wcBookingEndTime, true, 'Not Applicable', 'Smoke Test');
        // Verify Booking
        await viewItem('bookings', deploymentSimple, 1, areaName, programName);
        await validateValueByName('deployment-select', 'innerHTML', deploymentSimple);
        await validateValueByName('booking-description', 'value', 'Smoke Test');
        // Create sharing Booking with existing team
        await newBookingSetup(deploymentSimple, undefined, teamName2, wcBookingStartTime, wcBookingEndTime, true, 'Not Applicable', 'Smoke Test Sharing');
        // Delete
        await deleteItem('bookings', teamName2, 8, true, areaName, programName);
        await deleteItem('bookings', teamName, 8, true, areaName, programName);
        await deleteItem('deployments', deploymentSimple);
      });

      it('should create booking using a custom template and validate template info', async function () {
        var individualProgramName = 'A_Health_prog_Cr_template';
        var deploymentProducts = [
          {
            typeName: productTypeName,
            flavourName: productFlavourName,
            infrastructure: 'Physical',
            hardware: [hardwareName3, hardwareName4],
            data: ['test', 'newData'],
            admins_only: false
          },
          {
            typeName: productTypeName,
            flavourName: productFlavourName,
            admins_only: false
          }
        ];
        programREST3 = await createProgramREST(individualProgramName);
        areaREST3 = await createAreaREST(areaName2, programREST3._id);
        teamREST3 = await createTeamREST(teamName3, areaREST3._id);
        hardwareREST3 = await createHardwareREST(hardwareName3, programREST3._id, 'deploymentId');
        hardwareREST4 = await createHardwareREST(hardwareName4, programREST3._id, 'deploymentId');

        await openArtifactListView('programs');
        await viewItem('programs', individualProgramName);
        await addJiraTemplate();

        // Now Save and Confirm
        await newDeploymentSetup(
          deploymentName2, individualProgramName, false, areaName2, statusTypes.FREE, false, deploymentProducts,
          teamName3, deploymentPurpose, false, false, true, false, true
        );
        // Create a new Booking with JIRA Template
        await newBookingSetup(
          deploymentName2, productTypeName, teamName3, bookingStartTime, bookingEndTime, false, 'Initial Install', 'Smoke Test',
          true, 'jobTypeUG', 'ENM:20.08', 'LATEST GREEN', false, 'None', true
        );

        // Reset RA selection
        await openArtifactListView('bookings');
        await driver.sleep(1000);
        await driver.wait(until.elementLocated(By.className('select2-selection__clear')), 3000).click();

        // Verify Booking
        await viewItem('bookings', deploymentName2, 1, areaName2);
        await validateValueByName('deployment-select', 'innerHTML', deploymentName2);
        await validateValueByName('team-select', 'value', teamREST3._id);
        await validateValueByName('booking-description', 'value', 'Smoke Test');
        (await driver.findElement(By.name('full-template-info')).getText()).should.equal('Jira Board: CI_Framework\nProject: CIP\nIssue Type: Test');

        // Delete
        await deleteItem('bookings', deploymentName2, 1, true, areaName2);
        await deleteItem('deployments', deploymentName2);
        await deleteItem('teams', teamName3);
        await deleteItem('areas', areaName2);
        await deleteItem('hardware', hardwareName3);
        await deleteItem('hardware', hardwareName4);
        await deleteItem('programs', individualProgramName);
      });

      it('should create booking with visible and disabled Jenkins Job Settings when Deployment-Product does not have Jenkins Job URL', async function () {
        var deploymentName3 = 'JENKIN_JOB_SETTING';
        var disabledMsg = 'Disabled due to no Jenkins Job URL found in the selected Deployment-Product, to enable add Jenkins Job URL to the selected Product in the Deployment.';
        // Create Deployment without Jenkins Job URL
        await newDeploymentSetup(
          deploymentName3, programName, false, areaName, statusTypes.FREE, false, [],
          teamName, deploymentPurpose, null, null, null, null, null, false
        );
        await addNewProduct(0, productTypeName, productFlavourName, infraTypes.PHYSICAL, false);
        await clickSaveButton('Deployment creation');
        await findTableItem('deployments', deploymentName);
        // Create Booking
        await openArtifactListView('bookings', 'create-booking-button', areaName);
        await clickElement(By.id('create-booking-button'));
        await clickElement(By.id('create-booking-by-deployment-button'));
        await select2DropdownSelect('deployment-select', deploymentName3);
        await driver.sleep(500);
        await select2DropdownSelect('bookingProduct-select', productTypeName);
        await driver.sleep(500);
        await select2DropdownSelect('team-select', teamName);
        await driver.sleep(500);
        await driver.findElement(By.id('startTime')).sendKeys(bookingStartTime + webdriver.Key.TAB);
        await driver.findElement(By.id('endTime')).sendKeys(bookingEndTime + webdriver.Key.TAB);
        await driver.sleep(2000);
        await select2DropdownSelect('testingType-select', 'Not Applicable');
        // Checking Jenkins Job Settings
        (await driver.findElement(By.name('jenkins-trigger-div')).getAttribute('title')).should.equal(disabledMsg);
        (await driver.findElement(By.name('jenkinsJobTrigger')).getAttribute('disabled')).should.equal('true');
        (await driver.findElement(By.name('jenkins-job-type-div')).getAttribute('title')).should.equal(disabledMsg);
        (await driver.findElement(By.name('jobTypeUG')).getAttribute('disabled')).should.equal('true');
        (await driver.findElement(By.name('jobTypeII')).getAttribute('disabled')).should.equal('true');
        (await driver.findElement(By.name('jenkins-users-div')).getAttribute('title')).should.equal(disabledMsg);
        (await driver.findElement(By.name('additionalJenkinsUsers')).getAttribute('disabled')).should.equal('true');
        (await driver.findElement(By.name('enm-ps-div')).getAttribute('title')).should.equal(disabledMsg);
        (await driver.findElement(By.id('select2-enmProductSetDrop-select-container')).getAttribute('title')).should.equal(disabledMsg);
        (await driver.findElement(By.name('enmDropVersion-select')).getAttribute('disabled')).should.equal('true');
        (await driver.findElement(By.name('enmDropVersion-select')).getAttribute('value')).should.equal('string:DON\'T CARE');
        (await driver.findElement(By.name('nss-version-div')).getAttribute('title')).should.equal(disabledMsg);
        (await driver.findElement(By.name('nssVersion-select')).getAttribute('disabled')).should.equal('true');
        (await driver.findElement(By.id('select2-nssVersion-select-container')).getAttribute('title')).should.equal(disabledMsg);
        // Can Save Booking
        await clickElement(By.id('save-booking-button'));
        await driver.sleep(1000);
        // Delete
        await deleteItem('bookings', deploymentName3, 1, true, areaName);
        await deleteItem('deployments', deploymentName3);
      });

      afterEach(async function () {
        await deleteArtifactREST('bookings', false, deploymentName, false, true);
        await deleteArtifactREST('bookings', false, deploymentSimple, false, true);
        await deleteArtifactREST('bookings', false, deploymentBlocked, false, true);
      });

      after(async function () {
        await deleteArtifactREST('deployments', false, deploymentName, false, true);
        await deleteArtifactREST('deployments', false, deploymentSimple, false, true);
        await deleteArtifactREST('deployments', false, deploymentBlocked, false, true);
        await deleteArtifactREST('deployments', false, deploymentCrossRAEnabled, false, true);
      });
    });

    describe('Role', function () {
      var roleName = 'A_Health_role_1';
      var permissionList = [
        {
          resources: '/accessResourcePath',
          resourceMethodIds: ['all-resource-view-page', 'all-resource-put', 'all-resource-post', 'all-resource-delete']
        },
        {
          resources: '/accessResourcePath2',
          resourceMethodIds: ['user-created-resource-put', 'all-resource-delete']
        }
      ];
      it('should create Role and see it in Role list', async function () {
        // Save and Confirm
        await newRoleSetup(roleName, permissionList);
        await findTableItem('roles', roleName);
        // Delete
        await deleteItem('roles', roleName);
      });
    });

    after(async function () {
      if (!beforeOuterSuccessful) {
        await takeScreenshot('before_create');
      }
      try {
        await deleteArtifactREST('deployments', deploymentREST1, false, false, true);
        await deleteArtifactREST('hardware', hardwareREST1, false, false, true);
        await deleteArtifactREST('hardware', hardwareREST2, false, false, true);
        await deleteArtifactREST('productTypes', productTypeREST1, false, false, true);
        await deleteArtifactREST('productTypes', productTypeREST2, false, false, true);
        await deleteArtifactREST('productTypes', productTypeREST3, false, false, true);
        await deleteArtifactREST('productFlavours', productFlavourREST1, false, false, true);
        await deleteArtifactREST('teams', teamREST1, false, false, true);
        await deleteArtifactREST('teams', teamREST2, false, false, true);
        await deleteArtifactREST('areas', areaREST1, false, false, true);
        await deleteArtifactREST('areas', areaREST2, false, false, true);
        await deleteArtifactREST('programs', programREST1, false, false, true);
        await deleteArtifactREST('programs', programREST2, false, false, true);
        await deleteArtifactREST('labels', labelREST1, false, false, true);
        await deleteArtifactREST('labels', labelREST2, false, false, true);
      } catch (afterError) {
        await takeScreenshot('after_create');
        throw afterError;
      }
    });
  });

  describe('Edit', function () {
    this.timeout(300000);
    this.retries(MAX_RETRIES);
    var beforeOuterSuccessful = false;
    // Program Details
    var programName = 'A_Health_prog_Ed';
    // Label Details
    var labelName = 'A_HEALTH_LBL1_ED,A_HEALTH_LBL2_ED';
    var labelNameToDel = 'A_HEALTH_LBL1_ED';
    var labelNameToKeep = 'A_HEALTH_LBL2_ED';
    // Area Details
    var areaName = 'A_Health_area_Ed';
    var areaName2 = 'A_Health_area2_Ed';

    // Team Details
    var teamName = 'A_Health_team1_Ed';
    var teamName2 = 'A_Health_team2_Ed';
    var teamName3 = 'A_Health_team3_Ed';
    // Product-Flavour Details
    var productFlavourName1 = 'A_Health_prodFlav1_Ed';
    var productFlavourName2 = 'A_Health_prodFlav2_Ed';
    // Product-Type Details
    var productTypeName = 'A_Health_prodType1_Ed';
    var productTypeWithConfigName = 'A_Health_prodType2_Ed_wConf';

    var productConfig = [
      { name: 'cloudField', infrastructure: infraTypes.CLOUD },
      { name: 'physicalField', infrastructure: infraTypes.PHYSICAL }
    ];
    // Hardware Details
    var hardwareName1 = 'A_Health_HW1_Ed';
    var hardwareName2 = 'A_Health_HW2_Ed';
    var hardwareName3 = 'A_Health_HW3_Ed';
    var hardwareName4 = 'A_Health_HW4_Ed';

    // Deployment Details
    var deploymentName = 'A_Health_depl_Ed';
    var deploymentName2 = 'A_Health_depl2_Ed';
    var deploymentProduct = [
      {
        typeName: productTypeName,
        flavourName: productFlavourName1,
        hardware: [hardwareName1, hardwareName2],
        data: ['test', 'newData'],
        admins_only: false
      }
    ];

    // Role Details
    var roleName = 'A_Health_role_Ed';
    var rolePermissions = [];

    before(async function () {
      programREST1 = await createProgramREST(programName);
      areaREST1 = await createAreaREST(areaName, programREST1._id);
      teamREST1 = await createTeamREST(teamName, areaREST1._id);
      teamREST2 = await createTeamREST(teamName2, areaREST1._id);
      productFlavourREST1 = await createProductFlavourREST(productFlavourName1);
      productFlavourREST2 = await createProductFlavourREST(productFlavourName2);
      productTypeREST1 = await createProductTypeREST(productTypeName, [productFlavourName1]);
      productTypeREST2 = await createProductTypeREST(productTypeWithConfigName, [productFlavourName1], productConfig);
      hardwareREST1 = await createHardwareREST(hardwareName1, programREST1._id, 'deploymentId');
      hardwareREST2 = await createHardwareREST(hardwareName2, programREST1._id, 'deploymentId');
      roleREST1 = await createRoleREST(roleName, rolePermissions);
      beforeOuterSuccessful = true;
    });

    describe('Area', function () {
      var inidividualAreaName = 'A_Health_area1_Ed';
      var newAreaName = 'A_Health_area2_Ed';
      it('should edit Area and see it in Areas list @healthtest', async function () {
        await newAreaSetup(inidividualAreaName, programName);
        await editItem('areas', inidividualAreaName);
        await driver.findElement(By.name('name')).sendKeys(newAreaName);
        // Save and Confirm
        await clickSaveButton('Area update', null, true, 'Example Update Reason');
        await findTableItem('areas', newAreaName);
        // Delete
        await deleteItem('areas', newAreaName);
      });

      it('should not edit Area when no update reason provided @healthtest', async function () {
        await newAreaSetup(inidividualAreaName, programName);
        await editItem('areas', inidividualAreaName);
        await driver.findElement(By.name('name')).sendKeys(newAreaName);
        // Try to save
        await clickSaveButton(null, null, true);
        await driver.wait(until.elementLocated(By.xpath('//div[contains(.,"Area update error")]')), 5000);
        await driver.wait(until.elementLocated(By.xpath('//div[contains(.,"Must provide reason (10 chars min) for change.")]')), 5000);
        // Delete
        await deleteItem('areas', inidividualAreaName);
      });

      it('should not edit Area when invalid update reason provided @healthtest', async function () {
        await newAreaSetup(inidividualAreaName, programName);
        await editItem('areas', inidividualAreaName);
        await driver.findElement(By.name('name')).sendKeys(newAreaName);
        // Try to save
        await clickSaveButton(null, null, true, 'too short');
        await driver.wait(until.elementLocated(By.xpath('//div[contains(.,"Area update error")]')), 5000);
        await driver.wait(until.elementLocated(By.xpath('//div[contains(.,"Must provide reason (10 chars min) for change.")]')), 5000);
        // Delete
        await deleteItem('areas', inidividualAreaName);
      });
    });

    describe('Product-Type', function () {
      this.timeout(50000);
      // Product Type
      var individualTypeName = 'A_Health_prodType1_Ed_sngl';
      var newProdTypeName = 'renamed';
      // Deployment Details
      var deploymentName = 'A_Health_depl_EdProdTy';

      it('should edit Product-Type to change the name and add new Product-Flavour. Then see it in Product-Types list @healthtest', async function () {
        await newProductTypeSetup(individualTypeName, productFlavourName1);
        // Edit Product-Type
        await editItem('productTypes', individualTypeName);
        await driver.findElement(By.name('name')).sendKeys(newProdTypeName);
        await driver.findElement(By.css('[ng-class="classesBtn"]')).click();
        await driver.findElement(By.xpath(`//a[contains(.,"${productFlavourName2}")]`)).click();
        (await driver.findElement(By.xpath(`//a[contains(.,"${productFlavourName2}")]`)).isDisplayed()).should.equal(true);
        // Save and Confirm
        await driver.findElement(By.id('name')).click();
        await clickSaveButton('Product-Type update');
        (await driver.findElement(By.xpath(`//p[contains(.,"${newProdTypeName}")]`)).isDisplayed()).should.equal(true);
        (await driver.findElement(By.xpath(`//a[contains(.,"${productFlavourName1}")]`)).isDisplayed()).should.equal(true);
        (await driver.findElement(By.xpath(`//a[contains(.,"${productFlavourName2}")]`)).isDisplayed()).should.equal(true);
        // Product-Type List Page
        await findTableItem('productTypes', newProdTypeName);
        // Delete
        await deleteItem('productTypes', newProdTypeName);
      });

      it('should edit Product-Type to change configuration field name', async function () {
        await newProductTypeSetup(individualTypeName, productFlavourName1, productConfig);
        await editItem('productTypes', individualTypeName);
        // Edit Config Field Name
        await driver.findElement(By.name('productType.mandatoryConfigKeys[0].name')).sendKeys('Renamed');
        // Save and Confirm
        await clickSaveButton('Product-Type update');
        await driver.wait(until.elementLocated(By.xpath('//td[contains(.,"cloudFieldRenamed")]')), 5000);
        // Delete
        await deleteItem('productTypes', individualTypeName);
      });

      it('should edit Product-Type to add new configuration field', async function () {
        await newProductTypeSetup(individualTypeName, productFlavourName1, productConfig);
        await editItem('productTypes', individualTypeName);
        // Add Extra Config Fields
        await driver.wait(until.elementLocated(By.id('add-product-configuration')), 5000);
        await driver.findElement(By.id('add-product-configuration')).click();
        await driver.findElement(By.name('productType.mandatoryConfigKeys[2].name')).sendKeys('bothField');
        await clickAndSendKey('productType.mandatoryConfigKeys[2].infrastructure', 'Both');
        // Save and Confirm
        await clickSaveButton('Product-Type update');
        await driver.wait(until.elementLocated(By.xpath('//td[contains(.,"bothField")]')), 5000);
        // Delete
        await deleteItem('productTypes', individualTypeName);
      });

      it('should not be able to edit Product-Type that is attached to a Deployment', async function () {
        // Create Deployment with attached Product-Type
        var deploymentProducts = [{
          typeName: productTypeName,
          flavourName: productFlavourName1
        }];
        await newDeploymentSetup(deploymentName, programName, false, areaName, statusTypes.FREE, false, deploymentProducts);
        // Product-Type name field should NOT be editable
        await editItem('productTypes', productTypeName);
        (await driver.findElement(By.name('name')).getAttribute('disabled')).should.equal('true');
        // Delete
        await deleteItem('deployments', deploymentName);
      });
    });

    describe('Program', function () {
      it('should add JIRA Template to an existing Program', async function () {
        var individualProgramName = 'A_Health_prog_add_template';
        await newProgramSetup(individualProgramName);
        await addJiraTemplate();
        // Delete
        await deleteItem('programs', individualProgramName);
      });

      it('should edit JIRA Template of an existing Program', async function () {
        var individualProgramName = 'A_Health_prog_edit_template';
        await newProgramSetup(individualProgramName);
        await addJiraTemplate();
        await driver.wait(until.elementLocated(By.xpath('//*[@id="jiraTable"]/tbody/tr/td[7]/a[1]')), 5000);
        await driver.findElement(By.xpath('//*[@id="jiraTable"]/tbody/tr/td[7]/a[1]')).click();
        var infraType = 'Cloud';
        var jiraBoard = 'STSOSS';
        var project = 'Continuous Integration Services';
        var customFieldNames = ['Custom Field 1', 'Custom Field 2', 'Custom Field 3'];
        var customFieldValues = ['Field Values 1', 'Field Values 2', 'Field Values 3'];
        var components = componentTypes.TEAAS;
        await clickAndSendKey('jiraTemplate.infrastructure', infraType);
        await clickAndSendKey('jiraTemplate.board', jiraBoard);
        await driver.findElement(By.id('jiraTemplate.issueType')).sendKeys('Test 1');
        await clickAndSendKey('jiraTemplate.project', project);
        if (components) {
          var multiSelect = await driver.findElement(By.id('components'), 5000);
          await driver.findElement(By.id('components')).click();
          await multiSelect.findElement(By.xpath("//*[@id='components']/div/ul/*/div/input[@type='text']")).sendKeys(components);
          await multiSelect.findElement(By.xpath(`//*[@id='components']/div/ul/*/a[contains(.,"${components}")]`)).click();
          await driver.findElement(By.id('components')).click();
        }
        await driver.findElement(By.id('vm.addCustomField')).click();
        await driver.wait(until.elementLocated(By.id('jiraTemplate.custom_fields[0].key_name')), 5000);
        await driver.findElement(By.id('jiraTemplate.custom_fields[0].key_name')).sendKeys(customFieldNames[0]);
        await driver.findElement(By.id('jiraTemplate.custom_fields[0].key_value')).sendKeys(customFieldValues[0]);
        await clickElement(By.id('vm.addCustomField'));
        await driver.wait(until.elementLocated(By.id('jiraTemplate.custom_fields[1].key_name')), 5000);
        await driver.findElement(By.id('jiraTemplate.custom_fields[1].key_name')).sendKeys(customFieldNames[1]);
        await driver.findElement(By.id('jiraTemplate.custom_fields[1].key_value')).sendKeys(customFieldValues[1]);
        await driver.findElement(By.xpath('//*[@id="jira-template-modal"]/div/div[2]/form/fieldset/div[3]/button')).click();
        await driver.wait(until.elementLocated(By.xpath('//div[contains(.,"update successful")]')), 5000);
        await driver.wait(until.elementLocated(By.id('edit-jiratemp-0')), 5000);
        await clickElement(By.id('edit-jiratemp-0'));
        await driver.wait(until.elementLocated(By.id('remove_custom_field[0]')), 5000);
        await clickElement(By.id('remove_custom_field[0]'), true);
        await driver.wait(until.elementLocated(By.xpath('//*[@id="jira-template-modal"]/div/div[2]/form/fieldset/div[3]/button')), 5000);
        await driver.findElement(By.xpath('//*[@id="jira-template-modal"]/div/div[2]/form/fieldset/div[3]/button')).click();
        await driver.wait(until.elementLocated(By.xpath('//div[contains(.,"update successful")]')), 5000);
        // Delete
        await deleteItem('programs', individualProgramName);
      });

      it('should delete JIRA Template from a Program', async function () {
        var individualProgramName = 'A_Health_prog_delete_template';
        await newProgramSetup(individualProgramName);
        await addJiraTemplate();
        await driver.sleep(1000);
        await driver.wait(until.elementLocated(By.xpath('//*[@id="jiraTable"]/tbody/tr')), 5000);
        await clickElement(By.xpath('//*[@id="jiraTable"]/tbody/tr/td[7]/a[2]'), true);
        await driver.wait(until.elementLocated(By.xpath('//div[contains(.,"deleted successful")]')), 5000);
        // Delete
        await deleteItem('programs', individualProgramName);
      });
    });

    describe('Hardware', function () {
      var inidividualHWName = 'A_Health_HW_Ed1';
      var newHWName = 'A_Health_HW_Ed2';

      it('should edit Hardware and see it in Hardware list @healthtest', async function () {
        await newHardwareSetup(inidividualHWName, programName, 'hwDeploymentId');
        await editItem('hardware', inidividualHWName);
        await driver.findElement(By.id('hardwareName')).sendKeys(newHWName);
        // Save and Confirm
        await clickSaveButton('Hardware update');
        (await driver.findElement(By.xpath(`//p[contains(.,"${newHWName}")]`)).isDisplayed()).should.equal(true);
        await findTableItem('hardware', newHWName);
        // Delete
        await deleteItem('hardware', newHWName);
      });
    });

    describe('Label', function () {
      var individualLabelName = 'A_HEALTH_LBL_ED';
      var newLabelName = 'A_HEALTH_LBL_ED2';

      it('should edit Label and see it in Label list @healthtest', async function () {
        await newLabelSetup(individualLabelName);
        await driver.sleep(500);
        await editItem('labels', individualLabelName);
        await driver.sleep(500);
        await driver.findElement(By.id('name')).sendKeys(newLabelName);
        // Save and Confirm
        await clickSaveButton('Label update');
        (await driver.findElement(By.xpath(`//p[contains(.,"${newLabelName}")]`)).isDisplayed()).should.equal(true);
        await findTableItem('labels', newLabelName);
        // // Delete
        await deleteItem('labels', newLabelName);
      });
    });

    describe('Team', function () {
      it('should edit Team with only admins and remove Secondary Admin', async function () {
        var newTeamName = 'A_Health_team_admOnly_edit';
        // Save and Confirm
        await newTeamSetup(newTeamName, areaName);
        await findTableItem('teams', newTeamName);
        await driver.sleep(500);
        await editItem('teams', newTeamName);
        await driver.sleep(500);
        await driver.findElement(By.xpath('/html/body/div[1]/section/section/section/ui-view/section/form/fieldset[5]/div[2]/span/span[1]/span/button')).click();
        // Save and Confirm
        await clickSaveButton('Team update');
        var found = await driver.findElement(By.xpath('//p[contains(.,"Secondary Admin")]')).then(function () {
          return true;
        }, function (err) {
          if (err instanceof webdriver.error.NoSuchElementError) {
            return false;
          }
        });
        found.should.equal(false);
        // Delete
        await deleteItem('teams', newTeamName);
      });
    });

    describe('Deployment', function () {
      var beforeSuccessful = false;
      // Deployment Details
      var deploymentName = 'A_Health_depl_Ed_name';
      // Product-Type Details
      var deplProdTypeName = 'A_Health_prodType_Ed_name';

      before(async function () {
        // Create Product-Types
        await newProductTypeSetup(deplProdTypeName, productFlavourName1);
        beforeSuccessful = true;
      });

      it('should edit Deployment to add and remove Products and JIRA Issues @healthtest', async function () {
        // Create New Deployment
        await newDeploymentSetup(deploymentName, programName, false, areaName, statusTypes.IN_REVIEW, false, [], teamName, deploymentPurpose);
        // Edit Deployment
        await editItem('deployments', deploymentName);
        // Add JIRA 1
        await clickElement(By.id('add-jira'));
        await driver.findElement(By.name('jira_issues[0]')).sendKeys('CIP-29934');
        await driver.findElement(By.xpath('//body')).click();
        await driver.wait(until.elementLocated(By.className('ui-notification')), 5000);
        (await driver.findElement(By.xpath('//div[contains(.,"JIRA Issue: CIP-29934 is valid")]')).isDisplayed()).should.equal(true);
        // Add JIRA 2
        await clickElement(By.id('add-jira'));
        await driver.findElement(By.name('jira_issues[1]')).sendKeys('CIP-29795');
        await driver.findElement(By.xpath('//body')).click();
        await driver.wait(until.elementLocated(By.xpath('//div[contains(.,"JIRA Issue: CIP-29795 is valid")]')), 5000);
        (await driver.findElement(By.xpath('//div[contains(.,"JIRA Issue: CIP-29795 is valid")]')).isDisplayed()).should.equal(true);
        // Add Product 1
        await addNewProduct(0, deplProdTypeName, productFlavourName1, infraTypes.PHYSICAL, true, productNotes, [], ['test', 'newData']);
        // Add Product 2
        await addNewProduct(1, productTypeName, productFlavourName1);
        // Save and Confirm
        await clickSaveButton('Deployment update');
        (await driver.findElement(By.xpath(`//p[contains(.,"${teamName}")]`)).isDisplayed()).should.equal(true);
        (await driver.findElement(By.xpath(`//p[contains(.,"${deploymentPurpose}")]`)).isDisplayed()).should.equal(true);
        (await driver.findElement(By.xpath(`//td[contains(.,"${deplProdTypeName}")]`)).isDisplayed()).should.equal(true);
        (await driver.findElement(By.xpath(`//td[contains(.,"${productFlavourName1}")]`)).isDisplayed()).should.equal(true);
        (await driver.findElement(By.xpath('//td[contains(.,"CIP-29934")]')).isDisplayed()).should.equal(true);
        (await driver.findElement(By.xpath('//td[contains(.,"CIP-29795")]')).isDisplayed()).should.equal(true);
        (await driver.findElement(By.xpath('//td[contains(.,"test")]')).isDisplayed()).should.equal(true);
        (await driver.findElement(By.xpath('//td[contains(.,"newData")]')).isDisplayed()).should.equal(true);
        (await driver.findElement(By.xpath(`//td[contains(.,"${productNotes}")]`)).isDisplayed()).should.equal(true);
        // Edit Deployment
        await editItem('deployments', deploymentName);
        // Remove JIRA Issue
        await clickElement(By.id('remove-jira[0]'));
        alertElement = await driver.switchTo().alert().getText();
        alertElement.should.containEql('Are you sure you want to remove this JIRA Issue 1: "CIP-29934"?');
        await driver.switchTo().alert().accept();
        await driver.wait(until.elementLocated(By.xpath('//button[contains(.,"Save")]')), 5000);
        // Remove Product
        await clickElement(By.id('remove-product[0]'));
        alertElement = await driver.switchTo().alert().getText();
        alertElement.should.containEql('Are you sure you want to delete this Product?');
        await driver.switchTo().alert().accept();
        await driver.wait(until.elementLocated(By.xpath('//button[contains(.,"Save")]')), 5000);
        // Save and Confirm
        await clickSaveButton('Deployment update');
        (await driver.findElement(By.xpath(`//p[contains(.,"${teamName}")]`)).isDisplayed()).should.equal(true);
        (await driver.findElement(By.xpath(`//p[contains(.,"${deploymentPurpose}")]`)).isDisplayed()).should.equal(true);
        (await driver.findElement(By.xpath(`//td[contains(.,"${productFlavourName1}")]`)).isDisplayed()).should.equal(true);
        (await driver.findElement(By.xpath('//td[contains(.,"CIP-29795")]')).isDisplayed()).should.equal(true);
        (await driver.findElements(By.xpath('//td[contains(.,"CIP-29934")]'))).length.should.equal(0);
        (await driver.findElements(By.xpath('//td[contains(.,"test")]'))).length.should.equal(0);
        (await driver.findElements(By.xpath('//td[contains(.,"newData")]'))).length.should.equal(0);
        (await driver.findElements(By.xpath(`//td[contains(.,"${productNotes}")]`))).length.should.equal(0);
        // Delete
        await deleteItem('deployments', deploymentName);
      });

      it('should edit Deployment and remove one label and check the other one is still there', async function () {
        // Create New Deployment
        await newDeploymentSetup(deploymentName, programName, labelName, areaName);
        // Edit Deployment
        await editItem('deployments', deploymentName);
        await driver.findElement(By.css('[ng-class="classesBtn"]')).click();
        await driver.findElement(By.xpath(`//a[contains(.,"${labelNameToDel}")]`)).click();
        // Save and Confirm
        await driver.findElement(By.css('[ng-class="classesBtn"]')).click();
        await clickSaveButton('Deployment update');
        (await driver.findElement(By.name('dependent-labels')).getAttribute('innerHTML')).includes(labelNameToKeep).should.equal(true);
        (await driver.findElement(By.name('dependent-labels')).getAttribute('innerHTML')).includes(labelNameToDel).should.equal(false);
        // Delete
        await deleteItem('deployments', deploymentName);
      });

      it('should edit Deployment with Product and hardware and save it then check that hardware is still in-use and have dependent Deployment', async function () {
        var hardwareName1 = 'A_Health_HW1_Name';
        await newHardwareSetup(hardwareName1, programName, 'deploymentId');
        var deploymentProducts = [
          {
            typeName: productTypeName,
            flavourName: productFlavourName1,
            hardware: [hardwareName1],
            data: ['test', 'newData'],
            admins_only: false
          }
        ];
        // Create and Confirm
        await newDeploymentSetup(
          deploymentName, programName, false, areaName, statusTypes.FREE,
          false, deploymentProducts, teamName, deploymentPurpose
        );
        await findTableItem('deployments', deploymentName);
        // Edit Deployment and Save
        await editItem('deployments', deploymentName);
        await clickElement(By.xpath('//button[contains(.,"Save")]'));
        // Check Hardware view
        await viewItem('hardware', hardwareName1);
        await driver.wait(until.elementLocated(By.name('dependent-deployment')), 5000);
        await validateValueByName('dependent-deployment', 'innerHTML', deploymentName);
        // Delete
        await deleteArtifactREST('deployments', null, deploymentName);
        await deleteArtifactREST('hardware', null, hardwareName1);
      });

      it('should be able to edit a Product through a Deployments View Page \'Edit Product\' button', async function () {
        // New Deployment
        var deploymentProducts = [{
          typeName: deplProdTypeName,
          flavourName: productFlavourName1,
          data: ['test', 'newData'],
          admins_only: false
        }];
        await newDeploymentSetup(deploymentName, programName, false, areaName, statusTypes.IN_REVIEW, false, deploymentProducts, teamName);
        // Edit Product
        var editButton = await driver.findElement(By.xpath(`//td[contains(.,"${deplProdTypeName}")]/../td[${getActionButtonColumn('deploymentProducts')}]/a[contains(.,"Edit")]`));
        await driver.executeScript('arguments[0].click()', editButton);
        await driver.wait(until.elementLocated(By.xpath('//h1[contains(.,"Editing")]')), 5000);
        // Edit Product-Type
        await select2DropdownSelect('products0-productType', productTypeName);
        // Edit Infrastructure
        await select2DropdownSelect('products0-infrastructure', infraTypes.PHYSICAL);
        // Save and Confirm
        await clickSaveButton('Deployment update');
        (await driver.findElements(By.xpath('//td[contains(.,"Cloud")]'))).length.should.equal(0);
        (await driver.findElement(By.xpath(`//td[contains(.,"${productTypeName}")]`)).isDisplayed()).should.equal(true);
        (await driver.findElement(By.xpath(`//td[contains(.,"${productFlavourName1}")]`)).isDisplayed()).should.equal(true);
        (await driver.findElement(By.xpath('//td[contains(.,"Physical")]')).isDisplayed()).should.equal(true);
        // Delete
        await deleteItem('deployments', deploymentName);
      });

      it('should be able to add a Product to a Deployment through the Product List-View pages \'Create new Product\' button', async function () {
        // New Deployment
        var deploymentProducts = [{
          typeName: deplProdTypeName,
          flavourName: productFlavourName1,
          data: ['test', 'newData'],
          admins_only: false
        }];
        await newDeploymentSetup(deploymentName, programName, false, areaName, statusTypes.IN_REVIEW, false, deploymentProducts, teamName);
        // Products List Page
        await openArtifactListView('products', 'open-product-modal-btn');

        // Click Create Product
        await clickElement(By.id('open-product-modal-btn'));
        await select2DropdownSelect('product-deployment-select', deploymentName);
        await driver.findElement(By.id('submit-product-create')).click();
        await driver.wait(until.elementLocated(By.xpath('//h1[contains(.,"Editing")]')), 5000);
        // Add Product 2
        await driver.wait(until.elementLocated(By.name('products1-productType')), 5000);
        // Add Product-Type
        await select2DropdownSelect('products1-productType', productTypeName);
        // Add Product-Flavour
        await select2DropdownSelect('products1-flavour_name', productFlavourName1);
        // Add Infrastructure
        await select2DropdownSelect('products1-infrastructure', infraTypes.PHYSICAL);
        // Save and Confirm
        await clickSaveButton('Deployment update');
        (await driver.findElement(By.xpath(`//p[contains(.,"${teamName}")]`)).isDisplayed()).should.equal(true);
        (await driver.findElement(By.xpath(`//td[contains(.,"${deplProdTypeName}")]`)).isDisplayed()).should.equal(true);
        (await driver.findElement(By.xpath(`//td[contains(.,"${productTypeName}")]`)).isDisplayed()).should.equal(true);
        (await driver.findElement(By.xpath(`//td[contains(.,"${productFlavourName1}")]`)).isDisplayed()).should.equal(true);
        (await driver.findElement(By.xpath('//td[contains(.,"Cloud")]')).isDisplayed()).should.equal(true);
        (await driver.findElement(By.xpath('//td[contains(.,"Physical")]')).isDisplayed()).should.equal(true);
        (await driver.findElement(By.xpath('//td[contains(.,"newData")]')).isDisplayed()).should.equal(true);
        (await driver.findElement(By.xpath('//td[contains(.,"test")]')).isDisplayed()).should.equal(true);
        // Delete
        await deleteItem('deployments', deploymentName);
      });

      it('should be able to edit a Deployments Product through its table-row \'Edit\' button on the Product List-View Page', async function () {
        // New Deployment
        var deploymentProducts = [{
          typeName: deplProdTypeName,
          flavourName: productFlavourName1,
          data: ['test', 'newData'],
          admins_only: false
        }];
        await newDeploymentSetup(deploymentName, programName, false, areaName, statusTypes.IN_REVIEW, false, deploymentProducts);
        // Products List Page -> Edit Product
        await editItem('products', deplProdTypeName);
        // Edit Product-Type
        await select2DropdownSelect('products0-productType', productTypeName);
        // Edit Infrastructure
        await select2DropdownSelect('products0-infrastructure', infraTypes.PHYSICAL);
        // Save and Confirm
        await clickSaveButton('Deployment update');
        (await driver.findElement(By.xpath(`//td[contains(.,"${productTypeName}")]`)).isDisplayed()).should.equal(true);
        (await driver.findElement(By.xpath(`//td[contains(.,"${productFlavourName1}")]`)).isDisplayed()).should.equal(true);
        (await driver.findElement(By.xpath('//td[contains(.,"Physical")]')).isDisplayed()).should.equal(true);
        // Delete
        await deleteItem('deployments', deploymentName);
      });

      it('product-type based configuration fields name should be disabled when editing a Deployment', async function () {
        var deplProductsWithConfig = [{
          typeName: productTypeWithConfigName,
          flavourName: productFlavourName1,
          infrastructure: infraTypes.PHYSICAL,
          admins_only: false
        }];
        await newDeploymentSetup(
          deploymentName, programName, false, areaName, statusTypes.FREE, false,
          deplProductsWithConfig, null, null, null, null, false
        );
        await driver.findElement(By.name('products[0].configuration[0].key_value')).sendKeys('123Physical');
        await clickElement(By.xpath('//button[contains(.,"Save")]'));
        // Edit Deployment With Configuration
        await editItem('deployments', deploymentName);
        (await driver.findElement(By.name('products[0].configuration[0].key_name')).getAttribute('disabled')).should.equal('true');
        // Delete
        await deleteItem('deployments', deploymentName);
      });

      afterEach(async function () {
        try {
          if (this.currentTest.state === 'failed') {
            await deleteArtifactREST('deployments', null, deploymentName, false, true);
          }
        } catch (afterEachError) {
          await takeScreenshot('after_each_deployment_edit');
          throw afterEachError;
        }
      });

      after(async function () {
        if (!beforeSuccessful) {
          await takeScreenshot('before_deployment_edit');
        }
        try {
          await deleteArtifactREST('productTypes', null, deplProdTypeName, false, true);
          await deleteArtifactREST('labels', null, labelName, false, true);
          await deleteArtifactREST('labels', null, labelNameToDel, false, true);
          await deleteArtifactREST('labels', null, labelNameToKeep, false, true);
        } catch (afterError) {
          await takeScreenshot('after_deployment_edit');
          throw afterError;
        }
      });
    });

    describe('Booking', function () {
      this.timeout(100000);
      var progRaEditName = 'A_Health_Program_RA_Edit_Booking';
      var deploymentCustomTeam = 'A_Health_deployments_customTeam_edit';
      var editBookingStartTime = addDaysAndGenerateDatePickerString(1);
      var editBookingSharedTime = addDaysAndGenerateDatePickerString(2);
      var editBookingEndTime = addDaysAndGenerateDatePickerString(3);

      before(async function () {
        programREST2 = await createProgramREST(progRaEditName);
        areaREST2 = await createAreaREST(progRaEditName, programREST2._id);
        deploymentREST1 = await createDeploymentREST(
          deploymentCustomTeam, programREST2._id, areaREST2._id, statusTypes.FREE,
          [], true
        );
        await newDeploymentSetup(
          deploymentName, programName, false, areaName, statusTypes.FREE,
          false, deploymentProduct, teamName, deploymentPurpose
        );
      });

      it('should not be able to edit Booking Deployment And Deployment-Product if Booking is Shareable', async function () {
        await newBookingSetup(
          deploymentName, productTypeName, teamName, editBookingStartTime, editBookingEndTime, true, 'Initial Install', 'Smoke Test',
          true, undefined, 'ENM:20.08', 'LATEST GREEN', 'CIP-33636', 'None'
        );
        await viewItem('bookings', deploymentName, 1, areaName);
        (await driver.findElement(By.name('deployment-select')).getAttribute('disabled')).should.equal('true');
        (await driver.findElement(By.name('bookingProduct-select')).getAttribute('disabled')).should.equal('true');
        // Delete
        await deleteItem('bookings', deploymentName, 1, true, areaName);
      });

      it('should be able to edit Booking if it has not started yet', async function () {
        await newBookingSetup(
          deploymentName, productTypeName, teamName, editBookingStartTime, editBookingEndTime, true, 'Initial Install', 'Smoke Test',
          true, undefined, 'ENM:20.08', 'LATEST GREEN', 'CIP-33636', 'None'
        );
        // Update
        await viewItem('bookings', deploymentName, 1, areaName);
        await driver.sleep(1000);
        await select2DropdownSelect('testingType-select', 'Upgrade');
        await clickAndSendKey('booking-description', 'Updated Description');
        // Save
        await clickElement(By.id('save-booking-button'));
        await driver.sleep(1000);
        // Verify Update
        await viewItem('bookings', deploymentName, 1, areaName);
        await validateValueByName('testingType-select', 'innerHTML', 'Upgrade');
        await validateValueByName('booking-description', 'value', 'Updated Description');
        // Delete
        await deleteItem('bookings', deploymentName, 1, true, areaName);
      });

      it('should be able to edit Booking through weekly view calendar', async function () {
        await newBookingSetup(
          deploymentName, productTypeName, teamName, editBookingStartTime, editBookingStartTime, true, 'Initial Install', 'Smoke Test',
          true, undefined, 'ENM:20.08', 'LATEST GREEN', 'CIP-33636', 'None'
        );

        // Update
        await viewWeeklyCalendarBooking(areaName, deploymentName, editBookingStartTime);
        await driver.sleep(1000);
        await select2DropdownSelect('testingType-select', 'Upgrade');
        await clickAndSendKey('booking-description', 'Updated Description');
        // Save
        await clickElement(By.id('save-booking-button'));
        await driver.sleep(1000);
        // Verify Update
        await viewItem('bookings', deploymentName, 1, areaName);
        await validateValueByName('testingType-select', 'innerHTML', 'Upgrade');
        await validateValueByName('booking-description', 'value', 'Updated Description');
        // Delete
        await deleteItem('bookings', deploymentName, 1, true, areaName);
      });

      it('should be able to update Sharing Booking fields when Shareable Booking is updated', async function () {
        // Shareable Booking
        await newBookingSetup(
          deploymentName, productTypeName, teamName, editBookingStartTime, editBookingEndTime, true, 'Initial Install', 'Shareable Description',
          true, undefined, 'ENM:20.08', 'LATEST GREEN', 'CIP-33636', 'None'
        );
        // Sharing Booking
        await newBookingSetup(
          deploymentName, productTypeName, teamName2, editBookingSharedTime, editBookingSharedTime, true, 'Initial Install', 'Sharing Description',
          true, undefined, 'ENM:20.08', 'LATEST GREEN', 'CIP-33636', 'None'
        );
        // Update Shareable
        await viewItem('bookings', teamName, 8, areaName);
        await driver.sleep(1000);
        await select2DropdownSelect('testingType-select', 'Upgrade');
        await clickAndSendKey('booking-description', 'Shareable Updated');
        // Save
        await clickElement(By.id('save-booking-button'));
        await driver.sleep(1000);
        // Verify Sharing Booking Fields
        await viewItem('bookings', teamName2, 8, areaName);
        await validateValueByName('testingType-select', 'innerHTML', 'Upgrade');
        await validateValueByName('booking-description', 'value', 'Sharing');
        // Delete
        await deleteItem('bookings', teamName2, 8, true, areaName);
        await deleteItem('bookings', teamName, 8, true, areaName);
        await deleteItem('deployments', deploymentName);
      });

      it('should not be able to edit Booking after Deployment status is changed to \'In Review\' or \'Blocked/In Maintenance\'', async function () {
        var deploymentNameForStatus = 'A_Health_depl_status';
        await newDeploymentSetup(deploymentNameForStatus, programName, false, areaName, statusTypes.FREE);
        await newBookingSetup(
          deploymentNameForStatus, undefined, teamName, editBookingStartTime, editBookingEndTime, false, 'Initial Install', 'Smoke Test',
          true, undefined, 'ENM:20.08', 'LATEST GREEN', 'CIP-33636', 'None'
        );
        // Edit the Booking
        await viewItem('bookings', deploymentNameForStatus, 1, areaName);
        await clickAndSendKey('booking-description', 'Updated');
        await clickElement(By.id('save-booking-button'));
        await driver.sleep(1000);
        // Verify the edit
        await viewItem('bookings', deploymentNameForStatus, 1, areaName);
        await validateValueByName('booking-description', 'value', 'Updated');
        // Change Deployment status to 'Blocked/In Maintenance'
        await editItem('deployments', deploymentNameForStatus);
        await select2DropdownSelect('status-select', statusTypes.BLOCKED_IN_MAINTENANCE);
        await clickSaveButton();
        // Try to edit Booking again
        await viewItem('bookings', deploymentNameForStatus, 1, areaName);
        await validateValueByName('deploymentMessages', 'innerHTML', 'NOTE: Booking cannot be updated, whilst Deployment');
        // Update button disabled
        (await driver.findElement(By.xpath('//button[contains(.,"Update")]')).getAttribute('disabled')).should.equal('true');
        await deleteItem('bookings', deploymentNameForStatus, 1, true, areaName);
        await deleteItem('deployments', deploymentNameForStatus);
      });

      it('Team/CustomTeam button should be disabled when editing a Booking', async function () {
        await newBookingSetup(deploymentCustomTeam, undefined, 'customTeamName', editBookingStartTime, editBookingEndTime, false, 'Not Applicable', 'Smoke Test');
        // Verify Booking
        await viewItem('bookings', deploymentCustomTeam, 1, progRaEditName, progRaEditName);
        await validateValueByName('deployment-select', 'innerHTML', deploymentCustomTeam);
        await validateValueByName('team-select', 'innerHTML', teamName);
        await validateValueByName('booking-description', 'value', 'Smoke Test');
        // Verify Team/CustomTeam Field is disabled
        await validateValueByName('customTeamToggle', 'disabled', 'true');
        // Delete
        await deleteItem('bookings', deploymentCustomTeam, 1, true, progRaEditName, progRaEditName);
      });

      it('should edit booking using a custom template', async function () {
        var individualProgramName = 'A_Health_prog_edit_booking_template';
        var deploymentProducts = [
          {
            typeName: productTypeName,
            flavourName: productFlavourName1,
            infrastructure: 'Physical',
            hardware: [hardwareName3, hardwareName4],
            data: ['test', 'newData'],
            admins_only: false
          },
          {
            typeName: productTypeName,
            flavourName: productFlavourName1,
            admins_only: false
          }
        ];
        programREST3 = await createProgramREST(individualProgramName);
        areaREST3 = await createAreaREST(areaName2, programREST3._id);
        teamREST3 = await createTeamREST(teamName3, areaREST3._id);
        hardwareREST3 = await createHardwareREST(hardwareName3, programREST3._id, 'deploymentId');
        hardwareREST4 = await createHardwareREST(hardwareName4, programREST3._id, 'deploymentId');
        var bookingStartTime1 = addDaysAndGenerateDatePickerString(3);
        var bookingEndTime1 = addDaysAndGenerateDatePickerString(6);
        // Set up new Deployment
        await newDeploymentSetup(
          deploymentName2, individualProgramName, false, areaName2, statusTypes.FREE, false, deploymentProducts,
          teamName3, deploymentPurpose, false, false, true, false, true
        );

        // Create a New Booking without JIRA Template
        await newBookingSetup(
          deploymentName2, productTypeName, teamName3, bookingStartTime1, bookingEndTime1, false, 'Initial Install', 'Smoke Test',
          true, 'jobTypeUG', 'ENM:20.08', 'LATEST GREEN', false, 'None'
        );

        // Reset RA selection
        await openArtifactListView('bookings');
        await driver.wait(until.elementLocated(By.className('select2-selection__clear')), 3000).click();

        // Verify Booking
        await viewItem('bookings', deploymentName2, 1, areaName2);
        await validateValueByName('deployment-select', 'innerHTML', deploymentName2);
        await validateValueByName('team-select', 'value', teamREST3._id);
        await validateValueByName('booking-description', 'value', 'Smoke Test');

        await openArtifactListView('programs');
        await viewItem('programs', individualProgramName);
        await addJiraTemplate();

        // Reset RA selection
        await openArtifactListView('bookings');
        await driver.wait(until.elementLocated(By.className('select2-selection__clear')), 3000).click();

        await viewItem('bookings', deploymentName2, 1, areaName2);
        await driver.findElement(By.name('template-select')).sendKeys('JIRA Board: CI_Framework | Project: CIS | Issue Type: Task');

        // Delete
        await deleteItem('bookings', deploymentName2, 1, true, areaName2);
        await deleteItem('deployments', deploymentName2);
        await deleteItem('teams', teamName3);
        await deleteItem('areas', areaName2);
        await deleteItem('hardware', hardwareName3);
        await deleteItem('hardware', hardwareName4);
        await deleteItem('programs', individualProgramName);
      });
    });

    describe('User', function () {
      it('should edit User and add admin role to users role list', async function () {
        // Edit user page
        await openArtifactEditView('users', '5f06e8fac1b12b6564bd0f7e');
        // Add admin role
        await addRoleToUserRoleList('admin');
        await clickSaveButton();

        await driver.wait(until.elementLocated(By.xpath('//h1[contains(.,"Viewing User")]')), 5000);
        (await driver.findElement(By.xpath('//div[contains(.,"User update successful")]')).isDisplayed()).should.equal(true);
        // Verify role is present
        await driver.wait(until.elementLocated(By.xpath('//div[@class="form-group" and label[contains(text(), "Role")]]//p[contains(.,"admin")]')), 5000);
      });

      it('should edit User and remove admin role from users role list', async function () {
        // Edit user page
        await openArtifactEditView('users', '5d4a859d046eb841751053d1');
        // Add admin role
        await addRoleToUserRoleList('admin');
        await clickSaveButton();

        await driver.wait(until.elementLocated(By.xpath('//h1[contains(.,"Viewing User")]')), 5000);
        (await driver.findElement(By.xpath('//div[contains(.,"User update successful")]')).isDisplayed()).should.equal(true);
        // Verify role is present
        await driver.wait(until.elementLocated(By.xpath('//div[@class="form-group" and label[contains(text(), "Role")]]//p[contains(.,"user")]')), 5000);
        // TODO: Check for element admin element not existing
      });

      it('should edit user and add special permission', async function () {
        // Edit user page
        await openArtifactEditView('users', '5f241b211ead7daab53c3126');
        // Add permission
        await addPermission({
          resources: '/newAccessPoint',
          resourceMethodIds: ['all-resource-view-page', 'all-resource-put', 'all-resource-delete']
        }, 0);
        await clickSaveButton();

        await driver.wait(until.elementLocated(By.xpath('//h1[contains(.,"Viewing User")]')), 5000);
        (await driver.findElement(By.xpath('//div[contains(.,"User update successful")]')).isDisplayed()).should.equal(true);
        // Verify special permission is present
        await driver.wait(until.elementLocated(By.xpath('//p[contains(@class, "form-control-static") '
          + 'and contains(string(), "/newAccessPoint") and contains(string(), "view-page put delete") '
          + 'and not(contains(string(), "post"))]')), 5000);
      });

      it('should edit user and remove special permission', async function () {
        // Edit user page
        await openArtifactEditView('users', '5f06e8fac1b12b6564bd0f7e');
        // Remove special permission
        await removePermissionAtIndex('/accessPermPath', 0);
        await clickSaveButton();

        await driver.wait(until.elementLocated(By.xpath('//h1[contains(.,"Viewing User")]')), 5000);
        (await driver.findElement(By.xpath('//div[contains(.,"User update successful")]')).isDisplayed()).should.equal(true);
        // Verify speciall permission is gone
        await driver.wait(until.elementLocated(By.xpath('//div[contains(@class, "col-border-padding") '
          + 'and contains(string(), "Special Permissions") and contains(string(), "None")]')), 5000);
      });
    });

    describe('Role', function () {
      it('should edit role and add path permission', async function () {
        // View roles page
        await openArtifactListView('roles');
        // Edit role
        await editItem('roles', 'A_Health_role_Ed');

        await addPermission({
          resources: '/newAccessPoint',
          resourceMethodIds: ['all-resource-view-page', 'all-resource-put', 'all-resource-delete']
        }, 0);

        await clickSaveButton();

        await driver.wait(until.elementLocated(By.xpath('//h1[contains(.,"Viewing Role")]')), 5000);
        (await driver.findElement(By.xpath('//div[contains(.,"Role update successful")]')).isDisplayed()).should.equal(true);
        // Verify special is present
        await driver.wait(until.elementLocated(By.xpath('//p[contains(@class, "form-control-static") '
          + 'and contains(string(), "/newAccessPoint") and contains(string(), "view-page put delete") '
          + 'and not(contains(string(), "post"))]')), 5000);
      });
    });

    after(async function () {
      if (!beforeOuterSuccessful) {
        await takeScreenshot('before_edit');
      }
      try {
        await deleteArtifactREST('deployments', null, deploymentName, false, true);
        await deleteArtifactREST('deployments', deploymentREST1, false, false, true);
        await deleteArtifactREST('hardware', hardwareREST1, false, false, true);
        await deleteArtifactREST('hardware', hardwareREST2, false, false, true);
        await deleteArtifactREST('productTypes', productTypeREST1, false, false, true);
        await deleteArtifactREST('productTypes', productTypeREST2, false, false, true);
        await deleteArtifactREST('productFlavours', productFlavourREST1, false, false, true);
        await deleteArtifactREST('productFlavours', productFlavourREST2, false, false, true);
        await deleteArtifactREST('teams', teamREST1, false, false, true);
        await deleteArtifactREST('teams', teamREST2, false, false, true);
        await deleteArtifactREST('areas', areaREST1, false, false, true);
        await deleteArtifactREST('areas', areaREST2, false, false, true);
        await deleteArtifactREST('programs', programREST1, false, false, true);
        await deleteArtifactREST('programs', programREST2, false, false, true);
        await deleteArtifactREST('labels', labelREST1, false, false, true);
        await deleteArtifactREST('roles', roleREST1, false, false, true);
      } catch (afterError) {
        await takeScreenshot('after_edit');
        throw afterError;
      }
    });
  });

  describe('Restore', function () {
    this.timeout(100000);
    this.retries(MAX_RETRIES);
    var programName = 'Restore-Program';
    var areaName = 'Restore-Area';
    var productFlavourName = 'Restore-ProdFlav';
    var deploymentName = 'Restore-Deployment';
    var productTypeName = 'Restore-ProductType';
    var teamName = 'Restore-Team';

    it('should restore a Team to a previous version', async function () {
      // Prep
      programREST1 = await createProgramREST(programName);
      areaREST1 = await createAreaREST(areaName, programREST1._id);
      teamREST1 = await createTeamREST(teamName, areaREST1._id);
      // Modify
      await editItem('teams', teamName);
      // Add Users
      await driver.findElement(By.id('signum')).sendKeys('eednuts');
      await driver.findElement(By.css('[ng-click="vm.addUser()"]')).click();
      await driver.findElement(By.xpath('//td[contains(.,"Stephen Dunne D")]'));
      // Save
      await clickSaveButton('Team update');
      // Verify update
      (await driver.findElement(By.xpath('//p[contains(.,"Stephen Dunne D")]')).isDisplayed()).should.equal(true);
      // Restore original
      await restoreLogArtifact('teams', teamName);
      // Verify restore
      (await driver.findElements(By.xpath('//p[contains(.,"Stephen Dunne D")]'))).length.should.equal(0);
    });

    it('should restore a deleted Team', async function () {
      // Prep
      programREST1 = await createProgramREST(programName);
      areaREST1 = await createAreaREST(areaName, programREST1._id);
      teamREST1 = await createTeamREST(teamName, areaREST1._id);
      // Delete
      await deleteArtifactREST('teams', teamREST1);
      // Restore
      await restoreLogArtifact('teams', teamName, true);
      // Verify restore
      await driver.findElement(By.xpath(`//h1[contains(.,"Viewing Team '${teamName}'")]`));
      (await driver.findElements(By.xpath('//p[contains(.,"Stephen Dunne D")]'))).length.should.equal(0);
    });

    it('should restore a Deployment to a previous version', async function () {
      // Prep
      programREST1 = await createProgramREST(programName);
      areaREST1 = await createAreaREST(areaName, programREST1._id);
      teamREST1 = await createTeamREST(teamName, areaREST1._id);
      productFlavourREST1 = await createProductFlavourREST(productFlavourName);
      productTypeREST1 = await createProductTypeREST(productTypeName, [productFlavourName]);
      deploymentREST1 = await createDeploymentREST(deploymentName, programREST1._id, areaREST1._id, statusTypes.FREE);
      // Modify
      await editItem('deployments', deploymentName);
      await driver.wait(until.elementLocated(By.name('status-select')), 30000);
      await driver.wait(until.elementLocated(By.id('select2-status-select-container')), 5000);
      await driver.findElement(By.id('select2-status-select-container')).click();
      await driver.wait(until.elementLocated(By.className('select2-search__field')), 5000);
      await driver.findElement(By.className('select2-search__field')).sendKeys(statusTypes.IN_REVIEW + webdriver.Key.ENTER);
      // Save
      await clickSaveButton('Deployment update');
      // Verify updated
      (await driver.findElement(By.xpath(`//p[contains(.,"${statusTypes.IN_REVIEW}")]`)).isDisplayed()).should.equal(true);
      // Restore original
      await restoreLogArtifact('deployments', deploymentName);
      // Verify restore
      (await driver.findElement(By.xpath(`//p[contains(.,"${statusTypes.FREE}")]`)).isDisplayed()).should.equal(true);
    });

    it('should restore a deleted Deployment', async function () {
      // Prep
      programREST1 = await createProgramREST(programName);
      areaREST1 = await createAreaREST(areaName, programREST1._id);
      teamREST1 = await createTeamREST(teamName, areaREST1._id);
      productFlavourREST1 = await createProductFlavourREST(productFlavourName);
      productTypeREST1 = await createProductTypeREST(productTypeName, [productFlavourName]);
      deploymentREST1 = await createDeploymentREST(deploymentName, programREST1._id, areaREST1._id, statusTypes.FREE);
      // Delete
      await deleteArtifactREST('deployments', deploymentREST1);
      // Restore
      await restoreLogArtifact('deployments', deploymentName, true);
      // Verify restore
      (await driver.findElement(By.xpath(`//a[contains(.,"${programName}")]`)).isDisplayed()).should.equal(true);
      (await driver.findElement(By.xpath(`//a[contains(.,"${areaName}")]`)).isDisplayed()).should.equal(true);
    });

    it('should restore a deleted Product-Type', async function () {
      // Prep
      productFlavourREST1 = await createProductFlavourREST(productFlavourName);
      productTypeREST1 = await createProductTypeREST(productTypeName, [productFlavourName]);
      // Delete
      await deleteArtifactREST('productTypes', productTypeREST1);
      // Restore
      await restoreLogArtifact('productTypes', productTypeName, true);
      // Verify restore
      (await driver.findElement(By.xpath(`//p[contains(.,"${productTypeName}")]`)).isDisplayed()).should.equal(true);
    });

    it('should restore a deleted Product-Flavour', async function () {
      // Prep
      productFlavourREST1 = await createProductFlavourREST(productFlavourName);
      // Delete
      await deleteArtifactREST('productFlavours', productFlavourREST1);
      // Restore
      await restoreLogArtifact('productFlavours', productFlavourName, true);
      // Verify restore
      (await driver.findElement(By.xpath(`//p[contains(.,"${productFlavourName}")]`)).isDisplayed()).should.equal(true);
    });

    it('should restore a deleted Program', async function () {
      // Prep
      programREST1 = await createProgramREST(programName);
      // Delete
      await deleteArtifactREST('programs', programREST1);
      // Restore
      await restoreLogArtifact('programs', programName, true);
      // Verify restore
      (await driver.findElement(By.xpath(`//p[contains(.,"${programName}")]`)).isDisplayed()).should.equal(true);
    });

    it('should restore a deleted Area', async function () {
      // Prep
      programREST1 = await createProgramREST(programName);
      areaREST1 = await createAreaREST(areaName, programREST1._id);
      // Delete
      await deleteArtifactREST('areas', areaREST1);
      // Restore
      await restoreLogArtifact('areas', areaName, true);
      // Verify restore
      (await driver.findElement(By.xpath(`//p[contains(.,"${areaName}")]`)).isDisplayed()).should.equal(true);
    });

    afterEach(async function () {
      await deleteArtifactREST('deployments', null, deploymentName, true, true);
      await deleteArtifactREST('productTypes', null, productTypeName, true, true);
      await deleteArtifactREST('productFlavours', null, productFlavourName, true, true);
      await deleteArtifactREST('teams', null, teamName, true, true);
      await deleteArtifactREST('areas', null, areaName, true, true);
      await deleteArtifactREST('programs', null, programName, true, true);
    });
  });

  describe('Delete', function () {
    this.timeout(100000);
    this.retries(MAX_RETRIES);
    // Program Details
    var programName = 'A_Health_prog_Del';
    // Area Details
    var areaName = 'A_Health_area_Del';
    // Label Details
    var labelName = 'A_HEALTH_LBL_DEL';
    // Deployment Details
    var deploymentName = 'A_Health_depl_Del';
    // Product-Flavour Details
    var productFlavourName = 'A_Health_prodFlav_Del';
    // Product-Type Details
    var productTypeName = 'A_Health_prodType_Del';
    // Team Details
    var teamName = 'A_Health_team1_Del';
    var teamName2 = 'A_Health_team2_Del';
    // Role Details
    var roleName = 'A_Health_role_Ed';

    describe('Without Dependant Artifacts', function () {
      var beforeSuccessful = false;
      before(async function () {
        programREST1 = await createProgramREST(programName);
        areaREST1 = await createAreaREST(areaName, programREST1._id);
        teamREST1 = await createTeamREST(teamName, areaREST1._id);
        teamREST2 = await createTeamREST(teamName2, areaREST1._id);
        labelREST1 = await createLabelREST(labelName);
        productFlavourREST1 = await createProductFlavourREST(productFlavourName);
        productTypeREST1 = await createProductTypeREST(productTypeName, [productFlavourName]);
        roleREST1 = await createRoleREST(roleName, []);
        beforeSuccessful = true;
      });

      it('should delete Deployment @healthtest', async function () {
        // Create Deployment
        var deploymentProducts = [{
          product_type_name: productTypeName,
          flavour_name: productFlavourName,
          infrastructure: infraTypes.CLOUD,
          admins_only: false
        }];
        deploymentREST1 = await createDeploymentREST(
          deploymentName, programREST1._id, areaREST1._id, statusTypes.FREE,
          deploymentProducts, false, teamREST1._id, [labelREST1._id]
        );
        await deleteItem('deployments', deploymentName);
      });

      it('should delete Product-Type @healthtest', async function () {
        await deleteItem('productTypes', productTypeName);
      });

      it('should delete Product-Flavour @healthtest', async function () {
        await deleteItem('productFlavours', productFlavourName);
      });

      it('should delete Team @healthtest', async function () {
        await deleteItem('teams', teamName2);
        await deleteItem('teams', teamName);
      });

      it('should delete Area @healthtest', async function () {
        await deleteItem('areas', areaName);
      });

      it('should delete Program @healthtest', async function () {
        await deleteItem('programs', programName);
      });

      it('should delete Label @healthtest', async function () {
        await deleteItem('labels', labelName);
      });

      it('should delete Role @healthtest', async function () {
        await deleteItem('roles', roleName);
      });

      after(async function () {
        if (!beforeSuccessful) {
          await takeScreenshot('before_delete_no_dependants');
        }
      });
    });

    describe('With Dependant Artifact(s)', function () {
      var beforeSuccessful = false;
      before(async function () {
        programREST1 = await createProgramREST(programName);
        areaREST1 = await createAreaREST(areaName, programREST1._id);
        labelREST1 = await createLabelREST(labelName);
        teamREST1 = await createTeamREST(teamName, areaREST1._id);
        productFlavourREST1 = await createProductFlavourREST(productFlavourName);
        productTypeREST1 = await createProductTypeREST(productTypeName, [productFlavourName]);
        beforeSuccessful = true;
      });

      it('should not delete Product-Flavour attached to a Product-Type', async function () {
        await deleteItem('productFlavours', productFlavourName, 1, false);
      });

      it('should not delete Area attached to a Team', async function () {
        await deleteItem('areas', areaName, 1, false);
      });

      it('should not delete Program attached to an Area', async function () {
        await deleteItem('programs', programName, 1, false);
      });

      describe('With Deployment', function () {
        var beforeInnerSuccessful = false;
        before(async function () {
          teamREST2 = await createTeamREST(teamName2, areaREST1._id);
          // Create Deployment
          var deploymentProducts = [{
            product_type_name: productTypeName,
            flavour_name: productFlavourName,
            infrastructure: infraTypes.CLOUD,
            admins_only: false
          }];
          deploymentREST1 = await createDeploymentREST(
            deploymentName, programREST1._id, areaREST1._id, statusTypes.FREE,
            deploymentProducts, false, teamREST1._id, [labelREST1._id]
          );
          beforeInnerSuccessful = true;
        });

        it('should not delete Deployment when its used in a Booking', async function () {
          await newBookingSetup(
            deploymentName, productTypeName, teamName, bookingStartTime, bookingEndTime, false, 'Initial Install', 'Smoke Test',
            true, undefined, 'ENM:20.08', 'LATEST GREEN', 'CIP-33636', 'None'
          );
          await deleteItem('deployments', deploymentName, 1, false);
          // Delete Booking
          await deleteItem('bookings', deploymentName, 1, true, areaName);
        });

        it('should not delete Shareable Booking when there is a Sharing Booking present for same Deployment', async function () {
          // Shareable Booking
          await newBookingSetup(
            deploymentName, productTypeName, teamName, bookingStartTime, bookingEndTime, true, 'Initial Install', 'Shareable',
            true, undefined, 'ENM:20.08', 'LATEST GREEN', 'CIP-33636', 'None'
          );
          // Sharing Booking
          await newBookingSetup(
            deploymentName, productTypeName, teamName2, bookingSharedTime, bookingSharedTime, true, 'Initial Install', 'Sharing',
            true, undefined, 'ENM:20.08', 'LATEST GREEN', 'CIP-33636', 'None'
          );
          // Try delete shareable Booking
          await viewItem('bookings', teamName, 8, areaName);
          await clickElement(By.xpath('//button[contains(.,"Delete")]'), true);
          await driver.wait(until.elementLocated(By.className('ui-notification')), 5000);
          await driver.wait(until.elementLocated(By.xpath('//div[contains(.,"Can\'t delete Booking")]')), 5000);
          // Delete Sharing
          await deleteItem('bookings', teamName2, 8, true, areaName);
          // Delete Shareable
          await deleteItem('bookings', teamName, 8, true, areaName);
          await driver.wait(until.elementLocated(By.className('select2-selection__clear')), 3000).click();
        });

        it('should not delete Area attached to a Deployment', async function () {
          await deleteItem('areas', areaName, 1, false);
        });

        it('should not delete Program attached to a Deployment', async function () {
          await deleteItem('programs', programName, 1, false);
        });

        it('should not delete Product-Type attached to a Deployment', async function () {
          await deleteItem('productTypes', productTypeName, 1, false);
        });

        it('should not delete Team attached to a Deployment', async function () {
          await deleteItem('teams', teamName, 1, false);
        });

        it('should not delete Label attached to a Deployment', async function () {
          await deleteItem('labels', labelName, 1, false);
        });

        it('should not delete Role attached to a User', async function () {
          await deleteItem('roles', 'admin', 1, false);
        });

        after(async function () {
          if (!beforeInnerSuccessful) {
            await takeScreenshot('before_delete_with_deployment');
          }
        });
      });

      after(async function () {
        if (!beforeSuccessful) {
          await takeScreenshot('before_delete_with_dependants');
        }
      });
    });
  });

  describe('Export Data', function () {
    this.timeout(80000);
    this.retries(MAX_RETRIES);
    var beforeSuccessful = false;
    // Program Details
    var programName = 'ExportData-Program';
    // Area Details
    var areaName = 'ExportData-Area';
    // Deployment Details
    var deploymentName = 'ExportData-Deployment';
    // Product-Flavour Details
    var productFlavourName = 'ExportData-ProdFlav';
    // Product-Type Details
    var productTypeName = 'ExportData-Product-Type';
    // Team Details
    var teamName = 'ExportData-Team';
    // JIRA Issue Details
    var jiraIssue = 'CIP-29934';
    // Hardware Details
    var productHardwareName1 = 'export-hardware1';
    var productHardwareName2 = 'export-hardware2';
    // Product Data Details
    var productDataName1 = 'ExportData-ProductDataName1';
    var productDataName2 = 'ExportData-ProductDataName2';

    before(async function () {
      programREST1 = await createProgramREST(programName);
      areaREST1 = await createAreaREST(areaName, programREST1._id);
      teamREST1 = await createTeamREST(teamName, areaREST1._id);
      productFlavourREST1 = await createProductFlavourREST(productFlavourName);
      productTypeREST1 = await createProductTypeREST(productTypeName, [productFlavourName]);
      hardwareREST1 = await createHardwareREST(productHardwareName1, programREST1._id, 'deploymentId');
      hardwareREST2 = await createHardwareREST(productHardwareName2, programREST1._id, 'deploymentId');

      // Create Deployment
      var deploymentProducts = [{
        product_type_name: productTypeName,
        flavour_name: productFlavourName,
        infrastructure: infraTypes.CLOUD,
        purpose: productNotes,
        hardware_ids: [hardwareREST1._id, hardwareREST2._id],
        links: [
          { link_name: productDataName1, url: 'http://www.ericsson.se/link1' },
          { link_name: productDataName2, url: 'http://www.ericsson.se/link2' }
        ],
        admins_only: false
      }];

      deploymentREST1 = await createDeploymentREST(
        deploymentName, programREST1._id, areaREST1._id, statusTypes.FREE,
        deploymentProducts, false, teamREST1._id, [], deploymentPurpose, [jiraIssue]
      );

      bookingREST1 = await createBookingREST(
        deploymentName, deploymentREST1._id, deploymentREST1.products[0]._id, teamREST1._id,
        bookingStartTime, bookingEndTime, undefined, 'Not Applicable', 'Smoke Test'
      );
      beforeSuccessful = true;
    });

    it('should export Deployment data', async function () {
      await openArtifactListView('deployments');
      await clickElement(By.xpath('//button[contains(.,"Export Data")]'));
      await driver.sleep(1000);
      (fs.existsSync(exportDataFile)).should.be.true();
      var dataFile = fs.readFileSync(exportDataFile, 'utf8');
      var checkList = [deploymentName, programName, deploymentPurpose, areaName, productTypeName,
        productFlavourName, productFlavourName, teamName, jiraIssue,
        productHardwareName1, productHardwareName2, productDataName1, productDataName2, statusTypes.FREE, infraTypes.CLOUD, productNotes];
      checkList.forEach(function (item) {
        (dataFile).should.containEql(item);
      });
      await removeFile(exportDataFile);
    });

    it('should export Booking Stats data', async function () {
      await driver.get(`${baseUrl}/statistics/bookings`);
      await clickElement(By.xpath('//button[contains(.,"Export Stats Data")]'));
      await driver.sleep(1000);
      (fs.existsSync(exportDataFile2)).should.be.true();
      var dataFile = fs.readFileSync(exportDataFile2, 'utf8');
      var checkList = [programName, areaName, deploymentName, teamName, '1',
        '3', '3', bookingStartTime, bookingEndTime, '3', '3', '100%', bookingStartTime, bookingEndTime];
      checkList.forEach(function (item) {
        (dataFile).should.containEql(item);
      });
      await removeFile(exportDataFile2);
    });

    after(async function () {
      if (!beforeSuccessful) {
        await takeScreenshot('before_export_data');
      }
      try {
        await deleteArtifactREST('deployments', deploymentREST1, false, false, true);
        await deleteArtifactREST('bookings', bookingREST1, false, false, true);
        await deleteArtifactREST('hardware', hardwareREST1, false, false, true);
        await deleteArtifactREST('hardware', hardwareREST2, false, false, true);
        await deleteArtifactREST('teams', teamREST1, false, false, true);
        await deleteArtifactREST('areas', areaREST1, false, false, true);
        await deleteArtifactREST('programs', programREST1, false, false, true);
        await deleteArtifactREST('productTypes', productTypeREST1, false, false, true);
        await deleteArtifactREST('productFlavours', productFlavourREST1, false, false, true);
      } catch (afterError) {
        await takeScreenshot('after_export_data');
        throw afterError;
      }
    });
  });

  describe('Help & API Documentation', function () {
    this.timeout(40000);

    it('should get Help Documentation page @healthtest', async function () {
      await viewSupportDocs('helpdocs');
      await verifySupportDocs(By.xpath('//a[contains(.,"Help Center")]'), By.css('[href="#help/app/helpdocs/topic/features/admins"]'));
    });

    it('should get API Documentation page @healthtest', async function () {
      await viewSupportDocs('apidocs');
      await verifySupportDocs(By.css('[alt="Swagger UI"]'), By.css('[href="#/Deployments"]'));
    });
  });

  afterEach(async function () {
    if (this.currentTest.state === 'failed') {
      var failedTestTitle = this.currentTest.title.replace(/ /g, '_');
      await takeScreenshot(failedTestTitle);
      testFailures.push(failedTestTitle);
    }
  });

  after(async function () {
    this.timeout(250000);
    try {
      await writeTestReport();
      await deleteAllHealthArtifactsREST();
    } catch (removeArtifactsError) {
      throw removeArtifactsError;
    }
    return driver.quit();
  });
});

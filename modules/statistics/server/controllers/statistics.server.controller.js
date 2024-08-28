'use strict';

var _ = require('lodash'),
  moment = require('moment'),
  Booking = require('../../../bookings/server/models/bookings.server.model').Schema,
  Deployment = require('../../../deployments/server/models/deployments.server.model').Schema,
  Program = require('../../../programs/server/models/programs.server.model').Schema,
  Team = require('../../../teams/server/models/teams.server.model').Schema,
  Area = require('../../../areas/server/models/areas.server.model').Schema,
  ProductType = require('../../../product_types/server/models/product_types.server.model').Schema,
  errorHandler = require('../../../core/server/controllers/errors.server.controller'),
  weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
var dateTimeFormat = 'YYYY-MM-DD';
exports.bookingStatistics = async function (req, res, fromServer) {
  try {
    var query = req.query;
    // Get Associated Artifacts
    var allPrograms = await Program.find().exec();
    var allAreas = await Area.find().exec();
    var allTeams = await Team.find().exec();

    // Filter out Deployments that dont match query ID selectors; handles for undefined query filters
    var deploymentQuery = {
      _id: query.deploymentFilter,
      team_id: query.teamFilter,
      area_id: query.areaFilter,
      program_id: query.programFilter
    };

    // Delete keys with null values
    Object.keys(deploymentQuery).forEach((key) => deploymentQuery[key] == null && delete deploymentQuery[key]);

    // Get Associated Deployments
    var deployments = await Deployment.find(deploymentQuery).exec();

    // Filter out Bookings for unwanted Deployments or that didnt start/end within specified range
    var validDeploymentIds = deployments.map(deployment => deployment._id.toString());
    var bookingQuery = {
      startTime: { $gte: query.startTimeAfterFilter || moment().subtract(10, 'years') },
      endTime: { $lte: query.endTimeBeforeFilter || moment().add(10, 'years') },
      deployment_id: { $in: validDeploymentIds }
    };

    // Filter out Bookings that are child 'sharing' of other Bookings
    if (!query.sharedBookingsFilter) {
      bookingQuery.bookingType = { $ne: 'Sharing' };
    }

    // Filter out Bookings with incorrect Product Type
    if (query.productTypeFilter) {
      var queryProductType = await ProductType.findById(query.productTypeFilter).exec();
      var validProductIds = deployments.map(d => d.products).flat()
        .filter(p => p.product_type_name === queryProductType.name).map(p => p._id);
      bookingQuery.product_id = { $in: validProductIds };
    }

    // Get Associated Bookings and add Duration field
    var bookings = await Booking.find(bookingQuery).exec();
    bookings.forEach(booking => {
      booking.duration = moment(booking.endTime).diff(moment(booking.startTime), 'days');
      booking.teamTmp = booking.team_id || booking.customTeamName;
    });
    // Filter out Deployments that have no Bookings
    if (!query.emptyDeploymentsFilter) {
      var deploymentIdsWithBookings = bookings.map(booking => booking.deployment_id.toString());
      deployments = deployments.filter(depl => deploymentIdsWithBookings.includes(depl._id.toString()));
    }

    // Get Global Statistics
    var globalStatistics = calculateStatistics(bookings);
    globalStatistics.deployments = [];

    // Get Deployment Statistics
    deployments.forEach(function (deployment) {
      var deploymentStats = prepareStatisticsObject(deployment, allPrograms, allAreas, allTeams);
      var deploymentBookings = bookings.filter(booking => booking.deployment_id.equals(deployment._id));
      deploymentStats = getBookingStatistics(deploymentStats, deploymentBookings, allTeams);
      globalStatistics.deployments.push(deploymentStats);
    });

    // Return all Statistics
    if (fromServer === true) return globalStatistics;
    res.send(globalStatistics);
  } catch (err) {
    return res.status(400).send({
      message: errorHandler.getErrorMessage(err)
    });
  }
};

exports.bookingStatisticsExport = async function (req, res) {
  try {
    var filteredStats = await exports.bookingStatistics(req, res, true);
    var returnedStats = getBookingStatsData(filteredStats);
    res.send(returnedStats);
  } catch (err) {
    return res.status(400).send({
      message: errorHandler.getErrorMessage(err)
    });
  }
};

function prepareStatisticsObject(deployment, allPrograms, allAreas, allTeams) {
  var program = allPrograms.find(program => program._id.equals(deployment.program_id));
  var area = allAreas.find(area => area._id.equals(deployment.area_id));
  var team = allTeams.find(team => team._id.equals(deployment.team_id));

  var statisticsObject = {
    deployment: { _id: deployment._id, name: deployment.name },
    team: (team) ? { _id: team._id, name: team.name } : null,
    area: { _id: area._id, name: area.name },
    program: { _id: program._id, name: program.name },
    products: deployment.products.map(product => product.product_type_name).join(', ')
  };
  return statisticsObject;
}

function getBookingStatistics(statisticsObj, associatedBookings, teams) {
  if (!associatedBookings || associatedBookings.length === 0) {
    _.merge(statisticsObj, { teams: null });
    return statisticsObj;
  }

  // Get Statistics for all Bookings associated with the Deployment
  _.merge(statisticsObj, calculateStatistics(associatedBookings));

  // Group Bookings Per Team and get refined Team Statistics
  var lodashWrapped = _(associatedBookings).groupBy('teamTmp').map(function (teamBookings, teamIdName) {
    var foundTeam = teams.find(team => team._id.equals(teamIdName)) || { _id: teamIdName, name: teamIdName };
    return _.merge({ team: { _id: foundTeam._id, name: foundTeam.name } }, calculateStatistics(teamBookings, true));
  });
  statisticsObj.teams = _.chain(lodashWrapped).value();
  return statisticsObj;
}

function calculateStatistics(bookings, addBookings) {
  var totBookings = bookings.length || 0;
  var totDuration = bookings.reduce((acc, booking) => acc + booking.duration, 0);
  var uniqueDatesBooked = getBookingsDates(bookings, true);
  var allDatesBooked = getBookingsDates(bookings);
  var statistics = {
    totalBookings: bookings.length,
    totalDuration: totDuration,
    averageDuration: Math.round(totDuration / totBookings) || 0,
    datesUtilization: getDateRangeUtilization(uniqueDatesBooked),
    dailyActivity: getDailyActivity(allDatesBooked)
  };
  if (addBookings) statistics.bookings = bookings;
  return statistics;
}

function getBookingsDates(bookings, mustBeUnique, extendLastDate = 0) {
  var datesBooked = [];
  bookings.forEach(function (booking) {
    var currDate = moment(booking.startTime).startOf('day');
    var lastDate = moment(booking.endTime).startOf('day').add(extendLastDate, 'days'); // To keep last date from trimming: extendLastDate = 1
    do {
      var foundDate = datesBooked.some(date => date.isSame(currDate));
      if (!foundDate || !mustBeUnique) datesBooked.push(_.cloneDeep(currDate));
    } while (currDate.add(1, 'days').diff(lastDate) < 0);
  });
  return datesBooked.sort((a, b) => b - a);
}

function getDateRangeUtilization(datesBooked) {
  if (!datesBooked || datesBooked.length === 0) return null;
  var firstDate = datesBooked[datesBooked.length - 1].toDate();
  var lastDate = datesBooked[0].toDate();
  var fullRange = getBookingsDates([{ startTime: firstDate, endTime: lastDate }], true, 1);
  return {
    firstDate: firstDate,
    lastDate: lastDate,
    totalBookedRange: datesBooked.length,
    totalDateRange: fullRange.length
  };
}

function getDailyActivity(datesBooked) {
  if (!datesBooked || datesBooked.length === 0) return null;
  var dailyActivity = weekDays.map(day => { return { dayName: day, activity: 0 }; });
  datesBooked.forEach(function (date) { // Increase activity for the week-day name associated with the date
    dailyActivity.find(da => da.dayName === date.format('dddd')).activity += 1;
  });
  return dailyActivity.sort((a, b) => weekDays.indexOf(a.dayName) > weekDays.indexOf(b.dayName)); // Sort by week-day name
}

function getBookingStatsData(bookingStats) {
  var finalDataOutput = [];
  var statsData = _.cloneDeep(bookingStats);
  finalDataOutput.push(exportDataSetup('global', statsData));
  statsData.deployments.forEach(function (deploymentStats) {
    finalDataOutput.push(exportDataSetup('deployment', deploymentStats));
    if (deploymentStats.teams) {
      deploymentStats.teams.forEach(function (teamStats) {
        finalDataOutput.push(exportDataSetup('team', teamStats));
        teamStats.bookings.forEach(function (booking) {
          finalDataOutput.push(exportDataSetup('booking', booking));
        });
      });
    }
  });
  return finalDataOutput;
}

function exportDataSetup(dataType, statsData) {
  var program,
    ra,
    deployment,
    team;
  program = '';
  ra = '';
  deployment = '';
  team = '';
  if (dataType === 'deployment') {
    program = statsData.program.name;
    ra = statsData.area.name;
    deployment = statsData.deployment.name;
  } else if (dataType === 'team') {
    team = statsData.team.name;
  }
  return {
    Program: program,
    RA: ra,
    Deployment: deployment,
    Team: team,
    TotalBookings: statsData.totalBookings || '',
    TotalDuration: statsData.totalDuration || '',
    TotalAverageDuration: statsData.averageDuration || '',
    UtilizationStartDate: statsData.datesUtilization ? moment(statsData.datesUtilization.firstDate).format(dateTimeFormat) : '',
    UtilizationEndDate: statsData.datesUtilization ? moment(statsData.datesUtilization.lastDate).format(dateTimeFormat) : '',
    UtilizationTotalBookedRange: statsData.datesUtilization ? statsData.datesUtilization.totalBookedRange : '',
    UtilizationTotalDateRange: statsData.datesUtilization ? statsData.datesUtilization.totalDateRange : '',
    UtilizationPercentage: statsData.datesUtilization ? Math.round((statsData.datesUtilization.totalBookedRange / statsData.datesUtilization.totalDateRange) * 100) + '%' : '',
    BookingStartDate: statsData.startTime ? moment(statsData.startTime).format(dateTimeFormat) : '',
    BookingEndDate: statsData.endTime ? moment(statsData.endTime).format(dateTimeFormat) : ''
  };
}

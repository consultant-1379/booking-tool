'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
  express = require('express'),
  morgan = require('morgan'),
  cors = require('cors'),
  bodyParser = require('body-parser'),
  session = require('express-session'),
  passport = require('passport'),
  MongoStore = require('connect-mongo')(session),
  compress = require('compression'),
  methodOverride = require('method-override'),
  helmet = require('helmet'),
  hbs = require('express-hbs'),
  _ = require('lodash'),
  lusca = require('lusca'),
  partialResponse = require('express-partial-response'),
  config = require('../config'),
  ldap = require('./ldap'),
  policy = require('./policy'),
  logger = require('./logger'),
  allServerRoutes = require('./all.server.routes');

/**
 * Initialize local variables
 */
module.exports.initLocalVariables = function (app) {
  // Setting application local variables
  if (config.secure && config.secure.ssl === true) {
    app.locals.secure = config.secure.ssl;
  }
  app.locals.livereload = config.livereload;
  app.locals.logo = config.logo;
  app.locals.env = process.env.NODE_ENV;
  app.locals.domain = config.domain;

  // Passing the request url to environment locals
  app.use(function (req, res, next) {
    res.locals.host = req.protocol + '://' + req.hostname;
    res.locals.url = req.protocol + '://' + req.headers.host + req.originalUrl;
    next();
  });
  // Set up for CORS (for Swagger)
  app.use('/', function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'X-Requested-With');
    next();
  });
};

/**
 * Initialize application middleware
 */
module.exports.initMiddleware = function (app) {
  // Should be placed before express.static
  app.use(compress({
    filter: function (req, res) {
      return (/json|text|javascript|css|font|svg/).test(res.getHeader('Content-Type'));
    },
    level: 9
  }));

  // Enable logger (morgan) if enabled in the configuration file
  if (_.has(config, 'log.format')) {
    app.use(morgan(logger.getLogFormat(), logger.getMorganOptions()));
  }

  // Environment dependent middleware
  if (process.env.NODE_ENV === 'development') {
    // Disable views cache
    app.set('view cache', false);
  } else if (process.env.NODE_ENV === 'production') {
    app.locals.cache = 'memory';
  }

  // Request body parsing middleware should be above methodOverride
  app.use(bodyParser.urlencoded({
    extended: true
  }));

  app.use(bodyParser.json());

  app.use(function (err, req, res, next) {
    if (err instanceof SyntaxError) {
      return res.status(400).send({
        message: 'There was a syntax error found in your request, please make sure that it is valid and try again'
      });
    }
    next();
  });

  // Adding 'message' to fields as express-partial-response will remove it from response otherwise
  app.use(function (req, res, next) {
    if (req.query.fields) {
      req.query.fields += ',message';
    }
    next();
  });

  app.use(methodOverride());

  app.use(partialResponse());
};

/**
 * Configure view engine
 */
module.exports.initViewEngine = function (app) {
  app.engine('server.view.html', hbs.express4({
    extname: '.server.view.html'
  }));
  app.set('view engine', 'server.view.html');
  app.set('views', path.resolve('./'));
};

/**
 * Configure Express session
 */
module.exports.initSession = function (app, db) {
  // Express MongoDB session storage
  app.use(session({
    saveUninitialized: false,
    resave: false,
    secret: config.sessionSecret,
    cookie: {
      maxAge: config.sessionCookie.maxAge,
      httpOnly: config.sessionCookie.httpOnly,
      secure: config.sessionCookie.secure && config.secure.ssl
    },
    name: config.sessionKey,
    store: new MongoStore({
      url: config.dbMean.uri,
      collection: config.sessionCollection
    })
  }));

  ldap.addPassportStrategies();
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(ldap.signInFromBasicAuthentication());

  // Add Lusca CSRF Middleware
  app.use(lusca(config.csrf));
  // Enable CORS request (for Swagger UI)
  app.use(cors());
};

/**
 * Configure Helmet headers configuration
 */
module.exports.initHelmetHeaders = function (app) {
  // Use helmet to secure Express headers
  var SIX_MONTHS = 15778476000;
  app.use(helmet.frameguard());
  app.use(helmet.xssFilter());
  app.use(helmet.noSniff());
  app.use(helmet.ieNoOpen());
  app.use(helmet.hsts({
    maxAge: SIX_MONTHS,
    includeSubDomains: true,
    force: true
  }));
  app.disable('x-powered-by');
};

/**
 * Configure the modules static routes
 */
module.exports.initModulesClientRoutes = function (app) {
  // Setting the app router and static folder
  app.use('/', express.static(path.resolve('./public')));
};

/**
 * Configure the modules server routes
 */
module.exports.initModulesServerRoutes = function (app) {
  allServerRoutes.forEach(function (serverRoute) {
    serverRoute(app);
  });
};

/**
 * Configure error handling
 */
module.exports.initErrorRoutes = function (app) {
  app.use(function (err, req, res, next) {
    // If the error object doesn't exists
    if (!err) {
      return next();
    }

    // Log it
    logger.error(err.stack);

    // Return a stack trace as the error wasn't handle anywhere
    return res.status(500).send({
      message: err.stack
    });
  });
};

/**
 * Initialize the Express application
 */
module.exports.init = function (db) {
  // Initialize express app
  var app = express();

  // Initialize local variables
  this.initLocalVariables(app);

  // Initialize Express middleware
  this.initMiddleware(app);

  // Initialize Express view engine
  this.initViewEngine(app);

  // Initialize Helmet security headers
  this.initHelmetHeaders(app);

  // Initialize modules static client routes, before session!
  this.initModulesClientRoutes(app);

  // Initialize Express session
  this.initSession(app, db);

  // Initialize modules server routes
  this.initModulesServerRoutes(app);

  // Initialize error routes
  this.initErrorRoutes(app);

  return app;
};

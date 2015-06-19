'use strict';

let config,
    express = require('express'),
    routes = require('./routes'),
    session = require('express-session'),
    //favicon = require('serve-favicon')
    path = require('path'),
    passport = require('passport'),
    FacebookAuth = require('./FacebookAuth'),
    usersRouter = require('./routes/users'),
    notepadsRouter = require('./routes/notepads'),
    categoriesRouter = require('./routes/categories'),
    HttpStatus = require('http-status');

import User from './models/user';

let app = express();

//export NODE_ENV=development npm start
let envs = ['development', 'production', 'test'];
if (envs.indexOf(app.get('env')) !== -1) {
    console.info(app.get('env') + ' environment detected');
} else {
    console.warn('unrecognized environment detected', app.get('env'));
}

try {
    config = require('../config/app.conf.json');
} catch (err) {
    if (app.get('env') !== 'test') {
        //prod / dev env - cannot work without real config values
        process.stderr.write(err);
        process.exit();
    } else {
        //test env
        console.error(err);
        config = require('../config/testing.json');
    }
}

app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
//app.use(favicon(__dirname + '/public/favicon.ico'));
if (config) {
    app.use(session({
        //TODO: check these properties for their default values
        resave: true,
        saveUninitialized: true,
        //TODO: use the app.conf.js config file for this
        secret: config.sessionSecret
    }));
    FacebookAuth.setAppConfig(config);
    FacebookAuth.call(null, passport);
    app.use(passport.initialize());
    app.use(passport.session());
}
//get all data sent to the API inside req.body
app.use(require('body-parser').json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', routes.index);
app.get('/auth/facebook',
    passport.authenticate('facebook', {}),
    () => {}
);
app.get('/auth/facebook/callback',
    passport.authenticate('facebook', {
        failureRedirect: '/'
    }),
    FacebookAuth.login
);
app.get('/logout', FacebookAuth.logout);

//API URLs
//allow all locations access to the api urls
if (config) {
    app.use(config.apiBase, (req, res, next) => {
        // Website you wish to allow to connect
        res.setHeader('Access-Control-Allow-Origin', '*');
        // Request methods you wish to allow
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
        // Request headers you wish to allow
        res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
        // Pass to next layer of middleware
        next();
    });
}
//authorize if valid access token is given
let parseAccessToken = (req, res, next) => {
    let blockUser = err => {
        console.error(err);
        return res.status(HttpStatus.FORBIDDEN).send('Forbidden');
    };

    let accessToken = req.query.token;

    if (accessToken) {
        //this require is used often, may be put on top:
        User.getByAccessToken(accessToken).then(user => {
            if (user) {
                req.user = user;
                req.user.id = user._id;
                next();
            } else {
                return blockUser('Invalid access token!');
            }
        }).catch(err => {
            return blockUser(err);
        });
    } else {
        return next();
    }
};
app.use(parseAccessToken);

//API routes
if (config) {
    usersRouter.setAppConfig(config);
    app.use(config.apiBase + '/users', usersRouter);
    app.use(config.apiBase + '/notepads', notepadsRouter);
    app.use(config.apiBase + '/categories', categoriesRouter);
}

//dev env
if ('development' === app.get('env')) {
    //app.use(express.logger('dev')); TODO: check exp4 way
    let errorHandler = require('errorhandler');
    app.use(errorHandler());
}

let createConnection = () => {
    let connection = require('./db');
    connection.setAppConfig(config);
    connection().on('connected', err => {
        if (err) {
            process.stderr.write(err);
            process.exit();
        }
    });
};

let startServer = () => {
    app.listen(app.get('port'), () => {
        console.info('Express server listening on port ' + app.get('port'));
    });
};

module.exports = exports = app;
module.exports.createConnection = exports.createConnection = createConnection;
module.exports.startServer = exports.startServer = startServer;
module.exports.parseAccessToken = exports.parseAccessToken = parseAccessToken;
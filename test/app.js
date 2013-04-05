'use strict';

// Node core and 3rd party modules
var express = require('express'),
    mongoose = require('mongoose'),
    path = require('path'),
    http = require('http');

// Sample Mongoose schemea and Mongoose-EdgeAPI
var Sample = require(path.resolve(__dirname + '/models/Sample')),
    edgeapi = require(path.resolve(__dirname + '/../src/mongoose-edgeapi'));

var app = express(),
    server = http.createServer(app);

app.configure(function callback() {
    app.set('port', process.env.PORT || 3000);
    app.use(express.favicon());
    app.use(express.logger('dev'));
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(app.router);
    app.use(express.static(path.join(__dirname, '/../src')));
});

app.configure('development', function callback() {
    app.use(express.errorHandler());
});

mongoose.connect('mongodb://localhost/mongoose-edgeapi');

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function callback() {
    edgeapi.serveRoutes(app, Sample);
    server.listen(app.get('port'), function () {
        console.log('Express server listening on port ' + app.get('port'));
    });
});

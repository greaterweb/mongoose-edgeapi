'use strict';

// Node core and 3rd party modules
var express = require('express'),
    mongoose = require('mongoose'),
    path = require('path'),
    http = require('http'),
    _ = require('underscore');

// Sample Mongoose schemea and Mongoose-EdgeAPI
var Sample = require(path.resolve(__dirname + '/../models/Sample')),
    edgeapi = require(path.resolve(__dirname + '/../../src/mongoose-edgeapi')),
    sampleDocument = require(path.resolve(__dirname + '/../models/sampleDocument'));

var app = express(),
    server = http.createServer(app);

app.configure(function callback() {
    app.set('port', process.env.PORT || 9000);
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

var apiBasePath = '/api/samples',
    server_options = {
        hostname: 'localhost',
        port: app.get('port'),
        path: apiBasePath,
        method: 'GET'
    };

exports.rest = {
    setUp: function (callback) {
        var config = this;
        config.db = mongoose.connection;
        config.db.on('error', console.error.bind(console, '\nconnection error:'));
        config.db.once('open', function dbOpen() {
            config.crud = edgeapi.serveCrud(Sample);
            // wipe out DB contents before testing
            config.crud.api.remove({}).then(function () {
                callback();
            });
        });
        mongoose.connect('mongodb://localhost/mongoose-edgeapi');
    },
    tearDown: function (callback) {
        var config = this;
        config.db.close(function() {
            if (server.connections) {
                server.close(function () {
                    callback();
                });
            } else {
                callback();
            }
        });
    },
    get: {
        all: function (test) {
            var config = this,
                crud = config.crud.api;

            edgeapi.serveRoutes(app, Sample);
            server.listen(app.get('port'), function () {
                console.log('Express server listening on port ' + app.get('port'));

                test.expect(3);
                var req = http.request(server_options, function (res) {
                    var response = '';

                    res.on('data', function (chunk) {
                        response += chunk;
                    });

                    // when all chunked data is in, return response
                    res.on('end', function () {
                        var results = JSON.parse( response );
                        test.equal(res.statusCode, 200, 'Correct response code');
                        test.equal(results.documents.length, 0, 'Empty collection, expecting 0 results');
                        test.equal(results.meta.documents, 0, 'Empty collection, expecting 0 results');
                        test.done();
                    });
                });

                req.on('error', function (error) {
                    test.ifError(error);
                    test.done();
                });
                req.end();
            });
        },
        byID: function (test) {
            var config = this,
                crud = config.crud.api;

            edgeapi.serveRoutes(app, Sample);
            crud.save(sampleDocument).then(function (saved) {
                server.listen(app.get('port'), function () {
                    console.log('Express server listening on port ' + app.get('port'));

                    var options = _.extend(server_options, {
                        path: apiBasePath + '/' + saved._id
                    });

                    test.expect(11);
                    var req = http.request(server_options, function (res) {
                        var response = '';

                        res.on('data', function (chunk) {
                            response += chunk;
                        });

                        // when all chunked data is in, return response
                        res.on('end', function () {
                            var results = JSON.parse( response );
                            test.equal(res.statusCode, 200, 'Correct response code');
                            test.equal(results.name.first, sampleDocument.name.first, 'First name saved correctly');
                            test.equal(results.name.last, sampleDocument.name.last, 'Last name saved correctly');
                            test.equal(results.email, sampleDocument.email, 'Email saved correctly');
                            test.equal(results.friends.length, sampleDocument.friends.length, 'Correct number of friends saved');
                            test.equal(results.friends[0].name.first, sampleDocument.friends[0].name.first, 'Friend 1 first name saved correctly');
                            test.equal(results.friends[0].name.last, sampleDocument.friends[0].name.last, 'Friend 1 last name saved correctly');
                            test.equal(results.friends[0].email, sampleDocument.friends[0].email, 'Friend 1 email saved correctly');
                            test.equal(results.friends[1].name.first, sampleDocument.friends[1].name.first, 'Friend 2 first name saved correctly');
                            test.equal(results.friends[1].name.last, sampleDocument.friends[1].name.last, 'Friend 2 last name saved correctly');
                            test.equal(results.friends[1].email, sampleDocument.friends[1].email, 'Friend 2 email saved correctly');
                            test.done();
                        });
                    });

                    req.on('error', function (error) {
                        test.ifError(error);
                        test.done();
                    });
                    req.end();
                });
            });
        }
    },
    post: {
        document: function (test) {
            var config = this,
                crud = config.crud.api;

            edgeapi.serveRoutes(app, Sample);
            server.listen(app.get('port'), function () {
                console.log('Express server listening on port ' + app.get('port'));

                var data = JSON.stringify(sampleDocument);

                var options = _.extend(server_options, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': data.length
                    }
                });

                test.expect(11);
                var req = http.request(options, function (res) {
                    var response = '';

                    res.on('data', function (chunk) {
                        response += chunk;
                    });

                    // when all chunked data is in, return response
                    res.on('end', function () {
                        var results = JSON.parse( response );
                        test.equal(res.statusCode, 201, 'Correct response code');
                        test.equal(results.document.name.first, sampleDocument.name.first, 'First name saved correctly');
                        test.equal(results.document.name.last, sampleDocument.name.last, 'Last name saved correctly');
                        test.equal(results.document.email, sampleDocument.email, 'Email saved correctly');
                        test.equal(results.document.friends.length, sampleDocument.friends.length, 'Correct number of friends saved');
                        test.equal(results.document.friends[0].name.first, sampleDocument.friends[0].name.first, 'Friend 1 first name saved correctly');
                        test.equal(results.document.friends[0].name.last, sampleDocument.friends[0].name.last, 'Friend 1 last name saved correctly');
                        test.equal(results.document.friends[0].email, sampleDocument.friends[0].email, 'Friend 1 email saved correctly');
                        test.equal(results.document.friends[1].name.first, sampleDocument.friends[1].name.first, 'Friend 2 first name saved correctly');
                        test.equal(results.document.friends[1].name.last, sampleDocument.friends[1].name.last, 'Friend 2 last name saved correctly');
                        test.equal(results.document.friends[1].email, sampleDocument.friends[1].email, 'Friend 2 email saved correctly');
                        test.done();
                    });
                });

                req.on('error', function (error) {
                    test.ifError(error);
                    test.done();
                });
                req.write(data);
                req.end();
            });
        }
    }
};

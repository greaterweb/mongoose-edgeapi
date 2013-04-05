'use strict';

// Node core and 3rd party modules
var mongoose = require('mongoose'),
    path = require('path'),
    _ = require('underscore');

// Sample Mongoose schemea and Mongoose-EdgeAPI
var Sample = require(path.resolve(__dirname + '/../models/Sample')),
    edgeapi = require(path.resolve(__dirname + '/../../src/mongoose-edgeapi')),
    sampleDocument = require(path.resolve(__dirname + '/../models/sampleDocument'));

exports.crud = {
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
            // console.log('\nMongooose connection closed.');
            callback();
        });
    },
    create: {
        invalidDocument: function (test) {
            var config = this,
                crud = config.crud.api;

            test.expect(1);
            crud.save('foo').then(
                function (saved) {
                    // it shouldn't have saved...
                },
                function (error) {
                    test.ok(error, 'Invalid query, error message should be returned');
                    test.done();
                });
        },
        validDocument: function (test) {
            var config = this,
                crud = config.crud.api;

            test.expect(10);
            crud.save(sampleDocument).then(
                function (saved) {
                    // TODO: handle this iteratively to eliminate lots of coding
                    test.equal(saved.name.first, sampleDocument.name.first, 'First name saved correctly');
                    test.equal(saved.name.last, sampleDocument.name.last, 'Last name saved correctly');
                    test.equal(saved.email, sampleDocument.email, 'Email saved correctly');
                    test.equal(saved.friends.length, sampleDocument.friends.length, 'Correct number of friends saved');
                    test.equal(saved.friends[0].name.first, sampleDocument.friends[0].name.first, 'Friend 1 first name saved correctly');
                    test.equal(saved.friends[0].name.last, sampleDocument.friends[0].name.last, 'Friend 1 last name saved correctly');
                    test.equal(saved.friends[0].email, sampleDocument.friends[0].email, 'Friend 1 email saved correctly');
                    test.equal(saved.friends[1].name.first, sampleDocument.friends[1].name.first, 'Friend 2 first name saved correctly');
                    test.equal(saved.friends[1].name.last, sampleDocument.friends[1].name.last, 'Friend 2 last name saved correctly');
                    test.equal(saved.friends[1].email, sampleDocument.friends[1].email, 'Friend 2 email saved correctly');
                    test.done();
                });
        }
    },
    read: {
        invalidQuery: function (test) {
            var config = this,
                crud = config.crud.api;

            test.expect(1);
            crud.find({foo: 'bar'}).then(
                function (documents) {
                    test.strictEqual(documents.length, 0, 'Invalid query, 0 documents expected');
                    test.done();
                });
        },
        validQuery: function (test) {
            var config = this,
                crud = config.crud.api;

            test.expect(1);
            crud.save(sampleDocument).then(
                function (saved) {
                    crud.find({_id: saved._id}).then(
                    function (documents) {
                        test.strictEqual(documents.length, 1, 'Document found successfully');
                        test.done();
                    });
                });
        }
    },
    update: {
        invalidQuery: function (test) {
            var config = this,
                crud = config.crud.api;

            test.expect(1);
            crud.update({foo: 'bar'}, {bar: 'foo'}).then(
                function (update) {
                    test.strictEqual(update, 0, 'Invalid query, 0 updates expected');
                    test.done();
                });
        },
        validQuery: function (test) {
            var config = this,
                crud = config.crud.api;

            test.expect(1);
            crud.save(sampleDocument).then(
                function (saved) {
                    crud.update({_id: saved._id}, {name: 'John'}).then(
                    function (update) {
                        test.strictEqual(update, 1, 'Document updated successfully');
                        test.done();
                    });
                });
        }
    },
    delete: {
        invalidQuery: function (test) {
            var config = this,
                crud = config.crud.api;

            test.expect(1);
            crud.remove({foo: 'bar'}).then(
                function (removed) {
                    test.strictEqual(removed, 0, 'Invalid query, 0 documents removed');
                    test.done();
                });
        },
        validQuery: function (test) {
            var config = this,
                crud = config.crud.api;

            test.expect(1);
            crud.save(sampleDocument).then(
                function (saved) {
                    crud.remove({_id: saved._id}).then(
                    function (removed) {
                        test.strictEqual(removed, 1, 'Document successfully removed');
                        test.done();
                    });
                });
        }
    }
};

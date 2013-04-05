'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var sampleSchema = new Schema({
    name: {
        first: String,
        last: String
    },
    email: String,
    friends: [{
        name: {
            first: String,
            last: String
        },
        email: String
    }]
});

sampleSchema.virtual('name.full').get(function () {
    return this.name.first + ' ' + this.name.last;
});

sampleSchema.virtual('friends.name.full').get(function () {
    return this.friends.name.first + ' ' + this.friends.name.last;
});

module.exports = exports = mongoose.model('Sample', sampleSchema);

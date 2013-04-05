'use strict';

module.exports = function (grunt) {
    // load all grunt tasks
    require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

    var path = require('path');

    grunt.initConfig({
        project: {
            src : path.resolve(__dirname + '/src'),
            pkg : '',
            port: 3000,
            dist: path.resolve(__dirname + '/dist'),
            tmp: path.resolve(__dirname + '/.tmp'),
            test: path.resolve(__dirname + '/test')
        },
        jshint: {
            options: {
                jshintrc: '.jshintrc'
            },
            grunt: 'Gruntfile.js',
            src: '<%= project.src %>/**/*.js',
            test: '<%= project.test %>/**/*.js'
        },
        nodeunit: {
            all: ['<%= project.test %>/nodeunit/*.js']
        }
    });

    grunt.renameTask('regarde', 'watch');

};

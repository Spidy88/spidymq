"use strict";

module.exports = function(grunt) {
    grunt.registerTask('default', ['test']);
    grunt.registerTask('test', ['jshint', 'mochaTest']);

    grunt.initConfig({
        mochaTest: {
            test: {
                src: ['test/**/*.js'],
                options: {
                    reporter: 'list'
                }
            }
        },

        // TODO: Add jscs for code style validation. JSHint will no longer support this need.
        jshint: {
            all: [
                'Gruntfile.js',
                'index.js',
                'lib/**/*.js',
                'test/**/*.js'
            ],
            options: {
                esversion: 6,
                curly: true,
                eqeqeq: true,
                expr: true,
                strict: true,
                undef: true,
                mocha: true,
                node: true
            }
        },

        jsdoc : {
            dist : {
                src: ['index.js', 'lib/*.js', 'test/*.js'],
                options: {
                    destination: 'docs/jsdoc'
                }
            }
        }
    });

    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-jsdoc');
};
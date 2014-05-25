module.exports = function (grunt) {
    'use strict';

    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        compass: {
            build: {
                options: {
                    sassDir: 'sass',
                    cssDir: 'public/css',
                    outputStyle: 'compressed'
                }
           },
           watch: {
                options: {
                    sassDir: 'sass',
                    cssDir: 'public/css',
                    outputStyle: 'compressed',
                    watch: true
                }
           }
        },
        concurrent: {
            watch: {
                tasks: ['compass:watch'],
                options: {
                    logConcurrentOutput: true
                }
            }
        },
    });

    grunt.loadNpmTasks('grunt-concurrent');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-compass');

    grunt.registerTask('build', ['compass:build']);
    grunt.registerTask('bwatch', ['build', 'concurrent']);

    grunt.registerTask('default', 'bwatch');
}
;

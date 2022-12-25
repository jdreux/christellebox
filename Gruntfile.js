module.exports = function (grunt) {
    'use strict';

    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        sass: {
            build: {
                files: [{
                    expand: true,
                    cwd: 'sass',
                    src: ['*.scss'],
                    dest: 'public/css',
                    ext: '.css'
                  }]
           },
        },
        watch: {
            tasks: ['sass:build'],
            files: 'sass/*.scss',
            options: {
                logConcurrentOutput: true
            }
        },
    });

    grunt.loadNpmTasks('grunt-concurrent');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-sass');

    grunt.registerTask('build', ['sass:build']);
    grunt.registerTask('bwatch', ['build', 'watch']);

    grunt.registerTask('default', 'bwatch');
}
;

/*global module:false*/
module.exports = function(grunt) {

    // Project configuration.
    grunt.initConfig({
        // Metadata.
        pkg: grunt.file.readJSON('package.json'),
        banner: '/*! <%= pkg.title || pkg.name %> - v<%= pkg.version %> - ' +
                '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
                '<%= pkg.homepage ? "* " + pkg.homepage + "\\n" : "" %>' +
                '* Copyright (c) <%= grunt.template.today("yyyy") %> Nicole Sullivan and Nicholas C. Zakas;\n' +
                '* Licensed <%= _.pluck(pkg.licenses, "type").join(", ") %> <%= _.pluck(pkg.licenses, "url").join(", ") %> */\n',
        //Parser lib copy for verions that can't user requirejs
        parserlib: 'node_modules/parserlib/lib/node-parserlib.js',
        //Core CSSLint files used by most versions
        csslint_files: [
            'src/core/CSSLint.js',
            'src/core/*.js',
            'src/rules/*.js',
            'src/formatters/*.js'
        ],
        //Core fileset used by most versions
        core_files: [
            '<%= parserlib %>',
            '<%= csslint_files %>'
        ],
        // Task configuration.
        concat: {
            core: {
                options: {
                    banner: '<%= banner %>\n' +
                            //Hack for using the node version of parserlib
                            'var exports = exports || {};\n' +
                            'var CSSLint = (function(){\n',
                    footer: '\nreturn CSSLint;\n})();'
                },
                src: [
                    '<%= core_files %>'
                ],
                dest: 'build/<%= pkg.name %>.js'
            },//Build environment workers
            rhino: {
                options: {
                    banner: 'var exports = exports || {};\n' //Hack for using the node version of parserlib
                },
                src: [
                    '<%= concat.core.dest %>',
                    'src/cli/{common, rhino}.js'
                ],
                dest: 'build/<%= pkg.name %>-rhino.js'
            },
            node: {
                options: {
                    banner: '<%= banner %>',
                    footer: '\nexports.CSSLint = CSSLint;'
                },
                files: {
                    'build/<%= pkg.name %>-node.js': ['<%= core_files %>'],
                    'build/npm/lib/<%= pkg.name %>-node.js': ['<%= core_files %>']
                }
            },
            node_cli: {
                options: {
                    banner: '#!/usr/bin/env node\n<%= banner %>'
                },
                src: [
                    'src/cli/{common, node}.js'
                ],
                dest: 'build/npm/cli.js'
            },
            worker: {
                options: {
                    banner: '<%= banner %>\n' +
                            //Hack for using the node version of parserlib
                            'var exports = exports || {};\n'
                },
                src: [
                    '<%= core_files %>',
                    'src/worker/*.js'
                ],
                dest: 'build/<%= pkg.name %>-worker.js'
            },
            wsh: {
                options: {
                    banner: '<%= banner %>\n' +
                            //Hack for using the node version of parserlib
                            'var exports = exports || {};\n'
                },
                src: [
                    '<%= core_files %>',
                    'src/cli/{common, wsh}.js'
                ],
                dest: 'build/<%= pkg.name %>-wsh.js'
            }
        },
        jshint: {
            options: {
                curly: true,
                //eqeqeq: true,
                immed: true,
                latedef: true,
                newcap: true,
                noarg: true,
                sub: true,
                undef: true,
                //unused: true,
                boss: true,
                eqnull: true,
                // Copied from build.xml
                forin: true,
                noempty: true,
                rhino: false,
                // Temporary to suppress warnings that exist when using the latest JSHint
                eqeqeq: false,
                unused: false,
                globals: {
                    jQuery: true
                }
            },
            gruntfile: {
                src: 'Gruntfile.js'
            },
            all: {
                src: ['src/**/*.js']
            },
            tests: {
                src: ['tests/**/*.js']
            }
        },
        watch: {
            gruntfile: {
                files: '<%= jshint.gruntfile.src %>',
                tasks: ['jshint']
            },
            src: {
                files: '<%= jshint.all.src %>',
                tasks: ['jshint:all']
            },
            lib_test: {
                files: '<%= jshint.tests.src %>',
                tasks: ['jshint:tests']
            }
        },
        yuitest: {
            tests: {
                src: [
                    'tests/**/*.js'
                ]
            }
        }
    });

    // These plugins provide necessary tasks.
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-watch');

    // Default task.
    grunt.registerTask('default', ['test']);
    
    grunt.registerTask('test', ['jshint', 'concat', 'yuitest']);

    //Run the YUITest suite
    grunt.registerMultiTask('yuitest', 'Run the YUITests for the project', function() {
        /*jshint evil:true, node: true */

        var start = Date.now();
        var YUITest = require("yuitest");
        var CSSLint = require('./build/csslint-node').CSSLint;
        var files = this.filesSrc;
        var TestRunner = YUITest.TestRunner;
        var done = this.async();
        
        //Eval each file so the tests are brought into this scope were CSSLint and YUITest are loaded already
        files.forEach(function(filepath) {
            eval(grunt.file.read(filepath));
        });
        
        //Generic test event handler for individual test
        function handleTestResult(data){ 
            switch(data.type) {
                case TestRunner.TEST_FAIL_EVENT:
                    grunt.verbose.fail("Test named '" + data.testName + "' failed with message: '" + data.error.message + "'.").or.write(".".red);
                    break;
                case TestRunner.TEST_PASS_EVENT:
                    grunt.verbose.ok("Test named '" + data.testName + "' passed.").or.write(".".green);
                    break;
                case TestRunner.TEST_IGNORE_EVENT:
                    grunt.verbose.warn("Test named '" + data.testName + "' was ignored.").or.write(".".yellow);
                    break;
            }
        }

        //Event to execute after all tests suites are finished
        function reportResults(allsuites) {
            var end = Date.now();
            var elapsed = end - start;
            grunt.log.writeln().write("Finished in " + (elapsed / 1000) + " seconds").writeln();

            if (allsuites.results.failed > 0) {
                grunt.fail.warn(allsuites.results.failed + "/" + allsuites.results.total + "tests failed");
            } else {
                grunt.log.ok(allsuites.results.passed + "/" + allsuites.results.total + "tests passed");
                if (allsuites.results.ignored > 0) {
                    grunt.log.warn("Ignored: " + allsuites.results.ignored);
                }
            }
            //Tell grunt we're done the async testing
            done();
        }
        //Add event listeners
        TestRunner.subscribe(TestRunner.TEST_FAIL_EVENT, handleTestResult);
        TestRunner.subscribe(TestRunner.TEST_IGNORE_EVENT, handleTestResult);
        TestRunner.subscribe(TestRunner.TEST_PASS_EVENT, handleTestResult); 
        TestRunner.subscribe(TestRunner.COMPLETE_EVENT, reportResults); 
        TestRunner.run();
    });
};

'use strict';

var pkg = require('./package.json');

var child_process = require('child_process');
var fs = require('fs');
var path = require('path');

var archiver = require('archiver');
var del = require('del');
var NwBuilder = require('nw-builder');

var gulp = require('gulp');
var concat = require('gulp-concat');
var install = require("gulp-install");
var runSequence = require('run-sequence');
var os = require('os');

var distDir = './dist/';
var appsDir = './apps/';
var debugDir = './debug/';
var releaseDir = './release/';
var destDir;

var platforms = [];

// -----------------
// Helper functions
// -----------------

// Get platform from commandline args
// #
// # gulp <task> [<platform>]+        Run only for platform(s) (with <platform> one of --linux64, --osx64, or --win32 --chromeos)
// # 
function getPlatforms(includeChromeOs) {
    var supportedPlatforms = ['linux64', 'osx64', 'win32'];
    var result = [];
    var regEx = /--(\w+)/;
    for (var i = 3; i < process.argv.length; i++) {
        var arg = process.argv[i].match(regEx)[1];
        if (supportedPlatforms.indexOf(arg) > -1) {
            result.push(arg);
        } else if (arg === 'chromeos') {
            if (includeChromeOs) {
                result.push(arg);
            }
        } else {
             console.log('Unknown platform: ' + arg);
             process.exit();
        }
    }  

    if (result.length === 0) {
        switch (os.platform()) {
        case 'darwin':
            result.push('osx64');

            break;
        case 'linux':
            result.push('linux64');

            break;
        case 'win32':
            result.push('win32');

            break;

        default:
            break;
        }
    }

    console.log('Building for platform(s): ' + result + '.');

    return result;
}

function getRunDebugAppCommand() {
    switch (os.platform()) {
    case 'darwin':
        return 'open ' + path.join(debugDir, pkg.name, 'osx64', pkg.name + '.app');

        break;
    case 'linux':
        return path.join(debugDir, pkg.name, 'linux64', pkg.name);

        break;
    case 'win32':
        return path.join(debugDir, pkg.name, 'win32', pkg.name + '.exe');

        break;

    default:
        return '';

        break;
    }
}

function get_release_filename(platform, ext) {
    return 'Betaflight-BlackboxExplorer_' + platform + '_' + pkg.version + '.' + ext;
}

// -----------------
// Tasks
// -----------------

gulp.task('clean', function () { 
    return runSequence('clean-dist', 'clean-apps', 'clean-debug', 'clean-release');
});

gulp.task('clean-dist', function () { 
    return del([distDir + '**'], { force: true }); 
});

gulp.task('clean-apps', function () { 
    return del([appsDir + '**'], { force: true }); 
});

gulp.task('clean-debug', function () { 
    return del([debugDir + '**'], { force: true }); 
});

gulp.task('clean-release', function () { 
    return del([releaseDir + '**'], { force: true }); 
});

gulp.task('clean-cache', function () { 
    return del(['./cache/**'], { force: true }); 
});

gulp.task('clean-node-modules', function () { 
    return del(['./node_modules'], { force: true }); 
});

// Real work for dist task. Done in another task to call it via
// run-sequence.
gulp.task('dist', ['clean-dist'], function () {
    var distSources = [
        // CSS files
        './css/bootstrap-theme.css',
        './css/bootstrap-theme.css.map',
        './css/bootstrap-theme.min.css',
        './css/bootstrap.css',
        './css/bootstrap.css.map',
        './css/bootstrap.min.css',
        './css/header_dialog.css',
        './css/jquery.nouislider.min.css',
        './css/keys_dialog.css',
        './css/main.css',
        './css/user_settings_dialog.css',

        // JavaScript
        './background.js',
        './index.js',
        './js/cache.js',
        './js/complex.js',
        './js/configuration.js',
        './js/craft_2d.js',
        './js/craft_3d.js',
        './js/datastream.js',
        './js/decoders.js',
        './js/expo.js',
        './js/flightlog.js',
        './js/flightlog_fielddefs.js',
        './js/flightlog_fields_presenter.js',
        './js/flightlog_index.js',
        './js/flightlog_parser.js',
        './js/flightlog_video_renderer.js',
        './js/graph_config.js',
        './js/graph_config_dialog.js',
        './js/graph_legend.js',
        './js/graph_spectrum.js',
        './js/grapher.js',
        './js/gui.js',
        './js/header_dialog.js',
        './js/imu.js',
        './js/keys_dialog.js',
        './js/laptimer.js',
        './js/localization.js',
        './js/main.js',
        './js/pref_storage.js',
        './js/real.js',
        './js/release_checker.js',
        './js/seekbar.js',
        './js/tools.js',
        './js/user_settings_dialog.js',
        './js/video_export_dialog.js',
        './js/vendor/FileSaver.js',
        './js/vendor/bootstrap.js',
        './js/vendor/bootstrap.min.js',
        './js/vendor/jquery-1.11.3.min.js',
        './js/vendor/jquery-ui-1.11.4.min.js',
        './js/vendor/jquery.ba-throttle-debounce.js',
        './js/vendor/jquery.nouislider.all.min.js',
        './js/vendor/modernizr-2.6.2-respond-1.1.0.min.js',
        './js/vendor/npm.js',
        './js/vendor/semver.js',
        './js/vendor/three.js',
        './js/vendor/three.min.js',
        './js/vendor/webm-writer-0.1.1.js',

        // everything else
        './package.json', // For NW.js
        './manifest.json', // For Chrome app
        './*.html',
        './images/**/*',
        './_locales/**/*',
        './fonts/*',
    ];
    return gulp.src(distSources, { base: '.' })
        .pipe(gulp.dest(distDir))
        .pipe(install({
            npm: '--production --ignore-scripts'
        }));;
});

// Create runable app directories in ./apps
gulp.task('apps', ['dist', 'clean-apps'], function (done) {
    platforms = getPlatforms();
    console.log('Release build.');

    destDir = appsDir;

    var builder = new NwBuilder({
        files: './dist/**/*',
        buildDir: appsDir,
        platforms: platforms,
        flavor: 'normal',
        macIcns: './images/bf_icon.icns',
        macPlist: { 'CFBundleDisplayName': 'Betaflight Blackbox Explorer'},
        winIco: './images/bf_icon.ico',
    });
    builder.on('log', console.log);
    builder.build(function (err) {
        if (err) {
            console.log('Error building NW apps: ' + err);
            runSequence('clean-apps', function() {
                process.exit(1);
            });
        }
        // Execute post build task
        runSequence('post-build', function() {
            done();
        });
    });
});

// Create debug app directories in ./debug
gulp.task('debug', ['dist', 'clean-debug'], function (done) {
    platforms = getPlatforms();
    console.log('Debug build.');

    destDir = debugDir;

    var builder = new NwBuilder({
        files: './dist/**/*',
        buildDir: debugDir,
        platforms: platforms,
        flavor: 'sdk',
        macIcns: './images/bf_icon.icns',
        macPlist: { 'CFBundleDisplayName': 'Betaflight Blackbox Explorer'},
        winIco: './images/bf_icon.ico',
    });
    builder.on('log', console.log);
    builder.build(function (err) {
        if (err) {
            console.log('Error building NW apps: ' + err);
            runSequence('clean-debug', function() {
                process.exit(1);
            });
        }

        // Execute post build task
        runSequence('post-build', function() {
            // Start debug app
            var exec = require('child_process').exec;
            var run = getRunDebugAppCommand();
            console.log('Starting debug app (' + run + ')...');
            exec(run);
            done();
        });
    });
});

gulp.task('post-build', function(done) {
    if (platforms.indexOf('osx64') != -1) {
        // Determine the WebKit version distributed in nw.js
        var pathToVersions = path.join(destDir, pkg.name, 'osx64', pkg.name + '.app', 'Contents', 'Versions');
        var files = fs.readdirSync(pathToVersions);
        if (files.length >= 1) {
            var webKitVersion = files[0];
            console.log('Found Webkit version: ' + webKitVersion)
            // Copy ffmpeg codec library into macOS app
            var libSrc = './library/osx64/libffmpeg.dylib'
            var libDest = path.join(pathToVersions, webKitVersion) + '/';
            console.log('Copy ffmpeg library to macOS app (' + libSrc + ' to ' + libDest + ')');
            gulp.src(libSrc)
                .pipe(gulp.dest(libDest));
        } else {
            console.log('Error: could not find the Version folder.');
        }
    }
    if (platforms.indexOf('linux64') != -1) {
        // Copy ffmpeg codec library into Linux app
        var libSrc = './library/linux64/libffmpeg.so'
        var libDest = path.join(destDir, pkg.name, 'linux64', 'lib') + '/';
        console.log('Copy ffmpeg library to Linux app (' + libSrc + ' to ' + libDest + ')');
        gulp.src(libSrc)
            .pipe(gulp.dest(libDest));
    }
    if (platforms.indexOf('win32') != -1) {
        // Copy ffmpeg codec library into Windows app
        var libSrc = './library/win32/ffmpeg.dll'
        var libDest = path.join(destDir, pkg.name, 'win32') + '/';
        console.log('Copy ffmpeg library to Windows app (' + libSrc + ' to ' + libDest + ')');
        gulp.src(libSrc)
            .pipe(gulp.dest(libDest));
    }
    done();
});

// Create distribution package for windows platform
function release_win32() {
    var src = path.join(appsDir, pkg.name, 'win32');
    var output = fs.createWriteStream(path.join(releaseDir, get_release_filename('win32', 'zip')));
    var archive = archiver('zip', {
        zlib: { level: 9 }
    });
    archive.on('warning', function (err) { throw err; });
    archive.on('error', function (err) { throw err; });
    archive.pipe(output);
    archive.directory(src, 'Betaflight Blackbox Explorer');
    return archive.finalize();
}

// Create distribution package for linux platform
function release_linux64() {
    var src = path.join(appsDir, pkg.name, 'linux64');
    var output = fs.createWriteStream(path.join(releaseDir, get_release_filename('linux64', 'zip')));
    var archive = archiver('zip', {
        zlib: { level: 9 }
    });
    archive.on('warning', function (err) { throw err; });
    archive.on('error', function (err) { throw err; });
    archive.pipe(output);
    archive.directory(src, 'Betaflight Blackbox Explorer');
    return archive.finalize();
}

// Create distribution package for chromeos platform
function release_chromeos() {
    var src = distDir;
    var output = fs.createWriteStream(path.join(releaseDir, get_release_filename('chromeos', 'zip')));
    var archive = archiver('zip', {
        zlib: { level: 9 }
    });
    archive.on('warning', function (err) { throw err; });
    archive.on('error', function (err) { throw err; });
    archive.pipe(output);
    archive.directory(src, false);
    return archive.finalize();
}

// Create distribution package for macOS platform
function release_osx64() {
    var appdmg = require('gulp-appdmg');

    return gulp.src([])
        .pipe(appdmg({
            target: path.join(releaseDir, get_release_filename('macOS', 'dmg')),
            basepath: path.join(appsDir, pkg.name, 'osx64'),
            specification: {
                title: 'BF Blackbox Explorer', // <= volume name; should be smaller than 27 chars.
                contents: [
                    { 'x': 448, 'y': 342, 'type': 'link', 'path': '/Applications' },
                    { 'x': 192, 'y': 344, 'type': 'file', 'path': pkg.name + '.app', 'name': 'Betaflight Blackbox Explorer.app' }
                ],
                background: path.join(__dirname, 'images/dmg-background.png'),
                format: 'UDZO',
                window: {
                    size: {
                        width: 638,
                        height: 479
                    }
                }
            },
        })
    );
}

// Create distributable .zip files in ./release
gulp.task('release', ['apps', 'clean-release'], function () {
    fs.mkdir(releaseDir, '0775', function(err) {
        if (err) {
            if (err.code !== 'EEXIST') {
                throw err;
            }
        }
    });

    platforms = getPlatforms(true);
    console.log('Packing release.');

    if (platforms.indexOf('chromeos') !== -1) {
        release_chromeos();
    }

    if (platforms.indexOf('linux64') !== -1) {
        release_linux64();
    }

    if (platforms.indexOf('osx64') !== -1) {
        release_osx64();
    }

    if (platforms.indexOf('win32') !== -1) {
        release_win32();
    }
});

gulp.task('default', ['debug']);

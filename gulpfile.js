'use strict';

const pkg = require('./package.json');

const child_process = require('child_process');
const fs = require('fs');
const path = require('path');

const zip = require('gulp-zip');
const del = require('del');
const innoSetup = require('@quanle94/innosetup');
const NwBuilder = require('nw-builder');
const deb = require('gulp-debian');
const buildRpm = require('rpm-builder')
const commandExistsSync = require('command-exists').sync;

const gulp = require('gulp');
const concat = require('gulp-concat');
const yarn = require("gulp-yarn");
const rename = require('gulp-rename');
const os = require('os');

const DIST_DIR = './dist/';
const APPS_DIR = './apps/';
const DEBUG_DIR = './debug/';
const RELEASE_DIR = './release/';

const LINUX_INSTALL_DIR = '/opt/betaflight';

var nwBuilderOptions = {
    version: '0.50.2',
    files: './dist/**/*',
    macIcns: './images/bf_icon.icns',
    macPlist: { 'CFBundleDisplayName': 'Betaflight Blackbox Explorer'},
    winIco: './images/bf_icon.ico',
};

//-----------------
//Pre tasks operations
//-----------------
const SELECTED_PLATFORMS = getInputPlatforms();

//-----------------
//Tasks
//-----------------

gulp.task('clean', gulp.parallel(clean_dist, clean_apps, clean_debug, clean_release));

gulp.task('clean-dist', clean_dist);

gulp.task('clean-apps', clean_apps);

gulp.task('clean-debug', clean_debug);

gulp.task('clean-release', clean_release);

gulp.task('clean-cache', clean_cache);

const distRebuild = gulp.series(clean_dist, dist);
gulp.task('dist', distRebuild);

const appsBuild = gulp.series(gulp.parallel(clean_apps, distRebuild), apps, gulp.parallel(listPostBuildTasks(APPS_DIR)));
gulp.task('apps', appsBuild);

const debugAppsBuild = gulp.series(gulp.parallel(clean_debug, distRebuild), debug, gulp.parallel(listPostBuildTasks(DEBUG_DIR)));

const debugBuild = gulp.series(dist, debug, gulp.parallel(listPostBuildTasks(DEBUG_DIR)), start_debug);
gulp.task('debug', debugBuild);

const releaseBuild = gulp.series(gulp.parallel(clean_release, appsBuild), gulp.parallel(listReleaseTasks(APPS_DIR)));
gulp.task('release', releaseBuild);

const debugReleaseBuild = gulp.series(gulp.parallel(clean_release, debugAppsBuild), gulp.parallel(listReleaseTasks(DEBUG_DIR)));
gulp.task('debug-release', debugReleaseBuild);

gulp.task('default', debugBuild);

// -----------------
// Helper functions
// -----------------

// Get platform from commandline args
// #
// # gulp <task> [<platform>]+        Run only for platform(s) (with <platform> one of --linux64, --linux32, --osx64, --win32 or --win64)
// # 
function getInputPlatforms() {
    var supportedPlatforms = ['linux64', 'linux32', 'osx64', 'win32', 'win64'];
    var platforms = [];
    var regEx = /--(\w+)/;
    for (var i = 3; i < process.argv.length; i++) {
        var arg = process.argv[i].match(regEx)[1];
        if (supportedPlatforms.indexOf(arg) > -1) {
             platforms.push(arg);
        } else {
             console.log('Unknown platform: ' + arg);
             process.exit();
        }
    }  

    if (platforms.length === 0) {
        var defaultPlatform = getDefaultPlatform();
        if (supportedPlatforms.indexOf(defaultPlatform) > -1) {
            platforms.push(defaultPlatform);
        } else {
            console.error(`Your current platform (${os.platform()}) is not a supported build platform. Please specify platform to build for on the command line.`);
            process.exit();
        }
    }

    if (platforms.length > 0) {
        console.log('Building for platform(s): ' + platforms + '.');
    } else {
        console.error('No suitables platforms found.');
        process.exit();
    }

    return platforms;
}

// Gets the default platform to be used
function getDefaultPlatform() {
    let defaultPlatform;
    switch (os.platform()) {
    case 'darwin':
        defaultPlatform = 'osx64';

        break;
    case 'linux':
        defaultPlatform = 'linux64';

        break;
    case 'win32':
        defaultPlatform = 'win32';

        break;

    default:
        defaultPlatform = '';

        break;
    }
    return defaultPlatform;
}

function getPlatforms() {
    return SELECTED_PLATFORMS.slice();
}

function removeItem(platforms, item) {
    const index = platforms.indexOf(item);
    if (index >= 0) {
        platforms.splice(index, 1);
    }
}

function getRunDebugAppCommand(arch) {

    let command;

    switch (arch) {
    case 'osx64':
        const pkgName = `${pkg.name}.app`;
        command = `open ${path.join(DEBUG_DIR, pkg.name, arch, pkgName)}`;

        break;

    case 'linux64':
    case 'linux32':
        command = path.join(DEBUG_DIR, pkg.name, arch, pkg.name);

        break;

    case 'win32':
    case 'win64':
        command = path.join(DEBUG_DIR, pkg.name, arch, pkg.name + '.exe');

        break;

    default:
        command = '';

        break;
    }

    return command;
}

function getReleaseFilename(platform, ext) {
    return `${pkg.name}_${pkg.version}_${platform}.${ext}`;
}

function clean_dist() { 
    return del([DIST_DIR + '**'], { force: true }); 
};

function clean_apps() { 
    return del([APPS_DIR + '**'], { force: true }); 
};

function clean_debug() { 
    return del([DEBUG_DIR + '**'], { force: true }); 
};

function clean_release() { 
    return del([RELEASE_DIR + '**'], { force: true }); 
};

function clean_cache() { 
    return del(['./cache/**'], { force: true }); 
};

// Real work for dist task. Done in another task to call it via
// run-sequence.
function dist() {
    var distSources = [
        // CSS files
        './css/header_dialog.css',
        './css/jquery.nouislider.min.css',
        './css/keys_dialog.css',
        './css/main.css',
        './css/user_settings_dialog.css',

        // JavaScript
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
        './js/workspace_selection.js',
        './js/graph_spectrum.js',
        './js/graph_spectrum_calc.js',
        './js/graph_spectrum_plot.js',
        './js/grapher.js',
        './js/sticks.js',
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
        './js/csv-exporter.js',
        './js/webworkers/csv-export-worker.js',
        './js/vendor/FileSaver.js',
        './js/vendor/jquery-1.11.3.min.js',
        './js/vendor/jquery-ui-1.11.4.min.js',
        './js/vendor/jquery.ba-throttle-debounce.js',
        './js/vendor/jquery.nouislider.all.min.js',
        './js/vendor/modernizr-2.6.2-respond-1.1.0.min.js',
        './js/vendor/semver.js',
        './js/vendor/three.js',
        './js/vendor/three.min.js',
        './js/screenshot.js',

        // everything else
        './package.json', // For NW.js
        './*.html',
        './images/**/*',
        './_locales/**/*',
    ];
    return gulp.src(distSources, { base: '.' })
        .pipe(gulp.dest(DIST_DIR))
        .pipe(yarn({
            production: true,
            ignoreScripts: true
        }));;
};

// Create runable app directories in ./apps
function apps(done) {
    var platforms = getPlatforms();

    buildNWApps(platforms, 'normal', APPS_DIR, done);
};

function listPostBuildTasks(folder, done) {

    var platforms = getPlatforms();

    var postBuildTasks = [];

    if (platforms.indexOf('win32') != -1) {
        postBuildTasks.push(function post_build_win32(done){ return post_build('win32', folder, done) });
    }

    if (platforms.indexOf('win64') != -1) {
        postBuildTasks.push(function post_build_win64(done){ return post_build('win64', folder, done) });
    }

    if (platforms.indexOf('linux32') != -1) {
        postBuildTasks.push(function post_build_linux32(done){ return post_build('linux32', folder, done) });
    }

    if (platforms.indexOf('linux64') != -1) {
        postBuildTasks.push(function post_build_linux64(done){ return post_build('linux64', folder, done) });
    }

    if (platforms.indexOf('osx64') != -1) {
        postBuildTasks.push(function post_build_osx64(done){ return post_build('osx64', folder, done) });
    }

    // We need to return at least one task, if not gulp will throw an error
    if (postBuildTasks.length == 0) {
        postBuildTasks.push(function post_build_none(done){ done() });
    }
    return postBuildTasks;
}

function post_build(arch, folder, done) {

    if ((arch == 'win32') || (arch == 'win64')) {
        // Copy ffmpeg codec library into Windows app
        var libSrc = './library/' + arch + '/ffmpeg.dll'
        var libDest = path.join(folder, pkg.name, arch);
        console.log('Copy ffmpeg library to Windows app (' + libSrc + ' to ' + libDest + ')');
        return gulp.src(libSrc)
                   .pipe(gulp.dest(libDest));
    }

    if ((arch == 'linux32') || (arch == 'linux64')) {

        // Copy Ubuntu launcher scripts to destination dir
        var launcherDir = path.join(folder, pkg.name, arch);

       // Copy ffmpeg codec library into Linux app
        var libSrc = './library/' + arch + '/libffmpeg.so'
        var libDest = path.join(launcherDir, 'lib');

        console.log('Copy Ubuntu launcher scripts to ' + launcherDir);        
        gulp.src('assets/linux/**')                   
            .pipe(gulp.dest(launcherDir))
            .on('end', function() {

                console.log('Copy ffmpeg library to Linux app (' + libSrc + ' to ' + libDest + ')');
                gulp.src(libSrc)
                    .pipe(gulp.dest(libDest))
                    .on('end', function() {done()});

            });
        return;
    }

    if (arch == 'osx64') {
        // Determine the WebKit version distributed in nw.js
        var pathToVersions = path.join(folder, pkg.name, 'osx64', pkg.name + '.app', 'Contents', 'Frameworks', 'nwjs Framework.framework', 'Versions');
        var files = fs.readdirSync(pathToVersions);
        if (files.length >= 1) {
            var webKitVersion = files[0];
            console.log('Found nwjs version: ' + webKitVersion)
            // Copy ffmpeg codec library into macOS app
            var libSrc = './library/osx64/libffmpeg.dylib'
            var libDest = path.join(pathToVersions, webKitVersion) + '/';
            console.log('Copy ffmpeg library to macOS app (' + libSrc + ' to ' + libDest + ')');
            return gulp.src(libSrc)
                       .pipe(gulp.dest(libDest));
        } else {
            console.log('Error: could not find the Version folder.');
        }
    }

    return done();
}

// Create debug app directories in ./debug
function debug(done) {
    var platforms = getPlatforms();

    buildNWApps(platforms, 'sdk', DEBUG_DIR, done);
}

function buildNWApps(platforms, flavor, dir, done) {

    if (platforms.length > 0) {
        var builder = new NwBuilder(Object.assign({
            buildDir: dir,
            platforms: platforms,
            flavor: flavor
        }, nwBuilderOptions));
        builder.on('log', console.log);
        builder.build(function (err) {
            if (err) {
                console.log('Error building NW apps: ' + err);
                clean_debug();
                process.exit(1);
            }
            done();
        });
    } else {
        console.log('No platform suitable for NW Build')
        done();
    }
}


function start_debug(done) {

    var platforms = getPlatforms();

    var exec = require('child_process').exec;    
    if (platforms.length === 1) {
        var run = getRunDebugAppCommand(platforms[0]);
        console.log('Starting debug app (' + run + ')...');
        exec(run);
    } else {
        console.log('More than one platform specified, not starting debug app');
    }
    done();
}

// Create installer package for windows platforms
function release_win(arch, appDirectory, done) {

    // Parameters passed to the installer script
    const parameters = [];

    // Extra parameters to replace inside the iss file
    parameters.push(`/Dversion=${pkg.version}`);
    parameters.push(`/DarchName=${arch}`);
    parameters.push(`/DarchAllowed=${(arch === 'win32') ? 'x86 x64' : 'x64'}`);
    parameters.push(`/DarchInstallIn64bit=${(arch === 'win32') ? '' : 'x64'}`);
    parameters.push(`/DsourceFolder=${appDirectory}`);
    parameters.push(`/DtargetFolder=${RELEASE_DIR}`);

    // Show only errors in console
    parameters.push(`/Q`);

    // Script file to execute
    parameters.push("assets/windows/installer.iss");

    innoSetup(parameters, {},
    function(error) {
        if (error != null) {
            console.error(`Installer for platform ${arch} finished with error ${error}`);
        } else {
            console.log(`Installer for platform ${arch} finished`);
        }
        done();
    });
}

// Create distribution package (zip) for windows and linux platforms
function release_zip(arch, appDirectory) {
    const src = path.join(appDirectory, pkg.name, arch, '**');
    const output = getReleaseFilename(arch, 'zip');
    const base = path.join(appDirectory, pkg.name, arch);

    return compressFiles(src, base, output, 'Betaflight Blackbox Explorer');
}

// Compress files from srcPath, using basePath, to outputFile in the RELEASE_DIR
function compressFiles(srcPath, basePath, outputFile, zipFolder) {
    return gulp.src(srcPath, { base: basePath })
               .pipe(rename(function(actualPath){ actualPath.dirname = path.join(zipFolder, actualPath.dirname) }))
               .pipe(zip(outputFile))
               .pipe(gulp.dest(RELEASE_DIR));
}

function release_deb(arch, appDirectory, done) {
    // Check if dpkg-deb exists
    if (!commandExistsSync('dpkg-deb')) {
        console.warn('dpkg-deb command not found, not generating deb package for ' + arch);
        return done();
    }

    var debArch;

    switch (arch) {
    case 'linux32':
        debArch = 'i386';
        break;
    case 'linux64':
        debArch = 'amd64';
        break;
    default:
        console.error("Deb package error, arch: " + arch);
        process.exit(1);
        break;
    }

    return gulp.src([path.join(appDirectory, pkg.name, arch, '*')])
        .pipe(deb({
             package: pkg.name,
             version: pkg.version,
             section: 'base',
             priority: 'optional',
             architecture: debArch,
             maintainer: pkg.author,
             description: pkg.description,
             preinst: [`rm -rf ${LINUX_INSTALL_DIR}/${pkg.name}`],
             postinst: [`chown root:root ${LINUX_INSTALL_DIR}`, `chown -R root:root ${LINUX_INSTALL_DIR}/${pkg.name}`, `cp ${LINUX_INSTALL_DIR}/${pkg.name}/mime/${pkg.name}.xml /usr/share/mime/packages/`, 'update-mime-database /usr/share/mime',
                        `cp ${LINUX_INSTALL_DIR}/${pkg.name}/icon/bf_icon_128.png /usr/share/icons/hicolor/128x128/mimetypes/application-x-blackboxlog.png`, 'gtk-update-icon-cache /usr/share/icons/hicolor -f',
                        `xdg-desktop-menu install ${LINUX_INSTALL_DIR}/${pkg.name}/${pkg.name}.desktop`],
             prerm: [`rm /usr/share/mime/packages/${pkg.name}.xml`, 'update-mime-database /usr/share/mime',
                     'rm /usr/share/icons/hicolor/128x128/mimetypes/application-x-blackboxlog.png', 'gtk-update-icon-cache /usr/share/icons/hicolor -f',
                     `xdg-desktop-menu uninstall ${pkg.name}.desktop`],
             depends: 'libgconf-2-4',
             changelog: [],
             _target: `${LINUX_INSTALL_DIR}/${pkg.name}`,
             _out: RELEASE_DIR,
             _copyright: 'assets/linux/copyright',
             _clean: true
    }));
}

function release_rpm(arch, appDirectory, done) {

    // Check if dpkg-deb exists
    if (!commandExistsSync('rpmbuild')) {
        console.warn('rpmbuild command not found, not generating rpm package for ' + arch);
        done();
    }

    // The buildRpm does not generate the folder correctly, manually
    createDirIfNotExists(RELEASE_DIR);

    var options = {
             name: pkg.name,
             version: pkg.version,
             buildArch: getLinuxPackageArch('rpm', arch),
             vendor: pkg.author,
             summary: pkg.description,
             license: 'GNU General Public License v3.0',
             requires: 'libgconf-2-4',
             prefix: '/opt',
             files:
                 [ { cwd: path.join(appDirectory, pkg.name, arch),
                     src: '*',
                     dest: `${LINUX_INSTALL_DIR}/${pkg.name}` } ],
             postInstallScript: [`cp ${LINUX_INSTALL_DIR}/${pkg.name}/mime/${pkg.name}.xml /usr/share/mime/packages/`, 'update-mime-database /usr/share/mime',
                                 `cp ${LINUX_INSTALL_DIR}/${pkg.name}/icon/bf_icon_128.png /usr/share/icons/hicolor/128x128/mimetypes/application-x-blackboxlog.png`, 'gtk-update-icon-cache /usr/share/icons/hicolor -f',
                                 `xdg-desktop-menu install ${LINUX_INSTALL_DIR}/${pkg.name}/${pkg.name}.desktop`,
                                 'xdg-desktop-menu forceupdate'],
             preUninstallScript: [`rm /usr/share/mime/packages/${pkg.name}.xml`, 'update-mime-database /usr/share/mime',
                                  'rm /usr/share/icons/hicolor/128x128/mimetypes/application-x-blackboxlog.png', 'gtk-update-icon-cache /usr/share/icons/hicolor -f',
                                  `xdg-desktop-menu uninstall ${pkg.name}.desktop`],
             tempDir: path.join(RELEASE_DIR,'tmp-rpm-build-' + arch),
             keepTemp: false,
             verbose: false,
             rpmDest: RELEASE_DIR
    };

    buildRpm(options, function(err, rpm) {
        if (err) {
          console.error("Error generating rpm package: " + err);
        }
        done();
    });
}

// Create distribution package for macOS platform
function release_osx64(appDirectory) {
    var appdmg = require('gulp-appdmg');

    // The appdmg does not generate the folder correctly, manually
    createDirIfNotExists(RELEASE_DIR);

    // The src pipe is not used
    return gulp.src(['.'])
        .pipe(appdmg({
            target: path.join(RELEASE_DIR, getReleaseFilename('macOS', 'dmg')),
            basepath: path.join(appDirectory, pkg.name, 'osx64'),
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

function getLinuxPackageArch(type, arch) {
    var packArch;

    switch (arch) {
    case 'linux32':
        packArch = 'i386';
        break;
    case 'linux64':
        if (type == 'rpm') {
            packArch = 'x86_64';
        } else {
            packArch = 'amd64';
        }
        break;
    default:
        console.error("Package error, arch: " + arch);
        process.exit(1);
        break;
    }

    return packArch;
}

// Create the dir directory, with write permissions
function createDirIfNotExists(dir) {
    fs.mkdir(dir, '0775', function(err) {
        if (err) {
            if (err.code !== 'EEXIST') {
                throw err;
            }
        }
    });
}

// Create a list of the gulp tasks to execute for release
function listReleaseTasks(appDirectory) {

    createDirIfNotExists(RELEASE_DIR);

    var platforms = getPlatforms();

    var releaseTasks = [];

    if (platforms.indexOf('linux64') !== -1) {
        releaseTasks.push(function release_linux64_zip(){
            return release_zip('linux64', appDirectory);
        });
        releaseTasks.push(function release_linux64_deb(done){
            return release_deb('linux64', appDirectory, done);
        });
        releaseTasks.push(function release_linux64_rpm(done){
            return release_rpm('linux64', appDirectory, done);
        });
    }

    if (platforms.indexOf('linux32') !== -1) {
        releaseTasks.push(function release_linux32_zip(){
            return release_zip('linux32', appDirectory);
        });
        releaseTasks.push(function release_linux32_deb(done){
            return release_deb('linux32', appDirectory, done);
        });
        releaseTasks.push(function release_linux32_rpm(done){
            return release_rpm('linux32', appDirectory, done);
        });
    }

    if (platforms.indexOf('osx64') !== -1) {
        releaseTasks.push(function () {
            return release_osx64(appDirectory);
        });
    }

    if (platforms.indexOf('win32') !== -1) {
        releaseTasks.push(function release_win32(done) {
            return release_win('win32', appDirectory, done);
        });
    }

    if (platforms.indexOf('win64') !== -1) {
        releaseTasks.push(function release_win64(done) {
            return release_win('win64', appDirectory, done);
        });
    }

    return releaseTasks;
}

'use strict';

const pkg = require('./package.json');

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
const yarn = require("gulp-yarn");
const rename = require('gulp-rename');
const os = require('os');
const git = require('simple-git')();
const source = require('vinyl-source-stream');
const stream = require('stream');

const DIST_DIR = './dist/';
const APPS_DIR = './apps/';
const DEBUG_DIR = './debug/';
const RELEASE_DIR = './release/';

const LINUX_INSTALL_DIR = '/opt/betaflight';

const NAME_REGEX = /-/g;

const nwBuilderOptions = {
    version: '0.72.0',
    files: './dist/**/*',
    macIcns: './images/bf_icon.icns',
    macPlist: { 'CFBundleDisplayName': 'Betaflight Blackbox Explorer'},
    winIco: './images/bf_icon.ico',
};

const metadata = {};

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

// dist_yarn MUST be done after dist_src

const distCommon = gulp.series(dist_src, dist_changelog, dist_yarn, dist_locale, dist_libraries, dist_resources);

const distBuild = gulp.series(process_package_release, distCommon);

const debugDistBuild = gulp.series(process_package_debug, distCommon);

const distRebuild = gulp.series(clean_dist, distBuild);
gulp.task('dist', distRebuild);

const appsBuild = gulp.series(gulp.parallel(clean_apps, distRebuild), apps, gulp.parallel(listPostBuildTasks(APPS_DIR)));
gulp.task('apps', appsBuild);

const debugAppsBuild = gulp.series(gulp.parallel(clean_debug, gulp.series(clean_dist, debugDistBuild)), debug, gulp.parallel(listPostBuildTasks(DEBUG_DIR)));

const debugBuildNoStart = gulp.series(debugDistBuild, debug, gulp.parallel(listPostBuildTasks(DEBUG_DIR)));
const debugBuild = gulp.series(debugBuildNoStart, start_debug);
gulp.task('debug', debugBuild);
gulp.task('debug-no-start', debugBuildNoStart);

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

function getGitRevision(done, callback, isReleaseBuild) {
    let gitRevision = 'none';

    git.raw([ 'rev-parse', '--short', 'HEAD' ], function (err, rev) {
        if (!err) {
            gitRevision = rev.replace(/(\r\n|\n|\r)/gm,"");
            callback(done, gitRevision, isReleaseBuild);
        }
    });
}

function process_package_release(done) {
    getGitRevision(done, processPackage, true);
}

function process_package_debug(done) {
    getGitRevision(done, processPackage, false);
}

function getInputPlatforms() {
    const supportedPlatforms = ['linux64', 'linux32', 'osx64', 'win32', 'win64'];
    const platforms = [];
    const regEx = /--(\w+)/;

    for (let i = 3; i < process.argv.length; i++) {
        const arg = process.argv[i].match(regEx)[1];
        if (supportedPlatforms.indexOf(arg) > -1) {
             platforms.push(arg);
        } else {
             console.log('Unknown platform: ' + arg);
             process.exit();
        }
    }  

    if (platforms.length === 0) {
        const defaultPlatform = getDefaultPlatform();
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
        defaultPlatform = 'win64';

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
        const packageName = `${metadata.name}.app`;
        command = `open ${path.join(DEBUG_DIR, metadata.name, arch, packageName)}`;

        break;
    case 'linux64':
    case 'linux32':
        command = path.join(DEBUG_DIR, metadata.name, arch, metadata.name);

        break;
    case 'win32':
    case 'win64':
        command = path.join(DEBUG_DIR, metadata.name, arch, metadata.name + '.exe');

        break;
    default:
        command = '';

        break;
    }

    return command;
}

function getReleaseFilename(platform, ext, portable = false) {
    return `${metadata.name}_${metadata.version}_${platform}${portable ? "-portable" : ""}.${ext}`;
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

function processPackage(done, gitRevision, isReleaseBuild) {
    const metadataKeys = [ 'name', 'productName', 'description', 'author', 'license', 'version', 'gitRevision' ];

    const pkg = require('./package.json');

    pkg.gitRevision = gitRevision;

    if (!isReleaseBuild) {
        pkg.productName = `${pkg.productName} (Debug Build)`;
        pkg.description = `${pkg.description} (Debug Build)`;
        pkg.version = `${pkg.version}-debug-${gitRevision}`;

        metadata.packageId = `${pkg.name}-debug`;
    } else {
        metadata.packageId = pkg.name;
    }

    function write_package_file() {
        Object.keys(pkg)
            .filter(key => metadataKeys.includes(key))
            .forEach((key) => {
                metadata[key] = pkg[key];
            });

        const packageJson = new stream.Readable;
        packageJson.push(JSON.stringify(pkg, undefined, 2));
        packageJson.push(null);

        return packageJson
            .pipe(source('package.json'))
            .pipe(gulp.dest(DIST_DIR));
    }

    gulp.series(write_package_file)(done);
}

function dist_src() {
    const distSources = [
        './css/**/*',
        './*.js',
        './js/**/*',
        './package.json', // For NW.js
        './*.html',
        './images/**/*',
        './_locales/**/*',
    ];

    return gulp.src(distSources, { base: '.' })
        .pipe(gulp.src('yarn.lock'))
        .pipe(gulp.dest(DIST_DIR));
}

function dist_changelog() {
    return gulp.src('changelog.html')
        .pipe(gulp.dest(DIST_DIR));
}

// This function relies on files from the dist_src function
function dist_yarn() {
    return gulp.src([`${DIST_DIR}package.json`, `${DIST_DIR}yarn.lock`])
        .pipe(gulp.dest(DIST_DIR))
        .pipe(yarn({
            production: true,
        }));
}

function dist_locale() {
    return gulp.src('./locales/**/*', { base: 'locales'})
        .pipe(gulp.dest(`${DIST_DIR}locales`));
}

function dist_libraries() {
    return gulp.src('./libraries/**/*', { base: '.'})
        .pipe(gulp.dest(`${DIST_DIR}js`));
}

function dist_resources() {
    return gulp.src(['./resources/**/*', '!./resources/osd/**/*.png'], { base: '.'})
        .pipe(gulp.dest(DIST_DIR));
}

// Create runable app directories in ./apps
function apps(done) {
    const platforms = getPlatforms();

    buildNWApps(platforms, 'normal', APPS_DIR, done);
};

function listPostBuildTasks(folder) {

    const platforms = getPlatforms();

    const postBuildTasks = [];

    if (platforms.indexOf('win32') != -1) {
        postBuildTasks.push(function post_build_win32(done){
            return post_build('win32', folder, done);
        });
    }

    if (platforms.indexOf('win64') != -1) {
        postBuildTasks.push(function post_build_win64(done){
            return post_build('win64', folder, done);
        });
    }

    if (platforms.indexOf('linux32') != -1) {
        postBuildTasks.push(function post_build_linux32(done){
            return post_build('linux32', folder, done);
        });
    }

    if (platforms.indexOf('linux64') != -1) {
        postBuildTasks.push(function post_build_linux64(done){
            return post_build('linux64', folder, done);
        });
    }

    if (platforms.indexOf('osx64') != -1) {
        postBuildTasks.push(function post_build_osx64(done){
            return post_build('osx64', folder, done);
        });
    }

    // We need to return at least one task, if not gulp will throw an error
    if (postBuildTasks.length == 0) {
        postBuildTasks.push(function post_build_none(done){
            done();
        });
    }
    return postBuildTasks;
}

function post_build(arch, folder, done) {

    if ((arch == 'win32') || (arch == 'win64')) {
        // Copy ffmpeg codec library into Windows app
        const libSrc = './library/' + arch + '/ffmpeg.dll';
        const libDest = path.join(folder, metadata.name, arch);
        console.log('Copy ffmpeg library to Windows app (' + libSrc + ' to ' + libDest + ')');
        return gulp.src(libSrc)
                   .pipe(gulp.dest(libDest));
    }

    if ((arch == 'linux32') || (arch == 'linux64')) {

        // Copy Ubuntu launcher scripts to destination dir
        const launcherDir = path.join(folder, pkg.name, arch);

       // Copy ffmpeg codec library into Linux app
        const libSrc = './library/' + arch + '/libffmpeg.so';
        const libDest = path.join(launcherDir, 'lib');

        console.log('Copy Ubuntu launcher scripts to ' + launcherDir);        
        gulp.src('assets/linux/**')
            .pipe(gulp.dest(launcherDir))
            .on('end', function() {

                console.log('Copy ffmpeg library to Linux app (' + libSrc + ' to ' + libDest + ')');
                gulp.src(libSrc)
                    .pipe(gulp.dest(libDest))
                    .on('end', function() {
                        done();
                    });

            });
        return;
    }

    if (arch == 'osx64') {
        // Determine the WebKit version distributed in nw.js
        const pathToVersions = path.join(folder, metadata.name, 'osx64', metadata.name + '.app', 'Contents', 'Frameworks', 'nwjs Framework.framework', 'Versions');
        const files = fs.readdirSync(pathToVersions);
        if (files.length >= 1) {
            const webKitVersion = files[0];
            console.log('Found nwjs version: ' + webKitVersion);
            // Copy ffmpeg codec library into macOS app
            const libSrc = './library/osx64/libffmpeg.dylib';
            const libDest = path.join(pathToVersions, webKitVersion) + '/';
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
    const platforms = getPlatforms();

    buildNWApps(platforms, 'sdk', DEBUG_DIR, done);
}

function buildNWApps(platforms, flavor, dir, done) {

    if (platforms.length > 0) {
        const builder = new NwBuilder(Object.assign({
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

    const platforms = getPlatforms();

    const exec = require('child_process').exec;    
    if (platforms.length === 1) {
        const run = getRunDebugAppCommand(platforms[0]);
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
    parameters.push(`/Dversion=${metadata.version}`);
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
    const src = path.join(appDirectory, metadata.name, arch, '**');
    const output = getReleaseFilename(arch, 'zip', true);
    const base = path.join(appDirectory, metadata.name, arch);

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

    let debArch;

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

    return gulp.src([path.join(appDirectory, metadata.name, arch, '*')])
        .pipe(deb({
            package: metadata.name,
            version: metadata.version,
            section: 'base',
            priority: 'optional',
            architecture: debArch,
            maintainer: metadata.author,
            description: metadata.description,
            preinst: [
                `rm -rf ${LINUX_INSTALL_DIR}/${metadata.name}`,
            ],
            postinst: [
                `chown root:root ${LINUX_INSTALL_DIR}`,
                `chown -R root:root ${LINUX_INSTALL_DIR}/${metadata.name}`,
                `cp ${LINUX_INSTALL_DIR}/${metadata.name}/mime/${metadata.name}.xml /usr/share/mime/packages/`, 'update-mime-database /usr/share/mime',
                `cp ${LINUX_INSTALL_DIR}/${metadata.name}/icon/bf_icon_128.png /usr/share/icons/hicolor/128x128/mimetypes/application-x-blackboxlog.png`, 'gtk-update-icon-cache /usr/share/icons/hicolor -f',
                `xdg-desktop-menu install ${LINUX_INSTALL_DIR}/${metadata.name}/${metadata.name}.desktop`,
                `chmod +xr ${LINUX_INSTALL_DIR}/${metadata.name}/chrome_crashpad_handler`,
                `chmod +xr ${LINUX_INSTALL_DIR}/${metadata.name}/${metadata.name}`,
                `chmod -R +Xr ${LINUX_INSTALL_DIR}/${metadata.name}/`,
            ],
            prerm: [
                `rm /usr/share/mime/packages/${metadata.name}.xml`, 'update-mime-database /usr/share/mime',
                'rm /usr/share/icons/hicolor/128x128/mimetypes/application-x-blackboxlog.png', 'gtk-update-icon-cache /usr/share/icons/hicolor -f',
                `xdg-desktop-menu uninstall ${metadata.name}.desktop`,
            ],
            conffiles: './test/configs/opt/etc/dummy.cfg',
            depends: 'libgconf-2-4',
            changelog: [],
            _target: `${LINUX_INSTALL_DIR}/${metadata.name}`,
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

    const options = {
        name: metadata.name,
        version: metadata.version.replace(NAME_REGEX, '_'),
        buildArch: getLinuxPackageArch('rpm', arch),
        vendor: metadata.author,
        summary: metadata.description,
        license: 'GNU General Public License v3.0',
        requires: 'libgconf-2-4',
        prefix: '/opt',
        files: [
            {
                cwd: path.join(appDirectory, metadata.name, arch),
                src: '*',
                dest: `${LINUX_INSTALL_DIR}/${metadata.name}`,
            },
        ],
        postInstallScript: [
            `cp ${LINUX_INSTALL_DIR}/${metadata.name}/mime/${metadata.name}.xml /usr/share/mime/packages/`, 'update-mime-database /usr/share/mime',
            `cp ${LINUX_INSTALL_DIR}/${metadata.name}/icon/bf_icon_128.png /usr/share/icons/hicolor/128x128/mimetypes/application-x-blackboxlog.png`, 'gtk-update-icon-cache /usr/share/icons/hicolor -f',
            `xdg-desktop-menu install ${LINUX_INSTALL_DIR}/${metadata.name}/${metadata.name}.desktop`,
            'xdg-desktop-menu forceupdate',
        ],
        preUninstallScript: [
            `rm /usr/share/mime/packages/${metadata.name}.xml`, 'update-mime-database /usr/share/mime',
            'rm /usr/share/icons/hicolor/128x128/mimetypes/application-x-blackboxlog.png', 'gtk-update-icon-cache /usr/share/icons/hicolor -f',
            `xdg-desktop-menu uninstall ${metadata.name}.desktop`,
        ],
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
    const appdmg = require('./gulp-appdmg');

    // The appdmg does not generate the folder correctly, manually
    createDirIfNotExists(RELEASE_DIR);

    // The src pipe is not used
    return gulp.src(['.'])
        .pipe(appdmg({
            target: path.join(RELEASE_DIR, getReleaseFilename('macOS', 'dmg')),
            basepath: path.join(appDirectory, metadata.name, 'osx64'),
            specification: {
                title: 'BF Blackbox Explorer', // <= volume name; should be smaller than 27 chars.
                contents: [
                    { 'x': 448, 'y': 342, 'type': 'link', 'path': '/Applications' },
                    { 'x': 192, 'y': 344, 'type': 'file', 'path': metadata.name + '.app', 'name': 'Betaflight Blackbox Explorer.app' },
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
    let packArch;

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

    const platforms = getPlatforms();

    const releaseTasks = [];

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
        releaseTasks.push(function release_win32_zip() {
            return release_zip('win32', appDirectory);
        });
        releaseTasks.push(function release_win32(done) {
            return release_win('win32', appDirectory, done);
        });
    }

    if (platforms.indexOf('win64') !== -1) {
        releaseTasks.push(function release_win64_zip() {
            return release_zip('win64', appDirectory);
        });
        releaseTasks.push(function release_win64(done) {
            return release_win('win64', appDirectory, done);
        });
    }

    return releaseTasks;
}

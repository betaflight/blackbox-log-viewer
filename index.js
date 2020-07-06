
openLinksInExternalBrowserByDefault();

$(document).ready(function () {
    // translate to user-selected language
    if (isNW()) {
        localize();
    }
});

function checkForConfiguratorUpdates() {
    var releaseChecker = new ReleaseChecker('configurator', 'https://api.github.com/repos/betaflight/blackbox-log-viewer/releases');

    releaseChecker.loadReleaseData(notifyOutdatedVersion);
}

function notifyOutdatedVersion(releaseData) {
    chrome.storage.local.get('checkForUnstableVersions', function (result) {
        var showUnstableReleases = false;
        if (result.checkForConfiguratorUnstableVersions) {
            showUnstableReleases = true;
        }
        var versions = releaseData.filter(function (version) {
            var semVerVersion = semver.parse(version.tag_name);
            if (semVerVersion && (showUnstableReleases || semVerVersion.prerelease.length === 0)) {
                return version;
            }
        }).sort(function (v1, v2) {
            try {
                return semver.compare(v2.tag_name, v1.tag_name);
            } catch (e) {
                return false;
            }
        });

        if (versions.length > 0 && semver.lt(getManifestVersion(), versions[0].tag_name)) {
            GUI.log(chrome.i18n.getMessage('updateNotice', [versions[0].tag_name, versions[0].html_url]));

            var dialog = $('.dialogUpdate')[0];

            $('.dialogUpdate-content').html(chrome.i18n.getMessage('updateNotice', [versions[0].tag_name, versions[0].html_url]));

            $('.dialogUpdate-closebtn').click(function () {
                dialog.close();
            });

            $('.dialogUpdate-websitebtn').click(function () {
                dialog.close();

                window.open(versions[0].html_url);
            });

            dialog.showModal();
        }
    });
}

if (isNW()) {
    checkForConfiguratorUpdates();
}

function openLinksInExternalBrowserByDefault() {

    if (isNW()) {
        const gui = require('nw.gui');

        //Get the current window
        const win = gui.Window.get();

        win.on('new-win-policy', function(frame, url, policy) {
            // do not open the window
            policy.ignore();
            // and open it in external browser
            gui.Shell.openExternal(url);
        });
    }
}



'use strict';

function startApplication() {
    const timestampId = Date.now();
    chrome.app.window.create('index.html',
    {
        id: `main${timestampId}`,
        frame: 'chrome',
        innerBounds : {
            'width' : 1340,
            'height' : 920,
        },
    },
    function (createdWindow) {
        if (getChromeVersion() >= 54) {
            createdWindow.icon = 'images/bf_icon_128.png';
        }
    });
}

function getChromeVersion () {
    const raw = navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./);

    return raw ? parseInt(raw[2], 10) : false;
}

chrome.app.runtime.onLaunched.addListener(startApplication);

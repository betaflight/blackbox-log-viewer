'use strict';

function startApplication() {
    chrome.app.window.create('index.html', {
        id: 'main',
        frame: 'chrome',
        innerBounds : {
            'width' : 1340,
            'height' : 920
        },
        title: 'Betaflight - Blackbox Explorer'
    });
}

chrome.app.runtime.onLaunched.addListener(startApplication);

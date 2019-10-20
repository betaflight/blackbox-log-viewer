"use strict";

function makeScreenshot() {
    let el = document.querySelector("#screenshot-frame"),
        elStyle = getComputedStyle(el),
        options = {
            /*
            The element that contains the graph has `position: fixed` set with `top: 60px`.
            This option ensures, that the image content won't overflow to the bottom.
            */
            scrollY: -1 * parseInt(elStyle.top),
        };
    html2canvas(el, options).then(canvas => {
        window.canv = canvas;
        let anchor = document.createElement("a");
        anchor.download = "graph-screenshot.png";
        anchor.href = canvas.toDataURL();
        anchor.click();
    });
}
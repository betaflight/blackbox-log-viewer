"use strict";

function FlightLogAnalyser(flightLog, canvas, analyserCanvas) {

const
        ANALYSER_LARGE_LEFT_MARGIN    = 10,
        ANALYSER_LARGE_TOP_MARGIN     = 10,
        ANALYSER_LARGE_HEIGHT_MARGIN  = 20,
        ANALYSER_LARGE_WIDTH_MARGIN   = 20;

var 
    that = this,

    mouseFrequency= null,

    analyserZoomX = 1.0, /* 100% */
    analyserZoomY = 1.0, /* 100% */

    dataBuffer = {
        fieldIndex: 0,
        curve: 0,
        fieldName: null
    },

    dataReload = false,

    fftData = null;

    try {

        var isFullscreen = false;

        var sysConfig = flightLog.getSysConfig();
        GraphSpectrumCalc.initialize(flightLog, sysConfig);
        GraphSpectrumPlot.initialize(analyserCanvas, sysConfig);

        var analyserZoomXElem = $("#analyserZoomX");
        var analyserZoomYElem = $("#analyserZoomY");

        var spectrumToolbarElem = $('#spectrumToolbar');
        var spectrumTypeElem = $("#spectrumTypeSelect");
        var overdrawSpectrumTypeElem = $("#overdrawSpectrumTypeSelect");

        this.setFullscreen = function(size) {
            isFullscreen = (size==true);
            GraphSpectrumPlot.setFullScreen(isFullscreen);
            that.resize();
        };

        this.setInTime = function(time) {
            dataReload = true;
            return GraphSpectrumCalc.setInTime(time);;
        };

        this.setOutTime = function(time) {
            dataReload = true;
            return GraphSpectrumCalc.setOutTime(time);;
        };

        var getSize = function () {
            if (isFullscreen){
                return {
                        height: canvas.clientHeight - ANALYSER_LARGE_HEIGHT_MARGIN,
                        width: canvas.clientWidth - ANALYSER_LARGE_WIDTH_MARGIN,
                        left: ANALYSER_LARGE_LEFT_MARGIN,
                        top: ANALYSER_LARGE_TOP_MARGIN
                };
            } else {
                return {
                    height: canvas.height * parseInt(userSettings.analyser.size) / 100.0,
                    width: canvas.width * parseInt(userSettings.analyser.size) / 100.0,
                    left: (canvas.width * parseInt(userSettings.analyser.left) / 100.0),
                    top:  (canvas.height * parseInt(userSettings.analyser.top) / 100.0)
                };
            }
        };

       	this.resize = function() {

            var newSize = getSize();

            // Determine the analyserCanvas location
            GraphSpectrumPlot.setSize(newSize.width, newSize.height);

            // Recenter the analyser canvas in the bottom left corner
            var parentElem = $(analyserCanvas).parent();

            $(parentElem).css({
                left: newSize.left, // (canvas.width  * getSize().left) + "px",
                top:  newSize.top   // (canvas.height * getSize().top ) + "px"
            });
            // place the sliders.
            $("input:first-of-type", parentElem).css({
                left: (newSize.width - 130) + "px"
            });
            $("input:last-of-type", parentElem).css({
                left: (newSize.width - 20) + "px"
            });
            $("#analyserResize", parentElem).css({
                left: (newSize.width - 28) + "px"
            });

        };

        var dataLoad = function() {

            GraphSpectrumCalc.setDataBuffer(dataBuffer);

            switch(spectrumType) {

            case SPECTRUM_TYPE.FREQUENCY:
                fftData = GraphSpectrumCalc.dataLoadFrequency();
                break;

            case SPECTRUM_TYPE.FREQ_VS_THROTTLE:
                fftData = GraphSpectrumCalc.dataLoadFrequencyVsThrottle();
                break;

            }

        };

        /* This function is called from the canvas drawing routines within grapher.js
           It is only used to record the current curve positions, collect the data and draw the 
           analyser on screen*/
        this.plotSpectrum =	function (fieldIndex, curve, fieldName) {
            // Store the data pointers
            dataBuffer = {
                    fieldIndex: fieldIndex,
                    curve: curve,
                    fieldName: fieldName
            };

            // Detect change of selected field.... reload and redraw required.
            if ((fftData == null) || (fieldIndex != fftData.fieldIndex) || dataReload) {
                dataReload = false;
                dataLoad();			
                GraphSpectrumPlot.setData(fftData, spectrumType);
            }

            that.draw(); // draw the analyser on the canvas....
        };

        this.destroy = function() {
            $(analyserCanvas).off("mousemove", trackFrequency);
            $(analyserCanvas).off("touchmove", trackFrequency);
        };

        this.refresh = function() {
            that.draw();
        };

        this.draw = function() {
            GraphSpectrumPlot.draw();
        };

        /* Add mouse/touch over event to read the frequency */
        $(analyserCanvas).on('mousemove', function (e) {
            trackFrequency(e, that);
        });
        $(analyserCanvas).on('touchmove', function (e) {
            trackFrequency(e, that);
        });

        /* add zoom controls */
        analyserZoomXElem.on('input', function () {
            analyserZoomX = (analyserZoomXElem.val() / 100);
            GraphSpectrumPlot.setZoom(analyserZoomX, analyserZoomY);
            that.refresh();
        }).val(100);

        analyserZoomYElem.on('input', function () {
            analyserZoomY = 1 / (analyserZoomYElem.val() / 100);
            GraphSpectrumPlot.setZoom(analyserZoomX, analyserZoomY);
            that.refresh();
        }).val(100);

        // Spectrum type to show
        var spectrumType  = parseInt(spectrumTypeElem.val(), 10);

        spectrumTypeElem.change(function() {
            var optionSelected = parseInt(spectrumTypeElem.val(), 10);

            if (optionSelected != spectrumType) {
                spectrumType = optionSelected;

                // Recalculate the data, for the same curve than now, and draw it
                dataReload = true;
                that.plotSpectrum(dataBuffer.fieldIndex, dataBuffer.curve, dataBuffer.fieldName);
            }
        });

        // Spectrum overdraw to show
        var overdrawSpectrumType  = parseInt(overdrawSpectrumTypeElem.val(), 10);
        GraphSpectrumPlot.setOverdraw(overdrawSpectrumType);

        overdrawSpectrumTypeElem.change(function() {
            var optionSelected = parseInt(overdrawSpectrumTypeElem.val(), 10);

            if (optionSelected != overdrawSpectrumType) {
                overdrawSpectrumType = optionSelected;

                // Refresh the graph
                GraphSpectrumPlot.setOverdraw(overdrawSpectrumType);
                that.draw();
            }
        });

        // track frequency under mouse
        var lastMouseX = 0,
            lastMouseY = 0;
         
        function trackFrequency(e, analyser) {
            if(e.shiftKey) {

                // Hide the combo and maximize buttons
                spectrumToolbarElem.removeClass('non-shift');

                var rect = analyserCanvas.getBoundingClientRect();
                var mouseX = e.clientX - rect.left;
                var mouseY = e.clientY - rect.top;
                if (mouseX != lastMouseX || mouseY != lastMouseY) {
                    lastMouseX = mouseX;
                    lastMouseY = mouseY;
                    GraphSpectrumPlot.setMousePosition(mouseX, mouseY);
                    if (analyser) {
                        analyser.refresh();
                    }
                }
                e.preventDefault();
            } else {
                spectrumToolbarElem.addClass('non-shift');
            }
        }

    } catch (e) {
        console.log('Failed to create analyser... error:' + e);
    }
}

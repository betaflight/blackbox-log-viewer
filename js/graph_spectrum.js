"use strict";

function FlightLogAnalyser(flightLog, canvas, analyserCanvas) {

var
        ANALYSER_LARGE_LEFT_MARGIN    = 10,
        ANALYSER_LARGE_TOP_MARGIN     = 10,
        ANALYSER_LARGE_HEIGHT_MARGIN  = 20,
        ANALYSER_LARGE_WIDTH_MARGIN   = 20;

var that = this;

var mouseFrequency= null;
var analyserZoomX = 1.0; /* 100% */
var analyserZoomY = 1.0; /* 100% */

var MAX_ANALYSER_LENGTH = 300 * 1000 * 1000; // 5min
var analyserTimeRange  = { 
							in: 0,
						   out: MAX_ANALYSER_LENGTH
};
var dataReload = false;

this.setInTime = function(time) {
	analyserTimeRange.in = time;
	dataReload = true;
	return analyserTimeRange.in;
};
this.setOutTime = function(time) {
    if((time - analyserTimeRange.in) <= MAX_ANALYSER_LENGTH) {
        analyserTimeRange.out = time;
        dataReload = true;
        return analyserTimeRange.out;
    }
	analyserTimeRange.out = analyserTimeRange.in + MAX_ANALYSER_LENGTH; // 5min
    dataReload = true;
	return analyserTimeRange.out;
};
	  
try {
	var sysConfig = flightLog.getSysConfig();
	var gyroRate = (1000000/sysConfig['looptime']).toFixed(0);
	var pidRate = 1000; //default for old logs
    var isFullscreen = false;

    GraphSpectrumPlot.initialize(analyserCanvas, sysConfig);

    var analyserZoomXElem = $("#analyserZoomX");
    var analyserZoomYElem = $("#analyserZoomY");

    // Correct the PID rate if we know the pid_process_denom (from log header)
    if (sysConfig.pid_process_denom != null) {
		pidRate = gyroRate / sysConfig.pid_process_denom;
	}
    
    var blackBoxRate = gyroRate * sysConfig['frameIntervalPNum'] / sysConfig['frameIntervalPDenom'];	
    if (sysConfig.pid_process_denom != null) {
        blackBoxRate = blackBoxRate / sysConfig.pid_process_denom;
    }

	var dataBuffer = {
			fieldIndex: 0,
			curve: 0,
            fieldName: null
		};
    var fftData = {
		fieldIndex: -1,
		fftLength: 0,
		fftOutput: 0,
		maxNoiseIdx: 0,
		blackBoxRate: 0
	};

	this.setFullscreen = function(size) {
		isFullscreen = (size==true);
        GraphSpectrumPlot.setFullScreen(isFullscreen);
		that.resize();
	};

	var getSize = function () {
		if (isFullscreen){
				return {
                    height: canvas.clientHeight - ANALYSER_LARGE_HEIGHT_MARGIN,
                    width: canvas.clientWidth - ANALYSER_LARGE_WIDTH_MARGIN,
                    left: ANALYSER_LARGE_LEFT_MARGIN,
                    top: ANALYSER_LARGE_TOP_MARGIN
                }
			} else {
				return {
					height: canvas.height * parseInt(userSettings.analyser.size) / 100.0,
					width: canvas.width * parseInt(userSettings.analyser.size) / 100.0,
					left: (canvas.width * parseInt(userSettings.analyser.left) / 100.0) + "px",
					top:  (canvas.height * parseInt(userSettings.analyser.top) / 100.0) + "px"
                }
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
		})

	};

    var getFlightSamples = function(samples) {
        //load all samples
        var logStart = flightLog.getMinTime();
        var logEnd = ((flightLog.getMaxTime() - logStart) <= MAX_ANALYSER_LENGTH)? flightLog.getMaxTime() : (logStart+MAX_ANALYSER_LENGTH);
        if(analyserTimeRange.in) {
            logStart = analyserTimeRange.in;
        }
        if(analyserTimeRange.out) {
            logEnd = analyserTimeRange.out;
        }
        var allChunks = flightLog.getChunksInTimeRange(logStart, logEnd); //Max 300 seconds

        // Loop through all the samples in the chunks and assign them to a sample array ready to pass to the FFT.
        var samplesCount = 0;
        for (var chunkIndex = 0; chunkIndex < allChunks.length; chunkIndex++) {
            var chunk = allChunks[chunkIndex];
            for (var frameIndex = 0; frameIndex < chunk.frames.length; frameIndex++) {
                samples[samplesCount++] = (dataBuffer.curve.lookupRaw(chunk.frames[frameIndex][dataBuffer.fieldIndex]));
            }
        }

        return samplesCount;
    };

    var hanningWindow = function(samples, size) {

        if (!size) {
            size = samples.length;
        }

        for(var i=0; i < size; i++) {
            samples[i] *= 0.5 * (1-Math.cos((2*Math.PI*i)/(fftData.samples - 1)));
        }
    };

    var fft  = function(samples) {

        var fftLength = samples.length;
        var fftOutput = new Float64Array(fftLength * 2);
        var fft = new FFT.complex(fftLength, false);

        fft.simple(fftOutput, samples, 'real');

        return fftOutput;
    };

    /**
     * Makes all the values absolute and returns the index of maxFrequency found
     */
    var normalizeFft = function(fftOutput, fftLength) {

        if (!fftLength) {
            fftLength = fftOutput.length;
        }

        // Make all the values absolute, and calculate some useful values (max noise, etc.)
        var maxFrequency = (blackBoxRate / 2.0);
        var noiseLowEndIdx = 100 / maxFrequency * fftLength;
        var maxNoiseIdx = 0;
        var maxNoise = 0;
        
        for (var i = 0; i < fftLength; i++) {
            fftOutput[i] = Math.abs(fftOutput[i]);
            if (i > noiseLowEndIdx && fftOutput[i] > maxNoise) {
                maxNoise = fftOutput[i];
                maxNoiseIdx = i;
            }
        }

        maxNoiseIdx = maxNoiseIdx / fftLength * maxFrequency;

        var fftData = {
            fieldIndex   : dataBuffer.fieldIndex,
            fieldName    : dataBuffer.fieldName,
            fftLength    : fftLength,
            fftOutput    : fftOutput,
            maxNoiseIdx  : maxNoiseIdx,
            blackBoxRate : blackBoxRate,
        };

        return fftData;
    };

    var dataLoad = function() {

        var samples = new Float64Array(MAX_ANALYSER_LENGTH/1000);

        var samplesCount = getFlightSamples(samples);

        if(userSettings.analyserHanning) {
            hanningWindow(samples, samplesCount);
        }

        //calculate fft
        var fftOutput = fft(samples);

        // Normalize the result
        fftData = normalizeFft(fftOutput, samplesCount)

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
			if ((fieldIndex != fftData.fieldIndex) || dataReload) {
				dataReload = false;
				dataLoad();			
                GraphSpectrumPlot.setData(fftData);
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
    analyserZoomXElem.on('input',
		function () {
		analyserZoomX = (analyserZoomXElem.val() / 100);
        GraphSpectrumPlot.setZoom(analyserZoomX, analyserZoomY);
		that.refresh();
		}            
	); analyserZoomXElem.val(100);
    analyserZoomYElem.on('input',
		function () {
		analyserZoomY = 1 / (analyserZoomYElem.val() / 100);
        GraphSpectrumPlot.setZoom(analyserZoomX, analyserZoomY);
		that.refresh();
		}            
	); analyserZoomYElem.val(100);

	}	catch (e) {
		console.log('Failed to create analyser... error:' + e);
    }
    // track frequency under mouse
    var lastFrequency;
    function trackFrequency(e, analyser) {
        if(e.shiftKey) {
            var rect = analyserCanvas.getBoundingClientRect();
            mouseFrequency = ((e.clientX - rect.left) / analyserCanvas.width) * ((blackBoxRate / analyserZoomX) / 2);
            if(lastFrequency != mouseFrequency) {
                lastFrequency = mouseFrequency;
                GraphSpectrumPlot.setMouseFrequency(mouseFrequency);
                if (analyser) {
                    analyser.refresh();
                }
            }
            e.preventDefault();
        }
    }

}


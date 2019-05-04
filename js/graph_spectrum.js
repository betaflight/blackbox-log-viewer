"use strict";

function FlightLogAnalyser(flightLog, canvas, analyserCanvas) {

const
        ANALYSER_LARGE_LEFT_MARGIN    = 10,
        ANALYSER_LARGE_TOP_MARGIN     = 10,
        ANALYSER_LARGE_HEIGHT_MARGIN  = 20,
        ANALYSER_LARGE_WIDTH_MARGIN   = 20,
        FIELD_THROTTLE_NAME           = 'rcCommands[3]',
        FREQ_VS_THR_CHUNK_TIME_MS     = 300,
        FREQ_VS_THR_WINDOW_DIVISOR    = 6;

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

    var spectrumTypeElem = $("#spectrumTypeSelect");

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

    var getFlightChunks = function() {
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

        return allChunks;
    }

    var getFlightSamplesFreq = function() {

        var allChunks = getFlightChunks();

        var samples = new Float64Array(MAX_ANALYSER_LENGTH / (1000 * 1000) * blackBoxRate);

        // Loop through all the samples in the chunks and assign them to a sample array ready to pass to the FFT.
        var samplesCount = 0;
        for (var chunkIndex = 0; chunkIndex < allChunks.length; chunkIndex++) {
            var chunk = allChunks[chunkIndex];
            for (var frameIndex = 0; frameIndex < chunk.frames.length; frameIndex++) {
                samples[samplesCount] = (dataBuffer.curve.lookupRaw(chunk.frames[frameIndex][dataBuffer.fieldIndex]));
                samplesCount++;
            }
        }

        return {
                samples  : samples,
                count    : samplesCount
               };
    };

    var getFlightSamplesFreqVsThrottle = function() {

        var allChunks = getFlightChunks();

        var samples = new Float64Array(MAX_ANALYSER_LENGTH / (1000 * 1000) * blackBoxRate);
        var throttle = new Uint16Array(MAX_ANALYSER_LENGTH / (1000 * 1000) * blackBoxRate);

        var FIELD_THROTTLE_INDEX = flightLog.getMainFieldIndexByName(FIELD_THROTTLE_NAME);

        // Loop through all the samples in the chunks and assign them to a sample array ready to pass to the FFT.
        var samplesCount = 0;
        for (var chunkIndex = 0; chunkIndex < allChunks.length; chunkIndex++) {
            var chunk = allChunks[chunkIndex];
            for (var frameIndex = 0; frameIndex < chunk.frames.length; frameIndex++) {
                samples[samplesCount] = (dataBuffer.curve.lookupRaw(chunk.frames[frameIndex][dataBuffer.fieldIndex]));
                throttle[samplesCount] = chunk.frames[frameIndex][FIELD_THROTTLE_INDEX]*10;
                samplesCount++;
            }
        }

        return {
                samples  : samples,
                throttle : throttle,
                count    : samplesCount
               };
    };

    var hanningWindow = function(samples, size) {

        if (!size) {
            size = samples.length;
        }

        for(var i=0; i < size; i++) {
            samples[i] *= 0.5 * (1-Math.cos((2*Math.PI*i)/(size - 1)));
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

    var dataLoadFrequency = function() {

        var flightSamples = getFlightSamplesFreq();

        if(userSettings.analyserHanning) {
            hanningWindow(flightSamples.samples, flightSamples.count);
        }

        //calculate fft
        var fftOutput = fft(flightSamples.samples);

        // Normalize the result
        fftData = normalizeFft(fftOutput, flightSamples.samples.length);
    }

    var dataLoadFrequencyVsThrottle = function() {

        var flightSamples = getFlightSamplesFreqVsThrottle();

        // We divide it into FREQ_VS_THR_CHUNK_TIME_MS FFT chunks, we calculate the average throttle 
        // for each chunk. We use a moving window to get more chunks available. 
        var fftChunkLength = blackBoxRate * FREQ_VS_THR_CHUNK_TIME_MS / 1000;
        var fftChunkWindow = Math.round(fftChunkLength / FREQ_VS_THR_WINDOW_DIVISOR);

        var matrixFftOutput = new Array(100);  // One for each throttle value, without decimal part
        var maxNoiseThrottle = 0; // Stores the max noise produced
        var numberSamplesThrottle = new Uint32Array(100); // Number of samples in each throttle value, used to average them later.

        var fft = new FFT.complex(fftChunkLength, false);
        for (var fftChunkIndex = 0; fftChunkIndex + fftChunkLength < flightSamples.samples.length; fftChunkIndex += fftChunkWindow) {
            
            var fftInput = flightSamples.samples.slice(fftChunkIndex, fftChunkIndex + fftChunkLength);
            var fftOutput = new Float64Array(fftChunkLength * 2);

            fft.simple(fftOutput, fftInput, 'real');

            if(userSettings.analyserHanning) {
                hanningWindow(fftOutput, fftChunkLength * 2);
            }

            fftOutput = fftOutput.slice(0, fftChunkLength);

            // Use only abs values
            for (var i = 0; i < fftChunkLength; i++) {
                fftOutput[i] = Math.abs(fftOutput[i]);
                if (fftOutput[i] > maxNoiseThrottle) {
                    maxNoiseThrottle = fftOutput[i];
                }
            }

            // Calculate average throttle, removing the decimal part
            var avgThrottle = 0; 
            for (var indexThrottle = fftChunkIndex; indexThrottle < fftChunkIndex + fftChunkLength; indexThrottle++) {
                avgThrottle += flightSamples.throttle[indexThrottle];
            } 
            avgThrottle = Math.round(avgThrottle / 10 / fftChunkLength);

            numberSamplesThrottle[avgThrottle]++;
            if (!matrixFftOutput[avgThrottle]) {
                matrixFftOutput[avgThrottle] = fftOutput;
            } else {
                matrixFftOutput[avgThrottle] = matrixFftOutput[avgThrottle].map(function (num, idx) {
                    return num + fftOutput[idx];
                });
            }
        }

        // Divide by the number of samples
        for (var i = 0; i < 100; i++) {
            if (numberSamplesThrottle[i] > 1) {
                for (var j = 0; j < matrixFftOutput[i].length; j++) {
                    matrixFftOutput[i][j] /= numberSamplesThrottle[i]; 
                }
            } else if (numberSamplesThrottle[i] == 0) {
                matrixFftOutput[i] = new Float64Array(fftChunkLength * 2);
            }
        }

        // The output data needs to be smoothed, the sampling is not perfect 
        // but after some tests we let the data as is, an we prefer to apply a 
        // blur algorithm to the heat map image

        fftData = {
                fieldIndex   : dataBuffer.fieldIndex,
                fieldName    : dataBuffer.fieldName,
                fftLength    : fftChunkLength,
                fftOutput    : matrixFftOutput,
                maxNoise     : maxNoiseThrottle,
                blackBoxRate : blackBoxRate,
            };

    }

    var dataLoad = function() {

        switch(spectrumType) {

        case SPECTRUM_TYPE.FREQUENCY:
            dataLoadFrequency();
            break;

        case SPECTRUM_TYPE.FREQ_VS_THROTTLE:
            dataLoadFrequencyVsThrottle();
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
			if ((fieldIndex != fftData.fieldIndex) || dataReload) {
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


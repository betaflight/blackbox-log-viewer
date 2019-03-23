"use strict";

function FlightLogAnalyser(flightLog, canvas, analyserCanvas) {

var

        ANALYSER_LARGE_LEFT_PROPORTION    = 0.05, // 5% from left
        ANALYSER_LARGE_TOP_PROPORTION     = 0.05, // 5% from top
        ANALYSER_LARGE_HEIGHT_PROPORTION  = 0.9, // 90% high
        ANALYSER_LARGE_WIDTH_PROPORTION   = 0.9; // 90% wide

var canvasCtx = analyserCanvas.getContext("2d");

var // inefficient; copied from grapher.js

        DEFAULT_FONT_FACE = "Verdana, Arial, sans-serif",
        
        drawingParams = {
            fontSizeFrameLabel: null,
            fontSizeFrameLabelFullscreen: "9"
        };

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
		maxNoiseIdx: 0
	};

	this.setFullscreen = function(size) {
		isFullscreen = (size==true);
		that.resize();
	};

	var getSize = function () {
		if (isFullscreen){
				return {
					height: canvas.clientHeight - 20, // ANALYSER_LARGE_HEIGHT_PROPORTION,
					width: canvas.clientWidth - 20,   // ANALYSER_LARGE_WIDTH_PROPORTION,
					left: '10px',               // ANALYSER_LARGE_LEFT_PROPORTION,
					top: '10px'                 // ANALYSER_LARGE_TOP_PROPORTION
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
        canvasCtx.canvas.height    =  newSize.height; // (canvas.height * getSize().height);
        canvasCtx.canvas.width     =  newSize.width; // (canvas.width  * getSize().width);

		// Recenter the analyser canvas in the bottom left corner
		var parentElem = $(analyserCanvas).parent();
		
		$(parentElem).css({
			left: newSize.left, // (canvas.width  * getSize().left) + "px",
			top:  newSize.top   // (canvas.height * getSize().top ) + "px"
        });
		// place the sliders.
		$("input:first-of-type", parentElem).css({
			left: (canvasCtx.canvas.width - 130) + "px"
        });
		$("input:last-of-type", parentElem).css({
			left: (canvasCtx.canvas.width - 20) + "px"
		});
		$("#analyserResize", parentElem).css({
			left: (canvasCtx.canvas.width - 28) + "px"
		})

	};
	
	var dataLoad = function() {
		//load all samples
		var logStart = flightLog.getMinTime();
		var logEnd = ((flightLog.getMaxTime() - logStart)<=MAX_ANALYSER_LENGTH)?flightLog.getMaxTime():(logStart+MAX_ANALYSER_LENGTH);
		if(analyserTimeRange.in) {
			logStart = analyserTimeRange.in;
		}
        if(analyserTimeRange.out) {
            logEnd = analyserTimeRange.out;
        }
		var allChunks = flightLog.getChunksInTimeRange(logStart, logEnd); //Max 300 seconds
		var samples = new Float64Array(MAX_ANALYSER_LENGTH/1000);

        // Loop through all the samples in the chunks and assign them to a sample array ready to pass to the FFT.
        fftData.samples	= 0;
		for (var chunkIndex = 0; chunkIndex < allChunks.length; chunkIndex++) {
			var chunk = allChunks[chunkIndex];
			for (var frameIndex = 0; frameIndex < chunk.frames.length; frameIndex++) {
				samples[fftData.samples++] = (dataBuffer.curve.lookupRaw(chunk.frames[frameIndex][dataBuffer.fieldIndex]));
			}
		}

        if(userSettings.analyserHanning) {
            // apply hanning window function
            for(var i=0; i<fftData.samples; i++) {
                samples[i] *= 0.5 * (1-Math.cos((2*Math.PI*i)/(fftData.samples - 1)));
            }
        }

        //calculate fft
		var fftLength = samples.length;
		var fftOutput = new Float64Array(fftLength * 2);
		var fft = new FFT.complex(fftLength, false);
		
		fft.simple(fftOutput, samples, 'real');

		//calculate absolute values and find motor noise above 100hz
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
		
		fftData.fieldIndex = dataBuffer.fieldIndex;
		fftData.fftLength = fftLength;
		fftData.fftOutput = fftOutput;
		fftData.maxNoiseIdx = maxNoiseIdx;
	};

	/**
     * Function to actually draw the spectrum analyser overlay
     * again, need to look at optimisation....
     **/
	var draw = function() {
		canvasCtx.save();
		canvasCtx.lineWidth = 1;
		canvasCtx.clearRect(0, 0, canvasCtx.canvas.width, canvasCtx.canvas.height);

		var MARGIN = 10; // pixels
		var HEIGHT = canvasCtx.canvas.height - MARGIN;
		var WIDTH  = canvasCtx.canvas.width;
		var LEFT   = canvasCtx.canvas.left;
		var TOP    = canvasCtx.canvas.top;

		var PLOTTED_BUFFER_LENGTH = fftData.fftLength / (analyserZoomX);
		var PLOTTED_BLACKBOX_RATE = blackBoxRate / (analyserZoomX);

		canvasCtx.translate(LEFT, TOP);

		var backgroundGradient = canvasCtx.createLinearGradient(0,0,0,(HEIGHT+((isFullscreen)?MARGIN:0)));
		if(isFullscreen) {
            backgroundGradient.addColorStop(1,   'rgba(0,0,0,0.9)');
            backgroundGradient.addColorStop(0,   'rgba(0,0,0,0.7)');
		} else {
			backgroundGradient.addColorStop(1,   'rgba(255,255,255,0.25)');
			backgroundGradient.addColorStop(0,   'rgba(255,255,255,0)');
		}
		canvasCtx.fillStyle = backgroundGradient; //'rgba(255, 255, 255, .25)'; /* white */

		canvasCtx.fillRect(0, 0, WIDTH, HEIGHT+((isFullscreen)?MARGIN:0));

		var barWidth = (WIDTH / (PLOTTED_BUFFER_LENGTH / 10)) - 1;
		var barHeight;
		var x = 0;

		var barGradient = canvasCtx.createLinearGradient(0,HEIGHT,0,0);
            barGradient.addColorStop(constrain(0/analyserZoomY,0,1),      'rgba(0,255,0,0.2)');
            barGradient.addColorStop(constrain(0.15/analyserZoomY,0,1),   'rgba(128,255,0,0.2)');
            barGradient.addColorStop(constrain(0.45/analyserZoomY,0,1),   'rgba(255,0,0,0.5)');
            barGradient.addColorStop(constrain(1/analyserZoomY, 0, 1),    'rgba(255,128,128,1.0)');
        canvasCtx.fillStyle = barGradient; //'rgba(0,255,0,0.3)'; //green

        var fftScale = HEIGHT / (analyserZoomY*100);
		for(var i = 0; i < PLOTTED_BUFFER_LENGTH; i += 10) {
			barHeight = (fftData.fftOutput[i] * fftScale);
			canvasCtx.fillRect(x,(HEIGHT-barHeight),barWidth,barHeight);
			x += barWidth + 1;
		}

		drawAxisLabel(dataBuffer.fieldName, WIDTH - 4, HEIGHT - 6, 'right');
		drawGridLines(PLOTTED_BLACKBOX_RATE, LEFT, TOP, WIDTH, HEIGHT, MARGIN);

		var offset = 0;
		if (mouseFrequency !=null) drawMarkerLine(mouseFrequency, PLOTTED_BLACKBOX_RATE, '', WIDTH, HEIGHT, (15*offset++) + MARGIN, "rgba(0,255,0,0.50)", 3);
		offset++; // make some space!
        // Dynamic gyro lpf 
        if(flightLog.getSysConfig().gyro_lowpass_dyn_hz[0] != null && flightLog.getSysConfig().gyro_lowpass_dyn_hz[0] > 0 &&
                flightLog.getSysConfig().gyro_lowpass_dyn_hz[1] > flightLog.getSysConfig().gyro_lowpass_dyn_hz[0]) {
            drawDoubleMarkerLine(flightLog.getSysConfig().gyro_lowpass_dyn_hz[0], flightLog.getSysConfig().gyro_lowpass_dyn_hz[1], PLOTTED_BLACKBOX_RATE, 'GYRO LPF Dyn cutoff', WIDTH, HEIGHT, (15*offset++) + MARGIN, "rgba(128,255,128,0.50)");

        // Static gyro lpf
        } else  if ((flightLog.getSysConfig().gyro_lowpass_hz != null) && (flightLog.getSysConfig().gyro_lowpass_hz > 0)) {
            drawMarkerLine(flightLog.getSysConfig().gyro_lowpass_hz,  PLOTTED_BLACKBOX_RATE, 'GYRO LPF cutoff', WIDTH, HEIGHT, (15*offset++) + MARGIN, "rgba(128,255,128,0.50)");
        }

        // Static gyro lpf 2
        if ((flightLog.getSysConfig().gyro_lowpass2_hz != null) && (flightLog.getSysConfig().gyro_lowpass2_hz > 0)) {
            drawMarkerLine(flightLog.getSysConfig().gyro_lowpass2_hz, PLOTTED_BLACKBOX_RATE, 'GYRO LPF2 cutoff', WIDTH, HEIGHT, (15*offset++) + MARGIN, "rgba(95,199,95,0.50)");
        }
		if(flightLog.getSysConfig().gyro_notch_hz!=null && flightLog.getSysConfig().gyro_notch_cutoff!=null ) {
			if(flightLog.getSysConfig().gyro_notch_hz.length > 0) { //there are multiple gyro notch filters
				var gradient = canvasCtx.createLinearGradient(0,0,0,(HEIGHT));
				gradient.addColorStop(1,   'rgba(128,255,128,0.10)');
				gradient.addColorStop(0,   'rgba(128,255,128,0.35)');
				for(var i=0; i<flightLog.getSysConfig().gyro_notch_hz.length; i++) {
					if(flightLog.getSysConfig().gyro_notch_hz[i] > 0 && flightLog.getSysConfig().gyro_notch_cutoff[i] > 0) {
						drawMarkerLine(flightLog.getSysConfig().gyro_notch_hz[i],  PLOTTED_BLACKBOX_RATE, null, WIDTH, HEIGHT, (15*offset) + MARGIN, gradient, (flightLog.getSysConfig().gyro_notch_hz[i] - flightLog.getSysConfig().gyro_notch_cutoff[i]));
						drawMarkerLine(flightLog.getSysConfig().gyro_notch_hz[i],  PLOTTED_BLACKBOX_RATE, 'GYRO notch center', WIDTH, HEIGHT, (15*offset++) + MARGIN, "rgba(128,255,128,0.50)"); // highlight the center
						drawMarkerLine(flightLog.getSysConfig().gyro_notch_cutoff[i],  PLOTTED_BLACKBOX_RATE, 'GYRO notch cutoff', WIDTH, HEIGHT, (15*offset++) + MARGIN, "rgba(128,255,128,0.50)");
					}
				}
			} else { // only a single gyro notch to display
				if(flightLog.getSysConfig().gyro_notch_hz > 0 && flightLog.getSysConfig().gyro_notch_cutoff > 0) {
					var gradient = canvasCtx.createLinearGradient(0,0,0,(HEIGHT));
					gradient.addColorStop(1,   'rgba(128,255,128,0.10)');
					gradient.addColorStop(0,   'rgba(128,255,128,0.35)');
					drawMarkerLine(flightLog.getSysConfig().gyro_notch_hz,  PLOTTED_BLACKBOX_RATE, null, WIDTH, HEIGHT, (15*offset) + MARGIN, gradient, (flightLog.getSysConfig().gyro_notch_hz - flightLog.getSysConfig().gyro_notch_cutoff));
					drawMarkerLine(flightLog.getSysConfig().gyro_notch_hz,  PLOTTED_BLACKBOX_RATE, 'GYRO notch center', WIDTH, HEIGHT, (15*offset++) + MARGIN, "rgba(128,255,128,0.50)"); // highlight the center
					drawMarkerLine(flightLog.getSysConfig().gyro_notch_cutoff,  PLOTTED_BLACKBOX_RATE, 'GYRO notch cutoff', WIDTH, HEIGHT, (15*offset++) + MARGIN, "rgba(128,255,128,0.50)");
				}
			}
		}
		offset++; // make some space!
		try {
			if(dataBuffer.fieldName.match(/(.*yaw.*)/i)!=null) {
				if(flightLog.getSysConfig().yaw_lpf_hz!=null)      		drawMarkerLine(flightLog.getSysConfig().yaw_lpf_hz,  PLOTTED_BLACKBOX_RATE, 'YAW LPF cutoff', WIDTH, HEIGHT, (15*offset++) + MARGIN);
			} else {
                // Dynamic dterm lpf 
                if(flightLog.getSysConfig().dterm_lpf_dyn_hz[0] != null && flightLog.getSysConfig().dterm_lpf_dyn_hz[0] > 0 &&
                        flightLog.getSysConfig().dterm_lpf_dyn_hz[1] > flightLog.getSysConfig().dterm_lpf_dyn_hz[0]) {
                    drawDoubleMarkerLine(flightLog.getSysConfig().dterm_lpf_dyn_hz[0], flightLog.getSysConfig().dterm_lpf_dyn_hz[1], PLOTTED_BLACKBOX_RATE, 'GYRO LPF Dyn Min cutoff', WIDTH, HEIGHT, (15*offset++) + MARGIN, "rgba(128,128,255,0.50)");

                // Static dterm lpf
                } else if((flightLog.getSysConfig().dterm_lpf_hz != null) && (flightLog.getSysConfig().dterm_lpf_hz > 0)) {
                    drawMarkerLine(flightLog.getSysConfig().dterm_lpf_hz,  PLOTTED_BLACKBOX_RATE, 'D-TERM LPF cutoff', WIDTH, HEIGHT, (15*offset++) + MARGIN, "rgba(128,128,255,0.50)");
                }

                // Static dterm lpf 2
                if((flightLog.getSysConfig().dterm_lpf2_hz != null) && (flightLog.getSysConfig().dterm_lpf2_hz > 0)) {
                    drawMarkerLine(flightLog.getSysConfig().dterm_lpf2_hz,  PLOTTED_BLACKBOX_RATE, 'D-TERM LPF2 cutoff', WIDTH, HEIGHT, (15*offset++) + MARGIN, "rgba(90,90,255,0.50)");
                }

				if(flightLog.getSysConfig().dterm_notch_hz!=null && flightLog.getSysConfig().dterm_notch_cutoff!=null ) {
					if(flightLog.getSysConfig().dterm_notch_hz > 0 && flightLog.getSysConfig().dterm_notch_cutoff > 0) {
						var gradient = canvasCtx.createLinearGradient(0,0,0,(HEIGHT));
						gradient.addColorStop(1,   'rgba(128,128,255,0.10)');
						gradient.addColorStop(0,   'rgba(128,128,255,0.35)');
						drawMarkerLine(flightLog.getSysConfig().dterm_notch_hz,  PLOTTED_BLACKBOX_RATE, null, WIDTH, HEIGHT, (15*offset) + MARGIN, gradient, (flightLog.getSysConfig().dterm_notch_hz - flightLog.getSysConfig().dterm_notch_cutoff));
						drawMarkerLine(flightLog.getSysConfig().dterm_notch_hz,  PLOTTED_BLACKBOX_RATE, 'D-TERM notch center', WIDTH, HEIGHT, (15*offset++) + MARGIN); // highlight the center
						drawMarkerLine(flightLog.getSysConfig().dterm_notch_cutoff,  PLOTTED_BLACKBOX_RATE, 'D-TERM notch cutoff', WIDTH, HEIGHT, (15*offset++) + MARGIN);
					}
				}
			}
			offset++; // make some space!
		} catch (e) {
			console.log('Notch filter fieldName missing');
		}
		drawMarkerLine(fftData.maxNoiseIdx,  PLOTTED_BLACKBOX_RATE, 'Max motor noise', WIDTH, HEIGHT, (15*offset) + MARGIN, "rgba(255,0,0,0.50)", 3);

		canvasCtx.restore();
	};
	
	var drawMarkerLine = function(frequency, sampleRate, label, WIDTH, HEIGHT, OFFSET, stroke, lineWidth){
		var x = WIDTH * frequency / (sampleRate / 2); // percentage of range where frequncy lies

		lineWidth = (lineWidth || 1);
		if (lineWidth > 5) { // is the linewidth specified as a frequency band
			lineWidth = WIDTH *  (2 * lineWidth) / (sampleRate / 2);		
		}
		if(lineWidth < 1) lineWidth = 1;

		canvasCtx.beginPath();
		canvasCtx.lineWidth = lineWidth || 1;
		canvasCtx.strokeStyle = stroke || "rgba(128,128,255,0.50)";

		canvasCtx.moveTo(x, OFFSET - 10);
		canvasCtx.lineTo(x, HEIGHT);

		canvasCtx.stroke();
		
		if(label!=null) drawAxisLabel(label + ' ' + (frequency.toFixed(0))+"Hz", (x + 2), OFFSET, 'left');
		
        return x;
	};

	var drawDoubleMarkerLine = function(frequency1, frequency2, sampleRate, label, WIDTH, HEIGHT, OFFSET, stroke, lineWidth) {
        var x1 = drawMarkerLine(frequency1, sampleRate, null, WIDTH, HEIGHT, OFFSET, stroke, lineWidth);
        var x2 = drawMarkerLine(frequency2, sampleRate, null, WIDTH, HEIGHT, OFFSET, stroke, lineWidth);

        canvasCtx.beginPath();
        canvasCtx.lineWidth = lineWidth || 1;
        canvasCtx.strokeStyle = stroke || "rgba(128,128,255,0.50)";

        canvasCtx.moveTo(x1, OFFSET - 10);
        canvasCtx.lineTo(x2, OFFSET - 10);

        canvasCtx.stroke();

        if(label!=null) {
            drawAxisLabel(label + ' ' + (frequency1.toFixed(0))+'-'+(frequency2.toFixed(0))+"Hz", (x1 + 2), OFFSET, 'left');
        }
    };

	var drawGridLines = function(sampleRate, LEFT, TOP, WIDTH, HEIGHT, MARGIN) {

		var ticks = 5;
		var frequencyInterval = (sampleRate / ticks) / 2;
		var frequency = 0;

		for(var i=0; i<=ticks; i++) {
				canvasCtx.beginPath();
				canvasCtx.lineWidth = 1;
				canvasCtx.strokeStyle = "rgba(255,255,255,0.25)";

				canvasCtx.moveTo(i * (WIDTH / ticks), 0);
				canvasCtx.lineTo(i * (WIDTH / ticks), HEIGHT);

				canvasCtx.stroke();
				var textAlign = (i==0)?'left':((i==ticks)?'right':'center');
				drawAxisLabel((frequency.toFixed(0))+"Hz", i * (WIDTH / ticks), HEIGHT + MARGIN, textAlign);
				frequency += frequencyInterval;
		}	
	};

	var drawAxisLabel = function(axisLabel, X, Y, align) {
			canvasCtx.font = ((isFullscreen)?drawingParams.fontSizeFrameLabelFullscreen:drawingParams.fontSizeFrameLabel) + "pt " + DEFAULT_FONT_FACE;
			canvasCtx.fillStyle = "rgba(255,255,255,0.9)";
			if(align) {
				 canvasCtx.textAlign = align;
				 } else 
				 {
				 canvasCtx.textAlign = 'center';
				 }


			canvasCtx.fillText(axisLabel, X, Y);
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
			}
			
			draw(); // draw the analyser on the canvas....
	};

    this.destroy = function() {
        $(analyserCanvas).off("mousemove", trackFrequency);
        $(analyserCanvas).off("touchmove", trackFrequency);
    };

    this.refresh = function() {
    	draw();
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
		that.refresh();
		}            
	); analyserZoomXElem.val(100);
    analyserZoomYElem.on('input',
		function () {
		analyserZoomY = 1 / (analyserZoomYElem.val() / 100);
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
			if(lastFrequency!=mouseFrequency) {
				lastFrequency = mouseFrequency;
				if(analyser) analyser.refresh();
			}
			e.preventDefault();
		}
	}

}


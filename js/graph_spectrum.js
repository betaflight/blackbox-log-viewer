"use strict";

function FlightLogAnalyser(flightLog, graphConfig, canvas, analyserCanvas, options) {

var
        ANALYSER_LEFT_PROPORTION    = parseInt(userSettings.analyser.left) / 100.0, // 5% from left
        ANALYSER_TOP_PROPORTION     = parseInt(userSettings.analyser.top) / 100.0, // 55% from top
        ANALYSER_HEIGHT_PROPORTION  = parseInt(userSettings.analyser.size) / 100.0, // 40% high
        ANALYSER_WIDTH_PROPORTION   = parseInt(userSettings.analyser.size) / 100.0, // 40% wide

        ANALYSER_LARGE_LEFT_PROPORTION    = 0.05, // 5% from left
        ANALYSER_LARGE_TOP_PROPORTION     = 0.05, // 55% from top
        ANALYSER_LARGE_HEIGHT_PROPORTION  = 0.90, // 40% high
        ANALYSER_LARGE_WIDTH_PROPORTION   = 0.90; // 40% wide

var canvasCtx = analyserCanvas.getContext("2d");

var // inefficient; copied from grapher.js

        DEFAULT_FONT_FACE = "Verdana, Arial, sans-serif",
        
        drawingParams = {
            fontSizeFrameLabel: null,
            fontSizeFrameLabelFullscreen: "9",
        };

var that = this;

var mouseFrequency= null;
var analyserZoomX = 1.0; /* 100% */
var analyserZoomY = 1.0; /* 100% */

var MAX_ANALYSER_LENGTH = 300 * 1000 * 1000; // 5min
var analyserTimeRange  = { 
							in: null,
						   out: MAX_ANALYSER_LENGTH, 
						 };
var dataReload = false;

this.setInTime = function(time) {
	if (time) {
		analyserTimeRange.in = time;
	} else {
		analyserTimeRange.in = null;
	}
	dataReload = true;
	return analyserTimeRange.in;
}
this.setOutTime = function(time) {
	if (time) {
		if((time - analyserTimeRange.in) <= MAX_ANALYSER_LENGTH) {
			analyserTimeRange.out = time;
			dataReload = true;
			return analyserTimeRange.out;
		}
	}
	analyserTimeRange.out = analyserTimeRange.in + MAX_ANALYSER_LENGTH; // 5min
	return analyserTimeRange.out;
	dataReload = true;
}
	  
try {
	var sysConfig = flightLog.getSysConfig();
	var gyroRate = (1000000/sysConfig['looptime']).toFixed(0);
	var pidRate = 1000; //default for old logs
	
	if (sysConfig.pid_process_denom != null) {
		pidRate = gyroRate / sysConfig.pid_process_denom;
	}
	
	var blackBoxRate = pidRate * (sysConfig['frameIntervalPNum'] / sysConfig['frameIntervalPDenom']);

	var dataBuffer = {
			chunks: 0, 
			startFrameIndex: 0, 
			fieldIndex: 0, 
			curve: 0,
			windowCenterTime: 0, 
			windowEndTime: 0
		};
		
	var fftData = {
		fieldIndex: -1,
		fftLength: 0,
		fftOutput: 0,
		maxNoiseIdx: 0
	};

	var initialised = false;
	// var zoom = 1.0;
	var analyserFieldName;   // Name of the field being analysed

	var isFullscreen = false;

	this.setFullscreen = function(size) {
		isFullscreen = (size==true);
		that.resize();
	}

	function getSize() {
		if (isFullscreen){
				return {
					height: ANALYSER_LARGE_HEIGHT_PROPORTION,
					width: ANALYSER_LARGE_WIDTH_PROPORTION,
					left: ANALYSER_LARGE_LEFT_PROPORTION,
					top: ANALYSER_LARGE_TOP_PROPORTION,
					}
			} else {
				return {
					height: parseInt(userSettings.analyser.size) / 100.0,
					width: parseInt(userSettings.analyser.size) / 100.0,
					left: parseInt(userSettings.analyser.left) / 100.0,
					top: parseInt(userSettings.analyser.top) / 100.0,
				}
			}
			
	}

   	this.resize = function() {

        // Determine the analyserCanvas location
        canvasCtx.canvas.height    = (canvas.height * getSize().height);
        canvasCtx.canvas.width     = (canvas.width  * getSize().width);

		// Recenter the analyser canvas in the bottom left corner
		var parentElem = $(analyserCanvas).parent();
		
		$(parentElem).css({
			left: (canvas.width  * getSize().left) + "px",
			top:  (canvas.height * getSize().top ) + "px",
		});
		// place the sliders.
		$("input:first-of-type", parentElem).css({
			left: (canvasCtx.canvas.width - 130) + "px",
		});
		$("input:last-of-type", parentElem).css({
			left: (canvasCtx.canvas.width - 20) + "px",
		});


	}
	
	this.setGraphZoom =	function(newZoom) {
		// zoom = 1.0 / newZoom * 100;
	}

	function dataLoad() {
		//load all samples
		var logStart = flightLog.getMinTime();
		var logEnd = ((flightLog.getMaxTime() - logStart)<=MAX_ANALYSER_LENGTH)?flightLog.getMaxTime():(logStart+MAX_ANALYSER_LENGTH);
		if(analyserTimeRange.in!=null) {
			logStart = analyserTimeRange.in;
			logEnd = analyserTimeRange.out;
		}
		var allChunks = flightLog.getChunksInTimeRange(logStart, logEnd); //300 seconds
		var chunkIndex = 0;
		var frameIndex = 0;
		var samples = new Float64Array(MAX_ANALYSER_LENGTH/1000);
		var i = 0;
		
		for (chunkIndex = 0; chunkIndex < allChunks.length; chunkIndex++) {
			var chunk = allChunks[chunkIndex];
			for (frameIndex = 0; frameIndex < chunk.frames.length; frameIndex++) {
				var fieldValue = chunk.frames[frameIndex][dataBuffer.fieldIndex];
				var sample = (dataBuffer.curve.lookupRaw(fieldValue));
				samples[i++] = sample;
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
	}

	/* Function to actually draw the spectrum analyser overlay
		again, need to look at optimisation.... 

		*/

	function draw() {
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

		var gradient = canvasCtx.createLinearGradient(0,0,0,(HEIGHT+((isFullscreen)?MARGIN:0)));
		if(isFullscreen) {
			gradient.addColorStop(1,   'rgba(0,0,0,0.9)');
			gradient.addColorStop(0,   'rgba(0,0,0,0.7)');
		} else {
			gradient.addColorStop(1,   'rgba(255,255,255,0.25)');
			gradient.addColorStop(0,   'rgba(255,255,255,0)');

		}
		canvasCtx.fillStyle = gradient; //'rgba(255, 255, 255, .25)'; /* white */
		canvasCtx.fillRect(0, 0, WIDTH, HEIGHT+((isFullscreen)?MARGIN:0));

		var barWidth = (WIDTH / (PLOTTED_BUFFER_LENGTH / 10)) - 1;
		var barHeight;
		var x = 0;

		var gradient = canvasCtx.createLinearGradient(0,HEIGHT,0,0);
			gradient.addColorStop(0,   'rgba(0,255,0,0.2)');
			gradient.addColorStop(0.15, 'rgba(128,255,0,0.2)');
			gradient.addColorStop(0.45, 'rgba(255,0,0,0.5)');
			gradient.addColorStop(1,   'rgba(255,128,128,1.0)');

		for(var i = 0; i < PLOTTED_BUFFER_LENGTH; i += 10) {
			barHeight = (fftData.fftOutput[i] / (analyserZoomY*100) * HEIGHT);

			canvasCtx.fillStyle = gradient; //'rgba(0,255,0,0.3)'; //green
			canvasCtx.fillRect(x,(HEIGHT)-barHeight,barWidth,barHeight);

			x += barWidth + 1;
		}

		drawAxisLabel(analyserFieldName, WIDTH - 4, HEIGHT - 6, 'right');
		drawGridLines(PLOTTED_BLACKBOX_RATE, LEFT, TOP, WIDTH, HEIGHT, MARGIN);

		var isYawField = (analyserFieldName.match(/(.*yaw.*)/i)!=null);
		var offset = 0;
		if (mouseFrequency !=null) drawMarkerLine(mouseFrequency,  PLOTTED_BLACKBOX_RATE, '', WIDTH, HEIGHT, (15*offset++) + MARGIN, "rgba(0,255,0,0.50)", 3);
		offset++; // make some space!
		if(flightLog.getSysConfig().gyro_lowpass_hz!=null) 		drawMarkerLine(flightLog.getSysConfig().gyro_lowpass_hz/100.0,  PLOTTED_BLACKBOX_RATE, 'GYRO LPF cutoff', WIDTH, HEIGHT, (15*offset++) + MARGIN, "rgba(128,255,128,0.50)");
		if(flightLog.getSysConfig().gyro_notch_hz!=null && flightLog.getSysConfig().gyro_notch_cutoff!=null ) {
			if(flightLog.getSysConfig().gyro_notch_hz > 0 && flightLog.getSysConfig().gyro_notch_cutoff > 0) {
				var gradient = canvasCtx.createLinearGradient(0,0,0,(HEIGHT));
				gradient.addColorStop(1,   'rgba(128,255,128,0.10)');
				gradient.addColorStop(0,   'rgba(128,255,128,0.35)');
	 			drawMarkerLine(flightLog.getSysConfig().gyro_notch_hz/100.0,  PLOTTED_BLACKBOX_RATE, null, WIDTH, HEIGHT, (15*offset) + MARGIN, gradient, (flightLog.getSysConfig().gyro_notch_hz - flightLog.getSysConfig().gyro_notch_cutoff)/100.0);
	 			drawMarkerLine(flightLog.getSysConfig().gyro_notch_hz/100.0,  PLOTTED_BLACKBOX_RATE, 'GYRO notch center', WIDTH, HEIGHT, (15*offset++) + MARGIN, "rgba(128,255,128,0.50)"); // highlight the center
				drawMarkerLine(flightLog.getSysConfig().gyro_notch_cutoff/100.0,  PLOTTED_BLACKBOX_RATE, 'GYRO notch cutoff', WIDTH, HEIGHT, (15*offset++) + MARGIN, "rgba(128,255,128,0.50)");
			}
		}
		offset++; // make some space!
		if(isYawField) {
			if(flightLog.getSysConfig().yaw_lpf_hz!=null)      		drawMarkerLine(flightLog.getSysConfig().yaw_lpf_hz/100.0,  PLOTTED_BLACKBOX_RATE, 'YAW LPF cutoff', WIDTH, HEIGHT, (15*offset++) + MARGIN);
		} else {
			if(flightLog.getSysConfig().dterm_lpf_hz!=null)    		drawMarkerLine(flightLog.getSysConfig().dterm_lpf_hz/100.0,  PLOTTED_BLACKBOX_RATE, 'D-TERM LPF cutoff', WIDTH, HEIGHT, (15*offset++) + MARGIN);
			if(flightLog.getSysConfig().dterm_notch_hz!=null && flightLog.getSysConfig().dterm_notch_cutoff!=null ) {
				if(flightLog.getSysConfig().dterm_notch_hz > 0 && flightLog.getSysConfig().dterm_notch_cutoff > 0) {
					var gradient = canvasCtx.createLinearGradient(0,0,0,(HEIGHT));
					gradient.addColorStop(1,   'rgba(128,128,255,0.10)');
					gradient.addColorStop(0,   'rgba(128,128,255,0.35)');
					drawMarkerLine(flightLog.getSysConfig().dterm_notch_hz/100.0,  PLOTTED_BLACKBOX_RATE, null, WIDTH, HEIGHT, (15*offset) + MARGIN, gradient, (flightLog.getSysConfig().dterm_notch_hz - flightLog.getSysConfig().dterm_notch_cutoff)/100.0);
					drawMarkerLine(flightLog.getSysConfig().dterm_notch_hz/100.0,  PLOTTED_BLACKBOX_RATE, 'D-TERM notch center', WIDTH, HEIGHT, (15*offset++) + MARGIN); // highlight the center
					drawMarkerLine(flightLog.getSysConfig().dterm_notch_cutoff/100.0,  PLOTTED_BLACKBOX_RATE, 'D-TERM notch cutoff', WIDTH, HEIGHT, (15*offset++) + MARGIN);
				}
			}
		}
		offset++; // make some space!
		drawMarkerLine(fftData.maxNoiseIdx,  PLOTTED_BLACKBOX_RATE, 'Max motor noise', WIDTH, HEIGHT, (15*offset++) + MARGIN, "rgba(255,0,0,0.50)", 3);

		canvasCtx.restore();
	}
	
	function drawMarkerLine(frequency, sampleRate, label, WIDTH, HEIGHT, OFFSET, stroke, lineWidth){
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
		
	}

	function drawGridLines(sampleRate, LEFT, TOP, WIDTH, HEIGHT, MARGIN) {

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
	}

	function drawAxisLabel(axisLabel, X, Y, align) {
			canvasCtx.font = ((isFullscreen)?drawingParams.fontSizeFrameLabelFullscreen:drawingParams.fontSizeFrameLabel) + "pt " + DEFAULT_FONT_FACE;
			canvasCtx.fillStyle = "rgba(255,255,255,0.9)";
			if(align) {
				 canvasCtx.textAlign = align;
				 } else 
				 {
				 canvasCtx.textAlign = 'center';
				 }


			canvasCtx.fillText(axisLabel, X, Y);
		}

	/* This function is called from the canvas drawing routines within grapher.js
	   It is only used to record the current curve positions, collect the data and draw the 
	   analyser on screen*/

	this.plotSpectrum =	function (chunks, startFrameIndex, fieldIndex, curve, fieldName, windowCenterTime, windowEndTime) {
			// Store the data pointers
			dataBuffer = {
				chunks: chunks,
				startFrameIndex: startFrameIndex,
				fieldIndex: fieldIndex,
				curve: curve,
				windowCenterTime: windowCenterTime,
				windowEndTime: windowEndTime
			};

			analyserFieldName = fieldName;
			if ((fieldIndex != fftData.fieldIndex) || dataReload) {
				dataReload = false;
				dataLoad();				
			}
			
			draw(); // draw the analyser on the canvas....
	}

    this.destroy = function() {
        $(analyserCanvas).off("mousemove", trackFrequency);
    };

    this.refresh = function() {
    	draw();
    }

	/* Add mouse over event to read the frequency */
	$(analyserCanvas).on('mousemove', function (e) {
		trackFrequency(e, that);
	});

	/* add zoom controls */
	$("#analyserZoomX").on('input',        
		function () {
		analyserZoomX = ($( "#analyserZoomX" ).val() / 100);
		that.refresh();
		}            
	); $( "#analyserZoomX" ).val(100);
	$("#analyserZoomY").on('input',        
		function () {
		analyserZoomY = 1 / ($( "#analyserZoomY" ).val() / 100);
		that.refresh();
		}            
	); $( "#analyserZoomY" ).val(100);

	}	catch (e) {
		console.log('Failed to create analyser... error:' + e);
	};

	// release the hardware context associated with the analyser
	this.closeAnalyserHardware = function() {
	}

    
	// track frequency under mouse
	function trackFrequency(e, analyser) {
		var lastFrequency;
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


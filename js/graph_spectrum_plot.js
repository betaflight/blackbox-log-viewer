"use strict";

const DEFAULT_FONT_FACE       = "Verdana, Arial, sans-serif",
      DEFAULT_MARK_LINE_WIDTH = 2,
      MARGIN                  = 10; // pixels;

var GraphSpectrumPlot = GraphSpectrumPlot || {
    _isFullScreen : false,
    _cachedCanvas : null,
    _canvasCtx    : null,
    _fftData      : null,
    _mouseFrequency : null,
    _sysConfig    : null,
    _zoomX : 1.0,
    _zoomY : 1.0,
    _drawingParams : {
            fontSizeFrameLabel: "6",
            fontSizeFrameLabelFullscreen: "9",
    },
};

GraphSpectrumPlot.initialize = function(canvas, sysConfig) {
    this._canvasCtx = canvas.getContext("2d");
    this._sysConfig = sysConfig;
    this._invalicateCache();
};

GraphSpectrumPlot.setZoom = function(zoomX, zoomY) {
    this._zoomX =  zoomX;
    this._zoomY =  zoomY;
    this._invalicateCache();
};

GraphSpectrumPlot.setSize = function(width, height) {
    this._canvasCtx.canvas.width  =  width; 
    this._canvasCtx.canvas.height =  height;
    this._invalicateCache();
};

GraphSpectrumPlot.setFullScreen = function(isFullScreen) {
    this._isFullScreen = isFullScreen; 
    this._invalicateCache();
};

GraphSpectrumPlot.setData = function(fftData) {
    this._fftData = fftData;
    this._invalicateCache();
};

GraphSpectrumPlot.setMouseFrequency = function(mouseFrequency) {
    this._mouseFrequency = mouseFrequency;
};

GraphSpectrumPlot.draw = function() {

    this._drawCachedElements();
    this._drawNotCachedElements();
};

GraphSpectrumPlot._drawCachedElements = function() {

    if (this._cachedCanvas == null) {

        this._cachedCanvas = document.createElement('canvas');
        var cachedCtx = this._cachedCanvas.getContext('2d');

        cachedCtx.canvas.height = this._canvasCtx.canvas.height;
        cachedCtx.canvas.width = this._canvasCtx.canvas.width;

        this._drawGraph(cachedCtx);
        this._drawFiltersAndMarkers(cachedCtx);

    }

    this._canvasCtx.clearRect(0, 0, this._canvasCtx.canvas.width, this._canvasCtx.canvas.height);
    this._canvasCtx.drawImage(this._cachedCanvas, 0, 0, this._canvasCtx.canvas.width, this._canvasCtx.canvas.height);
};

GraphSpectrumPlot._drawGraph = function(canvasCtx) {

    canvasCtx.lineWidth = 1;
    
    
    var HEIGHT = canvasCtx.canvas.height - MARGIN;
    var WIDTH  = canvasCtx.canvas.width;
    var LEFT   = canvasCtx.canvas.left;
    var TOP    = canvasCtx.canvas.top;

    var PLOTTED_BUFFER_LENGTH = this._fftData.fftLength / this._zoomX;
    var PLOTTED_BLACKBOX_RATE = this._fftData.blackBoxRate / this._zoomX;

    canvasCtx.translate(LEFT, TOP);

    var backgroundGradient = canvasCtx.createLinearGradient(0,0,0,(HEIGHT + ((this._isFullScreen)? MARGIN : 0)));
    if (this._isFullScreen) {
        backgroundGradient.addColorStop(1,   'rgba(0,0,0,0.9)');
        backgroundGradient.addColorStop(0,   'rgba(0,0,0,0.7)');
    } else {
        backgroundGradient.addColorStop(1,   'rgba(255,255,255,0.25)');
        backgroundGradient.addColorStop(0,   'rgba(255,255,255,0)');
    }
    canvasCtx.fillStyle = backgroundGradient; //'rgba(255, 255, 255, .25)'; /* white */

    canvasCtx.fillRect(0, 0, WIDTH, HEIGHT + ((this._isFullScreen)? MARGIN : 0));

    var barWidth = (WIDTH / (PLOTTED_BUFFER_LENGTH / 10)) - 1;
    var barHeight;
    var x = 0;

    var barGradient = canvasCtx.createLinearGradient(0,HEIGHT,0,0);
        barGradient.addColorStop(constrain(0 / this._zoomY,0,1),      'rgba(0,255,0,0.2)');
        barGradient.addColorStop(constrain(0.15 / this._zoomY,0,1),   'rgba(128,255,0,0.2)');
        barGradient.addColorStop(constrain(0.45 / this._zoomY,0,1),   'rgba(255,0,0,0.5)');
        barGradient.addColorStop(constrain(1 / this._zoomY, 0, 1),    'rgba(255,128,128,1.0)');
    canvasCtx.fillStyle = barGradient; //'rgba(0,255,0,0.3)'; //green

    var fftScale = HEIGHT / (this._zoomY * 100);
    for(var i = 0; i < PLOTTED_BUFFER_LENGTH; i += 10) {
        barHeight = (this._fftData.fftOutput[i] * fftScale);
        canvasCtx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight);
        x += barWidth + 1;
    }

    this._drawAxisLabel(canvasCtx, this._fftData.fieldName, WIDTH - 4, HEIGHT - 6, 'right');
    this._drawGridLines(canvasCtx, PLOTTED_BLACKBOX_RATE, LEFT, TOP, WIDTH, HEIGHT, MARGIN);

};

GraphSpectrumPlot._drawFiltersAndMarkers = function(canvasCtx) {

    var HEIGHT = this._canvasCtx.canvas.height - MARGIN;
    var WIDTH  = this._canvasCtx.canvas.width;
    var PLOTTED_BLACKBOX_RATE = this._fftData.blackBoxRate / this._zoomX;

    var offset = 2; // make some space! Includes the space for the mouseFrequency. In this way the other elements don't move in the screen when used

    // Dynamic gyro lpf 
    if(this._sysConfig.gyro_lowpass_dyn_hz[0] != null && this._sysConfig.gyro_lowpass_dyn_hz[0] > 0 &&
            this._sysConfig.gyro_lowpass_dyn_hz[1] > this._sysConfig.gyro_lowpass_dyn_hz[0]) {
        this._drawLowpassDynFilter(canvasCtx, this._sysConfig.gyro_lowpass_dyn_hz[0], this._sysConfig.gyro_lowpass_dyn_hz[1], PLOTTED_BLACKBOX_RATE, 'GYRO LPF Dyn cutoff', WIDTH, HEIGHT, (15*offset++) + MARGIN, "rgba(94, 194, 98, 0.50)");

    // Static gyro lpf
    } else  if ((this._sysConfig.gyro_lowpass_hz != null) && (this._sysConfig.gyro_lowpass_hz > 0)) {
        this._drawLowpassFilter(canvasCtx, this._sysConfig.gyro_lowpass_hz,  PLOTTED_BLACKBOX_RATE, 'GYRO LPF cutoff', WIDTH, HEIGHT, (15*offset++) + MARGIN, "rgba(94, 194, 98, 0.50)");
    }

    // Static gyro lpf 2
    if ((this._sysConfig.gyro_lowpass2_hz != null) && (this._sysConfig.gyro_lowpass2_hz > 0)) {
        this._drawLowpassFilter(canvasCtx, this._sysConfig.gyro_lowpass2_hz, PLOTTED_BLACKBOX_RATE, 'GYRO LPF2 cutoff', WIDTH, HEIGHT, (15*offset++) + MARGIN, "rgba(0, 172, 122, 0.50)");
    }

     // Notch gyro
    if (this._sysConfig.gyro_notch_hz != null && this._sysConfig.gyro_notch_cutoff != null ) {
        if (this._sysConfig.gyro_notch_hz.length > 0) { //there are multiple gyro notch filters
            for (var i=0; i < this._sysConfig.gyro_notch_hz.length; i++) {
                if (this._sysConfig.gyro_notch_hz[i] > 0 && this._sysConfig.gyro_notch_cutoff[i] > 0) {
                    this._drawNotchFilter(canvasCtx, this._sysConfig.gyro_notch_hz[i], this._sysConfig.gyro_notch_cutoff[i], PLOTTED_BLACKBOX_RATE, 'GYRO notch', WIDTH, HEIGHT, (15*offset++) + MARGIN, "rgba(0, 148, 134, 0.50)");
                }
            }
        } else { // only a single gyro notch to display
            if (this._sysConfig.gyro_notch_hz > 0 && this._sysConfig.gyro_notch_cutoff > 0) {
                this._drawNotchFilter(canvasCtx, this._sysConfig.gyro_notch_hz, this._sysConfig.gyro_notch_cutoff, PLOTTED_BLACKBOX_RATE, 'GYRO notch', WIDTH, HEIGHT, (15*offset++) + MARGIN, "rgba(0, 148, 134, 0.50)");
            }
        }
    }

    offset++; // make some space!
    try {
        if (this._fftData.fieldName.match(/(.*yaw.*)/i) != null) {
            if (this._sysConfig.yaw_lpf_hz != null && this._sysConfig.yaw_lpf_hz > 0) {
                this._drawLowpassFilter(canvasCtx, this._sysConfig.yaw_lpf_hz,  PLOTTED_BLACKBOX_RATE, 'YAW LPF cutoff', WIDTH, HEIGHT, (15*offset++) + MARGIN);
            }
        } else {
            // Dynamic dterm lpf 
            if (this._sysConfig.dterm_lpf_dyn_hz[0] != null && this._sysConfig.dterm_lpf_dyn_hz[0] > 0 &&
                    this._sysConfig.dterm_lpf_dyn_hz[1] > this._sysConfig.dterm_lpf_dyn_hz[0]) {
                this._drawLowpassDynFilter(canvasCtx, this._sysConfig.dterm_lpf_dyn_hz[0], this._sysConfig.dterm_lpf_dyn_hz[1], PLOTTED_BLACKBOX_RATE, 'D-TERM LPF Dyn cutoff', WIDTH, HEIGHT, (15*offset++) + MARGIN, "rgba(0, 123, 132, 0.50)");

            // Static dterm lpf
            } else if ((this._sysConfig.dterm_lpf_hz != null) && (this._sysConfig.dterm_lpf_hz > 0)) {
                this._drawLowpassFilter(canvasCtx, this._sysConfig.dterm_lpf_hz,  PLOTTED_BLACKBOX_RATE, 'D-TERM LPF cutoff', WIDTH, HEIGHT, (15*offset++) + MARGIN, "rgba(0, 123, 132, 0.50)");
            }

            // Static dterm lpf 2
            if ((this._sysConfig.dterm_lpf2_hz != null) && (this._sysConfig.dterm_lpf2_hz > 0)) {
                this._drawLowpassFilter(canvasCtx, this._sysConfig.dterm_lpf2_hz,  PLOTTED_BLACKBOX_RATE, 'D-TERM LPF2 cutoff', WIDTH, HEIGHT, (15*offset++) + MARGIN, "rgba(16, 97, 116, 0.50)");
            }

            // Notch dterm
            if (this._sysConfig.dterm_notch_hz != null && this._sysConfig.dterm_notch_cutoff != null) {
                if (this._sysConfig.dterm_notch_hz > 0 && this._sysConfig.dterm_notch_cutoff > 0) {
                    this._drawNotchFilter(canvasCtx, this._sysConfig.dterm_notch_hz, this._sysConfig.dterm_notch_cutoff, PLOTTED_BLACKBOX_RATE, 'D-TERM notch', WIDTH, HEIGHT, (15*offset++) + MARGIN, "rgba(47, 72, 88, 0.50)");
                }
            }
        }
        offset++; // make some space!
    } catch (e) {
        console.log('Notch filter fieldName missing');
    }

    this._drawInterestFrequency(canvasCtx, this._fftData.maxNoiseIdx,  PLOTTED_BLACKBOX_RATE, 'Max motor noise', WIDTH, HEIGHT, (15*offset) + MARGIN, "rgba(255,0,0,0.50)", 3);

};

GraphSpectrumPlot._drawNotCachedElements = function() {

    var canvasCtx = this._canvasCtx; // Not cached canvas

    var HEIGHT = this._canvasCtx.canvas.height - MARGIN;
    var WIDTH  = this._canvasCtx.canvas.width;
    var PLOTTED_BLACKBOX_RATE = this._fftData.blackBoxRate / this._zoomX;

    var offset = 0;
    if (this._mouseFrequency !=null) {
        this._drawInterestFrequency(canvasCtx, this._mouseFrequency, PLOTTED_BLACKBOX_RATE, '', WIDTH, HEIGHT, 15*offset + MARGIN, "rgba(0,255,0,0.50)", 3);
    }
}

GraphSpectrumPlot._drawAxisLabel = function(canvasCtx, axisLabel, X, Y, align) {
    canvasCtx.font = ((this._isFullScreen)? this._drawingParams.fontSizeFrameLabelFullscreen : this._drawingParams.fontSizeFrameLabel) + "pt " + DEFAULT_FONT_FACE;
    canvasCtx.fillStyle = "rgba(255,255,255,0.9)";
    if(align) {
        canvasCtx.textAlign = align;
    } else {
        canvasCtx.textAlign = 'center';
    }

    canvasCtx.fillText(axisLabel, X, Y);
};

GraphSpectrumPlot._drawGridLines = function(canvasCtx, sampleRate, LEFT, TOP, WIDTH, HEIGHT, MARGIN) {

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
        this._drawAxisLabel(canvasCtx, (frequency.toFixed(0))+"Hz", i * (WIDTH / ticks), HEIGHT + MARGIN, textAlign);
        frequency += frequencyInterval;
    }   
};

GraphSpectrumPlot._drawMarkerLine = function(canvasCtx, frequency, sampleRate, label, WIDTH, HEIGHT, OFFSET, stroke, lineWidth){
    var x = WIDTH * frequency / (sampleRate / 2); // percentage of range where frequncy lies

    lineWidth = (lineWidth || DEFAULT_MARK_LINE_WIDTH);
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
    
    if(label != null) {
        this._drawAxisLabel(canvasCtx, label.trim(), (x + 2), OFFSET + 1, 'left');
    }
    
    return x;
};

GraphSpectrumPlot._drawInterestFrequency = function(canvasCtx, frequency, sampleRate, label, WIDTH, HEIGHT, OFFSET, stroke, lineWidth) {
    var interestLabel = label + ' ' + frequency.toFixed(0) + "Hz";
    return this._drawMarkerLine(canvasCtx, frequency, sampleRate, interestLabel, WIDTH, HEIGHT, OFFSET, stroke, lineWidth);
}

GraphSpectrumPlot._drawLowpassFilter = function(canvasCtx, frequency, sampleRate, label, WIDTH, HEIGHT, OFFSET, stroke, lineWidth) {
    var lpfLabel = label + ' ' + frequency.toFixed(0) + "Hz"
    return this._drawMarkerLine(canvasCtx, frequency, sampleRate, lpfLabel, WIDTH, HEIGHT, OFFSET, stroke, lineWidth);
}

GraphSpectrumPlot._drawLowpassDynFilter = function(canvasCtx, frequency1, frequency2, sampleRate, label, WIDTH, HEIGHT, OFFSET, stroke, lineWidth) {

    // frequency2 line
    var x2 = this._drawMarkerLine(canvasCtx, frequency2, sampleRate, null, WIDTH, HEIGHT, OFFSET, stroke, lineWidth);

    // frequency1 line with label
    var dynFilterLabel = label + ' ' + (frequency1.toFixed(0))+'-'+(frequency2.toFixed(0))+"Hz";
    var x1 = this._drawMarkerLine(canvasCtx, frequency1, sampleRate, dynFilterLabel, WIDTH, HEIGHT, OFFSET, stroke, lineWidth);

    // Join line between frequency1 and frequency2 lines
    canvasCtx.beginPath();
    canvasCtx.lineWidth = lineWidth || DEFAULT_MARK_LINE_WIDTH;
    canvasCtx.strokeStyle = stroke || "rgba(128,128,255,0.50)";

    canvasCtx.moveTo(x1, OFFSET - 10);
    canvasCtx.lineTo(x2, OFFSET - 10);

    canvasCtx.stroke();
};

GraphSpectrumPlot._drawNotchFilter = function(canvasCtx, center, cutoff, sampleRate, label, WIDTH, HEIGHT, OFFSET, stroke, lineWidth) {

    var cutoffX = WIDTH * cutoff / (sampleRate / 2); 
    var centerX = WIDTH * center / (sampleRate / 2); 

    canvasCtx.beginPath();
    canvasCtx.lineWidth = lineWidth || DEFAULT_MARK_LINE_WIDTH;
    canvasCtx.strokeStyle = stroke || "rgba(128,128,255,0.50)";

    // center - offset
    canvasCtx.moveTo(centerX, OFFSET - 10);
    canvasCtx.lineTo(cutoffX, HEIGHT);

    // center + offset
    canvasCtx.moveTo(centerX, OFFSET - 10);
    canvasCtx.lineTo(centerX*2 - cutoffX, HEIGHT);

    canvasCtx.stroke();

    // center with label
    var labelNotch = label + ' center ' + (center.toFixed(0))+'Hz, cutoff '+(cutoff.toFixed(0))+"Hz";
    this._drawMarkerLine(canvasCtx, center, sampleRate, labelNotch, WIDTH, HEIGHT, OFFSET, stroke, lineWidth);

};

GraphSpectrumPlot._invalicateCache = function() {
    this._cachedCanvas = null;
};
"use strict";

const DEFAULT_FONT_FACE       = "Verdana, Arial, sans-serif",
      DEFAULT_MARK_LINE_WIDTH = 2;

var GraphSpectrumPlot = GraphSpectrumPlot || {
    isFullscreen : false,
    canvasCtx    : null,
    drawingParams : {
            fontSizeFrameLabel: null,
            fontSizeFrameLabelFullscreen: "9",
    },
};

GraphSpectrumPlot.initialize = function(canvas) {
    this.canvasCtx = canvas.getContext("2d");
};

GraphSpectrumPlot.setSize = function(width, height) {
    this.canvasCtx.canvas.width  =  width; 
    this.canvasCtx.canvas.height =  height;
}

GraphSpectrumPlot.drawNoiseGraph = function(fftData, dataBuffer, flightLog, isFullscreen, analyserZoomX, analyserZoomY, mouseFrequency) {

    this.isFullScreen = isFullscreen;
    

    this.canvasCtx.save();
    this.canvasCtx.lineWidth = 1;
    this.canvasCtx.clearRect(0, 0, this.canvasCtx.canvas.width, this.canvasCtx.canvas.height);

    var MARGIN = 10; // pixels
    var HEIGHT = this.canvasCtx.canvas.height - MARGIN;
    var WIDTH  = this.canvasCtx.canvas.width;
    var LEFT   = this.canvasCtx.canvas.left;
    var TOP    = this.canvasCtx.canvas.top;

    var PLOTTED_BUFFER_LENGTH = fftData.fftLength / analyserZoomX;
    var PLOTTED_BLACKBOX_RATE = fftData.blackBoxRate / analyserZoomX;

    this.canvasCtx.translate(LEFT, TOP);

    var backgroundGradient = this.canvasCtx.createLinearGradient(0,0,0,(HEIGHT+((isFullscreen)?MARGIN:0)));
    if(isFullscreen) {
        backgroundGradient.addColorStop(1,   'rgba(0,0,0,0.9)');
        backgroundGradient.addColorStop(0,   'rgba(0,0,0,0.7)');
    } else {
        backgroundGradient.addColorStop(1,   'rgba(255,255,255,0.25)');
        backgroundGradient.addColorStop(0,   'rgba(255,255,255,0)');
    }
    this.canvasCtx.fillStyle = backgroundGradient; //'rgba(255, 255, 255, .25)'; /* white */

    this.canvasCtx.fillRect(0, 0, WIDTH, HEIGHT+((isFullscreen)?MARGIN:0));

    var barWidth = (WIDTH / (PLOTTED_BUFFER_LENGTH / 10)) - 1;
    var barHeight;
    var x = 0;

    var barGradient = this.canvasCtx.createLinearGradient(0,HEIGHT,0,0);
        barGradient.addColorStop(constrain(0/analyserZoomY,0,1),      'rgba(0,255,0,0.2)');
        barGradient.addColorStop(constrain(0.15/analyserZoomY,0,1),   'rgba(128,255,0,0.2)');
        barGradient.addColorStop(constrain(0.45/analyserZoomY,0,1),   'rgba(255,0,0,0.5)');
        barGradient.addColorStop(constrain(1/analyserZoomY, 0, 1),    'rgba(255,128,128,1.0)');
    this.canvasCtx.fillStyle = barGradient; //'rgba(0,255,0,0.3)'; //green

    var fftScale = HEIGHT / (analyserZoomY * 100);
    for(var i = 0; i < PLOTTED_BUFFER_LENGTH; i += 10) {
        barHeight = (fftData.fftOutput[i] * fftScale);
        this.canvasCtx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight);
        x += barWidth + 1;
    }

    this.drawAxisLabel(dataBuffer.fieldName, WIDTH - 4, HEIGHT - 6, 'right');
    this.drawGridLines(PLOTTED_BLACKBOX_RATE, LEFT, TOP, WIDTH, HEIGHT, MARGIN);

    var offset = 0;
    if (mouseFrequency !=null) {
        this.drawInterestFrequency(mouseFrequency, PLOTTED_BLACKBOX_RATE, '', WIDTH, HEIGHT, 15*offset + MARGIN, "rgba(0,255,0,0.50)", 3);
    }

    offset += 2; // make some space! Includes the space for the mouseFrequency. In this way the other elements don't move in the screen when used

    // Dynamic gyro lpf 
    if(flightLog.getSysConfig().gyro_lowpass_dyn_hz[0] != null && flightLog.getSysConfig().gyro_lowpass_dyn_hz[0] > 0 &&
            flightLog.getSysConfig().gyro_lowpass_dyn_hz[1] > flightLog.getSysConfig().gyro_lowpass_dyn_hz[0]) {
        this.drawLowpassDynFilter(flightLog.getSysConfig().gyro_lowpass_dyn_hz[0], flightLog.getSysConfig().gyro_lowpass_dyn_hz[1], PLOTTED_BLACKBOX_RATE, 'GYRO LPF Dyn cutoff', WIDTH, HEIGHT, (15*offset++) + MARGIN, "rgba(94, 194, 98, 0.50)");

    // Static gyro lpf
    } else  if ((flightLog.getSysConfig().gyro_lowpass_hz != null) && (flightLog.getSysConfig().gyro_lowpass_hz > 0)) {
        this.drawLowpassFilter(flightLog.getSysConfig().gyro_lowpass_hz,  PLOTTED_BLACKBOX_RATE, 'GYRO LPF cutoff', WIDTH, HEIGHT, (15*offset++) + MARGIN, "rgba(94, 194, 98, 0.50)");
    }

    // Static gyro lpf 2
    if ((flightLog.getSysConfig().gyro_lowpass2_hz != null) && (flightLog.getSysConfig().gyro_lowpass2_hz > 0)) {
        this.drawLowpassFilter(flightLog.getSysConfig().gyro_lowpass2_hz, PLOTTED_BLACKBOX_RATE, 'GYRO LPF2 cutoff', WIDTH, HEIGHT, (15*offset++) + MARGIN, "rgba(0, 172, 122, 0.50)");
    }

     // Notch gyro
    if (flightLog.getSysConfig().gyro_notch_hz != null && flightLog.getSysConfig().gyro_notch_cutoff != null ) {
        if (flightLog.getSysConfig().gyro_notch_hz.length > 0) { //there are multiple gyro notch filters
            for (var i=0; i < flightLog.getSysConfig().gyro_notch_hz.length; i++) {
                if (flightLog.getSysConfig().gyro_notch_hz[i] > 0 && flightLog.getSysConfig().gyro_notch_cutoff[i] > 0) {
                    this.drawNotchFilter(flightLog.getSysConfig().gyro_notch_hz[i], flightLog.getSysConfig().gyro_notch_cutoff[i], PLOTTED_BLACKBOX_RATE, 'GYRO notch', WIDTH, HEIGHT, (15*offset++) + MARGIN, "rgba(0, 148, 134, 0.50)");
                }
            }
        } else { // only a single gyro notch to display
            if (flightLog.getSysConfig().gyro_notch_hz > 0 && flightLog.getSysConfig().gyro_notch_cutoff > 0) {
                this.drawNotchFilter(flightLog.getSysConfig().gyro_notch_hz, flightLog.getSysConfig().gyro_notch_cutoff, PLOTTED_BLACKBOX_RATE, 'GYRO notch', WIDTH, HEIGHT, (15*offset++) + MARGIN, "rgba(0, 148, 134, 0.50)");
            }
        }
    }
        offset++; // make some space!
        try {
            if (dataBuffer.fieldName.match(/(.*yaw.*)/i) != null) {
                if (flightLog.getSysConfig().yaw_lpf_hz != null && flightLog.getSysConfig().yaw_lpf_hz > 0) {
                    this.drawLowpassFilter(flightLog.getSysConfig().yaw_lpf_hz,  PLOTTED_BLACKBOX_RATE, 'YAW LPF cutoff', WIDTH, HEIGHT, (15*offset++) + MARGIN);
                }
            } else {
                // Dynamic dterm lpf 
                if (flightLog.getSysConfig().dterm_lpf_dyn_hz[0] != null && flightLog.getSysConfig().dterm_lpf_dyn_hz[0] > 0 &&
                        flightLog.getSysConfig().dterm_lpf_dyn_hz[1] > flightLog.getSysConfig().dterm_lpf_dyn_hz[0]) {
                    this.drawLowpassDynFilter(flightLog.getSysConfig().dterm_lpf_dyn_hz[0], flightLog.getSysConfig().dterm_lpf_dyn_hz[1], PLOTTED_BLACKBOX_RATE, 'D-TERM LPF Dyn cutoff', WIDTH, HEIGHT, (15*offset++) + MARGIN, "rgba(0, 123, 132, 0.50)");

                // Static dterm lpf
                } else if ((flightLog.getSysConfig().dterm_lpf_hz != null) && (flightLog.getSysConfig().dterm_lpf_hz > 0)) {
                    this.drawLowpassFilter(flightLog.getSysConfig().dterm_lpf_hz,  PLOTTED_BLACKBOX_RATE, 'D-TERM LPF cutoff', WIDTH, HEIGHT, (15*offset++) + MARGIN, "rgba(0, 123, 132, 0.50)");
                }

                // Static dterm lpf 2
                if ((flightLog.getSysConfig().dterm_lpf2_hz != null) && (flightLog.getSysConfig().dterm_lpf2_hz > 0)) {
                    this.drawLowpassFilter(flightLog.getSysConfig().dterm_lpf2_hz,  PLOTTED_BLACKBOX_RATE, 'D-TERM LPF2 cutoff', WIDTH, HEIGHT, (15*offset++) + MARGIN, "rgba(16, 97, 116, 0.50)");
                }

                // Notch dterm
                if (flightLog.getSysConfig().dterm_notch_hz != null && flightLog.getSysConfig().dterm_notch_cutoff != null) {
                    if (flightLog.getSysConfig().dterm_notch_hz > 0 && flightLog.getSysConfig().dterm_notch_cutoff > 0) {
                        this.drawNotchFilter(flightLog.getSysConfig().dterm_notch_hz, flightLog.getSysConfig().dterm_notch_cutoff, PLOTTED_BLACKBOX_RATE, 'D-TERM notch', WIDTH, HEIGHT, (15*offset++) + MARGIN, "rgba(47, 72, 88, 0.50)");
                    }
                }
            }
            offset++; // make some space!
        } catch (e) {
            console.log('Notch filter fieldName missing');
        }
        this.drawInterestFrequency(fftData.maxNoiseIdx,  PLOTTED_BLACKBOX_RATE, 'Max motor noise', WIDTH, HEIGHT, (15*offset) + MARGIN, "rgba(255,0,0,0.50)", 3);

        this.canvasCtx.restore();
};

GraphSpectrumPlot.drawAxisLabel = function(axisLabel, X, Y, align) {
    this.canvasCtx.font = ((this.isFullscreen)?this.drawingParams.fontSizeFrameLabelFullscreen:this.drawingParams.fontSizeFrameLabel) + "pt " + DEFAULT_FONT_FACE;
    this.canvasCtx.fillStyle = "rgba(255,255,255,0.9)";
    if(align) {
        this.canvasCtx.textAlign = align;
    } else {
        this.canvasCtx.textAlign = 'center';
    }

    this.canvasCtx.fillText(axisLabel, X, Y);
};

GraphSpectrumPlot.drawGridLines = function(sampleRate, LEFT, TOP, WIDTH, HEIGHT, MARGIN) {

    var ticks = 5;
    var frequencyInterval = (sampleRate / ticks) / 2;
    var frequency = 0;

    for(var i=0; i<=ticks; i++) {
        this.canvasCtx.beginPath();
        this.canvasCtx.lineWidth = 1;
        this.canvasCtx.strokeStyle = "rgba(255,255,255,0.25)";

        this.canvasCtx.moveTo(i * (WIDTH / ticks), 0);
        this.canvasCtx.lineTo(i * (WIDTH / ticks), HEIGHT);

        this.canvasCtx.stroke();
        var textAlign = (i==0)?'left':((i==ticks)?'right':'center');
        this.drawAxisLabel((frequency.toFixed(0))+"Hz", i * (WIDTH / ticks), HEIGHT + MARGIN, textAlign);
        frequency += frequencyInterval;
    }   
};

GraphSpectrumPlot.drawMarkerLine = function(frequency, sampleRate, label, WIDTH, HEIGHT, OFFSET, stroke, lineWidth){
    var x = WIDTH * frequency / (sampleRate / 2); // percentage of range where frequncy lies

    lineWidth = (lineWidth || DEFAULT_MARK_LINE_WIDTH);
    if (lineWidth > 5) { // is the linewidth specified as a frequency band
        lineWidth = WIDTH *  (2 * lineWidth) / (sampleRate / 2);        
    }
    if(lineWidth < 1) lineWidth = 1;

    this.canvasCtx.beginPath();
    this.canvasCtx.lineWidth = lineWidth || 1;
    this.canvasCtx.strokeStyle = stroke || "rgba(128,128,255,0.50)";

    this.canvasCtx.moveTo(x, OFFSET - 10);
    this.canvasCtx.lineTo(x, HEIGHT);

    this.canvasCtx.stroke();
    
    if(label != null) {
        this.drawAxisLabel(label.trim(), (x + 2), OFFSET + 1, 'left');
    }
    
    return x;
};

GraphSpectrumPlot.drawInterestFrequency = function(frequency, sampleRate, label, WIDTH, HEIGHT, OFFSET, stroke, lineWidth) {
    var interestLabel = label + ' ' + frequency.toFixed(0) + "Hz";
    return this.drawMarkerLine(frequency, sampleRate, interestLabel, WIDTH, HEIGHT, OFFSET, stroke, lineWidth);
}

GraphSpectrumPlot.drawLowpassFilter = function(frequency, sampleRate, label, WIDTH, HEIGHT, OFFSET, stroke, lineWidth) {
    var lpfLabel = label + ' ' + frequency.toFixed(0) + "Hz"
    return this.drawMarkerLine(frequency, sampleRate, lpfLabel, WIDTH, HEIGHT, OFFSET, stroke, lineWidth);
}

GraphSpectrumPlot.drawLowpassDynFilter = function(frequency1, frequency2, sampleRate, label, WIDTH, HEIGHT, OFFSET, stroke, lineWidth) {

    // frequency2 line
    var x2 = this.drawMarkerLine(frequency2, sampleRate, null, WIDTH, HEIGHT, OFFSET, stroke, lineWidth);

    // frequency1 line with label
    var dynFilterLabel = label + ' ' + (frequency1.toFixed(0))+'-'+(frequency2.toFixed(0))+"Hz";
    var x1 = this.drawMarkerLine(frequency1, sampleRate, dynFilterLabel, WIDTH, HEIGHT, OFFSET, stroke, lineWidth);

    // Join line between frequency1 and frequency2 lines
    this.canvasCtx.beginPath();
    this.canvasCtx.lineWidth = lineWidth || DEFAULT_MARK_LINE_WIDTH;
    this.canvasCtx.strokeStyle = stroke || "rgba(128,128,255,0.50)";

    this.canvasCtx.moveTo(x1, OFFSET - 10);
    this.canvasCtx.lineTo(x2, OFFSET - 10);

    this.canvasCtx.stroke();
};

GraphSpectrumPlot.drawNotchFilter = function(center, cutoff, sampleRate, label, WIDTH, HEIGHT, OFFSET, stroke, lineWidth) {

    var cutoffX = WIDTH * cutoff / (sampleRate / 2); 
    var centerX = WIDTH * center / (sampleRate / 2); 

    this.canvasCtx.beginPath();
    this.canvasCtx.lineWidth = lineWidth || DEFAULT_MARK_LINE_WIDTH;
    this.canvasCtx.strokeStyle = stroke || "rgba(128,128,255,0.50)";

    // center - offset
    this.canvasCtx.moveTo(centerX, OFFSET - 10);
    this.canvasCtx.lineTo(cutoffX, HEIGHT);

    // center + offset
    this.canvasCtx.moveTo(centerX, OFFSET - 10);
    this.canvasCtx.lineTo(centerX*2 - cutoffX, HEIGHT);

    this.canvasCtx.stroke();

    // center with label
    var labelNotch = label + ' center ' + (center.toFixed(0))+'Hz, cutoff '+(cutoff.toFixed(0))+"Hz";
    this.drawMarkerLine(center, sampleRate, labelNotch, WIDTH, HEIGHT, OFFSET, stroke, lineWidth);

};


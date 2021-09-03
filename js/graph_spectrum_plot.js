"use strict";

const BLUR_FILTER_PIXEL       = 1,
      DEFAULT_FONT_FACE       = "Verdana, Arial, sans-serif",
      DEFAULT_MARK_LINE_WIDTH = 2,
      MARGIN                  = 10,
      MARGIN_BOTTOM           = 10,
      MARGIN_LEFT             = 25,
      MARGIN_LEFT_FULLSCREEN  = 35,
      MAX_SETPOINT_DEFAULT    = 100,
      PID_ERROR_VERTICAL_CHUNK= 5,
      ZOOM_X_MAX              = 5;

const SPECTRUM_TYPE = {
        FREQUENCY        : 0,
        FREQ_VS_THROTTLE : 1,
        PIDERROR_VS_SETPOINT : 2,
      };

const SPECTRUM_OVERDRAW_TYPE = {
        ALL_FILTERS      : 0,
        GYRO_FILTERS     : 1,
        DTERM_FILTERS    : 2,
        YAW_FILTERS      : 3,
        HIDE_FILTERS     : 4,
        AUTO             : 5,
      };

window.GraphSpectrumPlot = window.GraphSpectrumPlot || {
    _isFullScreen     : false,
    _cachedCanvas     : null,
    _cachedDataCanvas : null,
    _canvasCtx        : null,
    _fftData          : null,
    _mousePosition    : {
            x : 0,
            y : 0,
    },
    _overdrawType     : null,
    _spectrumType     : null,
    _sysConfig        : null,
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
    this._invalidateCache();
    this._invalidateDataCache();
};

GraphSpectrumPlot.setZoom = function(zoomX, zoomY) {

    const modifiedZoomY = (this._zoomY !==  zoomY);

    this._zoomX =  zoomX;
    this._zoomY =  zoomY;
    this._invalidateCache();

    if (modifiedZoomY) {
        this._invalidateDataCache();
    }
};

GraphSpectrumPlot.setSize = function(width, height) {
    this._canvasCtx.canvas.width  =  width;
    this._canvasCtx.canvas.height =  height;
    this._invalidateCache();
};

GraphSpectrumPlot.setFullScreen = function(isFullScreen) {
    this._isFullScreen = isFullScreen;
    this._invalidateCache();
};

GraphSpectrumPlot.setData = function(fftData, spectrumType) {
    this._fftData = fftData;
    this._spectrumType = spectrumType;
    this._invalidateCache();
    this._invalidateDataCache();
};

GraphSpectrumPlot.setOverdraw = function(overdrawType) {
    this._overdrawType = overdrawType;
    this._invalidateCache();
};

GraphSpectrumPlot.setMousePosition = function(x, y) {
    this._mousePosition.x = x;
    this._mousePosition.y = y;
};

GraphSpectrumPlot.draw = function() {

    this._drawCachedElements();
    this._drawNotCachedElements();
};

GraphSpectrumPlot._drawCachedElements = function() {

    if (this._cachedCanvas == null) {

        this._cachedCanvas = document.createElement('canvas');
        const cachedCtx = this._cachedCanvas.getContext('2d');

        cachedCtx.canvas.height = this._canvasCtx.canvas.height;
        cachedCtx.canvas.width = this._canvasCtx.canvas.width;

        this._drawGraph(cachedCtx);
        this._drawFiltersAndMarkers(cachedCtx);

    }

    this._canvasCtx.clearRect(0, 0, this._canvasCtx.canvas.width, this._canvasCtx.canvas.height);
    this._canvasCtx.drawImage(this._cachedCanvas, 0, 0, this._canvasCtx.canvas.width, this._canvasCtx.canvas.height);
};

GraphSpectrumPlot._drawGraph = function(canvasCtx) {

    switch(this._spectrumType) {

    case SPECTRUM_TYPE.FREQUENCY:
        this._drawFrequencyGraph(canvasCtx);
        break;

    case SPECTRUM_TYPE.FREQ_VS_THROTTLE:
        this._drawFrequencyVsThrottleGraph(canvasCtx);
        break;

    case SPECTRUM_TYPE.PIDERROR_VS_SETPOINT:
            this._drawPidErrorVsSetpointGraph(canvasCtx);
            break;

    }

};

GraphSpectrumPlot._drawFrequencyGraph = function(canvasCtx) {

    canvasCtx.lineWidth = 1;

    const HEIGHT = canvasCtx.canvas.height - MARGIN;
    const WIDTH  = canvasCtx.canvas.width;
    const LEFT   = canvasCtx.canvas.left;
    const TOP    = canvasCtx.canvas.top;

    const PLOTTED_BUFFER_LENGTH = this._fftData.fftLength / this._zoomX;
    const PLOTTED_BLACKBOX_RATE = this._fftData.blackBoxRate / this._zoomX;

    canvasCtx.translate(LEFT, TOP);

    this._drawGradientBackground(canvasCtx, WIDTH, HEIGHT);

    const barWidth = (WIDTH / (PLOTTED_BUFFER_LENGTH / 10)) - 1;
    let x = 0;

    const barGradient = canvasCtx.createLinearGradient(0,HEIGHT,0,0);
    barGradient.addColorStop(constrain(0 / this._zoomY,0,1),      'rgba(0,255,0,0.2)');
    barGradient.addColorStop(constrain(0.15 / this._zoomY,0,1),   'rgba(128,255,0,0.2)');
    barGradient.addColorStop(constrain(0.45 / this._zoomY,0,1),   'rgba(255,0,0,0.5)');
    barGradient.addColorStop(constrain(1 / this._zoomY, 0, 1),    'rgba(255,128,128,1.0)');

    canvasCtx.fillStyle = barGradient; //'rgba(0,255,0,0.3)'; //green

    const fftScale = HEIGHT / (this._zoomY * 100);
    for(let i = 0; i < PLOTTED_BUFFER_LENGTH; i += 10) {
        const barHeight = (this._fftData.fftOutput[i] * fftScale);
        canvasCtx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight);
        x += barWidth + 1;
    }

    this._drawAxisLabel(canvasCtx, this._fftData.fieldName, WIDTH - 4, HEIGHT - 6, 'right');
    this._drawHorizontalGridLines(canvasCtx, PLOTTED_BLACKBOX_RATE / 2, LEFT, TOP, WIDTH, HEIGHT, MARGIN, 'Hz');

};

GraphSpectrumPlot._drawFrequencyVsThrottleGraph = function(canvasCtx) {

    const PLOTTED_BLACKBOX_RATE = this._fftData.blackBoxRate / this._zoomX;

    const ACTUAL_MARGIN_LEFT = this._getActualMarginLeft();
    const WIDTH = canvasCtx.canvas.width - ACTUAL_MARGIN_LEFT;
    const HEIGHT = canvasCtx.canvas.height - MARGIN_BOTTOM;
    const LEFT = canvasCtx.canvas.offsetLeft + ACTUAL_MARGIN_LEFT;
    const TOP = canvasCtx.canvas.offsetTop;

    canvasCtx.translate(LEFT, TOP);

    if (this._cachedDataCanvas == null) {
        this._cachedDataCanvas = this._drawHeatMap();
    }

    canvasCtx.drawImage(this._cachedDataCanvas, 0, 0, WIDTH, HEIGHT);

    canvasCtx.drawImage(this._cachedDataCanvas,
            0, 0, this._cachedDataCanvas.width / this._zoomX, this._cachedDataCanvas.height,
            0, 0, WIDTH, HEIGHT);


    this._drawAxisLabel(canvasCtx, this._fftData.fieldName, WIDTH  - 4, HEIGHT - 6, 'right');
    this._drawHorizontalGridLines(canvasCtx, PLOTTED_BLACKBOX_RATE / 2, LEFT, TOP, WIDTH, HEIGHT, MARGIN_BOTTOM, 'Hz');
    this._drawVerticalGridLines(canvasCtx, LEFT, TOP, WIDTH, HEIGHT, 100, '%');

};

GraphSpectrumPlot._drawHeatMap = function() {

    const THROTTLE_VALUES_SIZE  = 100;
    const SCALE_HEATMAP         = 1.3;  // Value decided after some tests to be similar to the scale of frequency graph
                                        // This value will be maximum color

    const heatMapCanvas = document.createElement('canvas');
    const canvasCtx = heatMapCanvas.getContext("2d", { alpha: false });

    // We use always a canvas of the size of the FFT data (is not too big)
    canvasCtx.canvas.width  = this._fftData.fftLength;
    canvasCtx.canvas.height = THROTTLE_VALUES_SIZE;

    const fftColorScale = 100 / (this._zoomY * SCALE_HEATMAP);

    // Loop for throttle
    for(let j = 0; j < 100; j++) {
        // Loop for frequency
        for(let i = 0; i < this._fftData.fftLength; i ++) {
            const valuePlot = Math.round(Math.min(this._fftData.fftOutput[j][i] * fftColorScale, 100));

            // The fillStyle is slow, but I haven't found a way to do this faster...
            canvasCtx.fillStyle = `hsl(360, 100%, ${valuePlot}%)`;
            canvasCtx.fillRect(i, 99 - j, 1, 1);

        }
    }

    // The resulting image has imperfections, usually we not have all the data in the input, so we apply a little of blur
    canvasCtx.filter = `blur(${BLUR_FILTER_PIXEL}px)`;
    canvasCtx.drawImage(heatMapCanvas, 0, 0);
    canvasCtx.filter = 'none';

    return heatMapCanvas;
};

GraphSpectrumPlot._drawPidErrorVsSetpointGraph = function(canvasCtx) {

    const ACTUAL_MARGIN_LEFT = this._getActualMarginLeft();

    const WIDTH  = canvasCtx.canvas.width - ACTUAL_MARGIN_LEFT;
    const HEIGHT = canvasCtx.canvas.height - MARGIN_BOTTOM;
    const LEFT   = canvasCtx.canvas.offsetLeft + ACTUAL_MARGIN_LEFT;
    const TOP    = canvasCtx.canvas.offsetTop;

    const dataLimits = this._drawPidErrorVsSetpointGraphProcessData();

    canvasCtx.translate(LEFT, TOP);

    canvasCtx.beginPath();

    this._drawGradientBackground(canvasCtx, WIDTH, HEIGHT);

    // Line with all the PID Error
    this._drawPidErrorVsSetpointGraphLine(canvasCtx, dataLimits.pidErrorArray, dataLimits.currentDrawMaxSetpoint, dataLimits.currentDrawMaxPidError, WIDTH, HEIGHT);

    // Squares grouping the setpoint range in groups
    this._drawPidErrorVsSetpointGraphGroups(canvasCtx, dataLimits.currentDataMaxSetpoint, dataLimits.currentDrawMaxSetpoint, dataLimits.currentDrawMaxPidError, WIDTH, HEIGHT);

    this._drawAxisLabel(canvasCtx, this._fftData.axisName, WIDTH  - 4, HEIGHT - 6, 'right');
    this._drawHorizontalGridLines(canvasCtx, dataLimits.currentDrawMaxSetpoint, LEFT, TOP, WIDTH, HEIGHT, MARGIN_BOTTOM, 'deg/s');
    this._drawVerticalGridLines(canvasCtx, LEFT, TOP, WIDTH, HEIGHT, dataLimits.currentDrawMaxPidError, 'deg/s');
};

GraphSpectrumPlot._drawPidErrorVsSetpointGraphProcessData = function() {

    const totalDrawMaxSetpoint = Math.trunc((this._fftData.fftOutput.length + (MAX_SETPOINT_DEFAULT - 1)) / MAX_SETPOINT_DEFAULT) * MAX_SETPOINT_DEFAULT;
    const currentDrawMaxSetpoint = MAX_SETPOINT_DEFAULT + Math.trunc((totalDrawMaxSetpoint - MAX_SETPOINT_DEFAULT) / (ZOOM_X_MAX - 1)) * (this._zoomX - 1);
    const currentDataMaxSetpoint = Math.min(currentDrawMaxSetpoint, this._fftData.fftOutput.length - 1);
    const pidErrorArray = this._fftData.fftOutput.slice(0, currentDataMaxSetpoint + 1);
    const maxPidError = Math.max(...pidErrorArray);
    const currentDrawMaxPidError = Math.trunc((maxPidError / PID_ERROR_VERTICAL_CHUNK) + 1) * PID_ERROR_VERTICAL_CHUNK;

    return {
        currentDataMaxSetpoint,
        currentDrawMaxSetpoint,
        pidErrorArray,
        currentDrawMaxPidError,
    };
};

GraphSpectrumPlot._drawPidErrorVsSetpointGraphLine = function(canvasCtx, pidErrorArray, currentDrawMaxSetpoint, currentDrawMaxPidError, WIDTH, HEIGHT) {

    canvasCtx.lineWidth = DEFAULT_MARK_LINE_WIDTH;
    canvasCtx.strokeStyle = "rgba(128,128,255,0.50)";

    const points = [];
    for (let setpoint = 0; setpoint <= currentDrawMaxSetpoint; setpoint++) {
        if (pidErrorArray[setpoint] != null) {
            const x = setpoint * WIDTH / currentDrawMaxSetpoint;
            const y = HEIGHT - pidErrorArray[setpoint] * HEIGHT / currentDrawMaxPidError;
            points.push({
                x,
                y});
        }
    }
    this._drawCurve(canvasCtx, points);
};

GraphSpectrumPlot._drawPidErrorVsSetpointGraphGroups = function(canvasCtx, currentDataMaxSetpoint, currentDrawMaxSetpoint, currentDrawMaxPidError, WIDTH, HEIGHT) {

    const NUMBER_OF_GROUPS = 10;

    const groupedSetpointWidth = currentDrawMaxSetpoint / NUMBER_OF_GROUPS;
    for (let setpointGroup = 0; setpointGroup <= currentDrawMaxSetpoint; setpointGroup += groupedSetpointWidth) {
        let sumPidError = 0;
        let countSamples = 0;
        for (let setpoint = setpointGroup; (setpoint <= currentDataMaxSetpoint) && (setpoint < setpointGroup + groupedSetpointWidth); setpoint++) {
            if (this._fftData.fftOutput[setpoint] != null) {
                sumPidError += this._fftData.fftOutput[setpoint];
                countSamples++;
            }
        }
        if (countSamples > 0) {
            // Draw the rectangle
            const setpointGroupError = sumPidError / countSamples;
            const x = setpointGroup * WIDTH / currentDrawMaxSetpoint;
            const y = HEIGHT - setpointGroupError * HEIGHT / currentDrawMaxPidError;
            const width = groupedSetpointWidth * WIDTH / currentDrawMaxSetpoint;
            const height = HEIGHT - y;
            canvasCtx.fillStyle = "rgba(128,255,0,0.2)";
            canvasCtx.fillRect(x + 1, y, width - 2, height);

            // Draw the value number
            const textGroup = setpointGroupError.toFixed(1);
            this._drawAxisLabel(canvasCtx, textGroup, x + width / 2, Math.min(y + 12, HEIGHT - 2));
        }
    }
};

GraphSpectrumPlot._drawFiltersAndMarkers = function(canvasCtx) {

    const HEIGHT = this._canvasCtx.canvas.height - MARGIN;
    const WIDTH  = this._canvasCtx.canvas.width - this._getActualMarginLeft();
    const PLOTTED_BLACKBOX_RATE = this._fftData.blackBoxRate / this._zoomX;

    let offset = 2; // make some space! Includes the space for the mouse frequency. In this way the other elements don't move in the screen when used

    // Gyro filters
    if (this._overdrawType === SPECTRUM_OVERDRAW_TYPE.ALL_FILTERS ||
        this._overdrawType === SPECTRUM_OVERDRAW_TYPE.GYRO_FILTERS ||
       (this._overdrawType === SPECTRUM_OVERDRAW_TYPE.AUTO && this._fftData.fieldName.toLowerCase().indexOf('gyro') !== -1)) {

        // Dynamic gyro lpf
        if(this._sysConfig.gyro_lowpass_dyn_hz[0] != null && this._sysConfig.gyro_lowpass_dyn_hz[0] > 0 &&
                this._sysConfig.gyro_lowpass_dyn_hz[1] > this._sysConfig.gyro_lowpass_dyn_hz[0]) {
            const label = this._sysConfig.gyro_soft_type != null ? `GYRO LPF (${FILTER_TYPE[this._sysConfig.gyro_soft_type]}) Dyn cutoff` : 'GYRO LPF Dyn cutoff';
            this._drawLowpassDynFilter(canvasCtx, this._sysConfig.gyro_lowpass_dyn_hz[0], this._sysConfig.gyro_lowpass_dyn_hz[1], PLOTTED_BLACKBOX_RATE, label, WIDTH, HEIGHT,
                (15 * offset) + MARGIN, "rgba(94, 194, 98, 0.50)");
            offset++;

        // Static gyro lpf
        } else  if ((this._sysConfig.gyro_lowpass_hz != null) && (this._sysConfig.gyro_lowpass_hz > 0)) {
            const label = this._sysConfig.gyro_soft_type != null ? `GYRO LPF (${FILTER_TYPE[this._sysConfig.gyro_soft_type]}) cutoff` : 'GYRO LPF cutoff';
            this._drawLowpassFilter(canvasCtx, this._sysConfig.gyro_lowpass_hz,  PLOTTED_BLACKBOX_RATE, label, WIDTH, HEIGHT, (15 * offset) + MARGIN, "rgba(94, 194, 98, 0.50)");
            offset++;
        }

        // Static gyro lpf 2
        if ((this._sysConfig.gyro_lowpass2_hz != null) && (this._sysConfig.gyro_lowpass2_hz > 0)) {
            const label = this._sysConfig.gyro_soft2_type != null ? `GYRO LPF2 (${FILTER_TYPE[this._sysConfig.gyro_soft2_type]}) cutoff` : 'GYRO LPF2 cutoff';
            this._drawLowpassFilter(canvasCtx, this._sysConfig.gyro_lowpass2_hz, PLOTTED_BLACKBOX_RATE, label, WIDTH, HEIGHT, (15 * offset) + MARGIN, "rgba(0, 172, 122, 0.50)");
            offset++;
        }

         // Notch gyro
        if (this._sysConfig.gyro_notch_hz != null && this._sysConfig.gyro_notch_cutoff != null ) {
            if (this._sysConfig.gyro_notch_hz.length > 0) { //there are multiple gyro notch filters
                for (let i=0; i < this._sysConfig.gyro_notch_hz.length; i++) {
                    if (this._sysConfig.gyro_notch_hz[i] > 0 && this._sysConfig.gyro_notch_cutoff[i] > 0) {
                        this._drawNotchFilter(canvasCtx, this._sysConfig.gyro_notch_hz[i], this._sysConfig.gyro_notch_cutoff[i], PLOTTED_BLACKBOX_RATE, 'GYRO Notch', WIDTH, HEIGHT,
                            (15 * offset) + MARGIN, "rgba(0, 148, 134, 0.50)");
                        offset++;
                    }
                }
            } else { // only a single gyro notch to display
                if (this._sysConfig.gyro_notch_hz > 0 && this._sysConfig.gyro_notch_cutoff > 0) {
                    this._drawNotchFilter(canvasCtx, this._sysConfig.gyro_notch_hz, this._sysConfig.gyro_notch_cutoff, PLOTTED_BLACKBOX_RATE, 'GYRO Notch', WIDTH, HEIGHT,
                        (15 * offset) + MARGIN, "rgba(0, 148, 134, 0.50)");
                    offset++;
                }
            }
        }
    }
    offset++; // make some space!

    // Yaw filters
    if (this._overdrawType === SPECTRUM_OVERDRAW_TYPE.ALL_FILTERS ||
        this._overdrawType === SPECTRUM_OVERDRAW_TYPE.YAW_FILTERS ||
       (this._overdrawType === SPECTRUM_OVERDRAW_TYPE.AUTO && this._fftData.fieldName.toLowerCase().indexOf('yaw') !== -1)) {

        if (this._sysConfig.yaw_lpf_hz != null && this._sysConfig.yaw_lpf_hz > 0) {
            this._drawLowpassFilter(canvasCtx, this._sysConfig.yaw_lpf_hz,  PLOTTED_BLACKBOX_RATE, 'YAW LPF cutoff', WIDTH, HEIGHT, (15 * offset) + MARGIN);
            offset++;
        }
    }

    // D-TERM filters
    try {

        if (this._overdrawType === SPECTRUM_OVERDRAW_TYPE.ALL_FILTERS ||
            this._overdrawType === SPECTRUM_OVERDRAW_TYPE.DTERM_FILTERS ||
           (this._overdrawType === SPECTRUM_OVERDRAW_TYPE.AUTO && this._fftData.fieldName.toLowerCase().indexOf('pid d') !== -1)) {

            // Dynamic dterm lpf
            if (this._sysConfig.dterm_lpf_dyn_hz[0] != null && this._sysConfig.dterm_lpf_dyn_hz[0] > 0 &&
                    this._sysConfig.dterm_lpf_dyn_hz[1] > this._sysConfig.dterm_lpf_dyn_hz[0]) {
                const label = this._sysConfig.dterm_filter_type != null ? `D-TERM LPF (${FILTER_TYPE[this._sysConfig.dterm_filter_type]}) Dyn cutoff` : 'D-TERM LPF Dyn cutoff';
                this._drawLowpassDynFilter(canvasCtx, this._sysConfig.dterm_lpf_dyn_hz[0], this._sysConfig.dterm_lpf_dyn_hz[1], PLOTTED_BLACKBOX_RATE, label, WIDTH, HEIGHT,
                    (15 * offset) + MARGIN, "rgba(0, 123, 132, 0.50)");
                offset++;

            // Static dterm lpf
            } else if ((this._sysConfig.dterm_lpf_hz != null) && (this._sysConfig.dterm_lpf_hz > 0)) {
                const label = this._sysConfig.dterm_filter_type != null ? `D-TERM LPF (${FILTER_TYPE[this._sysConfig.dterm_filter_type]}) cutoff` : 'D-TERM LPF cutoff';
                this._drawLowpassFilter(canvasCtx, this._sysConfig.dterm_lpf_hz,  PLOTTED_BLACKBOX_RATE, label, WIDTH, HEIGHT, (15 * offset) + MARGIN, "rgba(0, 123, 132, 0.50)");
                offset++;
            }

            // Static dterm lpf 2
            if ((this._sysConfig.dterm_lpf2_hz != null) && (this._sysConfig.dterm_lpf2_hz > 0)) {
                const label = this._sysConfig.dterm_filter2_type != null ? `D-TERM LPF2 (${FILTER_TYPE[this._sysConfig.dterm_filter2_type]}) cutoff` : 'D-TERM LPF2 cutoff';
                this._drawLowpassFilter(canvasCtx, this._sysConfig.dterm_lpf2_hz,  PLOTTED_BLACKBOX_RATE, label, WIDTH, HEIGHT, (15 * offset) + MARGIN, "rgba(16, 97, 116, 0.50)");
                offset++;
            }

            // Notch dterm
            if (this._sysConfig.dterm_notch_hz != null && this._sysConfig.dterm_notch_cutoff != null) {
                if (this._sysConfig.dterm_notch_hz > 0 && this._sysConfig.dterm_notch_cutoff > 0) {
                    this._drawNotchFilter(canvasCtx, this._sysConfig.dterm_notch_hz, this._sysConfig.dterm_notch_cutoff, PLOTTED_BLACKBOX_RATE, 'D-TERM Notch', WIDTH, HEIGHT,
                        (15 * offset) + MARGIN, "rgba(47, 72, 88, 0.50)");
                    offset++;
                }
            }
        }
        offset++; // make some space!
    } catch (e) {
        console.log('Notch filter fieldName missing');
    }

    if (this._spectrumType === SPECTRUM_TYPE.FREQUENCY) {
        this._drawInterestFrequency(canvasCtx, this._fftData.maxNoiseIdx, PLOTTED_BLACKBOX_RATE, 'Max motor noise', WIDTH, HEIGHT, (15 * offset) + MARGIN, "rgba(255,0,0,0.50)", 3);
        offset++;
    }

};

GraphSpectrumPlot._drawNotCachedElements = function() {

    const canvasCtx = this._canvasCtx; // Not cached canvas

    canvasCtx.save();

    const HEIGHT = canvasCtx.canvas.height - MARGIN_BOTTOM;
    const WIDTH = canvasCtx.canvas.width - this._getActualMarginLeft();
    const LEFT = canvasCtx.canvas.offsetLeft + this._getActualMarginLeft();
    const TOP = canvasCtx.canvas.offsetTop;

    canvasCtx.translate(LEFT, TOP);

    const offset = 0;
    if (this._mousePosition.x > 0 || this._mousePosition.y > 0) {
        const stroke = "rgba(0,255,0,0.50)";
        this._drawMousePosition(canvasCtx, this._mousePosition.x, this._mousePosition.y, WIDTH, HEIGHT, (15 * offset) + MARGIN, stroke, 3);
    }

    canvasCtx.restore();
};

GraphSpectrumPlot._drawAxisLabel = function(canvasCtx, axisLabel, X, Y, align, baseline) {

    canvasCtx.save();

    canvasCtx.font = `${((this._isFullScreen)? this._drawingParams.fontSizeFrameLabelFullscreen : this._drawingParams.fontSizeFrameLabel)}pt ${DEFAULT_FONT_FACE}`;
    canvasCtx.fillStyle = "rgba(255,255,255,0.9)";
    if(align) {
        canvasCtx.textAlign = align;
    } else {
        canvasCtx.textAlign = 'center';
    }
    if (baseline) {
        canvasCtx.textBaseline = baseline;
    } else {
        canvasCtx.textBaseline = 'alphabetic';
    }
    canvasCtx.shadowColor = 'black';
    canvasCtx.strokeStyle = 'black';
    canvasCtx.shadowBlur = 3;
    canvasCtx.strokeText(axisLabel, X, Y);
    canvasCtx.fillText(axisLabel, X, Y);

    canvasCtx.restore();
};

GraphSpectrumPlot._drawHorizontalGridLines = function(canvasCtx, maxValue, LEFT, TOP, WIDTH, HEIGHT, MARGIN_UP_LABEL, unitsLabel) {

    const TICKS = 5;
    const ticksInterval = maxValue / TICKS;

    let currentTick = 0;
    for(let i=0; i<=TICKS; i++) {
        canvasCtx.beginPath();
        canvasCtx.lineWidth = 1;
        canvasCtx.strokeStyle = "rgba(255,255,255,0.25)";

        canvasCtx.moveTo(i * (WIDTH / TICKS), 0);
        canvasCtx.lineTo(i * (WIDTH / TICKS), HEIGHT);

        canvasCtx.stroke();
        let textAlign;
        switch (i) {
            case 0:
                textAlign = 'left';
                break;
            case TICKS:
                textAlign = 'right';
                break;
            default:
                textAlign = 'center';
        }
        this._drawAxisLabel(canvasCtx, `${currentTick.toFixed(0)}${unitsLabel}`, i * (WIDTH / TICKS), HEIGHT + MARGIN_UP_LABEL, textAlign);
        currentTick += ticksInterval;
    }
};

GraphSpectrumPlot._drawVerticalGridLines = function(canvasCtx, LEFT, TOP, WIDTH, HEIGHT, maxValue, label) {

    const TICKS = 5;

    for(let i = 0; i <= TICKS; i++) {
            canvasCtx.beginPath();
            canvasCtx.lineWidth = 1;
            canvasCtx.strokeStyle = "rgba(255,255,255,0.25)";

            const verticalPosition = i * (HEIGHT / TICKS);
            canvasCtx.moveTo(0, verticalPosition);
            canvasCtx.lineTo(WIDTH, verticalPosition);

            canvasCtx.stroke();
            const verticalAxisValue = maxValue - i * maxValue / TICKS;
            let textBaseline;
            switch (i) {
                case 0:
                    textBaseline = 'top';
                    break;
                case TICKS:
                    textBaseline = 'bottom';
                    break;
                default:
                    textBaseline = 'middle';
            }
            this._drawAxisLabel(canvasCtx, `${verticalAxisValue}${label}`, 0, verticalPosition, "right", textBaseline);
    }
};

GraphSpectrumPlot._drawVerticalMarkerLine = function(canvasCtx, value, axisMaximum, label, WIDTH, HEIGHT, OFFSET, stroke, lineWidth) {
    const x = WIDTH * value / axisMaximum;

    let realLineWidth = (lineWidth || DEFAULT_MARK_LINE_WIDTH);
    if (realLineWidth > 5) { // is the linewidth specified as a frequency band
        realLineWidth = WIDTH *  (2 * realLineWidth) / (axisMaximum / 2);
    }
    if (realLineWidth < 1) {
        realLineWidth = 1;
    }

    canvasCtx.beginPath();
    canvasCtx.lineWidth = realLineWidth || 1;
    canvasCtx.strokeStyle = stroke || "rgba(128,128,255,0.50)";

    canvasCtx.moveTo(x, OFFSET - 10);
    canvasCtx.lineTo(x, HEIGHT);

    canvasCtx.stroke();

    if(label != null) {
        this._drawAxisLabel(canvasCtx, label.trim(), (x + 2), OFFSET + 1, 'left');
    }

    return x;
};

GraphSpectrumPlot._drawHorizontalMarkerLine = function(canvasCtx, value, maxAxisValue, label, WIDTH, HEIGHT, OFFSET, stroke, lineWidth){

    const y = HEIGHT * (maxAxisValue - value) / maxAxisValue; // percentage of range where throttle lies

    let realLineWidth = (lineWidth || DEFAULT_MARK_LINE_WIDTH);
    if (realLineWidth > 5) { // is the linewidth specified as a frequency band
        realLineWidth = WIDTH *  (2 * realLineWidth) / (sampleRate / 2);
    }
    if (realLineWidth < 1) {
        realLineWidth = 1;
    }

    canvasCtx.beginPath();
    canvasCtx.lineWidth = realLineWidth || 1;
    canvasCtx.strokeStyle = stroke || "rgba(128,128,255,0.50)";

    canvasCtx.moveTo(0, y);
    canvasCtx.lineTo(WIDTH - OFFSET + 10, y);

    canvasCtx.stroke();

    if(label != null) {
        this._drawAxisLabel(canvasCtx, label.trim(), (WIDTH - OFFSET + 8), y - 2, 'right');
    }

    return y;
};

GraphSpectrumPlot._drawGradientBackground = function(canvasCtx, WIDTH, HEIGHT) {

    const backgroundGradient = canvasCtx.createLinearGradient(0, 0, 0, (HEIGHT + ((this._isFullScreen) ? MARGIN : 0)));

    if (this._isFullScreen) {
        backgroundGradient.addColorStop(1, 'rgba(0,0,0,0.9)');
        backgroundGradient.addColorStop(0, 'rgba(0,0,0,0.7)');
    } else {
        backgroundGradient.addColorStop(1, 'rgba(255,255,255,0.25)');
        backgroundGradient.addColorStop(0, 'rgba(255,255,255,0)');
    }

    canvasCtx.fillStyle = backgroundGradient;
    canvasCtx.fillRect(0, 0, WIDTH, HEIGHT + ((this._isFullScreen) ? MARGIN : 0));
};

GraphSpectrumPlot._drawInterestFrequency = function(canvasCtx, frequency, sampleRate, label, WIDTH, HEIGHT, OFFSET, stroke, lineWidth) {
    const interestLabel = `${label} ${frequency.toFixed(0)}Hz`;
    return this._drawVerticalMarkerLine(canvasCtx, frequency, sampleRate / 2, interestLabel, WIDTH, HEIGHT, OFFSET, stroke, lineWidth);
};

GraphSpectrumPlot._drawLowpassFilter = function(canvasCtx, frequency, sampleRate, label, WIDTH, HEIGHT, OFFSET, stroke, lineWidth) {
    const lpfLabel = `${label} ${frequency.toFixed(0)}Hz`;
    return this._drawVerticalMarkerLine(canvasCtx, frequency, sampleRate / 2, lpfLabel, WIDTH, HEIGHT, OFFSET, stroke, lineWidth);
};

GraphSpectrumPlot._drawLowpassDynFilter = function(canvasCtx, frequency1, frequency2, sampleRate, label, WIDTH, HEIGHT, OFFSET, stroke, lineWidth) {

    // frequency1 line with label
    const dynFilterLabel = `${label} ${frequency1.toFixed(0)}-${frequency2.toFixed(0)}Hz`;
    const x1 = this._drawVerticalMarkerLine(canvasCtx, frequency1, sampleRate / 2, dynFilterLabel, WIDTH, HEIGHT, OFFSET, stroke, lineWidth);

    // frequency2 line
    const offsetByType = (this._spectrumType === SPECTRUM_TYPE.FREQ_VS_THROTTLE)? 0 : OFFSET;
    const x2 = this._drawVerticalMarkerLine(canvasCtx, frequency2, sampleRate / 2, null, WIDTH, HEIGHT, offsetByType, stroke, lineWidth);

    // Join line between frequency1 and frequency2 lines
    canvasCtx.beginPath();
    canvasCtx.lineWidth = lineWidth || DEFAULT_MARK_LINE_WIDTH;
    canvasCtx.strokeStyle = stroke || "rgba(128,128,255,0.50)";

    if (this._spectrumType === SPECTRUM_TYPE.FREQ_VS_THROTTLE) {
        /*
         * It draws a curve:
         *      frequency = (throttle - (throttle * throttle * throttle) / 3.0f) * 1.5f;
         * but need to scale the 1.5f using the max value of the dyn filter
         */
        const scale = frequency2 / (sampleRate / 2);
        const NUMBER_OF_POINTS = this._isFullScreen? 30 : 10;

        let startPlot = false;
        const points = [];
        for (let i=1; i <= NUMBER_OF_POINTS; i++) {

            const throttle = 1 / NUMBER_OF_POINTS * i;
            const y = HEIGHT - HEIGHT * throttle;


            const frequency = (throttle - (throttle * throttle * throttle) / 3) * (1.5 * scale);
            const x = WIDTH * frequency;

            if (x >= x1) {
                if (startPlot === false) {
                    // Interpolate a more or less correct y in the x1 position
                    points.push({
                        x: x1,
                        y: y + (HEIGHT - y) * (1 - x1 / x)});
                }
                startPlot = true;
                points.push({
                    x,
                    y});
            }
        }

        this._drawCurve(canvasCtx, points);

    } else {
        canvasCtx.moveTo(x1, OFFSET - 10);
        canvasCtx.lineTo(x2, OFFSET - 10);
    }

    canvasCtx.stroke();
};

GraphSpectrumPlot._drawNotchFilter = function(canvasCtx, center, cutoff, sampleRate, label, WIDTH, HEIGHT, OFFSET, stroke, lineWidth) {

    const cutoffX = WIDTH * cutoff / (sampleRate / 2);
    const centerX = WIDTH * center / (sampleRate / 2);

    canvasCtx.beginPath();
    canvasCtx.lineWidth = lineWidth || DEFAULT_MARK_LINE_WIDTH;
    canvasCtx.strokeStyle = stroke || "rgba(128,128,255,0.50)";

    if (this._spectrumType === SPECTRUM_TYPE.FREQ_VS_THROTTLE) {

        canvasCtx.moveTo(cutoffX, 0);
        canvasCtx.lineTo(centerX*2 - cutoffX, HEIGHT);
        canvasCtx.lineTo(centerX*2 - cutoffX, 0);
        canvasCtx.lineTo(cutoffX, HEIGHT);
        canvasCtx.lineTo(cutoffX, 0);

    } else {
        // center - offset
        canvasCtx.moveTo(centerX, OFFSET - 10);
        canvasCtx.lineTo(cutoffX, HEIGHT);

        // center + offset
        canvasCtx.moveTo(centerX, OFFSET - 10);
        canvasCtx.lineTo(centerX*2 - cutoffX, HEIGHT);

    }

    canvasCtx.stroke();

    // center with label
    const labelNotch = `${label} center ${center.toFixed(0)}Hz, cutoff ${cutoff.toFixed(0)}Hz`;
    this._drawVerticalMarkerLine(canvasCtx, center, sampleRate / 2, labelNotch, WIDTH, HEIGHT, OFFSET, stroke, lineWidth);

};

GraphSpectrumPlot._drawMousePosition = function(canvasCtx, mouseX, mouseY, WIDTH, HEIGHT, OFFSET, stroke, lineWidth) {

    // X axis
    if (this._spectrumType === SPECTRUM_TYPE.FREQUENCY || this._spectrumType === SPECTRUM_TYPE.FREQ_VS_THROTTLE) {
        // Calculate frequency at mouse
        const sampleRate = this._fftData.blackBoxRate / this._zoomX;
        const marginLeft = this._getActualMarginLeft();

        const mouseFrequency = ((mouseX - marginLeft) / WIDTH) * ((this._fftData.blackBoxRate / this._zoomX) / 2);
        if (mouseFrequency >= 0 && mouseFrequency <= sampleRate) {
            this._drawInterestFrequency(canvasCtx, mouseFrequency, sampleRate, '', WIDTH, HEIGHT, OFFSET, "rgba(0,255,0,0.50)", 3);
        }

        // Y axis
        if (this._spectrumType === SPECTRUM_TYPE.FREQ_VS_THROTTLE) {
            const mouseThrottle = (1 - (mouseY / HEIGHT)) * 100;
            if (mouseThrottle >= 0 && mouseThrottle <= 100) {
                const throttleLabel = `${mouseThrottle.toFixed(0)}%`;
                this._drawHorizontalMarkerLine(canvasCtx, mouseThrottle, 100, throttleLabel, WIDTH, HEIGHT, OFFSET, stroke, lineWidth);
            }
        }
    } else if (this._spectrumType === SPECTRUM_TYPE.PIDERROR_VS_SETPOINT) {

        const dataLimits = this._drawPidErrorVsSetpointGraphProcessData();

        // X axis. Calculate deg/sec at mouse
        const marginLeft = this._getActualMarginLeft();

        const mouseDegreesSecond = ((mouseX - marginLeft) / WIDTH) * dataLimits.currentDrawMaxSetpoint;
        const interestLabel = `${mouseDegreesSecond.toFixed(0)}deg/sec`;
        this._drawVerticalMarkerLine(canvasCtx, mouseDegreesSecond, dataLimits.currentDrawMaxSetpoint, interestLabel, WIDTH, HEIGHT, OFFSET, stroke, lineWidth);

        // Y axis. Calculate PID Error at mouse

        const mousePidError = (1 - (mouseY / HEIGHT)) * dataLimits.currentDrawMaxPidError;
        if (mousePidError >= 0 && mousePidError <= dataLimits.currentDrawMaxPidError) {
            const pidErrorLabel = `${mousePidError.toFixed(1)}deg/sec`;
            this._drawHorizontalMarkerLine(canvasCtx, mousePidError, dataLimits.currentDrawMaxPidError, pidErrorLabel, WIDTH, HEIGHT, OFFSET, stroke, lineWidth);
        }
    }
};

GraphSpectrumPlot._getActualMarginLeft = function() {

    let actualMarginLeft;
    switch (this._spectrumType) {

    case SPECTRUM_TYPE.FREQ_VS_THROTTLE:
        actualMarginLeft = (this._isFullScreen)? MARGIN_LEFT_FULLSCREEN : MARGIN_LEFT;
        break;
    case SPECTRUM_TYPE.PIDERROR_VS_SETPOINT:
        actualMarginLeft = (this._isFullScreen)? MARGIN_LEFT_FULLSCREEN : MARGIN_LEFT;
        actualMarginLeft *= 2;
        break;
    case SPECTRUM_TYPE.FREQUENCY:
    default:
        actualMarginLeft = 0;
    }

    return actualMarginLeft;
};

GraphSpectrumPlot._drawCurve = function(canvasCtx, points, tension) {

    canvasCtx.beginPath();
    canvasCtx.moveTo(points[0].x, points[0].y);

    const t = (tension != null) ? tension : 1;
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = (i > 0) ? points[i - 1] : points[0];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = (i !== points.length - 2) ? points[i + 2] : p2;

        const cp1x = p1.x + (p2.x - p0.x) / 6 * t;
        const cp1y = p1.y + (p2.y - p0.y) / 6 * t;

        const cp2x = p2.x - (p3.x - p1.x) / 6 * t;
        const cp2y = p2.y - (p3.y - p1.y) / 6 * t;

        canvasCtx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
    canvasCtx.stroke();
};

GraphSpectrumPlot._invalidateCache = function() {
    this._cachedCanvas = null;
};

GraphSpectrumPlot._invalidateDataCache = function() {
    this._cachedDataCanvas = null;
};

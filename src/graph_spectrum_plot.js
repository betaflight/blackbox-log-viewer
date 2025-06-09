import { FILTER_TYPE } from "./flightlog_fielddefs";
import { constrain } from "./tools";
import { NUM_VS_BINS } from "./graph_spectrum_calc";

const BLUR_FILTER_PIXEL = 1,
  DEFAULT_FONT_FACE = "Verdana, Arial, sans-serif",
  DEFAULT_MARK_LINE_WIDTH = 2,
  MARGIN = 10,
  MARGIN_BOTTOM = 10,
  MARGIN_LEFT = 25,
  MARGIN_LEFT_FULLSCREEN = 35,
  MAX_SETPOINT_DEFAULT = 100,
  PID_ERROR_VERTICAL_CHUNK = 5,
  ZOOM_X_MAX = 5,
  MAX_SPECTRUM_LINE_COUNT = 30000;

export const DEFAULT_MIN_DBM_VALUE = -40,
  DEFAULT_MAX_DBM_VALUE = 10;

export const SPECTRUM_TYPE = {
  FREQUENCY: 0,
  FREQ_VS_THROTTLE: 1,
  FREQ_VS_RPM: 2,
  POWER_SPECTRAL_DENSITY: 3,
  PSD_VS_THROTTLE: 4,
  PSD_VS_RPM: 5,
  PIDERROR_VS_SETPOINT: 6,
};

export const SPECTRUM_OVERDRAW_TYPE = {
  ALL_FILTERS: 0,
  GYRO_FILTERS: 1,
  DTERM_FILTERS: 2,
  YAW_FILTERS: 3,
  HIDE_FILTERS: 4,
  AUTO: 5,
};

export const GraphSpectrumPlot = window.GraphSpectrumPlot || {
  _isFullScreen: false,
  _cachedCanvas: null,
  _cachedDataCanvas: null,
  _canvasCtx: null,
  _fftData: null,
  _mousePosition: {
    x: 0,
    y: 0,
  },
  _overdrawType: null,
  _spectrumType: null,
  _sysConfig: null,
  _zoomX: 1.0,
  _zoomY: 1.0,
  _minPSD: DEFAULT_MIN_DBM_VALUE,
  _maxPSD: DEFAULT_MAX_DBM_VALUE,
  _lowLevelPSD: DEFAULT_MIN_DBM_VALUE,
  _drawingParams: {
    fontSizeFrameLabel: "6",
    fontSizeFrameLabelFullscreen: "9",
  },
  _importedSpectrumsData: [],
};

GraphSpectrumPlot.initialize = function (canvas, sysConfig) {
  this._canvasCtx = canvas.getContext("2d");
  this._sysConfig = sysConfig;
  this._invalidateCache();
  this._invalidateDataCache();
  this._logRateWarning = undefined;
  this._zoomX = 1;
  this._zoomY = 1;
};

GraphSpectrumPlot.setZoom = function (zoomX, zoomY) {
  const modifiedZoomY = this._zoomY !== zoomY;

  this._zoomX = zoomX;
  this._zoomY = zoomY;
  this._invalidateCache();

  if (modifiedZoomY) {
    this._invalidateDataCache();
  }
};

GraphSpectrumPlot.setMinPSD = function (min) {
  const modified = this._minPSD !== min;
  if (modified) {
    this._minPSD = min;
    this._invalidateCache();
    this._invalidateDataCache();
  }
};

GraphSpectrumPlot.setMaxPSD = function (max) {
  const modified = this._maxPSD !== max;
  if (modified) {
    this._maxPSD = max;
    this._invalidateCache();
    this._invalidateDataCache();
  }
};

GraphSpectrumPlot.setLowLevelPSD = function (lowLevel) {
  const modifiedLevel = this._lowLevelPSD !== lowLevel;
  if (modifiedLevel) {
    this._lowLevelPSD = lowLevel;
    this._invalidateCache();
    this._invalidateDataCache();
  }
};

GraphSpectrumPlot.setSize = function (width, height) {
  this._canvasCtx.canvas.width = width;
  this._canvasCtx.canvas.height = height;
  this._invalidateCache();
};

GraphSpectrumPlot.setFullScreen = function (isFullScreen) {
  this._isFullScreen = isFullScreen;
  this._invalidateCache();
};

GraphSpectrumPlot.setData = function (fftData, spectrumType) {
  this._fftData = fftData;
  this._spectrumType = spectrumType;
  this._invalidateCache();
  this._invalidateDataCache();
};

GraphSpectrumPlot.getImportedSpectrumCount = function () {
  return this._importedSpectrumsData.length;
};

GraphSpectrumPlot.addImportedSpectrumData = function (curvesData, name) {
  const curve = {
    points: curvesData,
    name:   name,
  };
  this._importedSpectrumsData.push(curve);
  this._invalidateCache();
  this._invalidateDataCache();
  GraphSpectrumPlot.draw();
};

GraphSpectrumPlot.clearImportedSpectrums = function (curvesData) {
  this._importedSpectrumsData.length = 0;
  this._invalidateCache();
  this._invalidateDataCache();
  GraphSpectrumPlot.draw();
};

GraphSpectrumPlot.setOverdraw = function (overdrawType) {
  this._overdrawType = overdrawType;
  this._invalidateCache();
};

GraphSpectrumPlot.setMousePosition = function (x, y) {
  this._mousePosition.x = x;
  this._mousePosition.y = y;
};

GraphSpectrumPlot.draw = function () {
  this._drawCachedElements();
  this._drawNotCachedElements();
};

GraphSpectrumPlot._drawCachedElements = function () {
  if (this._cachedCanvas == null) {
    this._cachedCanvas = document.createElement("canvas");
    const cachedCtx = this._cachedCanvas.getContext("2d");

    cachedCtx.canvas.height = this._canvasCtx.canvas.height;
    cachedCtx.canvas.width = this._canvasCtx.canvas.width;

    this._drawGraph(cachedCtx);
    this._drawFiltersAndMarkers(cachedCtx);
  }

  this._canvasCtx.clearRect(
    0,
    0,
    this._canvasCtx.canvas.width,
    this._canvasCtx.canvas.height
  );
  this._canvasCtx.drawImage(
    this._cachedCanvas,
    0,
    0,
    this._canvasCtx.canvas.width,
    this._canvasCtx.canvas.height
  );
};

GraphSpectrumPlot._drawGraph = function (canvasCtx) {
  switch (this._spectrumType) {
    case SPECTRUM_TYPE.FREQUENCY:
      this._drawFrequencyGraph(canvasCtx);
      break;

    case SPECTRUM_TYPE.FREQ_VS_THROTTLE:
      this._drawFrequencyVsXGraph(canvasCtx);
      break;

    case SPECTRUM_TYPE.FREQ_VS_RPM:
      this._drawFrequencyVsXGraph(canvasCtx);
      break;

    case SPECTRUM_TYPE.PSD_VS_THROTTLE:
      this._drawFrequencyVsXGraph(canvasCtx, true);
      break;

    case SPECTRUM_TYPE.PSD_VS_RPM:
      this._drawFrequencyVsXGraph(canvasCtx, true);
      break;

    case SPECTRUM_TYPE.PIDERROR_VS_SETPOINT:
      this._drawPidErrorVsSetpointGraph(canvasCtx);
      break;

    case SPECTRUM_TYPE.POWER_SPECTRAL_DENSITY:
      this._drawPowerSpectralDensityGraph(canvasCtx);
      break;
  }
};

GraphSpectrumPlot._drawFrequencyGraph = function (canvasCtx) {
  const HEIGHT = canvasCtx.canvas.height - MARGIN;
  const WIDTH = canvasCtx.canvas.width;
  const LEFT = canvasCtx.canvas.left;
  const TOP = canvasCtx.canvas.top;

  const PLOTTED_BUFFER_LENGTH = this._fftData.fftLength / this._zoomX;
  const PLOTTED_BLACKBOX_RATE = this._fftData.blackBoxRate / this._zoomX;

  canvasCtx.save();
  canvasCtx.translate(LEFT, TOP);

  this._drawGradientBackground(canvasCtx, WIDTH, HEIGHT);

  const barGradient = canvasCtx.createLinearGradient(0, HEIGHT, 0, 0);
  barGradient.addColorStop(
    constrain(0 / this._zoomY, 0, 1),
    "rgba(0,255,0,0.2)"
  );
  barGradient.addColorStop(
    constrain(0.15 / this._zoomY, 0, 1),
    "rgba(128,255,0,0.2)"
  );
  barGradient.addColorStop(
    constrain(0.45 / this._zoomY, 0, 1),
    "rgba(255,0,0,0.5)"
  );
  barGradient.addColorStop(
    constrain(1 / this._zoomY, 0, 1),
    "rgba(255,128,128,1.0)"
  );

  canvasCtx.fillStyle = barGradient;

  const fftScale = HEIGHT / (this._zoomY * 100);
  // Limit maximal count of drawing line to get good performance
  const stepData = Math.floor(PLOTTED_BUFFER_LENGTH / MAX_SPECTRUM_LINE_COUNT) + 1;
  const stepX = WIDTH / (PLOTTED_BUFFER_LENGTH / stepData);
  const barWidth = Math.max(stepX, 1);
  let x = 0;
  for (let i = 0; i < PLOTTED_BUFFER_LENGTH; i += stepData) {
    const barHeight = this._fftData.fftOutput[i] * fftScale;
    canvasCtx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight);
    x += stepX;
  }

  //Draw imported spectrums
  const curvesColors = [
    "Blue",
    "Purple",
    "DeepPink",
    "DarkCyan",
    "Chocolate",
  ];

  const spectrumCount =  this._importedSpectrumsData.length;
  for (let spectrumNum = 0;  spectrumNum < spectrumCount; spectrumNum++) {
    const curvesPonts = this._importedSpectrumsData[spectrumNum].points;
    const pointsCount = curvesPonts.length;
    const scaleX = 2 * WIDTH / PLOTTED_BLACKBOX_RATE * this._zoomX;

    canvasCtx.beginPath();
    canvasCtx.lineWidth = 1;
    canvasCtx.strokeStyle = curvesColors[spectrumNum];
    canvasCtx.moveTo(0, HEIGHT);
    const filterPointsCount = 50;
    for (let pointNum = 0; pointNum < pointsCount; pointNum++) {
    // Apply moving average filter at spectrum points to get visible line
      let filterStartPoint = pointNum - filterPointsCount / 2;
      if (filterStartPoint < 0) {
        filterStartPoint = 0;
      }
      let filterStopPoint = filterStartPoint + filterPointsCount;
      if (filterStopPoint > pointsCount) {
        filterStopPoint = pointsCount;
        filterStartPoint = filterStopPoint - filterPointsCount;
        if (filterStartPoint < 0) {
          filterStartPoint = 0;
        }
      }
      let middleValue = 0;
      for (let i = filterStartPoint; i < filterStopPoint; i++) {
        middleValue += curvesPonts[i].value;
      }
      middleValue /= filterPointsCount;

      canvasCtx.lineTo(curvesPonts[pointNum].freq * scaleX, HEIGHT - middleValue * fftScale);
    }
    canvasCtx.stroke();
  }

//Legend draw
  if (this._isFullScreen && spectrumCount > 0) {
    const legendPosX = 0.84 * WIDTH,
          legendPosY = 0.6 * HEIGHT,
          rowHeight = 16,
          padding = 4,
          legendWidth = 0.13 * WIDTH + padding,
          legendHeight = spectrumCount * rowHeight + 3 * padding;

    const legendArea = new Path2D();
    legendArea.rect(legendPosX, legendPosY, legendWidth, legendHeight);
    canvasCtx.clip(legendArea);
    canvasCtx.strokeStyle = "gray";
    canvasCtx.strokeRect(legendPosX, legendPosY, legendWidth, legendHeight);
    canvasCtx.font = `${this._drawingParams.fontSizeFrameLabelFullscreen}pt ${DEFAULT_FONT_FACE}`;
    canvasCtx.textAlign = "left";
    for (let row = 0; row < spectrumCount; row++) {
      const curvesName = this._importedSpectrumsData[row].name.split('.')[0];
      const Y = legendPosY + padding + rowHeight * (row + 1);
      canvasCtx.strokeStyle = curvesColors[row];
      canvasCtx.strokeText(curvesName, legendPosX + padding, Y);
    }
  }
  canvasCtx.restore();

  this._drawAxisLabel(
    canvasCtx,
    this._fftData.fieldName,
    WIDTH - 4,
    HEIGHT - 6,
    "right",
  );
  this._drawHorizontalGridLines(
    canvasCtx,
    PLOTTED_BLACKBOX_RATE / 2,
    LEFT,
    TOP,
    WIDTH,
    HEIGHT,
    MARGIN,
    "Hz",
  );
};

GraphSpectrumPlot._drawPowerSpectralDensityGraph = function (canvasCtx) {
  const HEIGHT = canvasCtx.canvas.height - MARGIN;
  const ACTUAL_MARGIN_LEFT = this._getActualMarginLeft();
  const WIDTH = canvasCtx.canvas.width - ACTUAL_MARGIN_LEFT;
  const LEFT = canvasCtx.canvas.offsetLeft + ACTUAL_MARGIN_LEFT;
  const TOP = canvasCtx.canvas.offsetTop;

  const PLOTTED_BLACKBOX_RATE = this._fftData.blackBoxRate / this._zoomX;

  canvasCtx.save();
  canvasCtx.translate(LEFT, TOP);
  this._drawGradientBackground(canvasCtx, WIDTH, HEIGHT);

  const pointsCount = this._fftData.psdLength;
  const scaleX = 2 * WIDTH / PLOTTED_BLACKBOX_RATE * this._zoomX;
  canvasCtx.beginPath();
  canvasCtx.lineWidth = 1;
  canvasCtx.strokeStyle = "white";

  // Allign y axis range by 10db
  const dbStep = 10;
  const minY = Math.floor(this._fftData.minimum / dbStep) * dbStep;
  let maxY = (Math.floor(this._fftData.maximum / dbStep) + 1) * dbStep;
  if (minY == maxY) {
    maxY = minY + 1;  // prevent divide by zero
  }
  const ticksCount = (maxY - minY) / dbStep;
  const scaleY = HEIGHT / (maxY - minY);
  //Store vsRange for _drawMousePosition
  this._fftData.vsRange = {
    min: minY,
    max: maxY,
  };
  canvasCtx.moveTo(0, 0);
  for (let pointNum = 0; pointNum < pointsCount; pointNum++) {
    const freq = PLOTTED_BLACKBOX_RATE / 2 * pointNum / pointsCount;
    const y = HEIGHT - (this._fftData.psdOutput[pointNum] - minY) * scaleY;
    canvasCtx.lineTo(freq * scaleX, y);
  }
  canvasCtx.stroke();

  this._drawAxisLabel(
    canvasCtx,
    this._fftData.fieldName,
    WIDTH - 4,
    HEIGHT - 6,
    "right",
  );
  this._drawHorizontalGridLines(
    canvasCtx,
    PLOTTED_BLACKBOX_RATE / 2,
    LEFT,
    TOP,
    WIDTH,
    HEIGHT,
    MARGIN,
    "Hz",
  );
  this._drawVerticalGridLines(
    canvasCtx,
    LEFT,
    TOP,
    WIDTH,
    HEIGHT,
    minY,
    maxY,
    "dBm/Hz",
    ticksCount,
  );
  const offset = 1;
  this._drawInterestFrequency(
    canvasCtx,
    this._fftData.maxNoiseFrequency,
    PLOTTED_BLACKBOX_RATE,
    "Max noise",
    WIDTH,
    HEIGHT,
    15 * offset + MARGIN,
    "rgba(255,0,0,0.50)",
    3,
  );

  canvasCtx.restore();
};

GraphSpectrumPlot.getPSDbyFreq  = function(frequency) {
  let freqIndex = Math.round(2 * frequency / this._fftData.blackBoxRate * (this._fftData.psdOutput.length - 1) );
  freqIndex = Math.min(freqIndex, this._fftData.psdOutput.length - 1);
  freqIndex = Math.max(freqIndex, 0);
  return this._fftData.psdOutput.length ? this._fftData.psdOutput[freqIndex] : 0;
};

GraphSpectrumPlot._drawFrequencyVsXGraph = function (canvasCtx, drawPSD = false) {
  const PLOTTED_BLACKBOX_RATE = this._fftData.blackBoxRate / this._zoomX;

  const ACTUAL_MARGIN_LEFT = this._getActualMarginLeft();
  const WIDTH = canvasCtx.canvas.width - ACTUAL_MARGIN_LEFT;
  const HEIGHT = canvasCtx.canvas.height - MARGIN_BOTTOM;
  const LEFT = canvasCtx.canvas.offsetLeft + ACTUAL_MARGIN_LEFT;
  const TOP = canvasCtx.canvas.offsetTop;

  canvasCtx.translate(LEFT, TOP);

  if (this._cachedDataCanvas == null) {
    this._cachedDataCanvas = this._drawHeatMap(drawPSD);
  }

  canvasCtx.drawImage(this._cachedDataCanvas, 0, 0, WIDTH, HEIGHT);

  canvasCtx.drawImage(
    this._cachedDataCanvas,
    0,
    0,
    this._cachedDataCanvas.width / this._zoomX,
    this._cachedDataCanvas.height,
    0,
    0,
    WIDTH,
    HEIGHT
  );

  this._drawAxisLabel(
    canvasCtx,
    this._fftData.fieldName,
    WIDTH - 4,
    HEIGHT - 6,
    "right"
  );
  this._drawHorizontalGridLines(
    canvasCtx,
    PLOTTED_BLACKBOX_RATE / 2,
    LEFT,
    TOP,
    WIDTH,
    HEIGHT,
    MARGIN_BOTTOM,
    "Hz"
  );

  if (this._spectrumType === SPECTRUM_TYPE.FREQ_VS_THROTTLE ||
      this._spectrumType === SPECTRUM_TYPE.PSD_VS_THROTTLE) {
    this._drawVerticalGridLines(
      canvasCtx,
      LEFT,
      TOP,
      WIDTH,
      HEIGHT,
      this._fftData.vsRange.min,
      this._fftData.vsRange.max,
      "%"
    );
  } else if (this._spectrumType === SPECTRUM_TYPE.FREQ_VS_RPM ||
             this._spectrumType === SPECTRUM_TYPE.PSD_VS_RPM) {
    this._drawVerticalGridLines(
      canvasCtx,
      LEFT,
      TOP,
      WIDTH,
      HEIGHT,
      this._fftData.vsRange.min,
      this._fftData.vsRange.max,
      "Hz"
    );
  }
};

GraphSpectrumPlot._drawHeatMap = function (drawPSD = false) {
  const THROTTLE_VALUES_SIZE = 100;
  //The magnitude is greate then seperete Re or Im value up to 1.4=sqrt(2). Therefore the SCALE_HEATMAP is decreased from 1.3 to 1.1
  const SCALE_HEATMAP = 1.1; // Value decided after some tests to be similar to the s
  // This value will be maximum color

  const heatMapCanvas = document.createElement("canvas");
  const canvasCtx = heatMapCanvas.getContext("2d", { alpha: false });

  // We use always a canvas of the size of the FFT data (is not too big)
  canvasCtx.canvas.width = this._fftData.fftLength;
  canvasCtx.canvas.height = THROTTLE_VALUES_SIZE;

  // Loop for throttle
  for (let j = 0; j < THROTTLE_VALUES_SIZE; j++) {
    // Loop for frequency
    for (let i = 0; i < this._fftData.fftLength; i++) {
      let valuePlot = this._fftData.fftOutput[j][i];
      if (drawPSD) {
        if (valuePlot < this._lowLevelPSD) {
          valuePlot = this._minPSD;      // Filter low values
        } else {
          valuePlot = Math.max(valuePlot, this._minPSD);
        }
        valuePlot = Math.min(valuePlot, this._maxPSD);
        valuePlot = Math.round((valuePlot - this._minPSD) * 100 / (this._maxPSD - this._minPSD));
      } else {
        const fftColorScale = 100 / (this._zoomY * SCALE_HEATMAP);
        valuePlot = Math.round(Math.min(valuePlot * fftColorScale, 100));
      }

      // The fillStyle is slow, but I haven't found a way to do this faster...
      canvasCtx.fillStyle = `hsl(360, 100%, ${valuePlot}%)`;
      canvasCtx.fillRect(i, 99 - j, 1, 1);
    }
  }

  // The resulting image has imperfections, usually we not have all the data in the input, so we apply a little of blur
  canvasCtx.filter = `blur(${BLUR_FILTER_PIXEL}px)`;
  canvasCtx.drawImage(heatMapCanvas, 0, 0);
  canvasCtx.filter = "none";

  return heatMapCanvas;
};

GraphSpectrumPlot.getValueFromMatrixFFT  = function(frequency, vsArgument) {
  const matrixFFT = this._fftData;
  let vsArgumentIndex = Math.round(NUM_VS_BINS * (vsArgument - matrixFFT.vsRange.min) / (matrixFFT.vsRange.max - matrixFFT.vsRange.min));
  if (vsArgumentIndex >= NUM_VS_BINS) {
    vsArgumentIndex = NUM_VS_BINS - 1;
  }
  let freqIndex = Math.round(2 * frequency / matrixFFT.blackBoxRate * (matrixFFT.fftLength - 1));
  freqIndex = Math.max(freqIndex, 0);
  freqIndex = Math.min(freqIndex, matrixFFT.fftLength - 1);
  return matrixFFT.fftOutput[vsArgumentIndex][freqIndex];
};

GraphSpectrumPlot._drawPidErrorVsSetpointGraph = function (canvasCtx) {
  const ACTUAL_MARGIN_LEFT = this._getActualMarginLeft();

  const WIDTH = canvasCtx.canvas.width - ACTUAL_MARGIN_LEFT;
  const HEIGHT = canvasCtx.canvas.height - MARGIN_BOTTOM;
  const LEFT = canvasCtx.canvas.offsetLeft + ACTUAL_MARGIN_LEFT;
  const TOP = canvasCtx.canvas.offsetTop;

  const dataLimits = this._drawPidErrorVsSetpointGraphProcessData();

  canvasCtx.translate(LEFT, TOP);

  canvasCtx.beginPath();

  this._drawGradientBackground(canvasCtx, WIDTH, HEIGHT);

  // Line with all the PID Error
  this._drawPidErrorVsSetpointGraphLine(
    canvasCtx,
    dataLimits.pidErrorArray,
    dataLimits.currentDrawMaxSetpoint,
    dataLimits.currentDrawMaxPidError,
    WIDTH,
    HEIGHT
  );

  // Squares grouping the setpoint range in groups
  this._drawPidErrorVsSetpointGraphGroups(
    canvasCtx,
    dataLimits.currentDataMaxSetpoint,
    dataLimits.currentDrawMaxSetpoint,
    dataLimits.currentDrawMaxPidError,
    WIDTH,
    HEIGHT
  );

  this._drawAxisLabel(
    canvasCtx,
    this._fftData.axisName,
    WIDTH - 4,
    HEIGHT - 6,
    "right"
  );
  this._drawHorizontalGridLines(
    canvasCtx,
    dataLimits.currentDrawMaxSetpoint,
    LEFT,
    TOP,
    WIDTH,
    HEIGHT,
    MARGIN_BOTTOM,
    "deg/s"
  );
  this._drawVerticalGridLines(
    canvasCtx,
    LEFT,
    TOP,
    WIDTH,
    HEIGHT,
    0,
    dataLimits.currentDrawMaxPidError,
    "deg/s"
  );
};

GraphSpectrumPlot._drawPidErrorVsSetpointGraphProcessData = function () {
  const totalDrawMaxSetpoint =
    Math.trunc(
      (this._fftData.fftOutput.length + (MAX_SETPOINT_DEFAULT - 1)) /
        MAX_SETPOINT_DEFAULT
    ) * MAX_SETPOINT_DEFAULT;
  const currentDrawMaxSetpoint =
    MAX_SETPOINT_DEFAULT +
    Math.trunc(
      (totalDrawMaxSetpoint - MAX_SETPOINT_DEFAULT) / (ZOOM_X_MAX - 1)
    ) *
      (this._zoomX - 1);
  const currentDataMaxSetpoint = Math.min(
    currentDrawMaxSetpoint,
    this._fftData.fftOutput.length - 1
  );
  const pidErrorArray = this._fftData.fftOutput.slice(
    0,
    currentDataMaxSetpoint + 1
  );
  const maxPidError = Math.max(...pidErrorArray);
  const currentDrawMaxPidError =
    Math.trunc(maxPidError / PID_ERROR_VERTICAL_CHUNK + 1) *
    PID_ERROR_VERTICAL_CHUNK;

  return {
    currentDataMaxSetpoint,
    currentDrawMaxSetpoint,
    pidErrorArray,
    currentDrawMaxPidError,
  };
};

GraphSpectrumPlot._drawPidErrorVsSetpointGraphLine = function (
  canvasCtx,
  pidErrorArray,
  currentDrawMaxSetpoint,
  currentDrawMaxPidError,
  WIDTH,
  HEIGHT
) {
  canvasCtx.lineWidth = DEFAULT_MARK_LINE_WIDTH;
  canvasCtx.strokeStyle = "rgba(128,128,255,0.50)";

  const points = [];
  for (let setpoint = 0; setpoint <= currentDrawMaxSetpoint; setpoint++) {
    if (pidErrorArray[setpoint] != null) {
      const x = (setpoint * WIDTH) / currentDrawMaxSetpoint;
      const y =
        HEIGHT - (pidErrorArray[setpoint] * HEIGHT) / currentDrawMaxPidError;
      points.push({
        x,
        y,
      });
    }
  }
  this._drawCurve(canvasCtx, points);
};

GraphSpectrumPlot._drawPidErrorVsSetpointGraphGroups = function (
  canvasCtx,
  currentDataMaxSetpoint,
  currentDrawMaxSetpoint,
  currentDrawMaxPidError,
  WIDTH,
  HEIGHT
) {
  const NUMBER_OF_GROUPS = 10;

  const groupedSetpointWidth = currentDrawMaxSetpoint / NUMBER_OF_GROUPS;
  for (
    let setpointGroup = 0;
    setpointGroup <= currentDrawMaxSetpoint;
    setpointGroup += groupedSetpointWidth
  ) {
    let sumPidError = 0;
    let countSamples = 0;
    for (
      let setpoint = setpointGroup;
      setpoint <= currentDataMaxSetpoint &&
      setpoint < setpointGroup + groupedSetpointWidth;
      setpoint++
    ) {
      if (this._fftData.fftOutput[setpoint] != null) {
        sumPidError += this._fftData.fftOutput[setpoint];
        countSamples++;
      }
    }
    if (countSamples > 0) {
      // Draw the rectangle
      const setpointGroupError = sumPidError / countSamples;
      const x = (setpointGroup * WIDTH) / currentDrawMaxSetpoint;
      const y = HEIGHT - (setpointGroupError * HEIGHT) / currentDrawMaxPidError;
      const width = (groupedSetpointWidth * WIDTH) / currentDrawMaxSetpoint;
      const height = HEIGHT - y;
      canvasCtx.fillStyle = "rgba(128,255,0,0.2)";
      canvasCtx.fillRect(x + 1, y, width - 2, height);

      // Draw the value number
      const textGroup = setpointGroupError.toFixed(1);
      this._drawAxisLabel(
        canvasCtx,
        textGroup,
        x + width / 2,
        Math.min(y + 12, HEIGHT - 2)
      );
    }
  }
};

GraphSpectrumPlot._drawFiltersAndMarkers = function (canvasCtx) {
  const HEIGHT = this._canvasCtx.canvas.height - MARGIN;
  const WIDTH = this._canvasCtx.canvas.width - this._getActualMarginLeft();
  const PLOTTED_BLACKBOX_RATE = this._fftData.blackBoxRate / this._zoomX;

  let offset = 2; // make some space! Includes the space for the mouse frequency. In this way the other elements don't move in the screen when used

  // Gyro filters
  if (
    this._overdrawType === SPECTRUM_OVERDRAW_TYPE.ALL_FILTERS ||
    this._overdrawType === SPECTRUM_OVERDRAW_TYPE.GYRO_FILTERS ||
    (this._overdrawType === SPECTRUM_OVERDRAW_TYPE.AUTO &&
      this._fftData.fieldName.toLowerCase().indexOf("gyro") !== -1)
  ) {
    // Dynamic gyro lpf
    if (
      this._sysConfig.gyro_lowpass_dyn_hz[0] != null &&
      this._sysConfig.gyro_lowpass_dyn_hz[0] > 0 &&
      this._sysConfig.gyro_lowpass_dyn_hz[1] >
        this._sysConfig.gyro_lowpass_dyn_hz[0]
    ) {
      const label =
        this._sysConfig.gyro_soft_type != null
          ? `GYRO LPF (${
              FILTER_TYPE[this._sysConfig.gyro_soft_type]
            }) Dyn cutoff`
          : "GYRO LPF Dyn cutoff";
      this._drawLowpassDynFilter(
        canvasCtx,
        this._sysConfig.gyro_lowpass_dyn_hz[0],
        this._sysConfig.gyro_lowpass_dyn_hz[1],
        PLOTTED_BLACKBOX_RATE,
        label,
        WIDTH,
        HEIGHT,
        15 * offset + MARGIN,
        "rgba(94, 194, 98, 0.50)"
      );
      offset++;

      // Static gyro lpf
    } else if (
      this._sysConfig.gyro_lowpass_hz != null &&
      this._sysConfig.gyro_lowpass_hz > 0
    ) {
      const label =
        this._sysConfig.gyro_soft_type != null
          ? `GYRO LPF (${FILTER_TYPE[this._sysConfig.gyro_soft_type]}) cutoff`
          : "GYRO LPF cutoff";
      this._drawLowpassFilter(
        canvasCtx,
        this._sysConfig.gyro_lowpass_hz,
        PLOTTED_BLACKBOX_RATE,
        label,
        WIDTH,
        HEIGHT,
        15 * offset + MARGIN,
        "rgba(94, 194, 98, 0.50)"
      );
      offset++;
    }

    // Static gyro lpf 2
    if (
      this._sysConfig.gyro_lowpass2_hz != null &&
      this._sysConfig.gyro_lowpass2_hz > 0
    ) {
      const label =
        this._sysConfig.gyro_soft2_type != null
          ? `GYRO LPF2 (${FILTER_TYPE[this._sysConfig.gyro_soft2_type]}) cutoff`
          : "GYRO LPF2 cutoff";
      this._drawLowpassFilter(
        canvasCtx,
        this._sysConfig.gyro_lowpass2_hz,
        PLOTTED_BLACKBOX_RATE,
        label,
        WIDTH,
        HEIGHT,
        15 * offset + MARGIN,
        "rgba(0, 172, 122, 0.50)"
      );
      offset++;
    }

    // Notch gyro
    if (
      this._sysConfig.gyro_notch_hz != null &&
      this._sysConfig.gyro_notch_cutoff != null
    ) {
      if (this._sysConfig.gyro_notch_hz.length > 0) {
        //there are multiple gyro notch filters
        for (let i = 0; i < this._sysConfig.gyro_notch_hz.length; i++) {
          if (
            this._sysConfig.gyro_notch_hz[i] > 0 &&
            this._sysConfig.gyro_notch_cutoff[i] > 0
          ) {
            this._drawNotchFilter(
              canvasCtx,
              this._sysConfig.gyro_notch_hz[i],
              this._sysConfig.gyro_notch_cutoff[i],
              PLOTTED_BLACKBOX_RATE,
              "GYRO Notch",
              WIDTH,
              HEIGHT,
              15 * offset + MARGIN,
              "rgba(0, 148, 134, 0.50)"
            );
            offset++;
          }
        }
      } else {
        // only a single gyro notch to display
        if (
          this._sysConfig.gyro_notch_hz > 0 &&
          this._sysConfig.gyro_notch_cutoff > 0
        ) {
          this._drawNotchFilter(
            canvasCtx,
            this._sysConfig.gyro_notch_hz,
            this._sysConfig.gyro_notch_cutoff,
            PLOTTED_BLACKBOX_RATE,
            "GYRO Notch",
            WIDTH,
            HEIGHT,
            15 * offset + MARGIN,
            "rgba(0, 148, 134, 0.50)"
          );
          offset++;
        }
      }
    }
  }
  offset++; // make some space!

  // Yaw filters
  if (
    this._overdrawType === SPECTRUM_OVERDRAW_TYPE.ALL_FILTERS ||
    this._overdrawType === SPECTRUM_OVERDRAW_TYPE.YAW_FILTERS ||
    (this._overdrawType === SPECTRUM_OVERDRAW_TYPE.AUTO &&
      this._fftData.fieldName.toLowerCase().indexOf("yaw") !== -1)
  ) {
    if (this._sysConfig.yaw_lpf_hz != null && this._sysConfig.yaw_lpf_hz > 0) {
      this._drawLowpassFilter(
        canvasCtx,
        this._sysConfig.yaw_lpf_hz,
        PLOTTED_BLACKBOX_RATE,
        "YAW LPF cutoff",
        WIDTH,
        HEIGHT,
        15 * offset + MARGIN
      );
      offset++;
    }
  }

  // D-TERM filters
  try {
    if (
      this._overdrawType === SPECTRUM_OVERDRAW_TYPE.ALL_FILTERS ||
      this._overdrawType === SPECTRUM_OVERDRAW_TYPE.DTERM_FILTERS ||
      (this._overdrawType === SPECTRUM_OVERDRAW_TYPE.AUTO &&
        this._fftData.fieldName.toLowerCase().indexOf("pid d") !== -1)
    ) {
      // Dynamic dterm lpf
      if (
        this._sysConfig.dterm_lpf_dyn_hz[0] != null &&
        this._sysConfig.dterm_lpf_dyn_hz[0] > 0 &&
        this._sysConfig.dterm_lpf_dyn_hz[1] >
          this._sysConfig.dterm_lpf_dyn_hz[0]
      ) {
        const label =
          this._sysConfig.dterm_filter_type != null
            ? `D-TERM LPF (${
                FILTER_TYPE[this._sysConfig.dterm_filter_type]
              }) Dyn cutoff`
            : "D-TERM LPF Dyn cutoff";
        this._drawLowpassDynFilter(
          canvasCtx,
          this._sysConfig.dterm_lpf_dyn_hz[0],
          this._sysConfig.dterm_lpf_dyn_hz[1],
          PLOTTED_BLACKBOX_RATE,
          label,
          WIDTH,
          HEIGHT,
          15 * offset + MARGIN,
          "rgba(0, 123, 132, 0.50)"
        );
        offset++;

        // Static dterm lpf
      } else if (
        this._sysConfig.dterm_lpf_hz != null &&
        this._sysConfig.dterm_lpf_hz > 0
      ) {
        const label =
          this._sysConfig.dterm_filter_type != null
            ? `D-TERM LPF (${
                FILTER_TYPE[this._sysConfig.dterm_filter_type]
              }) cutoff`
            : "D-TERM LPF cutoff";
        this._drawLowpassFilter(
          canvasCtx,
          this._sysConfig.dterm_lpf_hz,
          PLOTTED_BLACKBOX_RATE,
          label,
          WIDTH,
          HEIGHT,
          15 * offset + MARGIN,
          "rgba(0, 123, 132, 0.50)"
        );
        offset++;
      }

      // Static dterm lpf 2
      if (
        this._sysConfig.dterm_lpf2_hz != null &&
        this._sysConfig.dterm_lpf2_hz > 0
      ) {
        const label =
          this._sysConfig.dterm_filter2_type != null
            ? `D-TERM LPF2 (${
                FILTER_TYPE[this._sysConfig.dterm_filter2_type]
              }) cutoff`
            : "D-TERM LPF2 cutoff";
        this._drawLowpassFilter(
          canvasCtx,
          this._sysConfig.dterm_lpf2_hz,
          PLOTTED_BLACKBOX_RATE,
          label,
          WIDTH,
          HEIGHT,
          15 * offset + MARGIN,
          "rgba(16, 97, 116, 0.50)"
        );
        offset++;
      }

      // Notch dterm
      if (
        this._sysConfig.dterm_notch_hz != null &&
        this._sysConfig.dterm_notch_cutoff != null
      ) {
        if (
          this._sysConfig.dterm_notch_hz > 0 &&
          this._sysConfig.dterm_notch_cutoff > 0
        ) {
          this._drawNotchFilter(
            canvasCtx,
            this._sysConfig.dterm_notch_hz,
            this._sysConfig.dterm_notch_cutoff,
            PLOTTED_BLACKBOX_RATE,
            "D-TERM Notch",
            WIDTH,
            HEIGHT,
            15 * offset + MARGIN,
            "rgba(47, 72, 88, 0.50)"
          );
          offset++;
        }
      }
    }
    offset++; // make some space!
  } catch (e) {
    console.warn("Notch filter fieldName missing");
  }

  if (this._spectrumType === SPECTRUM_TYPE.FREQUENCY) {
    this._drawInterestFrequency(
      canvasCtx,
      this._fftData.maxNoiseFrequency,
      PLOTTED_BLACKBOX_RATE,
      "Max noise",
      WIDTH,
      HEIGHT,
      15 * offset + MARGIN,
      "rgba(255,0,0,0.50)",
      3
    );
    offset++;
  }

  this._drawRateWarning(canvasCtx);
};

GraphSpectrumPlot._drawNotCachedElements = function () {
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
    this._drawMousePosition(
      canvasCtx,
      this._mousePosition.x,
      this._mousePosition.y,
      WIDTH,
      HEIGHT,
      15 * offset + MARGIN,
      stroke,
      3
    );
  }

  canvasCtx.restore();
};

GraphSpectrumPlot._drawAxisLabel = function (
  canvasCtx,
  axisLabel,
  X,
  Y,
  align,
  baseline
) {
  canvasCtx.save();

  canvasCtx.font = `${
    this._isFullScreen
      ? this._drawingParams.fontSizeFrameLabelFullscreen
      : this._drawingParams.fontSizeFrameLabel
  }pt ${DEFAULT_FONT_FACE}`;
  canvasCtx.fillStyle = "rgba(255,255,255,0.9)";
  if (align) {
    canvasCtx.textAlign = align;
  } else {
    canvasCtx.textAlign = "center";
  }
  if (baseline) {
    canvasCtx.textBaseline = baseline;
  } else {
    canvasCtx.textBaseline = "alphabetic";
  }
  canvasCtx.shadowColor = "black";
  canvasCtx.strokeStyle = "black";
  canvasCtx.shadowBlur = 3;
  canvasCtx.strokeText(axisLabel, X, Y);
  canvasCtx.fillText(axisLabel, X, Y);

  canvasCtx.restore();
};

GraphSpectrumPlot._drawHorizontalGridLines = function (
  canvasCtx,
  maxValue,
  LEFT,
  TOP,
  WIDTH,
  HEIGHT,
  MARGIN_UP_LABEL,
  unitsLabel
) {
  const TICKS = 5;
  const ticksInterval = maxValue / TICKS;

  let currentTick = 0;
  for (let i = 0; i <= TICKS; i++) {
    canvasCtx.beginPath();
    canvasCtx.lineWidth = 1;
    canvasCtx.strokeStyle = "rgba(255,255,255,0.25)";

    canvasCtx.moveTo(i * (WIDTH / TICKS), 0);
    canvasCtx.lineTo(i * (WIDTH / TICKS), HEIGHT);

    canvasCtx.stroke();
    let textAlign;
    switch (i) {
      case 0:
        textAlign = "left";
        break;
      case TICKS:
        textAlign = "right";
        break;
      default:
        textAlign = "center";
    }
    this._drawAxisLabel(
      canvasCtx,
      `${currentTick.toFixed(0)}${unitsLabel}`,
      i * (WIDTH / TICKS),
      HEIGHT + MARGIN_UP_LABEL,
      textAlign
    );
    currentTick += ticksInterval;
  }
};

GraphSpectrumPlot._drawVerticalGridLines = function (
  canvasCtx,
  LEFT,
  TOP,
  WIDTH,
  HEIGHT,
  minValue,
  maxValue,
  label,
  ticks = 5,
) {

  for (let i = 0; i <= ticks; i++) {
    canvasCtx.beginPath();
    canvasCtx.lineWidth = 1;
    canvasCtx.strokeStyle = "rgba(255,255,255,0.25)";

    const verticalPosition = i * (HEIGHT / ticks);
    canvasCtx.moveTo(0, verticalPosition);
    canvasCtx.lineTo(WIDTH, verticalPosition);

    canvasCtx.stroke();
    const verticalAxisValue = (
      (maxValue - minValue) * ((ticks - i) / ticks) +
      minValue
    ).toFixed(0);
    let textBaseline;
    switch (i) {
      case 0:
        textBaseline = "top";
        break;
      case ticks:
        textBaseline = "bottom";
        break;
      default:
        textBaseline = "middle";
    }
    this._drawAxisLabel(
      canvasCtx,
      `${verticalAxisValue}${label}`,
      0,
      verticalPosition,
      "center",
      textBaseline
    );
  }
};

GraphSpectrumPlot._drawVerticalMarkerLine = function (
  canvasCtx,
  value,
  axisMaximum,
  label,
  WIDTH,
  HEIGHT,
  OFFSET,
  stroke,
  lineWidth
) {
  const x = (WIDTH * value) / axisMaximum;

  let realLineWidth = lineWidth || DEFAULT_MARK_LINE_WIDTH;
  if (realLineWidth > 5) {
    // is the linewidth specified as a frequency band
    realLineWidth = (WIDTH * (2 * realLineWidth)) / (axisMaximum / 2);
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

  if (label != null) {
    this._drawAxisLabel(canvasCtx, label.trim(), x + 2, OFFSET + 1, "left");
  }

  return x;
};

GraphSpectrumPlot._drawHorizontalMarkerLine = function (
  canvasCtx,
  value,
  minAxisValue,
  maxAxisValue,
  label,
  WIDTH,
  HEIGHT,
  OFFSET,
  stroke,
  lineWidth
) {
  const y = (HEIGHT * (maxAxisValue - value)) / (maxAxisValue - minAxisValue); // percentage of range where throttle lies

  let realLineWidth = lineWidth || DEFAULT_MARK_LINE_WIDTH;
  if (realLineWidth > 5) {
    // is the linewidth specified as a frequency band
    realLineWidth = (WIDTH * (2 * realLineWidth)) / (sampleRate / 2);
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

  if (label != null) {
    this._drawAxisLabel(
      canvasCtx,
      label.trim(),
      WIDTH - OFFSET + 8,
      y - 2,
      "right"
    );
  }

  return y;
};

GraphSpectrumPlot._drawGradientBackground = function (
  canvasCtx,
  WIDTH,
  HEIGHT
) {
  const backgroundGradient = canvasCtx.createLinearGradient(
    0,
    0,
    0,
    HEIGHT + (this._isFullScreen ? MARGIN : 0)
  );

  if (this._isFullScreen) {
    backgroundGradient.addColorStop(1, "rgba(0,0,0,1)");
    backgroundGradient.addColorStop(0, "rgba(0,0,0,0.9)");
  } else {
    backgroundGradient.addColorStop(1, "rgba(255,255,255,0.25)");
    backgroundGradient.addColorStop(0, "rgba(255,255,255,0)");
  }

  canvasCtx.fillStyle = backgroundGradient;
  canvasCtx.fillRect(0, 0, WIDTH, HEIGHT + (this._isFullScreen ? MARGIN : 0));
};

GraphSpectrumPlot._drawInterestFrequency = function (
  canvasCtx,
  frequency,
  sampleRate,
  label,
  WIDTH,
  HEIGHT,
  OFFSET,
  stroke,
  lineWidth
) {

  let interestLabel = "";
  if (this._spectrumType === SPECTRUM_TYPE.POWER_SPECTRAL_DENSITY && label != "" ) {
    const psdValue = this.getPSDbyFreq(frequency);
    interestLabel = `${label}: (${frequency.toFixed(0)}Hz, ${psdValue.toFixed(0)}dBm/Hz)`;
  } else {
    interestLabel = `${label} ${frequency.toFixed(0)}Hz`;
  }
  return this._drawVerticalMarkerLine(
    canvasCtx,
    frequency,
    sampleRate / 2,
    interestLabel,
    WIDTH,
    HEIGHT,
    OFFSET,
    stroke,
    lineWidth
  );
};

GraphSpectrumPlot._drawLowpassFilter = function (
  canvasCtx,
  frequency,
  sampleRate,
  label,
  WIDTH,
  HEIGHT,
  OFFSET,
  stroke,
  lineWidth
) {
  const lpfLabel = `${label} ${frequency.toFixed(0)}Hz`;
  return this._drawVerticalMarkerLine(
    canvasCtx,
    frequency,
    sampleRate / 2,
    lpfLabel,
    WIDTH,
    HEIGHT,
    OFFSET,
    stroke,
    lineWidth
  );
};

GraphSpectrumPlot._drawLowpassDynFilter = function (
  canvasCtx,
  frequency1,
  frequency2,
  sampleRate,
  label,
  WIDTH,
  HEIGHT,
  OFFSET,
  stroke,
  lineWidth
) {
  // frequency1 line with label
  const dynFilterLabel = `${label} ${frequency1.toFixed(
    0
  )}-${frequency2.toFixed(0)}Hz`;
  const x1 = this._drawVerticalMarkerLine(
    canvasCtx,
    frequency1,
    sampleRate / 2,
    dynFilterLabel,
    WIDTH,
    HEIGHT,
    OFFSET,
    stroke,
    lineWidth
  );

  // frequency2 line
  const offsetByType =
    this._spectrumType === SPECTRUM_TYPE.FREQ_VS_THROTTLE ||
    this._spectrumType === SPECTRUM_TYPE.FREQ_VS_RPM ||
    this._spectrumType === SPECTRUM_TYPE.PSD_VS_THROTTLE ||
    this._spectrumType === SPECTRUM_TYPE.PSD_VS_RPM
      ? 0
      : OFFSET;
  const x2 = this._drawVerticalMarkerLine(
    canvasCtx,
    frequency2,
    sampleRate / 2,
    null,
    WIDTH,
    HEIGHT,
    offsetByType,
    stroke,
    lineWidth
  );

  // Join line between frequency1 and frequency2 lines
  canvasCtx.beginPath();
  canvasCtx.lineWidth = lineWidth || DEFAULT_MARK_LINE_WIDTH;
  canvasCtx.strokeStyle = stroke || "rgba(128,128,255,0.50)";

  if (
    this._spectrumType === SPECTRUM_TYPE.FREQ_VS_THROTTLE ||
    this._spectrumType === SPECTRUM_TYPE.FREQ_VS_RPM ||
    this._spectrumType === SPECTRUM_TYPE.PSD_VS_THROTTLE ||
    this._spectrumType === SPECTRUM_TYPE.PSD_VS_RPM
  ) {
    /*
     * It draws a curve:
     *      frequency = (throttle - (throttle * throttle * throttle) / 3.0f) * 1.5f;
     * but need to scale the 1.5f using the max value of the dyn filter
     */
    const scale = frequency2 / (sampleRate / 2);
    const NUMBER_OF_POINTS = this._isFullScreen ? 30 : 10;

    let startPlot = false;
    const points = [];
    for (let i = 1; i <= NUMBER_OF_POINTS; i++) {
      const throttle = (1 / NUMBER_OF_POINTS) * i;
      const y = HEIGHT - HEIGHT * throttle;

      const frequency =
        (throttle - (throttle * throttle * throttle) / 3) * (1.5 * scale);
      const x = WIDTH * frequency;

      if (x >= x1) {
        if (startPlot === false) {
          // Interpolate a more or less correct y in the x1 position
          points.push({
            x: x1,
            y: y + (HEIGHT - y) * (1 - x1 / x),
          });
        }
        startPlot = true;
        points.push({
          x,
          y,
        });
      }
    }

    this._drawCurve(canvasCtx, points);
  } else {
    canvasCtx.moveTo(x1, OFFSET - 10);
    canvasCtx.lineTo(x2, OFFSET - 10);
  }

  canvasCtx.stroke();
};

GraphSpectrumPlot._drawNotchFilter = function (
  canvasCtx,
  center,
  cutoff,
  sampleRate,
  label,
  WIDTH,
  HEIGHT,
  OFFSET,
  stroke,
  lineWidth
) {
  const cutoffX = (WIDTH * cutoff) / (sampleRate / 2);
  const centerX = (WIDTH * center) / (sampleRate / 2);

  canvasCtx.beginPath();
  canvasCtx.lineWidth = lineWidth || DEFAULT_MARK_LINE_WIDTH;
  canvasCtx.strokeStyle = stroke || "rgba(128,128,255,0.50)";

  if (
    this._spectrumType === SPECTRUM_TYPE.FREQ_VS_THROTTLE ||
    this._spectrumType === SPECTRUM_TYPE.FREQ_VS_RPM ||
    this._spectrumType === SPECTRUM_TYPE.PSD_VS_THROTTLE ||
    this._spectrumType === SPECTRUM_TYPE.PSD_VS_RPM
  ) {
    canvasCtx.moveTo(cutoffX, 0);
    canvasCtx.lineTo(centerX * 2 - cutoffX, HEIGHT);
    canvasCtx.lineTo(centerX * 2 - cutoffX, 0);
    canvasCtx.lineTo(cutoffX, HEIGHT);
    canvasCtx.lineTo(cutoffX, 0);
  } else {
    // center - offset
    canvasCtx.moveTo(centerX, OFFSET - 10);
    canvasCtx.lineTo(cutoffX, HEIGHT);

    // center + offset
    canvasCtx.moveTo(centerX, OFFSET - 10);
    canvasCtx.lineTo(centerX * 2 - cutoffX, HEIGHT);
  }

  canvasCtx.stroke();

  // center with label
  const labelNotch = `${label} center ${center.toFixed(
    0
  )}Hz, cutoff ${cutoff.toFixed(0)}Hz`;
  this._drawVerticalMarkerLine(
    canvasCtx,
    center,
    sampleRate / 2,
    labelNotch,
    WIDTH,
    HEIGHT,
    OFFSET,
    stroke,
    lineWidth
  );
};

GraphSpectrumPlot._drawMousePosition = function (
  canvasCtx,
  mouseX,
  mouseY,
  WIDTH,
  HEIGHT,
  OFFSET,
  stroke,
  lineWidth
) {
  // X axis
  let mouseFrequency = 0;
  if (
    this._spectrumType === SPECTRUM_TYPE.FREQUENCY ||
    this._spectrumType === SPECTRUM_TYPE.FREQ_VS_THROTTLE ||
    this._spectrumType === SPECTRUM_TYPE.FREQ_VS_RPM ||
    this._spectrumType === SPECTRUM_TYPE.POWER_SPECTRAL_DENSITY ||
    this._spectrumType === SPECTRUM_TYPE.PSD_VS_THROTTLE ||
    this._spectrumType === SPECTRUM_TYPE.PSD_VS_RPM
  ) {
    // Calculate frequency at mouse
    const sampleRate = this._fftData.blackBoxRate / this._zoomX;
    const marginLeft = this._getActualMarginLeft();

    mouseFrequency =
      ((mouseX - marginLeft) / WIDTH) *
      (this._fftData.blackBoxRate / this._zoomX / 2);
    if (mouseFrequency >= 0 && mouseFrequency <= sampleRate) {
      this._drawInterestFrequency(
        canvasCtx,
        mouseFrequency,
        sampleRate,
        "",
        WIDTH,
        HEIGHT,
        OFFSET,
        "rgba(0,255,0,0.50)",
        3
      );
    }

    if (this._spectrumType === SPECTRUM_TYPE.POWER_SPECTRAL_DENSITY) {
      const psdLabel = Math.round(this.getPSDbyFreq(mouseFrequency)).toString() + "dBm/Hz";
      this._drawAxisLabel(
        canvasCtx,
        psdLabel,
        mouseX - 30,
        mouseY - 4,
        "left",
      );
    }

    // Y axis
    let unitLabel;
    switch (this._spectrumType) {
      case SPECTRUM_TYPE.FREQ_VS_THROTTLE:
      case SPECTRUM_TYPE.PSD_VS_THROTTLE:
        unitLabel = "%";
        break;
      case SPECTRUM_TYPE.FREQ_VS_RPM:
      case SPECTRUM_TYPE.PSD_VS_RPM:
        unitLabel = "Hz";
        break;
      case SPECTRUM_TYPE.POWER_SPECTRAL_DENSITY:
        unitLabel = "dBm/Hz";
        break;
      default:
        unitLabel = null;
        break;
    }
    if (unitLabel !== null) {
      const val_min = this._fftData.vsRange.min;
      const val_max = this._fftData.vsRange.max;
      const vsArgValue = (1 - mouseY / HEIGHT) * (val_max - val_min) + val_min;
      if (vsArgValue >= val_min && vsArgValue <= val_max) {
        const valueLabel = `${vsArgValue.toFixed(0)}${unitLabel}`;
        this._drawHorizontalMarkerLine(
          canvasCtx,
          vsArgValue,
          val_min,
          val_max,
          valueLabel,
          WIDTH,
          HEIGHT,
          OFFSET,
          stroke,
          lineWidth
        );

        if (this._spectrumType === SPECTRUM_TYPE.PSD_VS_THROTTLE ||
            this._spectrumType === SPECTRUM_TYPE.PSD_VS_RPM) {
          const label = Math.round(this.getValueFromMatrixFFT(mouseFrequency, vsArgValue)).toString() + "dBm/Hz";
          this._drawAxisLabel(
            canvasCtx,
            label,
            mouseX - 30,
            mouseY - 4,
            "left",
          );
        }
      }
    }
  } else if (this._spectrumType === SPECTRUM_TYPE.PIDERROR_VS_SETPOINT) {
    const dataLimits = this._drawPidErrorVsSetpointGraphProcessData();

    // X axis. Calculate deg/sec at mouse
    const marginLeft = this._getActualMarginLeft();

    const mouseDegreesSecond =
      ((mouseX - marginLeft) / WIDTH) * dataLimits.currentDrawMaxSetpoint;
    const interestLabel = `${mouseDegreesSecond.toFixed(0)}deg/sec`;
    this._drawVerticalMarkerLine(
      canvasCtx,
      mouseDegreesSecond,
      dataLimits.currentDrawMaxSetpoint,
      interestLabel,
      WIDTH,
      HEIGHT,
      OFFSET,
      stroke,
      lineWidth
    );

    // Y axis. Calculate PID Error at mouse

    const mousePidError =
      (1 - mouseY / HEIGHT) * dataLimits.currentDrawMaxPidError;
    if (
      mousePidError >= 0 &&
      mousePidError <= dataLimits.currentDrawMaxPidError
    ) {
      const pidErrorLabel = `${mousePidError.toFixed(1)}deg/sec`;
      this._drawHorizontalMarkerLine(
        canvasCtx,
        mousePidError,
        0,
        dataLimits.currentDrawMaxPidError,
        pidErrorLabel,
        WIDTH,
        HEIGHT,
        OFFSET,
        stroke,
        lineWidth
      );
    }
  }
};

GraphSpectrumPlot._getActualMarginLeft = function () {
  let actualMarginLeft;
  switch (this._spectrumType) {
    case SPECTRUM_TYPE.FREQ_VS_THROTTLE:
    case SPECTRUM_TYPE.FREQ_VS_RPM:
    case SPECTRUM_TYPE.PSD_VS_THROTTLE:
    case SPECTRUM_TYPE.PSD_VS_RPM:
    case SPECTRUM_TYPE.POWER_SPECTRAL_DENSITY:
      actualMarginLeft = this._isFullScreen
        ? MARGIN_LEFT_FULLSCREEN
        : MARGIN_LEFT;
      break;
    case SPECTRUM_TYPE.PIDERROR_VS_SETPOINT:
      actualMarginLeft = this._isFullScreen
        ? MARGIN_LEFT_FULLSCREEN
        : MARGIN_LEFT;
      actualMarginLeft *= 2;
      break;
    case SPECTRUM_TYPE.FREQUENCY:
    default:
      actualMarginLeft = 0;
  }

  return actualMarginLeft;
};

GraphSpectrumPlot._drawCurve = function (canvasCtx, points, tension) {
  canvasCtx.beginPath();
  canvasCtx.moveTo(points[0].x, points[0].y);

  const t = tension != null ? tension : 1;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[0];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i !== points.length - 2 ? points[i + 2] : p2;

    const cp1x = p1.x + ((p2.x - p0.x) / 6) * t;
    const cp1y = p1.y + ((p2.y - p0.y) / 6) * t;

    const cp2x = p2.x - ((p3.x - p1.x) / 6) * t;
    const cp2y = p2.y - ((p3.y - p1.y) / 6) * t;

    canvasCtx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }
  canvasCtx.stroke();
};

GraphSpectrumPlot._invalidateCache = function () {
  this._cachedCanvas = null;
};

GraphSpectrumPlot._invalidateDataCache = function () {
  this._cachedDataCanvas = null;
};

GraphSpectrumPlot.setLogRateWarningInfo = function (logRateInfo) {
  this._logRateWarning = logRateInfo;
};

GraphSpectrumPlot._drawRateWarning = function (canvasCtx) {
  if (this._logRateWarning != undefined) {
    canvasCtx.save();

    canvasCtx.font = `${
      this._isFullScreen
        ? this._drawingParams.fontSizeFrameLabelFullscreen
        : this._drawingParams.fontSizeFrameLabel
    }pt ${DEFAULT_FONT_FACE}`;
    canvasCtx.fillStyle = "orange";
    canvasCtx.textAlign = "center";
    canvasCtx.shadowColor = "black";
    canvasCtx.strokeStyle = "black";

    const actualRate = this._logRateWarning.actualRate.toFixed(0),
      betaflightRate = this._logRateWarning.betaflightRate.toFixed(0);
    const WarningText = `THE ACTUAL AND CONFIG LOG DATA RATE DIFFERENCE: ${actualRate} : ${betaflightRate}`;
    const X = canvasCtx.canvas.width / 2,
      Y = canvasCtx.canvas.height / 12;
    canvasCtx.strokeText(WarningText, X, Y);
    canvasCtx.fillText(WarningText, X, Y);

    canvasCtx.restore();
  }
};

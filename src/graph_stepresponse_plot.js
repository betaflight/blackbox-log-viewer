import { STEP_RESPONSE_LEN_SEC } from "./graph_stepresponse_calc.js";

// Ported from https://github.com/rotorflight/rotorflight-blackbox (js/graph_stepresponse_plot.js).
// captureImage() (used by the Tuning Log's "AI Analysis" feature - see tuning_ai.js) is ported
// from https://github.com/bph838/rotorflight-blackbox-bellsandwhistles (same file).

const STEP_RESPONSE_MARGIN = 10,
  STEP_RESPONSE_MARGIN_BOTTOM = 18,
  STEP_RESPONSE_MARGIN_LEFT = 28,
  STEP_RESPONSE_Y_MAX = 2.0, // fixed y-axis scale (0 .. 2.0), 1.0 = perfect tracking
  STEP_RESPONSE_LINEWIDTH = 3,
  STEP_RESPONSE_CAPTURE_WIDTH = 1400,
  STEP_RESPONSE_CAPTURE_HEIGHT = 800,
  STEP_RESPONSE_CAPTURE_LINEWIDTH = 4,
  STEP_RESPONSE_CAPTURE_FONTSIZE = "14",
  STEP_RESPONSE_AXIS_COLORS = {
    roll: "#fb8072",
    pitch: "#8dd3c7",
    yaw: "#ffffb3",
  },
  STEP_RESPONSE_AXIS_LABELS = {
    roll: "Roll",
    pitch: "Pitch",
    yaw: "Yaw",
  },
  STEP_RESPONSE_AXIS_PID_FIELD = {
    roll: "rollPID",
    pitch: "pitchPID",
    yaw: "yawPID",
  };

export const StepResponsePlot = {
  _canvasCtx: null,
  _cachedCanvas: null,
  _data: null,
  _isFullScreen: false,
  _lineWidth: STEP_RESPONSE_LINEWIDTH,
  // True only while captureImage() is rendering to its offscreen canvas - an opaque background
  // reads clearly wherever the captured PNG ends up (sent to the AI, downloaded, pasted
  // elsewhere), whereas the normal translucent gradient background assumes it's sitting over the
  // rest of the app's UI.
  _solidBackground: false,
  _sysConfig: null,
  _axisVisible: { roll: true, pitch: true, yaw: true },
  _mousePosition: {
    x: 0,
    y: 0,
  },
  _drawingParams: {
    fontSizeLabel: "6",
    fontSizeLabelFullscreen: "9",
  },
};

StepResponsePlot.initialize = function (canvas, sysConfig) {
  this._canvasCtx = canvas.getContext("2d");
  this._sysConfig = sysConfig;
  this._invalidateCache();
};

StepResponsePlot.setSize = function (width, height) {
  this._canvasCtx.canvas.width = width;
  this._canvasCtx.canvas.height = height;
  this._invalidateCache();
};

StepResponsePlot.setFullScreen = function (isFullScreen) {
  this._isFullScreen = isFullScreen;
  this._invalidateCache();
};

StepResponsePlot.setData = function (data) {
  this._data = data;
  this._invalidateCache();
};

StepResponsePlot.setAxisVisible = function (axis, visible) {
  this._axisVisible[axis] = visible;
  this._invalidateCache();
};

StepResponsePlot.setMousePosition = function (x, y) {
  this._mousePosition.x = x;
  this._mousePosition.y = y;
};

StepResponsePlot.clearMousePosition = function () {
  this._mousePosition.x = 0;
  this._mousePosition.y = 0;
};

StepResponsePlot.draw = function () {
  this._drawCachedElements();
  this._drawNotCachedElements();
};

StepResponsePlot._drawCachedElements = function () {
  if (this._cachedCanvas == null) {
    this._cachedCanvas = document.createElement("canvas");
    const cachedCtx = this._cachedCanvas.getContext("2d");

    cachedCtx.canvas.width = this._canvasCtx.canvas.width;
    cachedCtx.canvas.height = this._canvasCtx.canvas.height;

    this._drawGraph(cachedCtx);
  }

  this._canvasCtx.clearRect(
    0,
    0,
    this._canvasCtx.canvas.width,
    this._canvasCtx.canvas.height,
  );
  this._canvasCtx.drawImage(this._cachedCanvas, 0, 0);
};

StepResponsePlot._drawNotCachedElements = function () {
  if (this._mousePosition.x > 0 || this._mousePosition.y > 0) {
    this._drawMousePosition(this._canvasCtx);
  }
};

StepResponsePlot._invalidateCache = function () {
  this._cachedCanvas = null;
};

StepResponsePlot._drawGraph = function (canvasCtx) {
  const MARGIN = STEP_RESPONSE_MARGIN;
  const MARGIN_BOTTOM = STEP_RESPONSE_MARGIN_BOTTOM;
  const MARGIN_LEFT = STEP_RESPONSE_MARGIN_LEFT;

  const WIDTH = canvasCtx.canvas.width - MARGIN_LEFT - MARGIN;
  const HEIGHT = canvasCtx.canvas.height - MARGIN_BOTTOM - MARGIN;

  if (WIDTH <= 0 || HEIGHT <= 0 || !this._data) {
    return;
  }

  canvasCtx.save();
  canvasCtx.translate(MARGIN_LEFT, MARGIN);

  this._drawBackground(canvasCtx, WIDTH, HEIGHT);
  this._drawGrid(canvasCtx, WIDTH, HEIGHT);

  let axisIndex = 0;
  for (const axis in STEP_RESPONSE_AXIS_LABELS) {
    if (this._axisVisible[axis]) {
      this._drawAxisResponse(canvasCtx, axis, WIDTH, HEIGHT, axisIndex);
    }
    axisIndex++;
  }

  canvasCtx.restore();
};

StepResponsePlot._drawBackground = function (canvasCtx, WIDTH, HEIGHT) {
  if (this._solidBackground) {
    canvasCtx.fillStyle = "rgb(20,20,20)";
    canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
    return;
  }

  const backgroundGradient = canvasCtx.createLinearGradient(0, 0, 0, HEIGHT);

  if (this._isFullScreen) {
    backgroundGradient.addColorStop(1, "rgba(0,0,0,0.9)");
    backgroundGradient.addColorStop(0, "rgba(0,0,0,0.7)");
  } else {
    backgroundGradient.addColorStop(1, "rgba(255,255,255,0.25)");
    backgroundGradient.addColorStop(0, "rgba(255,255,255,0)");
  }

  canvasCtx.fillStyle = backgroundGradient;
  canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
};

StepResponsePlot._drawGrid = function (canvasCtx, WIDTH, HEIGHT) {
  const TICKS = 4;
  const LINEWIDTH = 2;

  // Horizontal gridlines (response amplitude)
  for (let i = 0; i <= TICKS; i++) {
    const y = HEIGHT - (i / TICKS) * HEIGHT;
    const value = (i / TICKS) * STEP_RESPONSE_Y_MAX;

    canvasCtx.beginPath();
    canvasCtx.lineWidth = LINEWIDTH;
    canvasCtx.strokeStyle =
      Math.abs(value - 1.0) < 1e-6 ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.2)";
    canvasCtx.setLineDash(Math.abs(value - 1.0) < 1e-6 ? [4, 3] : []);
    canvasCtx.moveTo(0, y);
    canvasCtx.lineTo(WIDTH, y);
    canvasCtx.stroke();
    canvasCtx.setLineDash([]);

    this._drawLabel(canvasCtx, value.toFixed(1), -4, y, "right", "middle");
  }

  // Vertical gridlines (time)
  const maxTime = STEP_RESPONSE_LEN_SEC;
  for (let i = 0; i <= TICKS; i++) {
    const x = (i / TICKS) * WIDTH;
    const value = (i / TICKS) * maxTime;

    canvasCtx.beginPath();
    canvasCtx.lineWidth = LINEWIDTH;
    canvasCtx.strokeStyle = "rgba(255,255,255,0.15)";
    canvasCtx.moveTo(x, 0);
    canvasCtx.lineTo(x, HEIGHT);
    canvasCtx.stroke();

    this._drawLabel(
      canvasCtx,
      `${Math.round(value * 1000)}ms`,
      x,
      HEIGHT + 4,
      "center",
      "top",
    );
  }
};

StepResponsePlot._formatPID = function (axis) {
  const pidField = STEP_RESPONSE_AXIS_PID_FIELD[axis];
  const pid = this._sysConfig && this._sysConfig[pidField];

  if (!pid || pid[0] == null) {
    return null;
  }

  // sysConfig.<axis>PID is [P, I, D, F, B, O]
  return `P:${pid[0]} I:${pid[1]} D:${pid[2]}${pid[3] != null ? ` F:${pid[3]}` : ""}`;
};

StepResponsePlot._drawAxisResponse = function (canvasCtx, axis, WIDTH, HEIGHT, axisIndex) {
  const axisData = this._data[axis];
  const color = STEP_RESPONSE_AXIS_COLORS[axis];
  const pidLabel = this._formatPID(axis);
  const rowY = 12 + axisIndex * 17;

  if (!axisData || axisData.windowCount === 0) {
    this._drawLabel(
      canvasCtx,
      pidLabel || `${STEP_RESPONSE_AXIS_LABELS[axis]}: no data`,
      WIDTH - 4,
      rowY,
      "right",
      "top",
      color,
    );
    return;
  }

  const responseLenSamples = axisData.response.length;

  canvasCtx.beginPath();
  canvasCtx.lineWidth = this._lineWidth;
  canvasCtx.strokeStyle = color;

  for (let n = 0; n < responseLenSamples; n++) {
    const x = (axisData.time[n] / STEP_RESPONSE_LEN_SEC) * WIDTH;
    const y = HEIGHT - (axisData.response[n] / STEP_RESPONSE_Y_MAX) * HEIGHT;

    if (n === 0) {
      canvasCtx.moveTo(x, y);
    } else {
      canvasCtx.lineTo(x, y);
    }
  }
  canvasCtx.stroke();

  const status = axisData.valid ? "" : " (low confidence)";
  const label = (pidLabel || STEP_RESPONSE_AXIS_LABELS[axis]) + status;
  this._drawLabel(canvasCtx, label, WIDTH - 4, rowY, "right", "top", color);
};

StepResponsePlot._drawMousePosition = function (canvasCtx) {
  const WIDTH = canvasCtx.canvas.width - STEP_RESPONSE_MARGIN_LEFT - STEP_RESPONSE_MARGIN;
  const HEIGHT =
    canvasCtx.canvas.height - STEP_RESPONSE_MARGIN_BOTTOM - STEP_RESPONSE_MARGIN;

  const x = this._mousePosition.x - STEP_RESPONSE_MARGIN_LEFT;

  if (WIDTH <= 0 || HEIGHT <= 0 || x < 0 || x > WIDTH || !this._data) {
    return;
  }

  const timeSec = (x / WIDTH) * STEP_RESPONSE_LEN_SEC;
  const alignRight = x + 90 > WIDTH;

  canvasCtx.save();
  canvasCtx.translate(STEP_RESPONSE_MARGIN_LEFT, STEP_RESPONSE_MARGIN);

  canvasCtx.beginPath();
  canvasCtx.lineWidth = 2;
  canvasCtx.strokeStyle = "rgba(0,255,0,0.66)";
  canvasCtx.moveTo(x, 0);
  canvasCtx.lineTo(x, HEIGHT);
  canvasCtx.stroke();

  const labelX = x + (alignRight ? -6 : 6);
  const labelAlign = alignRight ? "right" : "left";

  // Bottom-anchored readout, so it doesn't sit under the Roll/Pitch/Yaw toggle row docked at
  // the top of the panel.
  const lines = [{ text: `${Math.round(timeSec * 1000)}ms`, color: "rgba(0,255,0,0.9)" }];
  for (const axis in STEP_RESPONSE_AXIS_LABELS) {
    if (!this._axisVisible[axis]) {
      continue;
    }
    const axisData = this._data[axis];
    if (!axisData || axisData.windowCount === 0) {
      continue;
    }
    const value = this._interpolateResponseAt(axisData, timeSec);
    if (value == null) {
      continue;
    }
    lines.push({ text: value.toFixed(2), color: STEP_RESPONSE_AXIS_COLORS[axis] });
  }

  const LINE_HEIGHT = 12;
  const startY = HEIGHT - 4 - (lines.length - 1) * LINE_HEIGHT;

  lines.forEach((line, i) => {
    this._drawLabel(canvasCtx, line.text, labelX, startY + i * LINE_HEIGHT, labelAlign, "top", line.color);
  });

  canvasCtx.restore();
};

StepResponsePlot._interpolateResponseAt = function (axisData, timeSec) {
  const time = axisData.time,
    response = axisData.response;

  if (!time || time.length === 0 || timeSec < time[0] || timeSec > time[time.length - 1]) {
    return null;
  }

  const fraction = timeSec / STEP_RESPONSE_LEN_SEC;
  const index = Math.min(
    response.length - 2,
    Math.max(0, Math.floor(fraction * (response.length - 1))),
  );
  const segmentFraction = (timeSec - time[index]) / (time[index + 1] - time[index]);

  return response[index] + (response[index + 1] - response[index]) * segmentFraction;
};

StepResponsePlot._labelFontSize = function () {
  return this._isFullScreen
    ? this._drawingParams.fontSizeLabelFullscreen
    : this._drawingParams.fontSizeLabel;
};

StepResponsePlot._drawLabel = function (canvasCtx, text, X, Y, align, baseline, color) {
  canvasCtx.save();

  canvasCtx.font = `${this._labelFontSize()}pt Verdana, Arial, sans-serif`;
  canvasCtx.fillStyle = color || "rgba(255,255,255,0.9)";
  canvasCtx.textAlign = align || "center";
  canvasCtx.textBaseline = baseline || "alphabetic";
  canvasCtx.shadowColor = "black";
  canvasCtx.strokeStyle = "black";
  canvasCtx.shadowBlur = 3;
  canvasCtx.lineWidth = 2;
  canvasCtx.strokeText(text, X, Y);
  canvasCtx.fillStyle = color || "rgba(255,255,255,0.9)";
  canvasCtx.fillText(text, X, Y);

  canvasCtx.restore();
};

/**
 * Renders the current step response data at a large fixed resolution (independent of the
 * on-screen panel size) and returns it as a PNG data URL, for sending to the Tuning Log's AI
 * Analysis feature.
 */
StepResponsePlot.captureImage = function () {
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = STEP_RESPONSE_CAPTURE_WIDTH;
  tempCanvas.height = STEP_RESPONSE_CAPTURE_HEIGHT;

  const wasFullScreen = this._isFullScreen;
  const wasSolidBackground = this._solidBackground;
  const wasLineWidth = this._lineWidth;
  const wasFontSizeFullscreen = this._drawingParams.fontSizeLabelFullscreen;

  this._isFullScreen = true;
  this._solidBackground = true;
  this._lineWidth = STEP_RESPONSE_CAPTURE_LINEWIDTH;
  this._drawingParams.fontSizeLabelFullscreen = STEP_RESPONSE_CAPTURE_FONTSIZE;

  this._drawGraph(tempCanvas.getContext("2d"));

  this._isFullScreen = wasFullScreen;
  this._solidBackground = wasSolidBackground;
  this._lineWidth = wasLineWidth;
  this._drawingParams.fontSizeLabelFullscreen = wasFontSizeFullscreen;

  return tempCanvas.toDataURL("image/png");
};

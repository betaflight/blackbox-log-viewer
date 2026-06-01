import { ThemeColors } from "./theme_colors";

// Theme-aware color functions
function getBackgroundStyle() {
  return ThemeColors.getGraphBackground();
}

function getEventBarStyle() {
  return "#8d8"; // Green color works in both themes
}

function getActivityBarStyle() {
  return ThemeColors.isDarkTheme()
    ? "rgba(200,200,255, 0.9)"
    : "rgba(170,170,255, 0.9)";
}

function getOutsideExportRangeStyle() {
  return "rgba(100, 100, 100, 0.5)"; // Dimming overlay works in both themes
}

function getCursorStyle() {
  return "rgba(255, 64, 64, 0.75)"; // Red cursor works in both themes
}

function getCursorStyleWindow() {
  return "rgba(255, 65, 64, 0.15)"; // Red window overlay works in both themes
}

// The activity arrays are free-form data passed from the still-JS layer;
// access stays loose, consistent with the rest of the migration.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

interface DirtyRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Instance shape (the constructor's `this`). The value `SeekBar` below is the
// constructor function.
export interface SeekBar {
  onSeek: ((time: number) => void) | false;
  destroy(): void;
  resize(width: number, height: number): void;
  setActivityRange(min: number, max: number): void;
  setTimeRange(newMin: number, newMax: number, newCurrent: number): void;
  setActivity(
    newActivityTimes: Loose,
    newActivityStrengths: Loose,
    newHasEvent: Loose,
  ): void;
  setCurrentTime(newTime: number): void;
  setWindow(newTime: number): void;
  repaint(): void;
  setInTime(newInTime: number | false): void;
  setOutTime(newOutTime: number | false): void;
  refreshTheme(): void;
}

export function SeekBar(this: SeekBar, canvas: HTMLCanvasElement) {
  // eslint-disable-next-line @typescript-eslint/no-this-alias
  const that = this;
  //Times:
  let min: number;
  let max: number;
  let current: number;
  let currentWindow = 0;
  //Activity to display on bar:
  let activityStrength: Loose;
  let activityTime: Loose;
  //Whether a special event exists at the given time:
  let hasEvent: Loose;
  //Expect to be plotting PWM-like data by default:
  let activityMin = 1000;
  let activityMax = 2000;
  const canvasContext = canvas.getContext("2d")!;
  const background = document.createElement("canvas");
  const backgroundContext = background.getContext("2d")!;
  let inTime: number | false = false;
  let outTime: number | false = false;
  let backgroundValid = false;
  let dirtyRegion: false | DirtyRegion = false;
  //Current time cursor:
  let CURSOR_WIDTH = 1;
  // The bar begins a couple of px inset from the left to allow the cursor to hang over the edge at start&end
  let BAR_INSET = CURSOR_WIDTH;

  this.onSeek = false;

  function seekToDOMPixel(x: number) {
    const bounding = canvas.getBoundingClientRect();
    let time: number;

    // Compensate for canvas being stretched on the page
    x = (x / (bounding.right - bounding.left)) * canvas.width;

    time =
      ((x - BAR_INSET) * (max - min)) / (canvas.width - 1 - BAR_INSET * 2) +
      min;

    if (time < min) time = min;

    if (time > max) time = max;

    if (that.onSeek) that.onSeek(time);

    that.repaint();
  }

  function invalidateBackground() {
    backgroundValid = false;
  }

  function getCanvasOffsetLeft() {
    return canvas.getBoundingClientRect().left + window.scrollX;
  }

  let cancelMouseDrag: (() => void) | null = null;
  let cancelTouchDrag: (() => void) | null = null;

  function onMouseMove(e: MouseEvent) {
    if (e.button === 0) { seekToDOMPixel(e.pageX - getCanvasOffsetLeft()); }
  }

  function onMouseDown(e: MouseEvent) {
    e.preventDefault();

    if (e.button === 0) {
      seekToDOMPixel(e.pageX - getCanvasOffsetLeft());
      document.body.addEventListener("mousemove", onMouseMove);

      function onMouseUp() {
        document.body.removeEventListener("mousemove", onMouseMove);
        document.body.removeEventListener("mouseup", onMouseUp);
        cancelMouseDrag = null;
      }
      cancelMouseDrag = onMouseUp;
      document.body.addEventListener("mouseup", onMouseUp);
    }
  }

  canvas.addEventListener("mousedown", onMouseDown);

  function onTouchMove(e: TouchEvent) {
    seekToDOMPixel(e.touches[0].pageX - getCanvasOffsetLeft());
  }

  function onTouchStart(e: TouchEvent) {
    e.preventDefault();

    seekToDOMPixel(e.touches[0].pageX - getCanvasOffsetLeft());
    document.body.addEventListener("touchmove", onTouchMove);

    function onTouchEnd() {
      document.body.removeEventListener("touchmove", onTouchMove);
      document.body.removeEventListener("touchend", onTouchEnd);
      document.body.removeEventListener("touchcancel", onTouchEnd);
      cancelTouchDrag = null;
    }
    cancelTouchDrag = onTouchEnd;
    document.body.addEventListener("touchend", onTouchEnd);
    document.body.addEventListener("touchcancel", onTouchEnd);
  }

  canvas.addEventListener("touchstart", onTouchStart);

  this.destroy = function () {
    canvas.removeEventListener("mousedown", onMouseDown);
    canvas.removeEventListener("touchstart", onTouchStart);
    if (cancelMouseDrag) { cancelMouseDrag(); }
    if (cancelTouchDrag) { cancelTouchDrag(); }
  };

  this.resize = function (width: number, height: number) {
    const ratio = globalThis.devicePixelRatio ? globalThis.devicePixelRatio : 1;

    canvas.width = width * ratio;
    canvas.height = height * ratio;

    background.width = width * ratio;
    background.height = height * ratio;

    CURSOR_WIDTH = 2.5 * ratio;
    BAR_INSET = CURSOR_WIDTH;

    invalidateBackground();

    that.repaint();
  };

  this.setActivityRange = function (min: number, max: number) {
    activityMin = min;
    activityMax = max;

    invalidateBackground();
  };

  this.setTimeRange = function (
    newMin: number,
    newMax: number,
    newCurrent: number,
  ) {
    min = newMin;
    max = newMax;
    current = newCurrent;

    invalidateBackground();
  };

  this.setActivity = function (
    newActivityTimes: Loose,
    newActivityStrengths: Loose,
    newHasEvent: Loose,
  ) {
    activityTime = newActivityTimes;
    activityStrength = newActivityStrengths;
    hasEvent = newHasEvent;

    invalidateBackground();
  };

  this.setCurrentTime = function (newTime: number) {
    current = newTime;
  };

  this.setWindow = function (newTime: number) {
    currentWindow = newTime;
  };

  function rebuildBackground() {
    let x: number,
      activityIndex: number,
      activity: number,
      pixelTimeStep: number,
      time: number;

    backgroundContext.fillStyle = getBackgroundStyle();
    backgroundContext.fillRect(0, 0, canvas.width, canvas.height);

    if (max > min) {
      pixelTimeStep = (max - min) / (canvas.width - BAR_INSET * 2);

      if (activityTime.length) {
        //Draw events
        backgroundContext.strokeStyle = getEventBarStyle();
        backgroundContext.beginPath();

        time = min;
        activityIndex = 0;

        for (x = BAR_INSET; x < canvas.width - BAR_INSET; x++) {
          //Advance to the right entry in the activity array for this time
          while (
            activityIndex < activityTime.length &&
            time >= activityTime[activityIndex]
          ) {
            activityIndex++;
          }

          activityIndex--;

          if (activityIndex > 0) {
            if (hasEvent[activityIndex]) {
              backgroundContext.moveTo(x, canvas.height);
              backgroundContext.lineTo(x, 0);
            }
          }

          time += pixelTimeStep;
        }

        backgroundContext.stroke();

        //Draw activity bars
        backgroundContext.strokeStyle = getActivityBarStyle();
        backgroundContext.beginPath();

        time = min;
        activityIndex = 0;

        for (x = BAR_INSET; x < canvas.width - BAR_INSET; x++) {
          //Advance to the right entry in the activity array for this time
          while (
            activityIndex < activityTime.length &&
            time >= activityTime[activityIndex]
          ) {
            activityIndex++;
          }

          activityIndex--;

          if (activityIndex > 0) {
            activity =
              ((activityStrength[activityIndex] - activityMin) /
                (activityMax - activityMin)) *
              canvas.height;
            backgroundContext.moveTo(x, canvas.height);
            backgroundContext.lineTo(x, canvas.height - activity);
          }

          time += pixelTimeStep;
        }

        backgroundContext.stroke();
      }

      // Paint in/out region
      if (inTime !== false || outTime !== false) {
        backgroundContext.fillStyle = getOutsideExportRangeStyle();

        if (inTime !== false) {
          backgroundContext.fillRect(
            0,
            0,
            (inTime - min) / pixelTimeStep + BAR_INSET,
            canvas.height,
          );
        }

        if (outTime !== false) {
          const barStartX = (outTime - min) / pixelTimeStep + BAR_INSET;

          backgroundContext.fillRect(
            barStartX,
            0,
            canvas.width - barStartX,
            canvas.height,
          );
        }
      }

      backgroundValid = true;
    }
  }

  this.repaint = function () {
    if (canvas.width === 0 || canvas.height === 0) {
      return;
    }

    if (!backgroundValid) {
      dirtyRegion = false;
      rebuildBackground();
    }

    if (dirtyRegion === false) canvasContext.drawImage(background, 0, 0);
    else {
      canvasContext.drawImage(
        background,
        dirtyRegion.x,
        dirtyRegion.y,
        dirtyRegion.width,
        dirtyRegion.height,
        dirtyRegion.x,
        dirtyRegion.y,
        dirtyRegion.width,
        dirtyRegion.height,
      );
    }

    //Draw cursor
    const pixelTimeStep = (max - min) / (canvas.width - BAR_INSET * 2);
    const cursorX = (current - min) / pixelTimeStep + BAR_INSET;
    let cursorWidth = 0;

    if (currentWindow !== 0) {
      cursorWidth = currentWindow / 2 / pixelTimeStep;
    }

    canvasContext.fillStyle = getCursorStyle();
    if (cursorWidth < CURSOR_WIDTH) {
      cursorWidth = CURSOR_WIDTH;
      canvasContext.fillRect(
        cursorX - CURSOR_WIDTH,
        0,
        CURSOR_WIDTH * 2,
        canvas.height,
      );
    } else {
      canvasContext.fillRect(
        cursorX - CURSOR_WIDTH,
        0,
        CURSOR_WIDTH * 2,
        canvas.height,
      );

      canvasContext.fillStyle = getCursorStyleWindow(); // paint window
      canvasContext.fillRect(
        cursorX - cursorWidth,
        0,
        cursorWidth * 2,
        canvas.height,
      );
    }

    dirtyRegion = {
      x: Math.max(Math.floor(cursorX - cursorWidth - 1), 0),
      y: 0,
      width: Math.ceil(cursorWidth * 2 + 2),
      height: canvas.height,
    };
  };

  this.setInTime = function (newInTime: number | false) {
    inTime = newInTime;
    invalidateBackground();
  };

  this.setOutTime = function (newOutTime: number | false) {
    outTime = newOutTime;
    invalidateBackground();
  };

  this.refreshTheme = function () {
    invalidateBackground();
    that.repaint();
  };

  background.width = canvas.width;
  background.height = canvas.height;
}

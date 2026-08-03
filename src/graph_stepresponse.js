import { StepResponseCalc } from "./graph_stepresponse_calc";
import { StepResponsePlot } from "./graph_stepresponse_plot";
import { PrefStorage } from "./pref_storage";
import { useSettingsStore } from "./stores/settings.js";
import { useGraphStore } from "./stores/graph.js";

// Ported from https://github.com/rotorflight/rotorflight-blackbox (js/graph_stepresponse.js).
export function FlightLogStepResponse(flightLog, canvas, stepResponseCanvas) {
  const { userSettings } = useSettingsStore();
  const graphStore = useGraphStore();

  const STEP_RESPONSE_LARGE_LEFT_MARGIN = 10,
    STEP_RESPONSE_LARGE_TOP_MARGIN = 10,
    STEP_RESPONSE_LARGE_HEIGHT_MARGIN = 20,
    STEP_RESPONSE_LARGE_WIDTH_MARGIN = 20;

  const that = this,
    prefs = new PrefStorage();
  let isFullscreen = false,
    dataReload = true,
    stepResponseData = null;

  try {
    StepResponseCalc.initialize(flightLog, flightLog.getSysConfig());
    StepResponsePlot.initialize(stepResponseCanvas, flightLog.getSysConfig());

    userSettings.stepResponseAxes = userSettings.stepResponseAxes || {
      roll: true,
      pitch: true,
      yaw: true,
    };
    for (const axis in userSettings.stepResponseAxes) {
      StepResponsePlot.setAxisVisible(axis, userSettings.stepResponseAxes[axis]);
    }

    this.setFullscreen = function (size) {
      isFullscreen = size === true;
      StepResponsePlot.setFullScreen(isFullscreen);
      that.resize();
    };

    this.setInTime = function (time) {
      dataReload = true;
      return StepResponseCalc.setInTime(time);
    };

    this.setOutTime = function (time) {
      dataReload = true;
      return StepResponseCalc.setOutTime(time);
    };

    this.setAxisEnabled = function (axis, state) {
      userSettings.stepResponseAxes[axis] = state;
      saveOneUserSetting("stepResponseAxes", userSettings.stepResponseAxes);
      StepResponsePlot.setAxisVisible(axis, state);
      that.draw();
    };

    const getSize = function () {
      if (isFullscreen) {
        return {
          height: canvas.clientHeight - STEP_RESPONSE_LARGE_HEIGHT_MARGIN,
          width: canvas.clientWidth - STEP_RESPONSE_LARGE_WIDTH_MARGIN,
          left: STEP_RESPONSE_LARGE_LEFT_MARGIN,
          top: STEP_RESPONSE_LARGE_TOP_MARGIN,
        };
      }
      return {
        height:
          (canvas.height * Number.parseInt(userSettings.stepResponse.size, 10)) / 100,
        width:
          (canvas.width * Number.parseInt(userSettings.stepResponse.size, 10)) / 100,
        left:
          (canvas.width * Number.parseInt(userSettings.stepResponse.left, 10)) / 100,
        top:
          (canvas.height * Number.parseInt(userSettings.stepResponse.top, 10)) / 100,
      };
    };

    this.resize = function () {
      const newSize = getSize();
      StepResponsePlot.setSize(newSize.width, newSize.height);

      const parentElem = stepResponseCanvas.parentElement;
      parentElem.style.left = `${newSize.left}px`;
      parentElem.style.top = `${newSize.top}px`;

      // Push layout to store for Vue component positioning (toolbar/fullscreen button)
      graphStore.stepResponseLayout = {
        width: newSize.width,
        height: newSize.height,
        left: newSize.left,
        top: newSize.top,
      };
    };

    const dataLoad = function () {
      stepResponseData = StepResponseCalc.calculate();
      StepResponsePlot.setData(stepResponseData);
    };

    this.plot = function () {
      if (dataReload || stepResponseData == null) {
        dataReload = false;
        dataLoad();
      }
      that.draw();
    };

    this.draw = function () {
      StepResponsePlot.draw();
    };

    function onMouseMoveStepResponse(e) {
      if (e.shiftKey) {
        graphStore.stepResponseShiftActive = true;
        const rect = stepResponseCanvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        StepResponsePlot.setMousePosition(mouseX, mouseY);
        that.draw();
        e.preventDefault();
      } else {
        graphStore.stepResponseShiftActive = false;
        StepResponsePlot.clearMousePosition();
        that.draw();
      }
    }

    function onMouseLeaveStepResponse() {
      StepResponsePlot.clearMousePosition();
      that.draw();
    }

    this.destroy = function () {
      stepResponseCanvas.removeEventListener("mousemove", onMouseMoveStepResponse);
      stepResponseCanvas.removeEventListener("touchmove", onMouseMoveStepResponse);
      stepResponseCanvas.removeEventListener("mouseleave", onMouseLeaveStepResponse);
    };

    stepResponseCanvas.addEventListener("mousemove", onMouseMoveStepResponse);
    stepResponseCanvas.addEventListener("touchmove", onMouseMoveStepResponse);
    stepResponseCanvas.addEventListener("mouseleave", onMouseLeaveStepResponse);

    function saveOneUserSetting(name, value) {
      prefs.get("userSettings", function (data) {
        data = data || {};
        data[name] = value;
        prefs.set("userSettings", data);
      });
    }
  } catch (e) {
    console.error(`Failed to create step response panel... error: ${e}`);
  }
}

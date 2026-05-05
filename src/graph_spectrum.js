import { debounce } from "throttle-debounce";
import { GraphSpectrumCalc } from "./graph_spectrum_calc";
import {
  GraphSpectrumPlot,
  SPECTRUM_TYPE,
  SPECTRUM_OVERDRAW_TYPE,
} from "./graph_spectrum_plot";
import { PrefStorage } from "./pref_storage";
import { SpectrumExporter } from "./spectrum-exporter";

export function FlightLogAnalyser(flightLog, canvas, analyserCanvas) {
  const ANALYSER_LARGE_LEFT_MARGIN = 10,
    ANALYSER_LARGE_TOP_MARGIN = 10,
    ANALYSER_LARGE_HEIGHT_MARGIN = 20,
    ANALYSER_LARGE_WIDTH_MARGIN = 20;

  const that = this,
    prefs = new PrefStorage(),
    DEFAULT_PSD_HEATMAP_MIN = -40,
    DEFAULT_PSD_HEATMAP_MAX = 10,
    DEFAULT_PSD_SEGMENT_LENGTH_POWER = 9;
  let analyserZoomX = 1.0 /* 100% */,
    analyserZoomY = 1.0 /* 100% */,
    dataReload = false,
    fftData = null,
    addSpectrumForComparison = false;

  try {
    let isFullscreen = false;

    const sysConfig = flightLog.getSysConfig();
    const logRateInfo = GraphSpectrumCalc.initialize(flightLog, sysConfig);
    GraphSpectrumPlot.initialize(analyserCanvas, sysConfig);
    GraphSpectrumPlot.setLogRateWarningInfo(logRateInfo);
    const analyserZoomXElem = document.getElementById("analyserZoomX");
    const analyserZoomYElem = document.getElementById("analyserZoomY");
    const analyserMinPSD = document.getElementById("analyserMinPSD");
    const analyserMaxPSD = document.getElementById("analyserMaxPSD");
    const analyserLowLevelPSD = document.getElementById("analyserLowLevelPSD");
    const analyserSegmentLengthPowerAt2 = document.getElementById("analyserSegmentLengthPowerAt2");

    const spectrumToolbarElem = document.getElementById("spectrumToolbar");
    const spectrumTypeElem = document.getElementById("spectrumTypeSelect");
    const overdrawSpectrumTypeElem = document.getElementById("overdrawSpectrumTypeSelect");

    this.setFullscreen = function (size) {
      isFullscreen = size == true;
      GraphSpectrumPlot.setFullScreen(isFullscreen);
      that.resize();
    };

    this.prepareSpectrumForComparison = function () {
      if (userSettings.spectrumType === SPECTRUM_TYPE.POWER_SPECTRAL_DENSITY) {
        addSpectrumForComparison = true;
      }
    };

    this.setInTime = function (time) {
      dataReload = true;
      return GraphSpectrumCalc.setInTime(time);
    };

    this.setOutTime = function (time) {
      dataReload = true;
      return GraphSpectrumCalc.setOutTime(time);
    };

    const getSize = function () {
      if (isFullscreen) {
        return {
          height: canvas.clientHeight - ANALYSER_LARGE_HEIGHT_MARGIN,
          width: canvas.clientWidth - ANALYSER_LARGE_WIDTH_MARGIN,
          left: ANALYSER_LARGE_LEFT_MARGIN,
          top: ANALYSER_LARGE_TOP_MARGIN,
        };
      } else {
        return {
          height:
            (canvas.height * parseInt(userSettings.analyser.size)) / 100.0,
          width: (canvas.width * parseInt(userSettings.analyser.size)) / 100.0,
          left: (canvas.width * parseInt(userSettings.analyser.left)) / 100.0,
          top: (canvas.height * parseInt(userSettings.analyser.top)) / 100.0,
        };
      }
    };

    this.resize = function () {
      const newSize = getSize();

      // Determine the analyserCanvas location
      GraphSpectrumPlot.setSize(newSize.width, newSize.height);

      // Recenter the analyser canvas in the bottom left corner
      const parentElem = analyserCanvas.parentElement;

      parentElem.style.left = `${newSize.left}px`;
      parentElem.style.top = `${newSize.top}px`;

      // place the sliders.
      analyserZoomXElem.style.left = `${newSize.width - 130}px`;
      analyserZoomYElem.style.left = `${newSize.width - 20}px`;
      const comparisonElem = document.getElementById("spectrumComparison");
      const resizeElem = document.getElementById("analyserResize");
      const isFullscreen = document.documentElement.classList.contains("has-analyser-fullscreen");
      if (comparisonElem) {
        comparisonElem.style.left = `${newSize.width - (isFullscreen ? 250 : 150)}px`;
      }
      if (resizeElem) {
        resizeElem.style.left = `${newSize.width - (isFullscreen ? 20 : 30)}px`;
      }
      analyserMaxPSD.style.left = `${newSize.width - 90}px`;
      analyserMinPSD.style.left = `${newSize.width - 90}px`;
      analyserLowLevelPSD.style.left = `${newSize.width - 90}px`;
      document.getElementById("analyserMaxPSDLabel").style.left = `${newSize.width - 150}px`;
      document.getElementById("analyserMinPSDLabel").style.left = `${newSize.width - 150}px`;
      document.getElementById("analyserLowLevelPSDLabel").style.left = `${newSize.width - 155}px`;
      analyserSegmentLengthPowerAt2.style.left = `${newSize.width - 57}px`;
      document.getElementById("analyserSegmentLengthPowerAt2Label").style.left = `${newSize.width - 135}px`;
    };

    const dataLoad = function (fieldIndex, curve, fieldName) {
      if (fieldIndex > 0 && curve != null && fieldName != null) {
        GraphSpectrumCalc.setDataBuffer(fieldIndex, curve, fieldName);
      }

      switch (userSettings.spectrumType) {
        case SPECTRUM_TYPE.FREQ_VS_THROTTLE:
          fftData = GraphSpectrumCalc.dataLoadFrequencyVsThrottle();
          break;

        case SPECTRUM_TYPE.FREQ_VS_RPM:
          fftData = GraphSpectrumCalc.dataLoadFrequencyVsRpm();
          break;

        case SPECTRUM_TYPE.PSD_VS_THROTTLE:
          fftData = GraphSpectrumCalc.dataLoadPowerSpectralDensityVsThrottle();
          break;

        case SPECTRUM_TYPE.PSD_VS_RPM:
          fftData = GraphSpectrumCalc.dataLoadPowerSpectralDensityVsRpm();
          break;

        case SPECTRUM_TYPE.PIDERROR_VS_SETPOINT:
          fftData = GraphSpectrumCalc.dataLoadPidErrorVsSetpoint();
          break;

        case SPECTRUM_TYPE.POWER_SPECTRAL_DENSITY:
          fftData = GraphSpectrumCalc.dataLoadPSD(analyserZoomY);
          if (fftData.maximalSegmentsLength > 0) {
            analyserSegmentLengthPowerAt2.max =
              Math.ceil(Math.log2(fftData.maximalSegmentsLength));
          }
          break;

        case SPECTRUM_TYPE.FREQUENCY:
        default:
          fftData = GraphSpectrumCalc.dataLoadFrequency();
          break;
      }
    };

    this.shouldAddCurrentSpectrumBeforeReload = function () {
      return (
        addSpectrumForComparison &&
        fftData !== null &&
        !this.isMultiSpectrum() &&
        !dataReload
      );
    };

    /* This function is called from the canvas drawing routines within grapher.js
           It is only used to record the current curve positions, collect the data and draw the
           analyser on screen*/
    this.plotSpectrum = function (fieldIndex, curve, fieldName) {
      // Detect change of selected field.... reload and redraw required.
      const isMaxCountOfImportedPSD =
        GraphSpectrumPlot.isImportedCurvesMaxCount() &&
        userSettings.spectrumType === SPECTRUM_TYPE.POWER_SPECTRAL_DENSITY;
      let shouldReload =
        fftData == null ||
        (fieldIndex != fftData.fieldIndex && !isMaxCountOfImportedPSD) || // Lock spectrum data reload while PSD curves import is full
        dataReload;

      if (
        addSpectrumForComparison &&
        !GraphSpectrumPlot.isNewComparedCurve(fieldName)
      ) {
        GraphSpectrumPlot.removeComparedCurve(fieldName);
        addSpectrumForComparison = false;
        shouldReload = false; // Do not load if spectrum was deleted
      }

      if (shouldReload) {
        if (this.shouldAddCurrentSpectrumBeforeReload()) {
          GraphSpectrumPlot.addCurrentSpectrumIntoImport(); // The main curve is added into imported list when the second curve is selected for comparison
        }
        dataReload = false;
        dataLoad(fieldIndex, curve, fieldName);
        GraphSpectrumPlot.setData(fftData, userSettings.spectrumType);
      }
      if (addSpectrumForComparison) {
        GraphSpectrumPlot.addCurrentSpectrumIntoImport();
        addSpectrumForComparison = false;
      }
      that.draw(); // draw the analyser on the canvas....
    };

    function onMouseMoveAnalyser(e) {
      trackFrequency(e, that);
    }

    this.destroy = function () {
      analyserCanvas.removeEventListener("mousemove", onMouseMoveAnalyser);
      analyserCanvas.removeEventListener("touchmove", onMouseMoveAnalyser);
    };

    this.refresh = function () {
      that.draw();
    };

    this.draw = function () {
      GraphSpectrumPlot.draw();
    };

    /* Add mouse/touch over event to read the frequency */
    analyserCanvas.addEventListener("mousemove", onMouseMoveAnalyser);
    analyserCanvas.addEventListener("touchmove", onMouseMoveAnalyser);

    /* add zoom controls */
    const DEFAULT_ZOOM = 100;

    analyserZoomXElem.value = DEFAULT_ZOOM;
    analyserZoomXElem.addEventListener("input", debounce(100, function () {
      analyserZoomX = analyserZoomXElem.value / 100;
      GraphSpectrumPlot.setZoom(analyserZoomX, analyserZoomY);
      that.refresh();
    }));
    analyserZoomXElem.addEventListener("dblclick", function () {
      analyserZoomXElem.value = DEFAULT_ZOOM;
      analyserZoomXElem.dispatchEvent(new Event("input"));
    });

    analyserZoomYElem.value = DEFAULT_ZOOM;
    analyserZoomYElem.addEventListener("input", debounce(100, function () {
      analyserZoomY = 1 / (analyserZoomYElem.value / 100);
      GraphSpectrumPlot.setZoom(analyserZoomX, analyserZoomY);
      that.refresh();
    }));
    analyserZoomYElem.addEventListener("dblclick", function () {
      analyserZoomYElem.value = DEFAULT_ZOOM;
      analyserZoomYElem.dispatchEvent(new Event("input"));
    });

    if (userSettings.psdHeatmapMin == undefined) {
      userSettings.psdHeatmapMin = DEFAULT_PSD_HEATMAP_MIN;
    }
    GraphSpectrumPlot.setMinPSD(userSettings.psdHeatmapMin);
    GraphSpectrumPlot.setLowLevelPSD(userSettings.psdHeatmapMin);

    if (userSettings.psdHeatmapMax == undefined) {
      userSettings.psdHeatmapMax = DEFAULT_PSD_HEATMAP_MAX;
    }
    GraphSpectrumPlot.setMaxPSD(userSettings.psdHeatmapMax);

    analyserMinPSD.value = userSettings.psdHeatmapMin;
    analyserMinPSD.addEventListener("input", debounce(100, function () {
      const min = parseInt(analyserMinPSD.value);
      GraphSpectrumPlot.setMinPSD(min);
      saveOneUserSetting("psdHeatmapMin", min);
      analyserLowLevelPSD.min = min;
      analyserMaxPSD.min = min + 5;
      if (parseInt(analyserLowLevelPSD.value) < min) {
        analyserLowLevelPSD.value = min;
        analyserLowLevelPSD.dispatchEvent(new Event("input"));
      }
      that.refresh();
    }));
    analyserMinPSD.addEventListener("dblclick", function (e) {
      if (e.ctrlKey) {
        analyserMinPSD.value = userSettings.psdHeatmapMin;
        analyserMinPSD.dispatchEvent(new Event("input"));
      }
    });

    analyserMaxPSD.value = userSettings.psdHeatmapMax;
    analyserMaxPSD.addEventListener("input", debounce(100, function () {
      const max = parseInt(analyserMaxPSD.value);
      GraphSpectrumPlot.setMaxPSD(max);
      saveOneUserSetting("psdHeatmapMax", max);
      analyserMinPSD.max = max - 5;
      analyserLowLevelPSD.max = max;
      if (parseInt(analyserLowLevelPSD.value) > max) {
        analyserLowLevelPSD.value = max;
        analyserLowLevelPSD.dispatchEvent(new Event("input"));
      }
      that.refresh();
    }));
    analyserMaxPSD.addEventListener("dblclick", function (e) {
      if (e.ctrlKey) {
        analyserMaxPSD.value = userSettings.psdHeatmapMax;
        analyserMaxPSD.dispatchEvent(new Event("input"));
      }
    });

    analyserLowLevelPSD.value = analyserMinPSD.value;
    analyserLowLevelPSD.addEventListener("input", debounce(100, function () {
      const lowLevel = analyserLowLevelPSD.value;
      GraphSpectrumPlot.setLowLevelPSD(lowLevel);
      that.refresh();
    }));
    analyserLowLevelPSD.addEventListener("dblclick", function (e) {
      if (e.ctrlKey) {
        analyserLowLevelPSD.value = analyserMinPSD.value;
        analyserLowLevelPSD.dispatchEvent(new Event("input"));
      }
    });

    GraphSpectrumCalc.setPointsPerSegmentPSD(
      2 ** DEFAULT_PSD_SEGMENT_LENGTH_POWER,
    );
    analyserSegmentLengthPowerAt2.value = DEFAULT_PSD_SEGMENT_LENGTH_POWER;
    analyserSegmentLengthPowerAt2.addEventListener("input", debounce(100, function () {
      GraphSpectrumCalc.setPointsPerSegmentPSD(
        2 ** Number.parseInt(analyserSegmentLengthPowerAt2.value),
      );
      dataLoad();
      GraphSpectrumPlot.setData(fftData, userSettings.spectrumType);
      that.refresh();
    }));
    analyserSegmentLengthPowerAt2.addEventListener("dblclick", function (e) {
      if (e.ctrlKey) {
        analyserSegmentLengthPowerAt2.value = DEFAULT_PSD_SEGMENT_LENGTH_POWER;
        analyserSegmentLengthPowerAt2.dispatchEvent(new Event("input"));
      }
    });

    // Spectrum type to show
    userSettings.spectrumType =
      userSettings.spectrumType || SPECTRUM_TYPE.FREQUENCY;
    spectrumTypeElem.value = userSettings.spectrumType;

    function onSpectrumTypeChange() {
      const optionSelected = parseInt(spectrumTypeElem.value, 10);

      if (optionSelected != userSettings.spectrumType) {
        userSettings.spectrumType = optionSelected;
        saveOneUserSetting("spectrumType", userSettings.spectrumType);

        dataReload = true;
        that.plotSpectrum(-1, null, null);
      }

      const pidErrorVsSetpointSelected =
        optionSelected === SPECTRUM_TYPE.PIDERROR_VS_SETPOINT;
      const psdHeatMapSelected =
        optionSelected === SPECTRUM_TYPE.PSD_VS_THROTTLE ||
        optionSelected === SPECTRUM_TYPE.PSD_VS_RPM;
      const psdCurveSelected =
        optionSelected === SPECTRUM_TYPE.POWER_SPECTRAL_DENSITY;

      overdrawSpectrumTypeElem.style.display = pidErrorVsSetpointSelected ? "none" : "";
      analyserZoomYElem.classList.toggle(
        "onlyFullScreenException",
        pidErrorVsSetpointSelected || psdHeatMapSelected || psdCurveSelected,
      );
      analyserSegmentLengthPowerAt2.classList.toggle("onlyFullScreenException", !psdCurveSelected);
      analyserLowLevelPSD.classList.toggle("onlyFullScreenException", !psdHeatMapSelected);
      analyserMinPSD.classList.toggle("onlyFullScreenException", !psdHeatMapSelected);
      analyserMaxPSD.classList.toggle("onlyFullScreenException", !psdHeatMapSelected);
      document.getElementById("analyserMaxPSDLabel").classList.toggle("onlyFullScreenException", !psdHeatMapSelected);
      document.getElementById("analyserMinPSDLabel").classList.toggle("onlyFullScreenException", !psdHeatMapSelected);
      document.getElementById("analyserLowLevelPSDLabel").classList.toggle("onlyFullScreenException", !psdHeatMapSelected);
      document.getElementById("analyserSegmentLengthPowerAt2Label").classList.toggle("onlyFullScreenException", !psdCurveSelected);

      const showSpectrumsComparisonPanel =
        optionSelected === SPECTRUM_TYPE.FREQUENCY ||
        optionSelected === SPECTRUM_TYPE.POWER_SPECTRAL_DENSITY;
      document.getElementById("spectrumComparison").style.visibility =
        showSpectrumsComparisonPanel ? "visible" : "hidden";

      const showAddSpectrumButton =
        optionSelected === SPECTRUM_TYPE.POWER_SPECTRAL_DENSITY;
      const btnAdd = document.getElementById("btn-spectrum-add");
      if (btnAdd) btnAdd.style.display = showAddSpectrumButton ? "" : "none";
    }

    spectrumTypeElem.addEventListener("change", onSpectrumTypeChange);
    onSpectrumTypeChange();

    // Spectrum overdraw to show
    userSettings.overdrawSpectrumType =
      userSettings.overdrawSpectrumType || SPECTRUM_OVERDRAW_TYPE.ALL_FILTERS;
    overdrawSpectrumTypeElem.value = userSettings.overdrawSpectrumType;
    GraphSpectrumPlot.setOverdraw(userSettings.overdrawSpectrumType);

    overdrawSpectrumTypeElem.addEventListener("change", function () {
      const optionSelected = parseInt(overdrawSpectrumTypeElem.value, 10);

      if (optionSelected != userSettings.overdrawSpectrumType) {
        userSettings.overdrawSpectrumType = optionSelected;
        saveOneUserSetting(
          "overdrawSpectrumType",
          userSettings.overdrawSpectrumType,
        );

        GraphSpectrumPlot.setOverdraw(userSettings.overdrawSpectrumType);
        that.draw();
      }
    });

    // track frequency under mouse
    let lastMouseX = 0,
      lastMouseY = 0;

    function trackFrequency(e, analyser) {
      if (e.shiftKey) {
        // Hide the combo and maximize buttons
        spectrumToolbarElem.classList.remove("non-shift");

        const rect = analyserCanvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        if (mouseX != lastMouseX || mouseY != lastMouseY) {
          lastMouseX = mouseX;
          lastMouseY = mouseY;
          GraphSpectrumPlot.setMousePosition(mouseX, mouseY);
          if (analyser) {
            analyser.refresh();
          }
        }
        e.preventDefault();
      } else {
        spectrumToolbarElem.classList.add("non-shift");
      }
    }

    function saveOneUserSetting(name, value) {
      prefs.get("userSettings", function (data) {
        data = data || {};
        data[name] = value;
        prefs.set("userSettings", data);
      });
    }

    this.exportSpectrumToCSV = function (onSuccess, options) {
      SpectrumExporter(fftData, options).dump(onSuccess);
    };

    this.importSpectrumFromCSV = function (files) {
      GraphSpectrumPlot.importCurvesFromCSV(files);
    };

    this.removeImportedSpectrums = function () {
      GraphSpectrumPlot.removeImportedCurves();
    };

    this.getExportedFileName = function () {
      let fileName = (document.querySelector(".log-filename")?.textContent || "").split(".")[0];
      switch (userSettings.spectrumType) {
        case SPECTRUM_TYPE.FREQUENCY:
          fileName = fileName + "_sp";
          break;
        case SPECTRUM_TYPE.POWER_SPECTRAL_DENSITY:
          fileName = fileName + "_psd";
          break;
      }
      return fileName;
    };

    this.isMultiSpectrum = function () {
      return GraphSpectrumPlot.isMultiSpectrum();
    };
  } catch (e) {
    console.error(`Failed to create analyser... error: ${e}`);
  }
}

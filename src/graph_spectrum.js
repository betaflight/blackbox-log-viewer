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
    DEFAULT_PSD_HEATMAP_MAX = 10;
  let analyserZoomX = 1.0 /* 100% */,
    analyserZoomY = 1.0 /* 100% */,
    dataReload = false,
    fftData = null;

  try {
    let isFullscreen = false;

    const sysConfig = flightLog.getSysConfig();
    const logRateInfo = GraphSpectrumCalc.initialize(flightLog, sysConfig);
    GraphSpectrumPlot.initialize(analyserCanvas, sysConfig);
    GraphSpectrumPlot.setLogRateWarningInfo(logRateInfo);
    const analyserZoomXElem = $("#analyserZoomX");
    const analyserZoomYElem = $("#analyserZoomY");
    const analyserMinPSD = $("#analyserMinPSD");
    const analyserMaxPSD = $("#analyserMaxPSD");
    const analyserLowLevelPSD = $("#analyserLowLevelPSD");
    const analyserSegmentLengthPSD = $("#analyserSegmentLengthPSD");


    const spectrumToolbarElem = $("#spectrumToolbar");
    const spectrumTypeElem = $("#spectrumTypeSelect");
    const overdrawSpectrumTypeElem = $("#overdrawSpectrumTypeSelect");

    this.setFullscreen = function (size) {
      isFullscreen = size == true;
      GraphSpectrumPlot.setFullScreen(isFullscreen);
      that.resize();
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
      const parentElem = $(analyserCanvas).parent();

      $(parentElem).css({
        left: newSize.left, // (canvas.width  * getSize().left) + "px",
        top: newSize.top, // (canvas.height * getSize().top ) + "px"
      });
      // place the sliders.
      $("#analyserZoomX", parentElem).css({
        left: `${newSize.width - 130}px`,
      });
      $("#analyserZoomY", parentElem).css({
        left: `${newSize.width - 20}px`,
      });
      $("#analyserResize", parentElem).css({
        left: `${newSize.width - 20}px`,
      });
      $("#analyserMaxPSD", parentElem).css({
        left: `${newSize.width - 90}px`,
      });
      $("#analyserMinPSD", parentElem).css({
        left: `${newSize.width - 90}px`,
      });
      $("#analyserLowLevelPSD", parentElem).css({
        left: `${newSize.width - 90}px`,
      });
      $("#analyserMaxPSDLabel", parentElem).css({
        left: `${newSize.width - 150}px`,
      });
      $("#analyserMinPSDLabel", parentElem).css({
        left: `${newSize.width - 150}px`,
      });
      $("#analyserLowLevelPSDLabel", parentElem).css({
        left: `${newSize.width - 155}px`,
      });
      $("#analyserSegmentLengthPSD", parentElem).css({
        left: `${newSize.width - 150}px`,
      });
      $("#analyserSegmentLengthPSDLabel", parentElem).css({
        left: `${newSize.width - 150}px`,
      });
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
          break;

        case SPECTRUM_TYPE.FREQUENCY:
        default:
          fftData = GraphSpectrumCalc.dataLoadFrequency();
          break;
      }
    };

    /* This function is called from the canvas drawing routines within grapher.js
           It is only used to record the current curve positions, collect the data and draw the
           analyser on screen*/
    this.plotSpectrum = function (fieldIndex, curve, fieldName) {
      // Detect change of selected field.... reload and redraw required.
      if (fftData == null || fieldIndex != fftData.fieldIndex || dataReload) {
        dataReload = false;
        dataLoad(fieldIndex, curve, fieldName);
        GraphSpectrumPlot.setData(fftData, userSettings.spectrumType);
      }

      that.draw(); // draw the analyser on the canvas....
    };

    this.destroy = function () {
      $(analyserCanvas).off("mousemove", trackFrequency);
      $(analyserCanvas).off("touchmove", trackFrequency);
    };

    this.refresh = function () {
      that.draw();
    };

    this.draw = function () {
      GraphSpectrumPlot.draw();
    };

    /* Add mouse/touch over event to read the frequency */
    $(analyserCanvas).on("mousemove", function (e) {
      trackFrequency(e, that);
    });
    $(analyserCanvas).on("touchmove", function (e) {
      trackFrequency(e, that);
    });

    /* add zoom controls */
    const DEFAULT_ZOOM = 100;
    analyserZoomXElem
      .on(
        "input",
        debounce(100, function () {
          analyserZoomX = analyserZoomXElem.val() / 100;
          GraphSpectrumPlot.setZoom(analyserZoomX, analyserZoomY);
          that.refresh();
        }),
      )
      .dblclick(function () {
        $(this).val(DEFAULT_ZOOM).trigger("input");
      })
      .val(DEFAULT_ZOOM);

    analyserZoomYElem
      .on(
        "input",
        debounce(100, function () {
          analyserZoomY = 1 / (analyserZoomYElem.val() / 100);
          GraphSpectrumPlot.setZoom(analyserZoomX, analyserZoomY);
          // Recalculate PSD with updated samples per segment count
          if (userSettings.spectrumType == SPECTRUM_TYPE.POWER_SPECTRAL_DENSITY) {
            dataLoad();
            GraphSpectrumPlot.setData(fftData, userSettings.spectrumType);
          }
          that.refresh();
        }),
      )
      .dblclick(function () {
        $(this).val(DEFAULT_ZOOM).trigger("input");
      })
      .val(DEFAULT_ZOOM);

    if (userSettings.psdHeatmapMin == undefined) {
      userSettings.psdHeatmapMin = DEFAULT_PSD_HEATMAP_MIN;
    }
    GraphSpectrumPlot.setMinPSD(userSettings.psdHeatmapMin);
    GraphSpectrumPlot.setLowLevelPSD(userSettings.psdHeatmapMin);

    if (userSettings.psdHeatmapMax == undefined) {
      userSettings.psdHeatmapMax = DEFAULT_PSD_HEATMAP_MAX;
    }
    GraphSpectrumPlot.setMaxPSD(userSettings.psdHeatmapMax);

    analyserMinPSD
      .on(
        "input",
        debounce(100, function () {
          const min = parseInt(analyserMinPSD.val());
          GraphSpectrumPlot.setMinPSD(min);
          saveOneUserSetting("psdHeatmapMin", min);
          analyserLowLevelPSD.prop("min", min);
          analyserMaxPSD.prop("min", min + 5);
          analyserLowLevelPSD.val(min).trigger("input");
          that.refresh();
        }),
      )
      .dblclick(function (e) {
        if (e.ctrlKey) {
          $(this).val(userSettings.psdHeatmapMin).trigger("input");
        }
      })
      .val(userSettings.psdHeatmapMin);

    analyserMaxPSD
      .on(
        "input",
        debounce(100, function () {
          const max = parseInt(analyserMaxPSD.val());
          GraphSpectrumPlot.setMaxPSD(max);
          saveOneUserSetting("psdHeatmapMax", max);
          analyserMinPSD.prop("max", max - 5);
          analyserLowLevelPSD.prop("max", max);
          if (analyserLowLevelPSD.val() > max) {
            analyserLowLevelPSD.val(max).trigger("input");
          }
          that.refresh();
        }),
      )
      .dblclick(function (e) {
        if (e.ctrlKey) {
          $(this).val(userSettings.psdHeatmapMax).trigger("input");
        }
      })
      .val(userSettings.psdHeatmapMax);

    analyserLowLevelPSD
      .on(
        "input",
        debounce(100, function () {
          const lowLevel = analyserLowLevelPSD.val();
          GraphSpectrumPlot.setLowLevelPSD(lowLevel);
          that.refresh();
        }),
      )
      .dblclick(function (e) {
        if (e.ctrlKey) {
          $(this).val(analyserMinPSD.val()).trigger("input");
        }
      })
      .val(analyserMinPSD.val());

    // Spectrum type to show
    userSettings.spectrumType =
      userSettings.spectrumType || SPECTRUM_TYPE.FREQUENCY;
    spectrumTypeElem.val(userSettings.spectrumType);

    spectrumTypeElem
      .change(function () {
        const optionSelected = parseInt(spectrumTypeElem.val(), 10);

        if (optionSelected != userSettings.spectrumType) {
          userSettings.spectrumType = optionSelected;
          saveOneUserSetting("spectrumType", userSettings.spectrumType);

          // Recalculate the data, for the same curve than now, and draw it
          dataReload = true;
          that.plotSpectrum(-1, null, null); // Update fft data only
        }

        // Hide overdraw and zoomY if needed
        const pidErrorVsSetpointSelected =
          optionSelected === SPECTRUM_TYPE.PIDERROR_VS_SETPOINT;
        const psdHeatMapSelected =
          optionSelected === SPECTRUM_TYPE.PSD_VS_THROTTLE ||
          optionSelected === SPECTRUM_TYPE.PSD_VS_RPM;
        const psdCurveSelected =
          optionSelected === SPECTRUM_TYPE.POWER_SPECTRAL_DENSITY;
        overdrawSpectrumTypeElem.toggle(!pidErrorVsSetpointSelected);
        analyserZoomYElem.toggleClass(
          "onlyFullScreenException",
          pidErrorVsSetpointSelected || psdHeatMapSelected || psdCurveSelected,
        );
        analyserSegmentLengthPSD.toggleClass(
          "onlyFullScreenException",
          !psdCurveSelected,
        );
        analyserLowLevelPSD.toggleClass(
          "onlyFullScreenException",
          !psdHeatMapSelected,
        );
        analyserMinPSD.toggleClass(
          "onlyFullScreenException",
          !psdHeatMapSelected,
        );
        analyserMaxPSD.toggleClass(
          "onlyFullScreenException",
          !psdHeatMapSelected,
        );
        $("#analyserMaxPSDLabel").toggleClass(
          "onlyFullScreenException",
          !psdHeatMapSelected,
        );
        $("#analyserMinPSDLabel").toggleClass(
          "onlyFullScreenException",
          !psdHeatMapSelected,
        );
        $("#analyserLowLevelPSDLabel").toggleClass(
          "onlyFullScreenException",
          !psdHeatMapSelected,
        );
        $("#analyserSegmentLengthPSDLabel").toggleClass(
          "onlyFullScreenException",
          !psdCurveSelected,
        );


        const showSpectrumsComparisonPanel = optionSelected === SPECTRUM_TYPE.FREQUENCY || optionSelected === SPECTRUM_TYPE.POWER_SPECTRAL_DENSITY;
        $("#spectrumComparison").css("visibility", (showSpectrumsComparisonPanel ? "visible" : "hidden"));
      })
      .change();

    // Spectrum overdraw to show
    userSettings.overdrawSpectrumType =
      userSettings.overdrawSpectrumType || SPECTRUM_OVERDRAW_TYPE.ALL_FILTERS;
    overdrawSpectrumTypeElem.val(userSettings.overdrawSpectrumType);
    GraphSpectrumPlot.setOverdraw(userSettings.overdrawSpectrumType);

    overdrawSpectrumTypeElem.change(function () {
      const optionSelected = parseInt(overdrawSpectrumTypeElem.val(), 10);

      if (optionSelected != userSettings.overdrawSpectrumType) {
        userSettings.overdrawSpectrumType = optionSelected;
        saveOneUserSetting(
          "overdrawSpectrumType",
          userSettings.overdrawSpectrumType
        );

        // Refresh the graph
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
        spectrumToolbarElem.removeClass("non-shift");

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
        spectrumToolbarElem.addClass("non-shift");
      }
    }

    function saveOneUserSetting(name, value) {
      prefs.get("userSettings", function (data) {
        data = data || {};
        data[name] = value;
        prefs.set("userSettings", data);
      });
    }

    this.exportSpectrumToCSV = function(onSuccess, options) {
      SpectrumExporter(fftData, options).dump(onSuccess);
    };

    this.importSpectrumFromCSV = function(files) {
      GraphSpectrumPlot.importCurvesFromCSV(files);
    };

    this.removeImportedSpectrums = function() {
      GraphSpectrumPlot.removeImportedCurves();
    };

    this.getExportedFileName = function() {
      let fileName = $(".log-filename").text().split(".")[0];
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

  } catch (e) {
    console.error(`Failed to create analyser... error: ${e}`);
  }
}

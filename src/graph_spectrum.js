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

  let that = this,
    analyserZoomX = 1.0 /* 100% */,
    analyserZoomY = 1.0 /* 100% */,
    dataReload = false,
    fftData = null,
    prefs = new PrefStorage();

  this.dataBuffer = {
    fieldIndex: 0,
    curve: 0,
    fieldName: null,
  };

  try {
    let isFullscreen = false;

    let sysConfig = flightLog.getSysConfig();
    const logRateInfo = GraphSpectrumCalc.initialize(flightLog, sysConfig);
    GraphSpectrumPlot.initialize(analyserCanvas, sysConfig);
    GraphSpectrumPlot.setLogRateWarningInfo(logRateInfo);
    let analyserZoomXElem = $("#analyserZoomX");
    let analyserZoomYElem = $("#analyserZoomY");

    let spectrumToolbarElem = $("#spectrumToolbar");
    let spectrumTypeElem = $("#spectrumTypeSelect");
    let overdrawSpectrumTypeElem = $("#overdrawSpectrumTypeSelect");

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

    let getSize = function () {
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
      let newSize = getSize();

      // Determine the analyserCanvas location
      GraphSpectrumPlot.setSize(newSize.width, newSize.height);

      // Recenter the analyser canvas in the bottom left corner
      let parentElem = $(analyserCanvas).parent();

      $(parentElem).css({
        left: newSize.left, // (canvas.width  * getSize().left) + "px",
        top: newSize.top, // (canvas.height * getSize().top ) + "px"
      });
      // place the sliders.
      $("input:first-of-type", parentElem).css({
        left: `${newSize.width - 130}px`,
      });
      $("input:last-of-type", parentElem).css({
        left: `${newSize.width - 20}px`,
      });
      $("#analyserResize", parentElem).css({
        left: `${newSize.width - 20}px`,
      });
    };

    const dataLoad = function () {
      GraphSpectrumCalc.setDataBuffer(that.dataBuffer);
      switch (userSettings.spectrumType) {
        case SPECTRUM_TYPE.FREQ_VS_THROTTLE:
          fftData = GraphSpectrumCalc.dataLoadFrequencyVsThrottle();
          break;

        case SPECTRUM_TYPE.FREQ_VS_RPM:
          fftData = GraphSpectrumCalc.dataLoadFrequencyVsRpm();
          break;

        case SPECTRUM_TYPE.PIDERROR_VS_SETPOINT:
          fftData = GraphSpectrumCalc.dataLoadPidErrorVsSetpoint();
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
      // Store the data pointers

      that.dataBuffer.fieldIndex = fieldIndex;
      that.dataBuffer.curve = curve;
      that.dataBuffer.fieldName = fieldName;
      // Detect change of selected field.... reload and redraw required.
      if (fftData == null || fieldIndex != fftData.fieldIndex || dataReload) {
        dataReload = false;
        dataLoad();
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
        })
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
          that.refresh();
        })
      )
      .dblclick(function () {
        $(this).val(DEFAULT_ZOOM).trigger("input");
      })
      .val(DEFAULT_ZOOM);

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
          that.plotSpectrum(
            that.dataBuffer.fieldIndex,
            that.dataBuffer.curve,
            that.dataBuffer.fieldName,
          );
        }

        // Hide overdraw and zoomY if needed
        const pidErrorVsSetpointSelected =
          optionSelected === SPECTRUM_TYPE.PIDERROR_VS_SETPOINT;
        overdrawSpectrumTypeElem.toggle(!pidErrorVsSetpointSelected);
        analyserZoomYElem.toggleClass(
          "onlyFullScreenException",
          pidErrorVsSetpointSelected
        );

        $("#spectrumComparison").css("visibility", (optionSelected == 0 ? "visible" : "hidden"));
      })
      .change();

    // Spectrum overdraw to show
    userSettings.overdrawSpectrumType =
      userSettings.overdrawSpectrumType || SPECTRUM_OVERDRAW_TYPE.ALL_FILTERS;
    overdrawSpectrumTypeElem.val(userSettings.overdrawSpectrumType);
    GraphSpectrumPlot.setOverdraw(userSettings.overdrawSpectrumType);

    overdrawSpectrumTypeElem.change(function () {
      let optionSelected = parseInt(overdrawSpectrumTypeElem.val(), 10);

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

        let rect = analyserCanvas.getBoundingClientRect();
        let mouseX = e.clientX - rect.left;
        let mouseY = e.clientY - rect.top;
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
      const maxImportCount = 5;
      let importsLeft = maxImportCount - GraphSpectrumPlot.getImportedSpectrumCount();

      for (const file of files) {
        if (importsLeft-- == 0) {
          break;
        }
        const reader = new FileReader();
        reader.onload = function (e) {
          try {
            const stringRows = e.target.result.split("\n");

            const header = stringRows[0].split(",");
            if (header.length != 2 || header[0] != "freq" || header[1] != "value") {
              throw new SyntaxError("Wrong spectrum CSV data format");
            }

            stringRows.shift();
            const spectrumData = stringRows.map( function(row) {
              const data = row.split(",");
              return {
                freq: parseFloat(data[0]),
                value: parseFloat(data[1]),
              };
            });

            GraphSpectrumPlot.addImportedSpectrumData(spectrumData, file.name);
          } catch (e) {
            alert('Spectrum data import error: ' + e.message);
            return;
          }
        };

        reader.readAsText(file);
      }
    };

  } catch (e) {
    console.log(`Failed to create analyser... error: ${e}`);
  }

  this.clearImportedSpectrums = function() {
    GraphSpectrumPlot.clearImportedSpectrums();
  };
}

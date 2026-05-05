import "./vendor.js";

import { throttle } from "throttle-debounce";
import { MapGrapher } from "./graph_map.js";
import { FlightLogGrapher } from "./grapher.js";

import { defaultUserSettings } from "./user_settings_data.js";
import { SimpleStats } from "./simple-stats.js";
import { Configuration, ConfigurationDefaults } from "./configuration.js";
import { GraphConfig } from "./graph_config.js";
import { SeekBar } from "./seekbar.js";
import { GpxExporter } from "./gpx-exporter.js";
import { CsvExporter } from "./csv-exporter.js";
import ctzsnoozeWorkspace from "./ws_ctzsnooze.json";
import supaflyWorkspace from "./ws_supafly.json";
import { GraphLegend } from "./graph_legend.js";
import { FlightLog } from "./flightlog.js";
import { FlightLogParser } from "./flightlog_parser.js";
import { FlightLogFieldPresenter } from "./flightlog_fields_presenter.js";
import {
  formatTime,
  stringLoopTime,
  stringTimetoMsec,
  constrain,
  validate,
  mouseNotification,
  getManifestVersion,
} from "./tools.js";
import { PrefStorage } from "./pref_storage.js";
import { makeScreenshot } from "./screenshot.js";
import { DarkTheme } from "./dark_theme.js";
import { ThemeColors } from "./theme_colors.js";
import pinia from "./pinia_instance.js";
import { useLogStore } from "./stores/log.js";
import { useGraphStore } from "./stores/graph.js";
import { usePlaybackStore } from "./stores/playback.js";
import { useWorkspaceStore } from "./stores/workspace.js";
import { useAppStore } from "./stores/app.js";

// TODO: this is a hack, once we move to web fix this
globalThis.userSettings = null;

// these values set the initial dimensions of a secondary window
// which always opens at the centre of the user's screen
const NEW_WINDOW_WIDTH = 1000;
const NEW_WINDOW_HEIGHT = 760;

// these values set the minimum resize dimensions of a secondary window
// minimum resize dimensions of the initial window are set in package.json
const INNER_BOUNDS_WIDTH = 930;
const INNER_BOUNDS_HEIGHT = 480;

const INITIAL_APP_PAGE = "index.html";

function BlackboxLogViewer() {
  function supportsRequiredAPIs() {
    return (
      globalThis.File &&
      globalThis.FileReader &&
      globalThis.FileList &&
      !!document.createElement("canvas").getContext
    );
  }

  if (!supportsRequiredAPIs()) {
    alert(
      "Your browser does not support the APIs required for reading log files.",
    );
  }

  let GRAPH_STATE_PAUSED = 0,
    GRAPH_STATE_PLAY = 1,
    SMALL_JUMP_TIME = 100 * 1000,
    PLAYBACK_MIN_RATE = 10,
    PLAYBACK_MAX_RATE = 300,
    PLAYBACK_DEFAULT_RATE = 100,
    GRAPH_MIN_ZOOM = 1,
    GRAPH_MAX_ZOOM = 1000,
    GRAPH_DEFAULT_ZOOM = 100;

  let graphState = GRAPH_STATE_PAUSED,
    currentBlackboxTime = 0,
    lastRenderTime = false,
    flightLog,
    flightLogDataArray,
    graph = null,
    prefs = new PrefStorage(),
    configuration = null, // is their an associated dump file ?
    configurationDefaults = new ConfigurationDefaults(prefs), // configuration defaults
    // User's video render config:
    videoConfig = {},
    // JSON graph configuration:
    graphConfig = null,
    offsetCache = [], // Storage for the offset cache (last 20 files)
    currentOffsetCache = { log: null, index: null, video: null, offset: null },
    // JSON array of graph configurations for New Workspaces feature
    lastGraphConfig = null, // Undo feature - go back to last configuration.
    workspaceGraphConfigs = [], // Workspaces
    activeWorkspace = 1, // Active Workspace
    bookmarkTimes = [], // Empty array for bookmarks (times)
    // Graph configuration which is currently in use, customised based on the current flight log from graphConfig
    activeGraphConfig = new GraphConfig(),
    graphLegend = null,
    fieldPresenter = FlightLogFieldPresenter,
    hasVideo = false,
    hasLog = false,
    hasMarker = false, // add measure feature
    hasTable = true,
    hasAnalyser,
    hasMap,
    hasAnalyserFullscreen,
    hasAnalyserSticks = false,
    viewVideo = true,
    hasTableOverlay = false,
    hadTable,
    hasConfig = false,
    hasConfigOverlay = false,
    isFullscreen = false, // New fullscreen feature (to hide table)
    video = document.querySelector(".log-graph video"),
    canvas = document.getElementById("graphCanvas"),
    analyserCanvas = document.getElementById("analyserCanvas"),
    stickCanvas = document.getElementById("stickCanvas"),
    craftCanvas = document.getElementById("craftCanvas"),
    html = document.documentElement,
    videoURL = false,
    videoOffset = 0.0,
    videoExportInTime = false,
    videoExportOutTime = false,
    markerTime = 0, // New marker time
    graphRendersCount = 0,
    seekBarCanvas = document.querySelector(".log-seek-bar canvas"),
    seekBar = new SeekBar(seekBarCanvas),
    seekBarRepaintRateLimited = throttle(200, seekBar.repaint.bind(seekBar)),
    seekBarMode = "avgThrottle",
    updateValuesChartRateLimited,
    animationFrameIsQueued = false,
    playbackRate = PLAYBACK_DEFAULT_RATE,
    graphZoom = GRAPH_DEFAULT_ZOOM,
    lastGraphZoom = GRAPH_DEFAULT_ZOOM, // QuickZoom function.
    mapGrapher = new MapGrapher();

  // --- Pinia store sync ---
  // Initialize stores outside Vue component context using the shared Pinia instance.
  // Legacy code remains the driver; we push state changes into stores so Vue components
  // can reactively consume them.
  const logStore = useLogStore(pinia);
  const graphStore = useGraphStore(pinia);
  const playbackStore = usePlaybackStore(pinia);
  const workspaceStore = useWorkspaceStore(pinia);
  const appStore = useAppStore(pinia);

  function syncToStores() {
    // Log
    logStore.flightLog = flightLog ?? null;
    logStore.flightLogDataArray = flightLogDataArray ?? null;
    logStore.currentBlackboxTime = currentBlackboxTime;
    logStore.hasLog = hasLog;
    logStore.hasVideo = hasVideo;
    logStore.videoURL = videoURL;

    // Graph
    graphStore.graphZoom = graphZoom;
    graphStore.lastGraphZoom = lastGraphZoom;
    graphStore.hasTable = hasTable;
    graphStore.hasTableOverlay = hasTableOverlay;
    graphStore.hasAnalyser = !!hasAnalyser;
    graphStore.hasAnalyserFullscreen = !!hasAnalyserFullscreen;
    graphStore.hasAnalyserSticks = !!hasAnalyserSticks;
    graphStore.hasMap = !!hasMap;
    graphStore.hasMarker = hasMarker;
    graphStore.hasConfig = hasConfig;
    graphStore.hasConfigOverlay = hasConfigOverlay;
    graphStore.isFullscreen = isFullscreen;
    graphStore.markerTime = markerTime;
    graphStore.seekBarMode = seekBarMode;

    // Playback
    playbackStore.graphState = graphState;
    playbackStore.playbackRate = playbackRate;
    playbackStore.videoOffset = videoOffset;
    playbackStore.videoExportInTime = videoExportInTime;
    playbackStore.videoExportOutTime = videoExportOutTime;

    // Workspace
    workspaceStore.activeWorkspace = activeWorkspace;
    workspaceStore.workspaceGraphConfigs = workspaceGraphConfigs || [];
    workspaceStore.bookmarkTimes = [...bookmarkTimes];

    // App
    appStore.viewVideo = viewVideo;
  }

  // TODO: Figure out if we can open the same file in a new window
  function createNewBlackboxWindow(fileToOpen) {
    globalThis.open(globalThis.location.href, "_blank").focus();
  }

  function blackboxTimeFromVideoTime() {
    return (video.currentTime - videoOffset) * 1000000 + flightLog.getMinTime();
  }

  function syncLogToVideo() {
    if (hasLog) {
      currentBlackboxTime = blackboxTimeFromVideoTime();
    }
  }

  function setVideoOffset(offset, withRefresh) {
    // optionally prevent the graph refresh until later
    videoOffset = offset;

    /*
     * Round to 2 dec places for display and put a plus at the start for positive values to emphasize the fact it's
     * an offset
     */
    const videoOffsetDisplay =
      (videoOffset >= 0 ? "+" : "") +
      (videoOffset.toFixed(3) != videoOffset
        ? videoOffset.toFixed(3)
        : videoOffset);
    appStore.videoOffsetDisplay = videoOffsetDisplay;

    playbackStore.videoOffset = videoOffset;
    if (withRefresh) {
      invalidateGraph();
    }
  }

  function isInteger(value) {
    return (value | 0) == value || Math.trunc(value) == value;
  }

  function atMost2DecPlaces(value) {
    if (isInteger(value)) return value; //it's an integer already

    if (value === null) {
      return "(absent)";
    }

    return value.toFixed(2);
  }

  function updateValuesChart() {
    let table = document.querySelector(".log-field-values table"),
      tbody = table.querySelector("tbody"),
      i,
      frame = flightLog.getSmoothedFrameAtTime(currentBlackboxTime),
      fieldNames = flightLog.getMainFieldNames();

    tbody.innerHTML = "";

    if (frame) {
      let currentFlightMode =
        frame[flightLog.getMainFieldIndexByName("flightModeFlags")];

      if (hasTable || hasTableOverlay) {
        // Only redraw the table if it is enabled

        let rows = [],
          rowCount = Math.ceil(fieldNames.length / 2);

        for (i = 0; i < rowCount; i++) {
          let row =
              `<tr>` +
              `<td>${fieldPresenter.fieldNameToFriendly(
                fieldNames[i],
                flightLog.getSysConfig().debug_mode,
              )}</td>` +
              `<td class="raw-value">${atMost2DecPlaces(frame[i])}</td>` +
              `<td>${fieldPresenter.decodeFieldToFriendly(
                flightLog,
                fieldNames[i],
                frame[i],
                currentFlightMode,
              )}</td>`,
            secondColumn = i + rowCount;

          if (secondColumn < fieldNames.length) {
            row +=
              `<td>${fieldPresenter.fieldNameToFriendly(
                fieldNames[secondColumn],
                flightLog.getSysConfig().debug_mode,
              )}</td>` +
              `<td>${atMost2DecPlaces(frame[secondColumn])}</td>` +
              `<td>${fieldPresenter.decodeFieldToFriendly(
                flightLog,
                fieldNames[secondColumn],
                frame[secondColumn],
                currentFlightMode,
              )}</td>`;
          }

          row += "</tr>";

          rows.push(row);
        }

        tbody.insertAdjacentHTML("beforeend", rows.join(""));

        const statRows = [];
        const statsTable = document.querySelector(
          ".log-field-values #stats-table",
        );
        const statsTbody = statsTable.querySelector("tbody");
        statsTbody.innerHTML = "";
        const stats = SimpleStats(flightLog).calculate();
        for (const field of Object.keys(stats)) {
          const stat = stats[field];
          if (stat === undefined) {
            continue;
          }
          const name = fieldPresenter.fieldNameToFriendly(
            stat.name,
            flightLog.getSysConfig().debug_mode,
          );
          const minRaw = atMost2DecPlaces(stat.min);
          const minVal = FlightLogFieldPresenter.decodeFieldToFriendly(
            flightLog,
            stat.name,
            stat.min,
          );
          const maxRaw = atMost2DecPlaces(stat.max);
          const maxVal = FlightLogFieldPresenter.decodeFieldToFriendly(
            flightLog,
            stat.name,
            stat.max,
          );
          const meanRaw = atMost2DecPlaces(stat.mean);
          const meanVal = FlightLogFieldPresenter.decodeFieldToFriendly(
            flightLog,
            stat.name,
            stat.mean,
          );
          statRows.push(
            `<tr><td>${name}</td><td>${minVal} (${minRaw})</td><td>${maxVal} (${maxRaw})</td><td>${meanVal} (${meanRaw})</td></tr>`,
          );
        }
        statsTbody.insertAdjacentHTML("beforeend", statRows.join(""));
      }

      // Update flight mode flags on status bar
      const flightModeText = fieldPresenter.decodeFieldToFriendly(
        null,
        "flightModeFlags",
        currentFlightMode,
        null,
      );
      appStore.statusFlightMode = flightModeText;

      // update time field
      const graphTimeText = formatTime(
        (currentBlackboxTime - flightLog.getMinTime()) / 1000,
        true,
      );
      appStore.graphTimeDisplay = graphTimeText;
      if (hasMarker) {
        const markerText = `Marker Offset ${formatTime(
          (currentBlackboxTime - markerTime) / 1000,
          true,
        )}ms ${(1000000 / (currentBlackboxTime - markerTime)).toFixed(0)}Hz`;
        appStore.statusMarkerOffset = markerText;
      }

      // Update the Legend Values
      if (graphLegend) {
        graphLegend.updateValues(flightLog, frame);
      }
    }
  }

  updateValuesChartRateLimited = throttle(250, updateValuesChart);

  function animationLoop() {
    let now = Date.now();

    if (!graph) {
      animationFrameIsQueued = false;
      return;
    }

    if (hasVideo) {
      currentBlackboxTime = blackboxTimeFromVideoTime();
    } else if (graphState == GRAPH_STATE_PLAY) {
      let delta;

      if (lastRenderTime === false) {
        delta = 0;
      } else {
        delta = Math.floor(
          ((now - lastRenderTime) * 1000 * playbackRate) / 100,
        );
      }

      currentBlackboxTime += delta;

      if (currentBlackboxTime > flightLog.getMaxTime()) {
        currentBlackboxTime = flightLog.getMaxTime();
        setGraphState(GRAPH_STATE_PAUSED);
      }
    }

    graph.render(currentBlackboxTime);
    graphRendersCount++;

    seekBar.setCurrentTime(currentBlackboxTime);
    seekBar.setWindow(graph.getWindowWidthTime());

    if (flightLog.hasGpsData()) {
      mapGrapher.setCurrentTime(currentBlackboxTime);
    }

    updateValuesChartRateLimited();

    if (graphState == GRAPH_STATE_PLAY) {
      lastRenderTime = now;

      seekBarRepaintRateLimited();

      animationFrameIsQueued = true;
      requestAnimationFrame(animationLoop);
    } else {
      seekBar.repaint();

      animationFrameIsQueued = false;
    }
  }

  function invalidateGraph() {
    syncToStores();
    if (!animationFrameIsQueued) {
      animationFrameIsQueued = true;
      requestAnimationFrame(animationLoop);
    }
  }

  function updateCanvasSize() {
    const width = canvas.clientWidth,
      height = canvas.clientHeight;

    if (graph) {
      graph.resize(width, height);
      seekBar.resize(canvas.offsetWidth, 50);
      if (flightLog.hasGpsData()) {
        mapGrapher.resize(width, height);
      }

      invalidateGraph();
    }
  }

  function renderSeekBarPicker() {
    const seekBarContainer = document.querySelector(".seekBar-selection"),
      seekBarItems = [
        ["avgThrottle", "Average motor throttle"],
        ["maxRC", "Maximum stick input"],
        ["maxMotorDiff", "Maximum motor differential"],
      ];
    seekBarContainer.innerHTML = "";
    const seekBarPicker = document.createElement("select");
    seekBarPicker.id = "seekbarTypeSelect";
    seekBarPicker.className = "seekbarTypeSelect";
    seekBarPicker.addEventListener("change", function () {
      const activity = flightLog.getActivitySummary(),
        displayItem = this.value;
      seekBarMode = displayItem;
      seekBar.setActivity(
        activity.times,
        activity[displayItem],
        activity.hasEvent,
      );
      seekBar.repaint();
    });
    for (const item of seekBarItems) {
      const option = document.createElement("option");
      option.textContent = item[1];
      option.value = item[0];
      seekBarPicker.appendChild(option);
    }
    seekBarContainer.appendChild(seekBarPicker);
  }

  function renderLogFileInfo(file) {
    appStore.logFilename = file.name;

    const logIndexContainer = document.querySelector(".log-index"),
      logCount = flightLog.getLogCount();

    logIndexContainer.innerHTML = "";

    const logIndexPicker = document.createElement("select");
    logIndexPicker.className = "log-index no-wheel";
    if (logCount > 1) {
      logIndexPicker.addEventListener("change", function () {
        selectLog(Number.parseInt(this.value, 10));
        if (graph) {
          html.classList.toggle(
            "has-analyser-fullscreen",
            hasAnalyserFullscreen,
          );
          graph.setAnalyser(hasAnalyserFullscreen);
        }
      });
    }

    for (let index = 0; index < logCount; index++) {
      let logLabel;
      const error = flightLog.getLogError(index);

      if (error) {
        logLabel = error;
      } else {
        logLabel = `${formatTime(
          flightLog.getMinTime(index) / 1000,
          false,
        )} - ${formatTime(
          flightLog.getMaxTime(index) / 1000,
          false,
        )} [${formatTime(
          Math.ceil(
            (flightLog.getMaxTime(index) - flightLog.getMinTime(index)) / 1000,
          ),
          false,
        )}]`;
      }

      if (logCount > 1) {
        const option = document.createElement("option");
        option.textContent = `${index + 1}/${flightLog.getLogCount()}: ${logLabel}`;
        option.value = index;
        if (error) {
          option.disabled = true;
        }
        logIndexPicker.appendChild(option);
      } else {
        const holder = document.createElement("div");
        holder.className = "log-index-static no-wheel";
        holder.textContent = logLabel;
        logIndexContainer.appendChild(holder);
      }
    }

    if (logCount > 1) {
      logIndexPicker.value = 0;
      logIndexContainer.appendChild(logIndexPicker);
    }
  }

  /**
   * Update the metadata displays to show information about the currently selected log index.
   */
  function renderSelectedLogInfo() {
    const logIndexSelect = document.querySelector(
      ".log-index select, select.log-index",
    );
    if (logIndexSelect) {
      logIndexSelect.value = flightLog.getLogIndex();
    }

    if (flightLog.getNumCellsEstimate()) {
      const cellsText = `${flightLog.getNumCellsEstimate()}S (${Number(
        flightLog.getReferenceVoltageMillivolts() / 1000,
      ).toFixed(2)}V)`;
      document
        .querySelectorAll(".log-cells")
        .forEach((el) => (el.textContent = cellsText));
      document
        .querySelectorAll(".log-cells-header,.log-cells")
        .forEach((el) => (el.style.display = "block"));
      appStore.statusCells = cellsText;
    } else {
      document
        .querySelectorAll(".log-cells-header,.log-cells")
        .forEach((el) => (el.style.display = "none"));
      appStore.statusCells = "";
    }

    // Add log version information to status bar
    const sysConfig = flightLog.getSysConfig();

    const versionText =
      (sysConfig["Craft name"] != null && sysConfig["Craft name"].length
        ? `${sysConfig["Craft name"]} : `
        : "") +
      (sysConfig["Firmware revision"] != null
        ? `${sysConfig["Firmware revision"]}`
        : "") +
      (sysConfig.deviceUID == null ? "" : ` (${sysConfig.deviceUID})`);
    appStore.statusVersion = versionText;

    const looptimeText = stringLoopTime(
      sysConfig.looptime,
      sysConfig.pid_process_denom,
      sysConfig.unsynced_fast_pwm,
      sysConfig.motor_pwm_rate,
    );
    appStore.statusLooptime = looptimeText;

    const lograteText =
      sysConfig["frameIntervalPDenom"] != null &&
      sysConfig["frameIntervalPNum"] != null
        ? `Sample Rate : ${sysConfig["frameIntervalPNum"]}/${sysConfig["frameIntervalPDenom"]}`
        : "";
    appStore.statusLograte = lograteText;

    seekBar.setTimeRange(
      flightLog.getMinTime(),
      flightLog.getMaxTime(),
      currentBlackboxTime,
    );
    seekBar.setActivityRange(
      flightLog.getSysConfig().motorOutput[0],
      flightLog.getSysConfig().motorOutput[1],
    );

    const activity = flightLog.getActivitySummary();

    seekBar.setActivity(
      activity.times,
      activity[seekBarMode],
      activity.hasEvent,
    );
    seekBar.repaint();

    // Add flightLog to map
    html.classList.toggle("has-gps", flightLog.hasGpsData());
    if (flightLog.hasGpsData()) {
      mapGrapher.setUserSettings(userSettings);
      mapGrapher.setFlightLog(flightLog);
    }
  }

  function setGraphState(newState) {
    graphState = newState;

    lastRenderTime = false;

    switch (newState) {
      case GRAPH_STATE_PLAY:
        if (hasVideo) {
          video.play();
        }
        break;
      case GRAPH_STATE_PAUSED:
        if (hasVideo) {
          video.pause();
        }
        break;
    }

    syncToStores();
    invalidateGraph();
  }

  function setCurrentBlackboxTime(newTime) {
    if (hasVideo) {
      video.currentTime =
        (newTime - flightLog.getMinTime()) / 1000000 + videoOffset;

      syncLogToVideo();
    } else {
      currentBlackboxTime = newTime;
    }

    logStore.currentBlackboxTime = currentBlackboxTime;
    invalidateGraph();
  }

  function setVideoTime(newTime) {
    video.currentTime = newTime;

    syncLogToVideo();
  }

  function setVideoInTime(inTime) {
    videoExportInTime = inTime;

    if (seekBar) {
      seekBar.setInTime(videoExportInTime);
    }

    if (graph) {
      graph.setInTime(videoExportInTime);
      invalidateGraph();
    }
  }

  function setVideoOutTime(outTime) {
    videoExportOutTime = outTime;

    if (seekBar) {
      seekBar.setOutTime(videoExportOutTime);
    }

    if (graph) {
      graph.setOutTime(videoExportOutTime);
      invalidateGraph();
    }
  }

  function setPlaybackRate(rate, updateUi) {
    if (rate >= PLAYBACK_MIN_RATE && rate <= PLAYBACK_MAX_RATE) {
      playbackRate = rate;

      if (video) {
        video.playbackRate = rate / 100;
      }
    }

    playbackStore.playbackRate = playbackRate;
  }

  function setGraphZoom(zoom, updateUi) {
    if (zoom == null) {
      // go back to last zoom value
      zoom = lastGraphZoom;
    }
    if (zoom >= GRAPH_MIN_ZOOM && zoom <= GRAPH_MAX_ZOOM) {
      lastGraphZoom = graphZoom;
      graphZoom = zoom;

      if (graph) {
        graph.setGraphZoom(zoom / 100);
        invalidateGraph();
      }
    }

    graphStore.graphZoom = graphZoom;
    graphStore.lastGraphZoom = lastGraphZoom;
  }

  function showConfigFile(state) {
    if (hasConfig) {
      if (state == null) {
        // no state specified, just toggle
        hasConfigOverlay = !hasConfigOverlay;
      } else {
        //state defined, just set item
        hasConfigOverlay = state ? true : false;
      }
      html.classList.toggle("has-config-overlay", hasConfigOverlay);
    }
  }

  function showValueTable(state) {
    if (state == null) {
      // no state specified, just toggle
      hasTableOverlay = !hasTableOverlay;
    } else {
      //state defined, just set item
      hasTableOverlay = state ? true : false;
    }
    html.classList.toggle("has-table-overlay", hasTableOverlay);
    updateValuesChart();
  }

  /**
   * Set the index of the log from the log file that should be viewed. Pass "null" as the index to open the first
   * available log.
   */
  function selectLog(logIndex) {
    let success = false;

    try {
      if (logIndex === null) {
        for (let i = 0; i < flightLog.getLogCount(); i++) {
          if (flightLog.openLog(i)) {
            success = true;
            currentOffsetCache.index = i;
            break;
          }
        }

        if (!success) {
          throw "No logs in this file could be parsed successfully";
        }
      } else {
        flightLog.openLog(logIndex);
        currentOffsetCache.index = logIndex;
      }
    } catch (e) {
      alert(`Error opening log: ${e}`);
      currentOffsetCache.index = null;
      return;
    }

    if (graph) {
      graph.destroy();
    }

    if (
      flightLog.getSysConfig().looptime != null &&
      flightLog.getSysConfig().frameIntervalPNum != null &&
      flightLog.getSysConfig().frameIntervalPDenom != null
    ) {
      userSettings.analyserSampleRate =
        1000000 /
        ((flightLog.getSysConfig().looptime *
          validate(flightLog.getSysConfig().pid_process_denom, 1) *
          flightLog.getSysConfig().frameIntervalPDenom) /
          flightLog.getSysConfig().frameIntervalPNum);
    }

    graph = new FlightLogGrapher(
      flightLog,
      activeGraphConfig,
      canvas,
      stickCanvas,
      craftCanvas,
      analyserCanvas,
      userSettings,
    );

    setVideoInTime(false);
    setVideoOutTime(false);

    activeGraphConfig.adaptGraphs(flightLog, graphConfig);

    graph.onSeek = function (offset) {
      //Seek faster
      offset *= 2;

      if (hasVideo) {
        setVideoTime(video.currentTime + offset / 1000000);
      } else {
        setCurrentBlackboxTime(currentBlackboxTime + offset);
      }
      invalidateGraph();
    };

    if (hasVideo) {
      syncLogToVideo();
    } else {
      // Start at beginning:
      currentBlackboxTime = flightLog.getMinTime();
    }

    renderSelectedLogInfo();

    updateCanvasSize();

    setGraphState(GRAPH_STATE_PAUSED);
    setGraphZoom(graphZoom, true);
    syncToStores();
  }

  function loadFileMessage(fileName) {
    const loadingEl = document.getElementById("loading-file-text");
    if (loadingEl) {
      loadingEl.textContent = `Trying to load file ${fileName}...`;
      loadingEl.style.display = "";
    }
  }

  function loadFiles(files) {
    for (const file of files) {
      let isLog = file.name.match(/\.(BBL|TXT|CFL|BFL|LOG)$/i),
        isVideo = file.name.match(/\.(AVI|MOV|MP4|MPEG)$/i),
        isWorkspaces = file.name.match(/\.(JSON)$/i);

      loadFileMessage(file.name);

      if (!isLog && !isVideo && !isWorkspaces) {
        if (file.size < 10 * 1024 * 1024)
          isLog = true; //Assume small files are logs rather than videos
        else isVideo = true;
      }

      if (isLog) {
        loadLogFile(file);
      } else if (isVideo) {
        loadVideo(file);
      } else if (isWorkspaces) {
        loadWorkspaces(file);
      }
    }

    // finally, see if there is an offsetCache value already, and auto set the offset
    for (const cahesOffset of offsetCache) {
      if (
        currentOffsetCache.log == cahesOffset.log &&
        currentOffsetCache.index == cahesOffset.index &&
        currentOffsetCache.video == cahesOffset.video
      ) {
        setVideoOffset(cahesOffset.offset, true);
      }
    }
  }

  function loadLogFile(file) {
    const reader = new FileReader();

    reader.onload = function (e) {
      const bytes = e.target.result;

      const fileContents = String.fromCharCode.apply(
        null,
        new Uint8Array(bytes, 0, 100),
      );

      if (fileContents.match(/# dump|# diff/i)) {
        // this is actually a configuration file
        try {
          // Firstly, is this a configuration defaults file
          // (the filename contains the word 'default')

          if (file.name.match(/default/i)) {
            configurationDefaults.loadFile(file);
          } else {
            configuration = new Configuration(
              file,
              configurationDefaults,
              showConfigFile,
            ); // the configuration class will actually re-open the file as a text object.
            hasConfig = true;
            html.classList.toggle("has-config", hasConfig);
          }
        } catch (e) {
          configuration = null;
          hasConfig = false;
        }
        return;
      }

      flightLogDataArray = new Uint8Array(bytes);

      try {
        flightLog = new FlightLog(flightLogDataArray);
      } catch (err) {
        alert(
          `Sorry, an error occurred while trying to open this log:\n\n${err}`,
        );
        return;
      }

      if (!graphConfig) {
        graphConfig = GraphConfig.getExampleGraphConfigs(flightLog, [
          "Motors",
          "Gyros",
        ]);
      }

      renderLogFileInfo(file);
      renderSeekBarPicker();
      currentOffsetCache.log = file.name; // store the name of the loaded log file
      currentOffsetCache.index = null; // and clear the index

      hasLog = true;
      logStore.hasLog = true;
      html.classList.toggle("has-log", hasLog);
      html.classList.toggle("has-table", hasTable);
      html.classList.toggle("has-craft", userSettings.drawCraft);
      html.classList.toggle("has-sticks", userSettings.drawSticks);
      html.classList.toggle(
        "has-expo-override",
        userSettings.graphExpoOverride,
      );
      html.classList.toggle(
        "has-smoothing-override",
        userSettings.graphSmoothOverride,
      );
      html.classList.toggle(
        "has-grid-override",
        userSettings.graphSmoothOverride,
      );

      setTimeout(function () {
        globalThis.dispatchEvent(new Event("resize"));
      }, 500); // refresh the window size;

      selectLog(null);

      if (graph) {
        html.classList.toggle("has-analyser-fullscreen", hasAnalyserFullscreen);
        graph.setAnalyser(hasAnalyserFullscreen);
      }
    };

    reader.readAsArrayBuffer(file);
  }

  function loadVideo(file) {
    currentOffsetCache.video = file.name; // store the name of the loaded video
    if (videoURL) {
      URL.revokeObjectURL(videoURL);
      videoURL = false;
    }

    if (!URL.createObjectURL) {
      alert(
        "Sorry, your web browser doesn't support showing videos from your local computer.",
      );
      currentOffsetCache.video = null; // clear the associated video name
      return;
    }

    videoURL = URL.createObjectURL(file);
    video.volume = 1.0;
    video.src = videoURL;

    // Reapply the last playbackRate to the new video
    setPlaybackRate(playbackRate, true);
  }

  function videoLoaded(e) {
    hasVideo = true;
    html.classList.toggle("has-video", hasVideo);

    syncToStores();
    setGraphState(GRAPH_STATE_PAUSED);
    invalidateGraph();
  }

  function reportVideoError(e) {
    let errorMessage = "Error while loading the video.";
    if (e.currentTarget.error.code) {
      errorMessage += ` ERROR (${e.currentTarget.error.code}): ${e.currentTarget.error.message}`;
    }
    alert(errorMessage);
  }

  function onLegendVisbilityChange(hidden) {
    prefs.set("log-legend-hidden", hidden);
    updateCanvasSize();
  }

  function onLegendSelectionChange(toggleAnalizer, ctrlKey) {
    const lockAnalyserHide = ctrlKey || graph.hasMultiSpectrumAnalyser();
    if (toggleAnalizer) {
      if (lockAnalyserHide) {
        hasAnalyser = true; // Do not hide analyser when ctrlKey is pressed or it has many spectrums
      } else {
        hasAnalyser = !hasAnalyser; // Toggle the analyser state
      }
    } else {
      hasAnalyser = true; // Default to true when toggleAnalizer is false
    }
    graph.setDrawAnalyser(hasAnalyser, ctrlKey);
    html.classList.toggle("has-analyser", hasAnalyser);
    prefs.set("hasAnalyser", hasAnalyser);
    invalidateGraph();
  }

  function onLegendHighlightChange() {
    invalidateGraph();
  }

  function setMarker(state) {
    // update marker field
    hasMarker = state;
    html.classList.toggle("has-marker", state);
  }

  function setFullscreen(state) {
    // update fullscreen status
    isFullscreen = state;
    html.classList.toggle("is-fullscreen", state);
  }

  this.getMarker = function () {
    // get marker field
    return {
      state: hasMarker,
      time: markerTime,
    };
  };

  this.getBookmarks = function () {
    // get bookmark events
    const bookmarks = [];
    try {
      if (bookmarkTimes != null) {
        for (let i = 0; i <= 9; i++) {
          if (bookmarkTimes[i] != null) {
            bookmarks[i] = {
              state: bookmarkTimes[i] != 0,
              time: bookmarkTimes[i],
            };
          } else bookmarks[i] = null;
        }
      }
      return bookmarks;
    } catch (e) {
      return null;
    }
  };

  this.getBookmarkTimes = function () {
    return bookmarkTimes;
  };

  this.refreshGraph = function () {
    // Called when the theme changes to refresh canvas colors
    if (graph !== null) {
      ThemeColors.clearCache();
      graph.refreshTheme();
      invalidateGraph();
    }
    if (seekBar !== null && typeof seekBar.refreshTheme === "function") {
      seekBar.refreshTheme();
    }
  };

  // Workspace save/restore to/from file.
  function saveWorkspaces(file) {
    let data; // Data to save

    if (!workspaceGraphConfigs) {
      return null;
    } // No workspaces to save
    if (!file) {
      file = "workspaces.json";
    } // No filename to save to, make one up

    if (typeof workspaceGraphConfigs === "object") {
      data = JSON.stringify(workspaceGraphConfigs, undefined, 4);
    }

    const blob = new Blob([data], { type: "text/json" }),
      e = document.createEvent("MouseEvents"),
      a = document.createElement("a");

    a.download = file;
    a.href = globalThis.URL.createObjectURL(blob);
    a.dataset.downloadurl = ["text/json", a.download, a.href].join(":");
    e.initMouseEvent(
      "click",
      true,
      false,
      globalThis,
      0,
      0,
      0,
      0,
      0,
      false,
      false,
      false,
      false,
      0,
      null,
    );
    a.dispatchEvent(e);
  }

  function upgradeWorkspaceFormat(oldFormat) {
    // Check if upgrade is needed
    if (!oldFormat.graphConfig) {
      return oldFormat;
    }

    const newFormat = [];

    oldFormat.graphConfig.forEach((element, id) => {
      if (element) {
        let title = "Unnamed";
        if (element.length > 0) {
          title = element[0].label;
        }

        newFormat[id] = {
          title: title,
          graphConfig: element,
        };
      } else {
        newFormat[id] = null;
      }
    });

    return newFormat;
  }

  function loadWorkspaces(file) {
    const reader = new FileReader();

    reader.onload = function (e) {
      const data = e.target.result;
      let tmp = JSON.parse(data);
      if (tmp.graphConfig) {
        globalThis.alert("Old Workspace format. Upgrading...");
        tmp = upgradeWorkspaceFormat(tmp);
      }
      workspaceGraphConfigs = tmp;
      onSwitchWorkspace(workspaceGraphConfigs, 1);
      globalThis.alert("Workspaces Loaded");
    };

    reader.readAsText(file);
  }

  function createExportCallback(fileExtension, fileType, file, startTime) {
    const callback = function (data) {
      console.debug(
        `${fileExtension.toUpperCase()} export finished in ${
          (performance.now() - startTime) / 1000
        } secs`,
      );
      if (!data) {
        console.debug("Empty data, nothing to save");
        return;
      }
      const blob = new Blob([data], { type: fileType }),
        e = document.createEvent("MouseEvents"),
        a = document.createElement("a");
      a.download = file || `${appStore.logFilename}.${fileExtension}`;
      a.href = globalThis.URL.createObjectURL(blob);
      a.dataset.downloadurl = [fileType, a.download, a.href].join(":");
      e.initMouseEvent(
        "click",
        true,
        false,
        globalThis,
        0,
        0,
        0,
        0,
        0,
        false,
        false,
        false,
        false,
        0,
        null,
      );
      a.dispatchEvent(e);
    };
    return callback;
  }

  function exportCsv(file, options = {}) {
    const onSuccess = createExportCallback(
      "csv",
      "text/csv",
      file,
      performance.now(),
    );
    CsvExporter(flightLog, options).dump(onSuccess);
  }

  function exportSpectrumToCsv(options = {}) {
    const fileName = graph.getAnalyser().getExportedFileName();
    if (fileName == null) {
      console.warn("The export is not supported for this spectrum type");
      return;
    }

    const onSuccess = createExportCallback(
      "csv",
      "text/csv",
      fileName,
      performance.now(),
    );
    graph.getAnalyser().exportSpectrumToCSV(onSuccess, options);
  }

  function exportGpx(file) {
    const onSuccess = createExportCallback(
      "gpx",
      "GPX File",
      file,
      performance.now(),
    );
    GpxExporter(flightLog).dump(onSuccess);
  }

  function newGraphConfig(newConfig, noRedraw) {
    lastGraphConfig = graphConfig; // Remember the last configuration.
    graphConfig = newConfig;
    activeGraphConfig.setRedrawChart(noRedraw ? false : true);
    activeGraphConfig.adaptGraphs(flightLog, graphConfig);

    prefs.set("graphConfig", graphConfig);
  }

  // Store to local cache and update Workspace Selector control
  function onSwitchWorkspace(newWorkspaces, newActiveId) {
    prefs.set("activeWorkspace", newActiveId);
    prefs.set("workspaceGraphConfigs", newWorkspaces);
    workspaceGraphConfigs = newWorkspaces;
    activeWorkspace = newActiveId;
    workspaceStore.workspaceGraphConfigs = newWorkspaces || [];
    workspaceStore.activeWorkspace = newActiveId;
    if (
      flightLog &&
      newWorkspaces[newActiveId] &&
      newWorkspaces[newActiveId].graphConfig
    ) {
      newGraphConfig(newWorkspaces[newActiveId].graphConfig);
      document.getElementById("legend_title").textContent =
        newWorkspaces[newActiveId].title;
    }
  }

  // Save current config
  function onSaveWorkspace(id, title) {
    workspaceGraphConfigs[id] = {
      title: title,
      graphConfig: graphConfig,
    };
    onSwitchWorkspace(workspaceGraphConfigs, id);
  }

  activeGraphConfig.addListener(function () {
    invalidateGraph();
  });

  // Initialize on DOM ready (modules are deferred, DOM is ready)
  {
    // Initialize dark theme
    DarkTheme.init(prefs);

    // Bootstrap tooltips/dropdowns no longer initialized — replaced by Vue/CSS

    // Version information
    appStore.statusViewerVersion = `v${__APP_VERSION__}`;

    graphLegend = new GraphLegend(
      document.querySelector(".log-graph-legend"),
      activeGraphConfig,
      onLegendVisbilityChange,
      onLegendSelectionChange,
      onLegendHighlightChange,
      zoomGraphConfig,
      expandGraphConfig,
      newGraphConfig,
    );

    // initial load of the configuration defaults if we have them
    prefs.get("workspaceGraphConfigs", function (item) {
      if (item) {
        workspaceGraphConfigs = upgradeWorkspaceFormat(item);
      } else {
        workspaceGraphConfigs = ctzsnoozeWorkspace;
      }
    });

    prefs.get("activeWorkspace", function (id) {
      if (id) {
        activeWorkspace = id;
      } else {
        activeWorkspace = 1;
      }
    });

    onSwitchWorkspace(workspaceGraphConfigs, activeWorkspace);

    prefs.get("log-legend-hidden", function (item) {
      if (item) {
        graphLegend.hide();
      }
    });

    /* Always start with the table hidden
        prefs.get('hasTable', function(item) {
           if (item) {
               hasTable = item;
               html.classList.toggle("has-table", hasTable);
           }
        });
        */
    hasTable = false;
    html.classList.toggle("has-table", hasTable);

    // Reset the analyser window on application startup.
    hasAnalyser = false;
    html.classList.toggle("has-analyser", hasAnalyser);

    // File open and new window wired via Vue AppToolbar

    let logJumpBack = function (fast, slow) {
      let scrollTime = SMALL_JUMP_TIME;
      if (fast != null) {
        scrollTime =
          fast === 0 ? scrollTime : graph.getWindowWidthTime() * fast;
      }
      if (hasVideo) {
        if (slow) {
          scrollTime = (1 / 60) * 1000000;
        } // Assume 60Hz video
        setVideoTime(video.currentTime - scrollTime / 1000000);
      } else {
        const currentFrame = flightLog.getCurrentFrameAtTime(
          hasVideo ? video.currentTime : currentBlackboxTime,
        );
        if (currentFrame && currentFrame.previous && slow) {
          setCurrentBlackboxTime(
            currentFrame.previous[
              FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME
            ],
          );
        } else {
          setCurrentBlackboxTime(currentBlackboxTime - scrollTime);
        }
      }

      setGraphState(GRAPH_STATE_PAUSED);
    };
    // Playback buttons wired via Vue PlaybackControls bridge

    let logJumpForward = function (fast, slow) {
      let scrollTime = SMALL_JUMP_TIME;
      if (fast != null) {
        scrollTime =
          fast === 0 ? scrollTime : graph.getWindowWidthTime() * fast;
      }
      if (hasVideo) {
        if (slow) {
          scrollTime = (1 / 60) * 1000000;
        } // Assume 60Hz video
        setVideoTime(video.currentTime + scrollTime / 1000000);
      } else {
        const currentFrame = flightLog.getCurrentFrameAtTime(
          hasVideo ? video.currentTime : currentBlackboxTime,
        );
        if (currentFrame && currentFrame.next && slow) {
          setCurrentBlackboxTime(
            currentFrame.next[
              FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME
            ],
          );
        } else {
          setCurrentBlackboxTime(currentBlackboxTime + scrollTime);
        }
      }

      setGraphState(GRAPH_STATE_PAUSED);
    };
    let logJumpStart = function () {
      setCurrentBlackboxTime(flightLog.getMinTime());
      setGraphState(GRAPH_STATE_PAUSED);
    };

    let logJumpEnd = function () {
      setCurrentBlackboxTime(flightLog.getMaxTime());
      setGraphState(GRAPH_STATE_PAUSED);
    };

    let logPlayPause = function () {
      if (graphState == GRAPH_STATE_PAUSED) {
        setGraphState(GRAPH_STATE_PLAY);
      } else {
        setGraphState(GRAPH_STATE_PAUSED);
      }
    };

    let logSyncHere = function () {
      setVideoOffset(video.currentTime, true);
    };

    let logSyncBack = function () {
      setVideoOffset(videoOffset - 1 / 15, true);
    };

    let logSyncForward = function () {
      setVideoOffset(videoOffset + 1 / 15, true);
    };

    let logSmartSync = function () {
      if (hasMarker && hasVideo && hasLog) {
        try {
          setVideoOffset(
            videoOffset + (currentBlackboxTime - markerTime) / 1000000,
            true,
          );
        } catch (e) {
          console.log("Failed to set video offset");
        }
      }
      setMarker(!hasMarker);
      invalidateGraph();
    };
    // Sync controls wired via Vue SyncPanel bridge

    // Time input wired via Vue TimePanel bridge

    function expandGraphConfig(index) {
      // Put each of the fields into a separate graph

      const expandedGraphConfig = [];

      for (const field of graphConfig[index].fields) {
        // Loop through each of the fields
        const singleGraph = { fields: [], label: "", height: 1 };
        singleGraph.fields.push(field);
        singleGraph.label = field.name;
        expandedGraphConfig.push(singleGraph);
      }

      newGraphConfig(expandedGraphConfig);
      invalidateGraph();
    }

    function zoomGraphConfig(index) {
      // Put each of the fields onto one graph and clear the others

      if (graphConfig.length == 1) {
        // if there is only one graph, then return to previous configuration
        if (lastGraphConfig != null) {
          newGraphConfig(lastGraphConfig);
        }
      } else {
        const expandedGraphConfig = [];
        const singleGraph = { fields: [], label: "", height: 1 };

        for (const field of graphConfig[index].fields) {
          // Loop through each of the fields
          singleGraph.fields.push(field);
          singleGraph.label = graphConfig[index].label;
        }
        expandedGraphConfig.push(singleGraph);

        newGraphConfig(expandedGraphConfig);
      }
      invalidateGraph();
    }
    // Initialize user settings from prefs (replaces legacy UserSettingsDialog onLoad)
    prefs.get("userSettings", function (item) {
      if (item) {
        globalThis.userSettings = { ...defaultUserSettings, ...item };
      } else {
        globalThis.userSettings = { ...defaultUserSettings };
      }
    });

    document
      .querySelector(".open-graph-configuration-dialog")
      ?.addEventListener("click", function (e) {
        e.preventDefault();
        globalThis.vueApp.graphConfigDialogOpen = true;
      });

    // Header, keys, settings dialogs wired via Vue AppToolbar/ViewControls

    // Status bar interactions wired via Vue StatusBar bridge
    this.gotoBookmark = function (index) {
      if (bookmarkTimes?.[index] != null) {
        setCurrentBlackboxTime(bookmarkTimes[index]);
        invalidateGraph();
      }
    };
    this.gotoMarker = function () {
      setCurrentBlackboxTime(markerTime);
      invalidateGraph();
    };
    this.showConfigFile = function () {
      showConfigFile(true);
    };

    // Export buttons wired via Vue AppToolbar

    document
      .getElementById("btn-spectrum-export")
      ?.addEventListener("click", function (e) {
        exportSpectrumToCsv();
        e.preventDefault();
      });

    document
      .getElementById("btn-spectrum-import")
      ?.addEventListener("change", function (e) {
        graph.getAnalyser().importSpectrumFromCSV(e.target.files);
        e.preventDefault();
        e.target.value = "";
      });

    document
      .getElementById("btn-spectrum-clear")
      ?.addEventListener("click", function (e) {
        graph.getAnalyser().removeImportedSpectrums();
        e.preventDefault();
      });

    // GPX export wired via Vue AppToolbar

    window.addEventListener("resize", function () {
      updateCanvasSize();
    });

    function updateHeaderSize() {
      const topControls = document.querySelector(".video-top-controls");
      if (!topControls) {
        return;
      }
      const newHeight = topControls.clientHeight - 20;
      document
        .querySelectorAll(
          ".log-graph, .log-graph-config, .log-seek-bar, .log-field-values",
        )
        .forEach((el) => {
          el.style.top = `${newHeight}px`;
        });
      invalidateGraph();
    }

    function savePenDefaults(graphConfig, graph, field) {
      /**
       * graphConfig is the current graph configuration
       * group is the set of pens to change, null means individual pen within group
       * field is the actual pen to change, null means all pens within group
       */

      if (graph == null && field == null) {
        return false;
      } // no pen specified, just exit

      if (graph != null && field == null) {
        const gi = Number.parseInt(graph, 10);
        // save ALL pens within group
        for (const configField of graphConfig[gi].fields) {
          if (configField.default == null) {
            configField.default = [];
            configField.default.smoothing = configField.smoothing;
            configField.default.power = configField.curve.power;
          }
        }
        return "<h4>Stored defaults for all pens</h4>";
      }
      if (graph != null && field != null) {
        const gi = Number.parseInt(graph, 10);
        const fi = Number.parseInt(field, 10);
        // restore single pen
        if (graphConfig[gi].fields[fi].default == null) {
          graphConfig[gi].fields[fi].default = [];
          graphConfig[gi].fields[fi].default.smoothing =
            graphConfig[gi].fields[fi].smoothing;
          graphConfig[gi].fields[fi].default.power =
            graphConfig[gi].fields[fi].curve.power;
          return "<h4>Stored defaults for single pen</h4>";
        }
      }
      return false; // nothing was changed
    }

    function restorePenDefaults(graphConfig, graph, field) {
      /**
       * graphConfig is the current graph configuration
       * group is the set of pens to change, null means individual pen within group
       * field is the actual pen to change, null means all pens within group
       */

      if (graph == null && field == null) {
        return false;
      } // no pen specified, just exit

      if (graph != null && field == null) {
        const gi = Number.parseInt(graph, 10);
        // restore ALL pens within group
        for (const configField of graphConfig[gi].fields) {
          if (configField.default != null) {
            configField.smoothing = configField.default.smoothing;
            configField.curve.power = configField.default.power;
          } else {
            return false;
          }
        }
        return "<h4>Restored defaults for all pens</h4>";
      }
      if (graph != null && field != null) {
        const gi = Number.parseInt(graph, 10);
        const fi = Number.parseInt(field, 10);
        // restore single pen
        if (graphConfig[gi].fields[fi].default == null) {
          return false; // no defaults stored
        }
        graphConfig[gi].fields[fi].smoothing =
          graphConfig[gi].fields[fi].default.smoothing;
        graphConfig[gi].fields[fi].curve.power =
          graphConfig[gi].fields[fi].default.power;
        return "<h4>Restored defaults for single pen</h4>";
      }
      return false; // nothing was changed
    }

    function changePenSmoothing(graphConfig, graph, field, delta) {
      /**
       * graphConfig is the current graph configuration
       * group is the set of pens to change, null means individual pen within group
       * field is the actual pen to change, null means all pens within group
       * delta is the direction false is down, true is up
       */

      const range = { min: 0, max: 10000 }; // actually in milliseconds!
      const scroll = 1000; // actually in milliseconds

      if (graph == null && field == null) {
        return false;
      } // no pen specified, just exit

      savePenDefaults(graphConfig, graph, field); // only updates defaults if they are not already set

      let changedValue = "<h4>Smoothing</h4>";
      if (graph != null && field == null) {
        const gi = Number.parseInt(graph, 10);
        // change ALL pens within group
        for (const configField of graphConfig[gi].fields) {
          configField.smoothing += delta ? -scroll : +scroll;
          configField.smoothing = constrain(
            configField.smoothing,
            range.min,
            range.max,
          );
          changedValue += `${configField.friendlyName} ${(configField.smoothing / 100).toFixed(2)}%\n`;
        }
        return changedValue;
      }
      if (graph != null && field != null) {
        const gi = Number.parseInt(graph, 10);
        const fi = Number.parseInt(field, 10);
        // change single pen
        graphConfig[gi].fields[fi].smoothing += delta ? -scroll : +scroll;
        graphConfig[gi].fields[fi].smoothing = constrain(
          graphConfig[gi].fields[fi].smoothing,
          range.min,
          range.max,
        );
        return `${changedValue + graphConfig[gi].fields[fi].friendlyName} ${(graphConfig[gi].fields[fi].smoothing / 100).toFixed(2)}%\n`;
      }
      return false; // nothing was changed
    }

    function changePenZoom(graphConfig, graph, field, delta) {
      /**
       * graphConfig is the current graph configuration
       * group is the set of pens to change, null means individual pen within group
       * field is the actual pen to change, null means all pens within group
       * delta is the direction false is down, true is up
       */

      if (graph == null && field == null) {
        return false;
      } // no pen specified, just exit

      savePenDefaults(graphConfig, graph, field); // only updates defaults if they are not already set
      const zoomScaleOut = 1.05,
        zoomScaleIn = 1.0 / zoomScaleOut;
      let changedValue = "<h4></h4>";
      if (graph != null && field == null) {
        const gi = Number.parseInt(graph, 10);
        // change ALL pens within group
        changedValue += delta ? "Zoom out:\n" : "Zoom in:\n";
        for (const configField of graphConfig[gi].fields) {
          configField.curve.MinMax.min *= delta ? zoomScaleOut : zoomScaleIn;
          configField.curve.MinMax.max *= delta ? zoomScaleOut : zoomScaleIn;
          changedValue += `${configField.friendlyName}\n`;
        }
        return changedValue;
      }
      if (graph != null && field != null) {
        const gi = Number.parseInt(graph, 10);
        // change single pen
        graphConfig[gi].fields[field].curve.MinMax.min *= delta
          ? zoomScaleOut
          : zoomScaleIn;
        graphConfig[gi].fields[field].curve.MinMax.max *= delta
          ? zoomScaleOut
          : zoomScaleIn;
        changedValue += delta ? "Zoom out:\n" : "Zoom in:\n";
        changedValue += `${graphConfig[gi].fields[field].friendlyName}\n`;
        return changedValue;
      }
      return false; // nothing was changed
    }

    function changePenExpo(graphConfig, graph, field, delta) {
      /**
       * graphConfig is the current graph configuration
       * group is the set of pens to change, null means individual pen within group
       * field is the actual pen to change, null means all pens within group
       * delta is the direction false is down, true is up
       */

      const range = { min: 0.05, max: 1.0 }; // 1.0 is actually 100 percent linear!
      const scroll = 0.05;

      if (graph == null && field == null) {
        return false;
      } // no pen specified, just exit

      savePenDefaults(graphConfig, graph, field); // only updates defaults if they are not already set

      let changedValue = "<h4>Expo</h4>";
      if (graph != null && field == null) {
        const gi = Number.parseInt(graph, 10);
        // change ALL pens within group
        for (const configField of graphConfig[gi].fields) {
          configField.curve.power += delta ? -scroll : +scroll;
          configField.curve.power = constrain(
            configField.curve.power,
            range.min,
            range.max,
          );
          changedValue += `${configField.friendlyName} ${(configField.curve.power * 100).toFixed(2)}%\n`;
        }
        return changedValue;
      }
      if (graph != null && field != null) {
        const gi = Number.parseInt(graph, 10);
        const fi = Number.parseInt(field, 10);
        // change single pen
        graphConfig[gi].fields[fi].curve.power += delta ? -scroll : +scroll;
        graphConfig[gi].fields[fi].curve.power = constrain(
          graphConfig[gi].fields[fi].curve.power,
          range.min,
          range.max,
        );
        return `${changedValue + graphConfig[gi].fields[fi].friendlyName} ${(graphConfig[gi].fields[fi].curve.power * 100).toFixed(2)}%\n`;
      }
      return false; // nothing was changed
    }

    function saveOneUserSetting(name, value) {
      prefs.get("userSettings", function (data) {
        if (!data) {
          data = {};
        }
        data[name] = value;
        prefs.set("userSettings", data);
      });
    }

    function toggleOverrideStatus(userSetting, className) {
      userSettings[userSetting] = !userSettings[userSetting]; // toggle current setting
      html.classList.toggle(className, userSettings[userSetting]);
      saveOneUserSetting(userSetting, userSettings[userSetting]);
      graph.refreshOptions(userSettings);
      graph.refreshGraphConfig();
      invalidateGraph();
    }

    document
      .querySelector(".log-graph-legend")
      ?.addEventListener("mousedown", function (e) {
        if (e.button !== 1) {
          return;
        } // middle mouse button only

        if (
          e.target.classList.contains("graph-legend-group") ||
          e.target.classList.contains("graph-legend-field")
        ) {
          const refreshRequired = restorePenDefaults(
            activeGraphConfig.getGraphs(),
            e.target.getAttribute("graph"),
            e.target.getAttribute("field"),
          );

          if (refreshRequired) {
            graph.refreshGraphConfig();
            invalidateGraph();
            mouseNotification.show(
              document.querySelector(".log-graph"),
              null,
              null,
              refreshRequired,
              1000,
              null,
              "bottom-right",
              0,
            );
          }
          e.preventDefault();
          return;
        }
      });

    function handleGraphCanvasWheel(e, delta) {
      const zoomStep = 10 + (e.altKey ? 15 : 0);
      if (delta < 0) {
        if (e.altKey || e.shiftKey) {
          setGraphZoom(graphZoom - zoomStep, true);
        } else {
          logJumpBack(0.1);
        }
      } else {
        if (e.altKey || e.shiftKey) {
          setGraphZoom(graphZoom + zoomStep, true);
        } else {
          logJumpForward(0.1);
        }
      }
      e.preventDefault();
    }

    function handleFieldQuickAdjustWheel(e, delta) {
      const graphs = activeGraphConfig.getGraphs();
      const graphIdx = e.target.getAttribute("graph");
      const fieldIdx = e.target.getAttribute("field");
      const increase = delta >= 0;
      let refreshRequired = false;

      if (e.shiftKey) {
        refreshRequired = changePenZoom(graphs, graphIdx, fieldIdx, increase);
        e.preventDefault();
      } else if (e.altKey) {
        refreshRequired = changePenExpo(graphs, graphIdx, fieldIdx, increase);
        e.preventDefault();
      } else if (e.ctrlKey) {
        refreshRequired = changePenSmoothing(
          graphs,
          graphIdx,
          fieldIdx,
          increase,
        );
        e.preventDefault();
      }

      if (refreshRequired) {
        graph.refreshGraphConfig();
        invalidateGraph();
        mouseNotification.show(
          document.querySelector(".log-graph"),
          null,
          null,
          refreshRequired,
          750,
          null,
          "bottom-right",
          0,
        );
      }
    }

    document.addEventListener(
      "wheel",
      function (e) {
        if (e.target.classList.contains("no-wheel")) {
          e.preventDefault();
          return;
        }

        if (graph && !e.target.closest(".modal")) {
          let rawDelta = 0;
          if (e.deltaY < 0) {
            rawDelta = 1;
          } else if (e.deltaY > 0) {
            rawDelta = -1;
          }
          const delta = Math.max(-1, Math.min(1, rawDelta));
          if (delta !== 0) {
            if (e.target.id === "graphCanvas") {
              handleGraphCanvasWheel(e, delta);
              return;
            }
            if (e.target.classList.contains("field-quick-adjust")) {
              handleFieldQuickAdjustWheel(e, delta);
              return;
            }
          }
        }
      },
      { passive: false },
    );

    function handleWorkspaceKey(id, shiftKey) {
      if (!shiftKey) {
        if (workspaceGraphConfigs[id] != null) {
          onSwitchWorkspace(workspaceGraphConfigs, id);
        }
      } else if (workspaceGraphConfigs[id]) {
        onSaveWorkspace(id, workspaceGraphConfigs[id].title);
      } else {
        onSaveWorkspace(id, "Unnamed");
      }
    }

    function handleBookmarkSave(id) {
      if (id === 0) {
        bookmarkTimes = [];
      } else if (bookmarkTimes == null) {
        bookmarkTimes = [];
        bookmarkTimes[id] = currentBlackboxTime;
      } else if (bookmarkTimes[id] == null) {
        bookmarkTimes[id] = currentBlackboxTime;
      } else {
        bookmarkTimes[id] = null;
      }
      invalidateGraph();
    }

    function handleDigitKey(e) {
      const id = Number.parseInt(e.code.slice(5), 10);
      if (!e.altKey) {
        handleWorkspaceKey(id, e.shiftKey);
      } else if (e.shiftKey) {
        handleBookmarkSave(id);
      } else if (bookmarkTimes[id] != null) {
        setCurrentBlackboxTime(bookmarkTimes[id]);
        invalidateGraph();
      }
    }

    function handleAnalyserKey(shifted) {
      if (!shifted) {
        hasAnalyser =
          activeGraphConfig.selectedFieldName != null ? !hasAnalyser : false;
        graph.setDrawAnalyser(hasAnalyser);
        html.classList.toggle("has-analyser", hasAnalyser);
        prefs.set("hasAnalyser", hasAnalyser);
      } else {
        hasAnalyserFullscreen = hasAnalyser ? !hasAnalyserFullscreen : false;
        html.classList.toggle("has-analyser-fullscreen", hasAnalyserFullscreen);
        graph.setAnalyser(hasAnalyserFullscreen);
      }
      invalidateGraph();
    }

    function handleLetterKey(e, shifted) {
      switch (e.code) {
        case "KeyI":
          if (!shifted) {
            setVideoInTime(
              videoExportInTime === currentBlackboxTime
                ? false
                : currentBlackboxTime,
            );
          }
          e.preventDefault();
          break;
        case "KeyO":
          if (!shifted) {
            setVideoOutTime(
              videoExportOutTime === currentBlackboxTime
                ? false
                : currentBlackboxTime,
            );
          }
          e.preventDefault();
          break;
        case "KeyM":
          if (e.altKey) {
            logSmartSync();
          } else {
            markerTime = currentBlackboxTime;
            setMarker(!hasMarker);
            appStore.statusMarkerOffset = hasMarker
              ? `Marker Offset ${formatTime(0)}ms`
              : "";
            invalidateGraph();
          }
          e.preventDefault();
          break;
        case "KeyC":
          if (!shifted) {
            showValueTable(false);
            showConfigFile();
            e.preventDefault();
          }
          break;
        case "KeyA":
          handleAnalyserKey(shifted);
          if (!shifted) {
            e.preventDefault();
          }
          break;
        case "KeyH":
          if (!shifted) {
            globalThis.vueApp.headerDialogOpen = true;
            e.preventDefault();
          }
          break;
        case "KeyT":
          if (!shifted) {
            showValueTable();
            showConfigFile(false);
            invalidateGraph();
            e.preventDefault();
          }
          break;
        case "KeyW":
          if (e.shiftKey) {
            workspaceStore.showDefaultMenu = true;
          }
          break;
        case "KeyZ":
          try {
            if (e.ctrlKey) {
              if (lastGraphConfig != null) {
                newGraphConfig(lastGraphConfig);
              }
            } else if (graphZoom === GRAPH_MIN_ZOOM) {
              setGraphZoom(null, true);
            } else {
              setGraphZoom(GRAPH_MIN_ZOOM, true);
            }
          } catch {
            // Intentionally ignored — workspace toggle gracefully degrades when graph state is incomplete
          }
          e.preventDefault();
          break;
        case "KeyS":
          try {
            if (!shifted) {
              toggleOverrideStatus(
                "graphSmoothOverride",
                "has-smoothing-override",
              );
            } else if (e.altKey) {
              makeScreenshot();
            } else if (e.shiftKey) {
              onSaveWorkspace(
                activeWorkspace,
                workspaceGraphConfigs[activeWorkspace].title,
              );
            }
          } catch {
            // Intentionally ignored — smoothing/screenshot/save gracefully degrades when graph state is incomplete
          }
          e.preventDefault();
          break;
        case "KeyX":
          try {
            if (!shifted) {
              toggleOverrideStatus("graphExpoOverride", "has-expo-override");
            }
          } catch {
            // Intentionally ignored — expo override gracefully degrades when graph state is incomplete
          }
          e.preventDefault();
          break;
        case "KeyG":
          try {
            if (!shifted) {
              toggleOverrideStatus("graphGridOverride", "has-grid-override");
            }
          } catch {
            // Intentionally ignored — grid override gracefully degrades when graph state is incomplete
          }
          e.preventDefault();
          break;
        default:
          return false;
      }
      return true;
    }

    function handleNavigationKey(e) {
      switch (e.code) {
        case "Space":
          logPlayPause();
          break;
        case "ArrowLeft":
          if (e.shiftKey) {
            setGraphZoom(graphZoom - 10 - (e.altKey ? 15 : 0), true);
          } else {
            logJumpBack(null, e.altKey);
          }
          break;
        case "ArrowRight":
          if (e.shiftKey) {
            setGraphZoom(graphZoom + 10 + (e.altKey ? 15 : 0), true);
          } else {
            logJumpForward(null, e.altKey);
          }
          break;
        case "PageUp":
          logJumpBack(0.25);
          break;
        case "PageDown":
          logJumpForward(0.25);
          break;
        case "Home":
          logJumpStart();
          break;
        case "End":
          logJumpEnd();
          break;
        default:
          return false;
      }
      e.preventDefault();
      return true;
    }

    document.addEventListener("keydown", function (e) {
      const shifted = e.altKey || e.shiftKey || e.ctrlKey || e.metaKey;
      if (
        e.key === "Enter" &&
        e.target.type === "text" &&
        !e.target.closest(".modal")
      ) {
        e.target.blur();
      }
      // keyboard controls are disabled on modal dialog boxes and text entry fields
      if (graph && e.target.type !== "text" && !e.target.closest(".modal")) {
        if (e.code.startsWith("Digit")) {
          try {
            handleDigitKey(e);
          } catch {
            // Intentionally ignored — workspace feature gracefully degrades when graph state is incomplete
          }
          e.preventDefault();
          return;
        }
        if (handleLetterKey(e, shifted)) {
          return;
        }
        handleNavigationKey(e);
      }
    });

    video.addEventListener("loadedmetadata", updateCanvasSize);
    video.addEventListener("error", reportVideoError);
    video.addEventListener("loadeddata", videoLoaded);

    // Speed/Zoom sliders and navbar toggle wired via Vue

    seekBar.onSeek = setCurrentBlackboxTime;

    /* drag and drop support */

    globalThis.ondragover = function (e) {
      // prevent default behavior from changing page on dropped file
      // NOTE: ondrop events WILL NOT WORK if you do not "preventDefault" in the ondragover event!!
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      return false;
    };

    globalThis.ondrop = function (e) {
      e.preventDefault();

      const item = e.dataTransfer.items[0];
      const entry = item.webkitGetAsEntry();
      if (entry.isFile) {
        const file = e.dataTransfer.files[0];
        loadFiles([file]);
      }
      return false;
    };

    if ("launchQueue" in globalThis) {
      launchQueue.setConsumer(async (launchParams) => {
        console.log("Opening files by extension in the desktop:", launchParams);
        const files = [];
        for (const fileHandler of launchParams.files) {
          console.log("launchQueue file", fileHandler);
          files.push(await fileHandler.getFile());
        }
        loadFiles(files);
      });
    }

    prefs.get("videoConfig", function (item) {
      if (item) {
        videoConfig = item;
      } else {
        videoConfig = {
          width: 1280,
          height: 720,
          frameRate: 30,
          videoDim: 0.4,
        };
      }
    });

    prefs.get("graphConfig", function (item) {
      if (item) {
        graphConfig = GraphConfig.load(item);
      }
    });

    // Get the offsetCache buffer
    prefs.get("offsetCache", function (item) {
      if (item) {
        offsetCache = item;
      }
    });

    // View toggle bridges
    this.toggleVideo = function () {
      viewVideo = !viewVideo;
      appStore.viewVideo = viewVideo;
      html.classList.toggle("video-hidden", !viewVideo);
    };
    this.toggleCraft = function () {
      userSettings.drawCraft = !userSettings.drawCraft;
      html.classList.toggle("has-craft", userSettings.drawCraft);
      saveOneUserSetting("drawCraft", userSettings.drawCraft);
    };
    this.toggleSticks = function () {
      userSettings.drawSticks = !userSettings.drawSticks;
      graph.setDrawSticks(userSettings.drawSticks);
      html.classList.toggle("has-sticks", userSettings.drawSticks);
      saveOneUserSetting("drawSticks", userSettings.drawSticks);
      invalidateGraph();
    };
    this.toggleTable = function () {
      showValueTable();
      showConfigFile(false);
    };
    this.viewConfig = function () {
      showValueTable(false);
      showConfigFile();
    };
    this.toggleAnalyser = function () {
      if (activeGraphConfig.selectedFieldName != null) {
        hasAnalyser = !hasAnalyser;
      } else {
        const graphs = activeGraphConfig.getGraphs();
        if (graphs.length == 0 || graphs[0].fields.length == 0) {
          hasAnalyser = false;
        } else {
          activeGraphConfig.selectedFieldName =
            graphs[0].fields[0].friendlyName;
          activeGraphConfig.selectedGraphIndex = 0;
          activeGraphConfig.selectedFieldIndex = 0;
          hasAnalyser = true;
        }
      }
      graph.setDrawAnalyser(hasAnalyser);
      html.classList.toggle("has-analyser", hasAnalyser);
      prefs.set("hasAnalyser", hasAnalyser);
      invalidateGraph();
    };
    this.toggleMap = function () {
      hasMap = !hasMap;
      graphStore.hasMap = hasMap;
      html.classList.toggle("has-map", hasMap);
      prefs.set("hasMap", hasMap);
      if (flightLog.hasGpsData()) {
        mapGrapher.initialize(userSettings);
      }
    };
    this.toggleAnalyserFullscreen = function () {
      if (hasAnalyser) {
        hasAnalyserFullscreen = !hasAnalyserFullscreen;
      } else hasAnalyserFullscreen = false;
      hasAnalyserFullscreen
        ? html.classList.add("has-analyser-fullscreen")
        : html.classList.remove("has-analyser-fullscreen");
      graph.setAnalyser(hasAnalyserFullscreen);
      invalidateGraph();
    };
    this.toggleSmoothing = function () {
      toggleOverrideStatus("graphSmoothOverride", "has-smoothing-override");
    };
    this.toggleExpo = function () {
      toggleOverrideStatus("graphExpoOverride", "has-expo-override");
    };
    this.toggleGrid = function () {
      toggleOverrideStatus("graphGridOverride", "has-grid-override");
    };
    this.setPlaybackRate = function (rate) {
      setPlaybackRate(rate, false);
    };
    this.setGraphZoom = function (zoom) {
      setGraphZoom(zoom, false);
    };
    this.logSyncHere = function () {
      logSyncHere();
    };
    this.logSyncBack = function () {
      logSyncBack();
    };
    this.logSyncForward = function () {
      logSyncForward();
    };
    this.logSmartSync = function () {
      logSmartSync();
    };
    this.setVideoOffsetValue = function (val) {
      const offset = Number.parseFloat(val);
      if (!Number.isNaN(offset)) {
        setVideoOffset(offset, true);
      }
    };
    this.setGraphTime = function (timeStr) {
      let newTime = stringTimetoMsec(timeStr);
      if (!isNaN(newTime)) {
        if (hasVideo) {
          setVideoTime(newTime / 1000000 + videoOffset);
        } else {
          newTime += flightLog.getMinTime();
          setCurrentBlackboxTime(newTime);
        }
        invalidateGraph();
      }
    };
    this.switchWorkspace = function (id) {
      if (workspaceGraphConfigs[id] != null) {
        onSwitchWorkspace(workspaceGraphConfigs, id);
      }
    };
    this.saveWorkspace = function (id, title) {
      onSaveWorkspace(id, title);
    };
    this.applyDefaultWorkspace = function (index) {
      const presets = [null, ctzsnoozeWorkspace, supaflyWorkspace];
      if (presets[index]) {
        onSwitchWorkspace(presets[index], 1);
      }
    };
  }

  // Bridge API — expose key functions for Vue components during migration
  this.loadFiles = loadFiles;
  this.invalidateGraph = invalidateGraph;
  Object.defineProperty(this, "flightLog", { get: () => flightLog });
  Object.defineProperty(this, "activeGraphConfig", {
    get: () => activeGraphConfig,
  });
  this.newGraphConfig = function (newConfig, redrawChart) {
    newGraphConfig(newConfig, redrawChart);
  };
  this.exportCsv = function () {
    setGraphState(GRAPH_STATE_PAUSED);
    exportCsv();
  };
  this.exportGpx = function () {
    setGraphState(GRAPH_STATE_PAUSED);
    exportGpx();
  };
  this.exportWorkspaces = function () {
    setGraphState(GRAPH_STATE_PAUSED);
    saveWorkspaces();
  };
  this.pauseForExport = function () {
    setGraphState(GRAPH_STATE_PAUSED);
  };
  this.getVideoExportParams = function () {
    return {
      graphConfig: activeGraphConfig,
      inTime: videoExportInTime,
      outTime: videoExportOutTime,
      flightVideo: hasVideo && viewVideo ? video.cloneNode() : false,
      flightVideoOffset: videoOffset,
      hasCraft: userSettings.drawCraft,
      hasAnalyser: hasAnalyser,
      hasSticks: userSettings.drawSticks,
    };
  };
  this.saveVideoConfig = function (newConfig) {
    videoConfig = newConfig;
    prefs.set("videoConfig", newConfig);
  };
  Object.defineProperty(this, "videoConfig", { get: () => videoConfig });
  // Playback
  this.logPlayPause = function () {
    logPlayPause();
  };
  this.logJumpBack = function () {
    logJumpBack(false);
  };
  this.logJumpForward = function () {
    logJumpForward(false);
  };
  this.logJumpStart = function () {
    logJumpStart();
  };
  this.logJumpEnd = function () {
    logJumpEnd();
  };
  this.videoJumpStart = function () {
    setVideoTime(0);
    setGraphState(GRAPH_STATE_PAUSED);
  };
  this.videoJumpEnd = function () {
    if (video.duration) {
      setVideoTime(video.duration);
      setGraphState(GRAPH_STATE_PAUSED);
    }
  };
  this.openNewWindow = function () {
    createNewBlackboxWindow();
  };
  this.saveUserSettings = function (newSettings) {
    globalThis.userSettings = newSettings;
    prefs.set("userSettings", newSettings);

    if (newSettings.darkMode !== undefined) {
      DarkTheme.setMode(newSettings.darkMode);
    }

    if (graph != null) {
      graph.refreshOptions(newSettings);
      graph.refreshLogo();
      graph.initializeCraftModel();
      if (flightLog.hasGpsData()) {
        mapGrapher.setUserSettings(newSettings);
      }
      updateCanvasSize();
    }
  };
}

// Close the dropdowns if not clicking a descendant of the dropdown
document.addEventListener("click", function (e) {
  if (!e.target.closest(".dropdown")) {
    document
      .querySelectorAll(".dropdown.open")
      .forEach((el) => el.classList.remove("open"));
  }
});

globalThis.blackboxLogViewer = new BlackboxLogViewer();
if (globalThis.window !== undefined) {
  globalThis.window.blackboxLogViewer = globalThis.blackboxLogViewer;
}

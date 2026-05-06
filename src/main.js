import "./vendor.js";

import { throttle } from "throttle-debounce";
import { MapGrapher } from "./graph_map.js";
import { FlightLogGrapher } from "./grapher.js";
import { SimpleStats } from "./simple-stats.js";
import { Configuration, ConfigurationDefaults } from "./configuration.js";
import { GraphConfig } from "./graph_config.js";
import { SeekBar } from "./seekbar.js";
import { GpxExporter } from "./gpx-exporter.js";
import { CsvExporter } from "./csv-exporter.js";
import ctzsnoozeWorkspace from "./ws_ctzsnooze.json";
import supaflyWorkspace from "./ws_supafly.json";
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
  triggerDownload,
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
import { useSettingsStore } from "./stores/settings.js";


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
    fieldPresenter = FlightLogFieldPresenter,
    hasVideo = false,
    hasLog = false,
    hasMarker = false, // add measure feature
    hasAnalyser,
    hasMap,
    hasAnalyserFullscreen,
    hasAnalyserSticks = false,
    viewVideo = true,
    hasTableOverlay = false,
    hasConfig = false,
    hasConfigOverlay = false,
    isFullscreen = false, // New fullscreen feature (to hide table)
    video = document.querySelector(".log-graph video"),
    canvas = document.getElementById("graphCanvas"),
    analyserCanvas = document.getElementById("analyserCanvas"),
    stickCanvas = document.getElementById("stickCanvas"),
    craftCanvas = document.getElementById("craftCanvas"),
    videoURL = false,
    videoOffset = 0.0,
    videoExportInTime = null,
    videoExportOutTime = null,
    markerTime = 0, // New marker time
    userSettings,
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
  const settingsStore = useSettingsStore(pinia);

  function syncToStores() {
    // Log
    logStore.flightLog = flightLog ?? null;
    logStore.flightLogDataArray = flightLogDataArray ?? null;
    logStore.currentBlackboxTime = currentBlackboxTime;
    logStore.hasLog = hasLog;
    logStore.hasVideo = hasVideo;
    logStore.hasGps = !!flightLog?.hasGpsData?.();
    logStore.videoURL = videoURL;

    // Graph
    graphStore.graphZoom = graphZoom;
    graphStore.lastGraphZoom = lastGraphZoom;
    graphStore.hasTableOverlay = hasTableOverlay;
    graphStore.hasAnalyser = !!hasAnalyser;
    graphStore.hasAnalyserFullscreen = !!hasAnalyserFullscreen;
    graphStore.hasAnalyserSticks = !!hasAnalyserSticks;
    graphStore.hasCraft = !!userSettings.drawCraft;
    graphStore.hasSticks = !!userSettings.drawSticks;
    graphStore.hasMap = !!hasMap;
    graphStore.hasMarker = hasMarker;
    graphStore.isFullscreen = isFullscreen;
    graphStore.markerTime = markerTime;
    graphStore.seekBarMode = seekBarMode;

    // Graph config
    graphStore.activeGraphConfig = activeGraphConfig;

    // Playback
    playbackStore.graphState = graphState;
    playbackStore.playbackRate = playbackRate;
    playbackStore.videoOffset = videoOffset;
    playbackStore.videoExportInTime = videoExportInTime;
    playbackStore.videoExportOutTime = videoExportOutTime;
    playbackStore.videoConfig = videoConfig;

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
    let frame = flightLog.getSmoothedFrameAtTime(currentBlackboxTime),
      fieldNames = flightLog.getMainFieldNames();

    if (frame) {
      let currentFlightMode =
        frame[flightLog.getMainFieldIndexByName("flightModeFlags")];

      if (graphStore.hasTableOverlay) {
        const debugMode = flightLog.getSysConfig().debug_mode;
        const values = [];

        for (let i = 0; i < fieldNames.length; i++) {
          values.push({
            name: fieldPresenter.fieldNameToFriendly(fieldNames[i], debugMode),
            raw: atMost2DecPlaces(frame[i]),
            decoded: fieldPresenter.decodeFieldToFriendly(flightLog, fieldNames[i], frame[i], currentFlightMode),
          });
        }
        logStore.fieldValues = values;

        const statRows = [];
        const stats = SimpleStats(flightLog).calculate();
        for (const field of Object.keys(stats)) {
          const stat = stats[field];
          if (stat === undefined) {
            continue;
          }
          statRows.push({
            name: fieldPresenter.fieldNameToFriendly(stat.name, debugMode),
            min: `${FlightLogFieldPresenter.decodeFieldToFriendly(flightLog, stat.name, stat.min)} (${atMost2DecPlaces(stat.min)})`,
            max: `${FlightLogFieldPresenter.decodeFieldToFriendly(flightLog, stat.name, stat.max)} (${atMost2DecPlaces(stat.max)})`,
            mean: `${FlightLogFieldPresenter.decodeFieldToFriendly(flightLog, stat.name, stat.mean)} (${atMost2DecPlaces(stat.mean)})`,
          });
        }
        logStore.fieldStats = statRows;
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
      if (graphStore.legendVisible) {
        updateLegendValues(flightLog, frame);
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

  function setSeekBarMode(mode) {
    seekBarMode = mode;
    graphStore.seekBarMode = mode;
    if (flightLog) {
      const activity = flightLog.getActivitySummary();
      seekBar.setActivity(activity.times, activity[mode], activity.hasEvent);
      seekBar.repaint();
    }
  }

  function renderLogFileInfo(file) {
    appStore.logFilename = file.name;

    const logCount = flightLog.getLogCount();
    const entries = [];
    for (let index = 0; index < logCount; index++) {
      const error = flightLog.getLogError(index);
      let logLabel;
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
      const label = logCount > 1
        ? `${index + 1}/${logCount}: ${logLabel}`
        : logLabel;
      entries.push({ label, value: index, disabled: !!error });
    }
    logStore.logIndexEntries = entries;
    logStore.activeLogIndex = 0;
  }

  /**
   * Update the metadata displays to show information about the currently selected log index.
   */
  function renderSelectedLogInfo() {
    logStore.activeLogIndex = flightLog.getLogIndex();

    if (flightLog.getNumCellsEstimate()) {
      appStore.statusCells = `${flightLog.getNumCellsEstimate()}S (${Number(
        flightLog.getReferenceVoltageMillivolts() / 1000,
      ).toFixed(2)}V)`;
    } else {
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
    if (flightLog.hasGpsData()) {
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
        hasConfigOverlay = !hasConfigOverlay;
      } else {
        hasConfigOverlay = !!state;
      }
      graphStore.hasConfigOverlay = hasConfigOverlay;
    }
  }

  function showValueTable(state) {
    if (state == null) {
      hasTableOverlay = !hasTableOverlay;
    } else {
      hasTableOverlay = !!state;
    }
    graphStore.hasTableOverlay = hasTableOverlay;
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

  function loadFiles(files) {
    for (const file of files) {
      let isLog = file.name.match(/\.(BBL|TXT|CFL|BFL|LOG)$/i),
        isVideo = file.name.match(/\.(AVI|MOV|MP4|MPEG)$/i),
        isWorkspaces = file.name.match(/\.(JSON)$/i);

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
            configuration = new Configuration(file);
            hasConfig = true;
            graphStore.hasConfig = true;
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
      seekBarMode = "avgThrottle";
      graphStore.seekBarMode = seekBarMode;
      currentOffsetCache.log = file.name; // store the name of the loaded log file
      currentOffsetCache.index = null; // and clear the index

      hasLog = true;
      logStore.hasLog = true;

      setTimeout(function () {
        globalThis.dispatchEvent(new Event("resize"));
      }, 500); // refresh the window size;

      selectLog(null);

      if (graph) {
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

  function buildLegendGraphs() {
    const graphs = activeGraphConfig.getGraphs();
    graphStore.legendGraphs = graphs.map((g, gi) => ({
      label: g.label,
      fields: g.fields.map((f, fi) => ({
        name: f.name,
        friendlyName: f.friendlyName,
        color: f.color,
        hidden: activeGraphConfig.isGraphFieldHidden(gi, fi),
      })),
    }));
  }

  function updateLegendValues(flightLog, frame) {
    try {
      const currentFlightMode = frame[flightLog.getMainFieldIndexByName("flightModeFlags")];
      const graphs = activeGraphConfig.getGraphs();
      const vals = {};
      for (let i = 0; i < graphs.length; i++) {
        for (let j = 0; j < graphs[i].fields.length; j++) {
          const field = graphs[i].fields[j];
          let value = frame[flightLog.getMainFieldIndexByName(field.name)];
          if (userSettings.legendUnits) {
            value = FlightLogFieldPresenter.decodeFieldToFriendly(
              flightLog, field.name, value, currentFlightMode,
            );
          } else if (value % 1 !== 0) {
            value = value.toFixed(2);
          }
          const settings = `Z100 E${(field.curve.power * 100).toFixed(0)} S${(field.smoothing / 100).toFixed(0)}`;
          vals[field.name] = { value: value ?? "", settings };
        }
      }
      graphStore.legendValues = vals;
    } catch (e) {
      console.log("Cannot update legend with values");
    }
  }

  function onLegendVisbilityChange(hidden) {
    prefs.set("log-legend-hidden", hidden);
    updateCanvasSize();
  }

  function onLegendSelectionChange(gi, fi, fieldName, ctrlKey) {
    const toggleAnalizer = activeGraphConfig.selectedFieldName === fieldName;
    const lockAnalyserHide = ctrlKey || graph.hasMultiSpectrumAnalyser();
    if (toggleAnalizer) {
      if (lockAnalyserHide) {
        hasAnalyser = true;
      } else {
        hasAnalyser = !hasAnalyser;
      }
    } else {
      activeGraphConfig.selectedFieldName = fieldName;
      activeGraphConfig.selectedGraphIndex = gi;
      activeGraphConfig.selectedFieldIndex = fi;
      hasAnalyser = true;
    }
    graph.setDrawAnalyser(hasAnalyser, ctrlKey);
    prefs.set("hasAnalyser", hasAnalyser);
    invalidateGraph();
  }

  function onLegendHighlightChange(gi, fi) {
    activeGraphConfig.highlightGraphIndex = gi;
    activeGraphConfig.highlightFieldIndex = fi;
    invalidateGraph();
  }

  function onLegendToggleField(gi, fi) {
    activeGraphConfig.toggleGraphField(gi, fi);
    buildLegendGraphs();
    invalidateGraph();
  }

  function setMarker(state) {
    hasMarker = state;
  }

  function setFullscreen(state) {
    isFullscreen = state;
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

    triggerDownload(new Blob([data], { type: "text/json" }), file);
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
      const filename = file || `${appStore.logFilename}.${fileExtension}`;
      triggerDownload(new Blob([data], { type: fileType }), filename);
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
      graphStore.legendTitle = newWorkspaces[newActiveId].title;
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
    buildLegendGraphs();
    invalidateGraph();
  });

  // Initialize on DOM ready (modules are deferred, DOM is ready)
  {
    // Initialize dark theme
    DarkTheme.init(prefs);

    // Version information
    appStore.statusViewerVersion = `v${__APP_VERSION__}`;

    buildLegendGraphs();

    // initial load of the configuration defaults if we have them
    prefs.get("workspaceGraphConfigs", function (item) {
      if (item) {
        workspaceGraphConfigs = upgradeWorkspaceFormat(item);
      } else {
        workspaceGraphConfigs = structuredClone(ctzsnoozeWorkspace);
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
        graphStore.legendVisible = false;
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
    hasTableOverlay = false;
    graphStore.hasTableOverlay = false;

    // Reset the analyser window on application startup.
    hasAnalyser = false;

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
    // userSettings is the reactive object from settingsStore — no global bridge needed
    userSettings = settingsStore.userSettings;

    // Graph configuration dialog wired via Vue LegendPanel "Graph setup" button

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

    // Spectrum actions wired via Vue SpectrumAnalyser
    this.spectrumExport = function () {
      exportSpectrumToCsv();
    };
    this.spectrumImport = function (files) {
      graph.getAnalyser()?.importSpectrumFromCSV(files);
    };
    this.spectrumClear = function () {
      graph.getAnalyser()?.removeImportedSpectrums();
    };
    this.getAnalyser = function () {
      return graph?.getAnalyser();
    };

    // GPX export wired via Vue AppToolbar

    window.addEventListener("resize", function () {
      updateCanvasSize();
    });

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
      settingsStore.saveSetting(name, value);
    }

    function toggleOverrideStatus(userSetting) {
      userSettings[userSetting] = !userSettings[userSetting];
      saveOneUserSetting(userSetting, userSettings[userSetting]);
      graph.refreshOptions(userSettings);
      graph.refreshGraphConfig();
      invalidateGraph();
    }

    // Middle-click pen reset wired via Vue LegendPanel

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

    function applyPenChange(refreshRequired) {
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
          if (delta !== 0 && e.target.id === "graphCanvas") {
            handleGraphCanvasWheel(e, delta);
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
          activeGraphConfig.selectedFieldName == null ? false : !hasAnalyser;
        if (!hasAnalyser) {
          hasAnalyserFullscreen = false;
          graph.setAnalyser(false);
        }
        graph.setDrawAnalyser(hasAnalyser);
        prefs.set("hasAnalyser", hasAnalyser);
      } else {
        hasAnalyserFullscreen = hasAnalyser ? !hasAnalyserFullscreen : false;
        graph.setAnalyser(hasAnalyserFullscreen);
      }
      invalidateGraph();
    }

    function handleKeyVideoIn(e, shifted) {
      if (!shifted) {
        setVideoInTime(
          videoExportInTime === currentBlackboxTime
            ? null
            : currentBlackboxTime,
        );
      }
      e.preventDefault();
    }

    function handleKeyVideoOut(e, shifted) {
      if (!shifted) {
        setVideoOutTime(
          videoExportOutTime === currentBlackboxTime
            ? null
            : currentBlackboxTime,
        );
      }
      e.preventDefault();
    }

    function handleKeyMarker(e) {
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
    }

    function handleKeyConfig(e, shifted) {
      if (!shifted) {
        appStore.headerDialogOpen = false;
        showValueTable(false);
        showConfigFile();
        e.preventDefault();
      }
    }

    function handleKeyTable(e, shifted) {
      if (!shifted) {
        appStore.headerDialogOpen = false;
        showValueTable();
        showConfigFile(false);
        invalidateGraph();
        e.preventDefault();
      }
    }

    function handleKeyZoom(e) {
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
        // Intentionally ignored — zoom toggle gracefully degrades when graph state is incomplete
      }
      e.preventDefault();
    }

    function handleKeySave(e, shifted) {
      try {
        if (!shifted) {
          toggleOverrideStatus("graphSmoothOverride");
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
    }

    function handleKeyOverride(settingKey, e, shifted) {
      try {
        if (!shifted) {
          toggleOverrideStatus(settingKey);
        }
      } catch {
        // Intentionally ignored — override gracefully degrades when graph state is incomplete
      }
      e.preventDefault();
    }

    const letterKeyHandlers = {
      KeyI: handleKeyVideoIn,
      KeyO: handleKeyVideoOut,
      KeyM: handleKeyMarker,
      KeyC: handleKeyConfig,
      KeyA(e, shifted) {
        handleAnalyserKey(shifted);
        if (!shifted) {
          e.preventDefault();
        }
      },
      KeyH(e, shifted) {
        if (!shifted) {
          if (!appStore.headerDialogOpen) {
            showValueTable(false);
            showConfigFile(false);
          }
          appStore.headerDialogOpen =
            !appStore.headerDialogOpen;
          e.preventDefault();
        }
      },
      KeyT: handleKeyTable,
      KeyW(e) {
        if (e.shiftKey) {
          workspaceStore.showDefaultMenu = true;
        }
      },
      KeyZ: handleKeyZoom,
      KeyS: handleKeySave,
      KeyX(e, shifted) {
        handleKeyOverride("graphExpoOverride", e, shifted);
      },
      KeyG(e, shifted) {
        handleKeyOverride("graphGridOverride", e, shifted);
      },
    };

    function handleLetterKey(e, shifted) {
      const handler = letterKeyHandlers[e.code];
      if (!handler) {
        return false;
      }
      handler(e, shifted);
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
    };
    this.toggleCraft = function () {
      userSettings.drawCraft = !userSettings.drawCraft;
      graphStore.hasCraft = userSettings.drawCraft;
      saveOneUserSetting("drawCraft", userSettings.drawCraft);
    };
    this.toggleSticks = function () {
      userSettings.drawSticks = !userSettings.drawSticks;
      graphStore.hasSticks = userSettings.drawSticks;
      graph.setDrawSticks(userSettings.drawSticks);
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
    this.closeOverlays = function () {
      showValueTable(false);
      showConfigFile(false);
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
      if (!hasAnalyser) {
        hasAnalyserFullscreen = false;
        graph.setAnalyser(false);
      }
      graph.setDrawAnalyser(hasAnalyser);
      prefs.set("hasAnalyser", hasAnalyser);
      invalidateGraph();
    };
    this.toggleMap = function () {
      hasMap = !hasMap;
      graphStore.hasMap = hasMap;
      prefs.set("hasMap", hasMap);
      if (flightLog?.hasGpsData()) {
        mapGrapher.initialize();
      }
    };
    this.toggleAnalyserFullscreen = function () {
      if (hasAnalyser) {
        hasAnalyserFullscreen = !hasAnalyserFullscreen;
      } else hasAnalyserFullscreen = false;
      graph.setAnalyser(hasAnalyserFullscreen);
      invalidateGraph();
    };
    this.toggleSmoothing = function () {
      toggleOverrideStatus("graphSmoothOverride");
    };
    this.toggleExpo = function () {
      toggleOverrideStatus("graphExpoOverride");
    };
    this.toggleGrid = function () {
      toggleOverrideStatus("graphGridOverride");
    };
    this.legendHighlight = function (gi, fi) {
      onLegendHighlightChange(gi, fi);
    };
    this.legendSelect = function (gi, fi, fieldName, ctrlKey) {
      onLegendSelectionChange(gi, fi, fieldName, ctrlKey);
    };
    this.legendZoom = function (gi) {
      zoomGraphConfig(gi);
    };
    this.legendExpand = function (gi) {
      expandGraphConfig(gi);
    };
    this.legendToggleField = function (gi, fi) {
      onLegendToggleField(gi, fi);
    };
    this.legendReorder = function (newOrder) {
      const oldGraphs = graphConfig;
      const newGraphs = newOrder.map((i) => oldGraphs[i]);
      newGraphConfig(newGraphs);
    };
    this.legendVisibilityChange = function (hidden) {
      onLegendVisbilityChange(hidden);
    };
    this.legendResetPen = function (gi, fi) {
      const graphs = activeGraphConfig.getGraphs();
      const msg = restorePenDefaults(graphs, String(gi), fi != null ? String(fi) : null);
      applyPenChange(msg);
    };
    this.legendFieldWheel = function (gi, fi, delta, shiftKey, altKey, ctrlKey) {
      const graphs = activeGraphConfig.getGraphs();
      const g = String(gi);
      const f = String(fi);
      const increase = delta >= 0;
      let msg = false;
      if (shiftKey) {
        msg = changePenZoom(graphs, g, f, increase);
      } else if (altKey) {
        msg = changePenExpo(graphs, g, f, increase);
      } else if (ctrlKey) {
        msg = changePenSmoothing(graphs, g, f, increase);
      }
      applyPenChange(msg);
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
          newTime += flightLog?.getMinTime() ?? 0;
          setCurrentBlackboxTime(newTime);
        }
        invalidateGraph();
      }
    };
    this.setSeekBarMode = function (mode) {
      setSeekBarMode(mode);
    };
    this.selectLogIndex = function (index) {
      selectLog(Number.parseInt(index, 10));
      if (graph) {
        graph.setAnalyser(hasAnalyserFullscreen);
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
      const presets = [null, structuredClone(ctzsnoozeWorkspace), structuredClone(supaflyWorkspace)];
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
    newGraphConfig(newConfig, !redrawChart);
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
    logJumpBack(null);
  };
  this.logJumpForward = function () {
    logJumpForward(null);
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
    settingsStore.saveAll(newSettings);

    if (newSettings.darkMode !== undefined) {
      DarkTheme.setMode(newSettings.darkMode);
    }

    if (graph != null) {
      graph.refreshOptions(userSettings);
      graph.refreshLogo();
      graph.initializeCraftModel();
      updateCanvasSize();
    }
  };

  // Register this controller in the store — replaces globalThis.blackboxLogViewer
  appStore.controller = this;
}

const _app = new BlackboxLogViewer(); // NOSONAR — constructor registers itself in appStore.controller

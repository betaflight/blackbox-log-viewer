import "./vendor.js";

import { throttle } from "throttle-debounce";
import { MapGrapher } from "./graph_map.js";
import { FlightLogGrapher } from "./grapher.js";
import { Configuration, ConfigurationDefaults } from "./configuration.js";
import { GraphConfig } from "./graph_config.js";
import { SeekBar } from "./seekbar.js";
import ctzsnoozeWorkspace from "./ws_ctzsnooze.json";
import supaflyWorkspace from "./ws_supafly.json";
import { FlightLog } from "./flightlog.js";
import { FlightLogParser } from "./flightlog_parser.js";
import {
  formatTime,
  stringLoopTime,
  stringTimetoMsec,
  validate,
  mouseNotification,
} from "./tools.js";
import { restorePenDefaults, changePenSmoothing, changePenZoom, changePenExpo } from "./pen_adjustment.js";
import { createKeydownHandler } from "./keyboard_handler.js";
import { upgradeWorkspaceFormat, saveWorkspaces, loadWorkspaces } from "./workspace_io.js";
import { exportCsv, exportGpx, exportSpectrumToCsv } from "./export_utils.js";
import { updateValuesChart } from "./values_display.js";
import { PrefStorage } from "./pref_storage.js";
import { makeScreenshot } from "./screenshot.js";
import { DarkTheme } from "./dark_theme.js";
import { ThemeColors } from "./theme_colors.js";
import pinia from "./pinia_instance.js";
import { useLogStore } from "./stores/log.js";
import { useGraphStore, GRAPH_MIN_ZOOM, GRAPH_MAX_ZOOM } from "./stores/graph.js";
import { usePlaybackStore, GRAPH_STATE_PAUSED, GRAPH_STATE_PLAY, PLAYBACK_MIN_RATE, PLAYBACK_MAX_RATE } from "./stores/playback.js";
import { useWorkspaceStore } from "./stores/workspace.js";
import { useAppStore } from "./stores/app.js";
import { useSettingsStore } from "./stores/settings.js";
import { watch } from "vue";


// TODO: Figure out if we can open the same file in a new window
function createNewBlackboxWindow(_fileToOpen) {
  globalThis.open(globalThis.location.href, "_blank").focus();
}

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

  const SMALL_JUMP_TIME = 100 * 1000;

  let lastRenderTime = false;
  let graph = null;
  const prefs = new PrefStorage();
  let _configuration = null; // is their an associated dump file ?
  const configurationDefaults = new ConfigurationDefaults(prefs); // configuration defaults
  // JSON graph configuration:
  let graphConfig = null;
  let offsetCache = []; // Storage for the offset cache (last 20 files)
  const currentOffsetCache = { log: null, index: null, video: null, offset: null };
  // JSON array of graph configurations for New Workspaces feature
  let lastGraphConfig = null; // Undo feature - go back to last configuration.
  // workspaceGraphConfigs, activeWorkspace, workspaceStore.bookmarkTimes live in workspaceStore
  // Graph configuration which is currently in use, customised based on the current flight log from graphConfig
  // activeGraphConfig lives in graphStore.activeGraphConfig (initialized after store creation)
  // hasLog lives in logStore.hasLog
  // hasMarker lives in graphStore.hasMarker
  // hasAnalyser, hasMap, hasAnalyserFullscreen live in graphStore
  // hasAnalyserSticks constant false, set in graphStore
  // viewVideo lives in appStore.viewVideo
  // hasTableOverlay, hasConfig, hasConfigOverlay live in graphStore
  // isFullscreen lives in graphStore.isFullscreen
  const video = document.getElementById("logVideo");
  const canvas = document.getElementById("graphCanvas");
  const analyserCanvas = document.getElementById("analyserCanvas");
  const stickCanvas = document.getElementById("stickCanvas");
  const craftCanvas = document.getElementById("craftCanvas");
  // markerTime lives in graphStore.markerTime
  // hasVideo, videoURL live in logStore
  // videoOffset, videoExportInTime, videoExportOutTime, videoConfig live in playbackStore
  let userSettings;
  const seekBarCanvas = document.getElementById("seekbarCanvas");
  const seekBar = new SeekBar(seekBarCanvas);
  const seekBarRepaintRateLimited = throttle(200, seekBar.repaint.bind(seekBar));
  // seekBarMode lives in graphStore.seekBarMode
  let animationFrameIsQueued = false;
  // playbackRate lives in playbackStore.playbackRate
  // graphZoom, lastGraphZoom live in graphStore
  const mapGrapher = new MapGrapher();

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
  graphStore.activeGraphConfig = new GraphConfig();
  graphStore.mapGrapher = mapGrapher;

  function blackboxTimeFromVideoTime() {
    return (video.currentTime - playbackStore.videoOffset) * 1000000 + logStore.flightLog.getMinTime();
  }

  function syncLogToVideo() {
    if (logStore.hasLog) {
      logStore.currentBlackboxTime = blackboxTimeFromVideoTime();
    }
  }

  function setVideoOffset(offset, withRefresh) {
    // optionally prevent the graph refresh until later
    playbackStore.videoOffset = offset;

    /*
     * Round to 2 dec places for display and put a plus at the start for positive values to emphasize the fact it's
     * an offset
     */
    appStore.videoOffsetDisplay =
      (offset >= 0 ? "+" : "") + offset.toFixed(3);

    if (withRefresh) {
      invalidateGraph();
    }
  }

  const updateValuesChartRateLimited = throttle(250, () =>
    updateValuesChart(logStore, graphStore, appStore, userSettings),
  );

  function animationLoop() {
    const now = Date.now();

    if (!graph) {
      animationFrameIsQueued = false;
      return;
    }

    if (logStore.hasVideo) {
      logStore.currentBlackboxTime = blackboxTimeFromVideoTime();
    } else if (playbackStore.graphState === GRAPH_STATE_PLAY) {
      let delta;

      if (lastRenderTime === false) {
        delta = 0;
      } else {
        delta = Math.floor(
          ((now - lastRenderTime) * 1000 * playbackStore.playbackRate) / 100,
        );
      }

      logStore.currentBlackboxTime += delta;

      if (logStore.currentBlackboxTime > logStore.flightLog.getMaxTime()) {
        logStore.currentBlackboxTime = logStore.flightLog.getMaxTime();
        setGraphState(GRAPH_STATE_PAUSED);
      }
    }

    graph.render(logStore.currentBlackboxTime);

    seekBar.setCurrentTime(logStore.currentBlackboxTime);
    seekBar.setWindow(graph.getWindowWidthTime());

    if (logStore.flightLog.hasGpsData()) {
      mapGrapher.setCurrentTime(logStore.currentBlackboxTime);
    }

    updateValuesChartRateLimited();

    if (playbackStore.graphState === GRAPH_STATE_PLAY) {
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
    if (!animationFrameIsQueued) {
      animationFrameIsQueued = true;
      requestAnimationFrame(animationLoop);
    }
  }
  graphStore.invalidateGraph = invalidateGraph;
  graphStore.updateCanvasSize = updateCanvasSize;

  function updateCanvasSize() {
    const width = canvas.clientWidth,
      height = canvas.clientHeight;

    if (graph) {
      graph.resize(width, height);
      seekBar.resize(canvas.offsetWidth, 50);
      if (logStore.flightLog.hasGpsData()) {
        mapGrapher.resize(width, height);
      }

      invalidateGraph();
    }
  }

  function setSeekBarMode(mode) {
    graphStore.seekBarMode = mode;
    if (logStore.flightLog) {
      const activity = logStore.flightLog.getActivitySummary();
      seekBar.setActivity(activity.times, activity[mode], activity.hasEvent);
      seekBar.repaint();
    }
  }

  function renderLogFileInfo(file) {
    appStore.logFilename = file.name;

    const logCount = logStore.flightLog.getLogCount();
    const entries = [];
    for (let index = 0; index < logCount; index++) {
      const error = logStore.flightLog.getLogError(index);
      let logLabel;
      if (error) {
        logLabel = error;
      } else {
        logLabel = `${formatTime(
          logStore.flightLog.getMinTime(index) / 1000,
          false,
        )} - ${formatTime(
          logStore.flightLog.getMaxTime(index) / 1000,
          false,
        )} [${formatTime(
          Math.ceil(
            (logStore.flightLog.getMaxTime(index) - logStore.flightLog.getMinTime(index)) / 1000,
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
    logStore.activeLogIndex = logStore.flightLog.getLogIndex();

    if (logStore.flightLog.getNumCellsEstimate()) {
      appStore.statusCells = `${logStore.flightLog.getNumCellsEstimate()}S (${Number(
        logStore.flightLog.getReferenceVoltageMillivolts() / 1000,
      ).toFixed(2)}V)`;
    } else {
      appStore.statusCells = "";
    }

    // Add log version information to status bar
    const sysConfig = logStore.flightLog.getSysConfig();

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
      logStore.flightLog.getMinTime(),
      logStore.flightLog.getMaxTime(),
      logStore.currentBlackboxTime,
    );
    seekBar.setActivityRange(
      logStore.flightLog.getSysConfig().motorOutput[0],
      logStore.flightLog.getSysConfig().motorOutput[1],
    );

    const activity = logStore.flightLog.getActivitySummary();

    seekBar.setActivity(
      activity.times,
      activity[graphStore.seekBarMode],
      activity.hasEvent,
    );
    seekBar.repaint();

    // Add flightLog to map
    if (logStore.flightLog.hasGpsData()) {
      mapGrapher.setFlightLog(logStore.flightLog);
    }
  }

  function setGraphState(newState) {
    playbackStore.graphState = newState;

    lastRenderTime = false;

    switch (newState) {
      case GRAPH_STATE_PLAY:
        if (logStore.hasVideo) {
          video.play();
        }
        break;
      case GRAPH_STATE_PAUSED:
        if (logStore.hasVideo) {
          video.pause();
        }
        break;
    }

    invalidateGraph();
  }

  function setCurrentBlackboxTime(newTime) {
    if (logStore.hasVideo) {
      video.currentTime =
        (newTime - logStore.flightLog.getMinTime()) / 1000000 + playbackStore.videoOffset;

      syncLogToVideo();
    } else {
      logStore.currentBlackboxTime = newTime;
    }

    invalidateGraph();
  }

  function setVideoTime(newTime) {
    video.currentTime = newTime;

    syncLogToVideo();
  }

  function setVideoInTime(inTime) {
    playbackStore.videoExportInTime = inTime;

    if (seekBar) {
      seekBar.setInTime(playbackStore.videoExportInTime);
    }

    if (graph) {
      graph.setInTime(playbackStore.videoExportInTime);
      invalidateGraph();
    }
  }

  function setVideoOutTime(outTime) {
    playbackStore.videoExportOutTime = outTime;

    if (seekBar) {
      seekBar.setOutTime(playbackStore.videoExportOutTime);
    }

    if (graph) {
      graph.setOutTime(playbackStore.videoExportOutTime);
      invalidateGraph();
    }
  }

  function setPlaybackRate(rate, _updateUi) {
    if (rate >= PLAYBACK_MIN_RATE && rate <= PLAYBACK_MAX_RATE) {
      playbackStore.playbackRate = rate;

      if (video) {
        video.playbackRate = rate / 100;
      }
    }
  }

  function setGraphZoom(zoom, _updateUi) {
    if (zoom == null) {
      // go back to last zoom value
      zoom = graphStore.lastGraphZoom;
    }
    if (zoom >= GRAPH_MIN_ZOOM && zoom <= GRAPH_MAX_ZOOM) {
      graphStore.lastGraphZoom = graphStore.graphZoom;
      graphStore.graphZoom = zoom;

      if (graph) {
        graph.setGraphZoom(zoom / 100);
        invalidateGraph();
      }
    }

  }

  function showConfigFile(state) {
    if (graphStore.hasConfig) {
      if (state == null) {
        graphStore.hasConfigOverlay = !graphStore.hasConfigOverlay;
      } else {
        graphStore.hasConfigOverlay = !!state;
      }
    }
  }

  function showValueTable(state) {
    if (state == null) {
      graphStore.hasTableOverlay = !graphStore.hasTableOverlay;
    } else {
      graphStore.hasTableOverlay = !!state;
    }
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
        for (let i = 0; i < logStore.flightLog.getLogCount(); i++) {
          if (logStore.flightLog.openLog(i)) {
            success = true;
            currentOffsetCache.index = i;
            break;
          }
        }

        if (!success) {
          throw "No logs in this file could be parsed successfully";
        }
      } else {
        logStore.flightLog.openLog(logIndex);
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
      logStore.flightLog.getSysConfig().looptime != null &&
      logStore.flightLog.getSysConfig().frameIntervalPNum != null &&
      logStore.flightLog.getSysConfig().frameIntervalPDenom != null
    ) {
      userSettings.analyserSampleRate =
        1000000 /
        ((logStore.flightLog.getSysConfig().looptime *
          validate(logStore.flightLog.getSysConfig().pid_process_denom, 1) *
          logStore.flightLog.getSysConfig().frameIntervalPDenom) /
          logStore.flightLog.getSysConfig().frameIntervalPNum);
    }

    graph = new FlightLogGrapher(
      logStore.flightLog,
      graphStore.activeGraphConfig,
      canvas,
      stickCanvas,
      craftCanvas,
      analyserCanvas,
      userSettings,
    );
    graphStore.graph = graph;

    setVideoInTime(false);
    setVideoOutTime(false);

    graphStore.activeGraphConfig.adaptGraphs(logStore.flightLog, graphConfig);

    graph.onSeek = function (offset) {
      //Seek faster
      offset *= 2;

      if (logStore.hasVideo) {
        setVideoTime(video.currentTime + offset / 1000000);
      } else {
        setCurrentBlackboxTime(logStore.currentBlackboxTime + offset);
      }
      invalidateGraph();
    };

    if (logStore.hasVideo) {
      syncLogToVideo();
    } else {
      // Start at beginning:
      logStore.currentBlackboxTime = logStore.flightLog.getMinTime();
    }

    renderSelectedLogInfo();

    updateCanvasSize();

    setGraphState(GRAPH_STATE_PAUSED);
    setGraphZoom(graphStore.graphZoom, true);
  }

  function loadFiles(files) {
    for (const file of files) {
      let isLog = file.name.match(/\.(BBL|TXT|CFL|BFL|LOG)$/i);
      let isVideo = file.name.match(/\.(AVI|MOV|MP4|MPEG)$/i);
      const isWorkspaces = file.name.match(/\.(JSON)$/i);

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
        loadWorkspaces(file, workspaceStore, onSwitchWorkspace);
      }
    }

    // finally, see if there is an offsetCache value already, and auto set the offset
    for (const cahesOffset of offsetCache) {
      if (
        currentOffsetCache.log === cahesOffset.log &&
        currentOffsetCache.index === cahesOffset.index &&
        currentOffsetCache.video === cahesOffset.video
      ) {
        setVideoOffset(cahesOffset.offset, true);
      }
    }
  }

  function loadLogFile(file) {
    const reader = new FileReader();

    reader.onload = function (e) {
      const bytes = e.target.result;

      const fileContents = String.fromCodePoint(
        ...new Uint8Array(bytes, 0, 100),
      );

      if (/# dump|# diff/i.exec(fileContents)) {
        // this is actually a configuration file
        try {
          // Firstly, is this a configuration defaults file
          // (the filename contains the word 'default')

          if (file.name.match(/default/i)) {
            configurationDefaults.loadFile(file);
          } else {
            _configuration = new Configuration(file);
            graphStore.hasConfig = true;
          }
        } catch {
          _configuration = null;
          graphStore.hasConfig = false;
        }
        return;
      }

      logStore.flightLogDataArray = new Uint8Array(bytes);

      try {
        logStore.flightLog = new FlightLog(logStore.flightLogDataArray);
      } catch (err) {
        alert(
          `Sorry, an error occurred while trying to open this log:\n\n${err}`,
        );
        return;
      }

      if (!graphConfig) {
        graphConfig = GraphConfig.getExampleGraphConfigs(logStore.flightLog, [
          "Motors",
          "Gyros",
        ]);
      }

      renderLogFileInfo(file);
      graphStore.seekBarMode = "avgThrottle";
      currentOffsetCache.log = file.name; // store the name of the loaded log file
      currentOffsetCache.index = null; // and clear the index

      logStore.hasLog = true;

      setTimeout(function () {
        globalThis.dispatchEvent(new Event("resize"));
      }, 500); // refresh the window size;

      selectLog(null);

      if (graph) {
        graph.setAnalyser(graphStore.hasAnalyserFullscreen);
      }
    };

    reader.readAsArrayBuffer(file);
  }

  function loadVideo(file) {
    currentOffsetCache.video = file.name; // store the name of the loaded video
    if (logStore.videoURL) {
      URL.revokeObjectURL(logStore.videoURL);
      logStore.videoURL = null;
    }

    if (!URL.createObjectURL) {
      alert(
        "Sorry, your web browser doesn't support showing videos from your local computer.",
      );
      currentOffsetCache.video = null; // clear the associated video name
      return;
    }

    logStore.videoURL = URL.createObjectURL(file);
    video.volume = 1.0;
    video.src = logStore.videoURL;

    // Reapply the last playbackStore.playbackRate to the new video
    setPlaybackRate(playbackStore.playbackRate, true);
  }

  function videoLoaded(_e) {
    logStore.hasVideo = true;

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

  // buildLegendGraphs, onLegendVisbilityChange, onLegendSelectionChange,
  // onLegendHighlightChange, onLegendToggleField moved to graphStore actions

  function setMarker(state) {
    graphStore.hasMarker = state;
  }


  // getMarker, getBookmarks, getBookmarkTimes — grapher.js reads stores directly

  appStore.refreshGraph = () => {
    if (graph !== null) {
      ThemeColors.clearCache();
      graph.refreshTheme();
      invalidateGraph();
    }
    if (seekBar !== null && typeof seekBar.refreshTheme === "function") {
      seekBar.refreshTheme();
    }
  };



  function newGraphConfig(newConfig, noRedraw) {
    lastGraphConfig = graphConfig; // Remember the last configuration.
    graphConfig = newConfig;
    graphStore.activeGraphConfig.setRedrawChart(noRedraw ? false : true);
    graphStore.activeGraphConfig.adaptGraphs(logStore.flightLog, graphConfig);

    prefs.set("graphConfig", graphConfig);
  }

  // Store to local cache and update Workspace Selector control
  function onSwitchWorkspace(newWorkspaces, newActiveId) {
    prefs.set("activeWorkspace", newActiveId);
    prefs.set("workspaceGraphConfigs", newWorkspaces);
    workspaceStore.workspaceGraphConfigs = newWorkspaces || [];
    workspaceStore.activeWorkspace = newActiveId;
    if (
      logStore.flightLog &&
      newWorkspaces[newActiveId] &&
      newWorkspaces[newActiveId].graphConfig
    ) {
      newGraphConfig(newWorkspaces[newActiveId].graphConfig);
      graphStore.legendTitle = newWorkspaces[newActiveId].title;
    }
  }

  // Save current config
  function onSaveWorkspace(id, title) {
    workspaceStore.workspaceGraphConfigs[id] = {
      title: title,
      graphConfig: graphConfig,
    };
    onSwitchWorkspace(workspaceStore.workspaceGraphConfigs, id);
  }

  graphStore.activeGraphConfig.addListener(function () {
    graphStore.buildLegendGraphs();
    invalidateGraph();
  });

  let logJumpBack, logJumpForward, logJumpStart, logJumpEnd, logPlayPause;

  // Initialize on DOM ready (modules are deferred, DOM is ready)
  {
    // Initialize dark theme
    DarkTheme.init(prefs);

    // Version information
    appStore.statusViewerVersion = `v${__APP_VERSION__}`;

    graphStore.buildLegendGraphs();

    // initial load of the configuration defaults if we have them
    prefs.get("workspaceGraphConfigs", function (item) {
      if (item) {
        workspaceStore.workspaceGraphConfigs = upgradeWorkspaceFormat(item);
      } else {
        workspaceStore.workspaceGraphConfigs = structuredClone(ctzsnoozeWorkspace);
      }
    });

    prefs.get("activeWorkspace", function (id) {
      if (id) {
        workspaceStore.activeWorkspace = id;
      } else {
        workspaceStore.activeWorkspace = 1;
      }
    });

    onSwitchWorkspace(workspaceStore.workspaceGraphConfigs, workspaceStore.activeWorkspace);

    prefs.get("log-legend-hidden", function (item) {
      if (item) {
        graphStore.legendVisible = false;
      }
    });

    graphStore.hasTableOverlay = false;

    // Reset the analyser window on application startup.
    graphStore.hasAnalyser = false;

    // File open and new window wired via Vue AppToolbar

    logJumpBack = function (fast, slow) {
      let scrollTime = SMALL_JUMP_TIME;
      if (fast != null) {
        scrollTime =
          fast === 0 ? scrollTime : graph.getWindowWidthTime() * fast;
      }
      if (logStore.hasVideo) {
        if (slow) {
          scrollTime = (1 / 60) * 1000000;
        } // Assume 60Hz video
        setVideoTime(video.currentTime - scrollTime / 1000000);
      } else {
        const currentFrame = logStore.flightLog.getCurrentFrameAtTime(
          logStore.hasVideo ? video.currentTime : logStore.currentBlackboxTime,
        );
        if (currentFrame && currentFrame.previous && slow) {
          setCurrentBlackboxTime(
            currentFrame.previous[
              FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME
            ],
          );
        } else {
          setCurrentBlackboxTime(logStore.currentBlackboxTime - scrollTime);
        }
      }

      setGraphState(GRAPH_STATE_PAUSED);
    };
    // Playback buttons wired via Vue PlaybackControls bridge

    logJumpForward = function (fast, slow) {
      let scrollTime = SMALL_JUMP_TIME;
      if (fast != null) {
        scrollTime =
          fast === 0 ? scrollTime : graph.getWindowWidthTime() * fast;
      }
      if (logStore.hasVideo) {
        if (slow) {
          scrollTime = (1 / 60) * 1000000;
        } // Assume 60Hz video
        setVideoTime(video.currentTime + scrollTime / 1000000);
      } else {
        const currentFrame = logStore.flightLog.getCurrentFrameAtTime(
          logStore.hasVideo ? video.currentTime : logStore.currentBlackboxTime,
        );
        if (currentFrame && currentFrame.next && slow) {
          setCurrentBlackboxTime(
            currentFrame.next[
              FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME
            ],
          );
        } else {
          setCurrentBlackboxTime(logStore.currentBlackboxTime + scrollTime);
        }
      }

      setGraphState(GRAPH_STATE_PAUSED);
    };
    logJumpStart = function () {
      setCurrentBlackboxTime(logStore.flightLog.getMinTime());
      setGraphState(GRAPH_STATE_PAUSED);
    };

    logJumpEnd = function () {
      setCurrentBlackboxTime(logStore.flightLog.getMaxTime());
      setGraphState(GRAPH_STATE_PAUSED);
    };

    logPlayPause = function () {
      if (playbackStore.graphState === GRAPH_STATE_PAUSED) {
        setGraphState(GRAPH_STATE_PLAY);
      } else {
        setGraphState(GRAPH_STATE_PAUSED);
      }
    };

    const logSyncHere = function () {
      setVideoOffset(video.currentTime, true);
    };

    const logSyncBack = function () {
      setVideoOffset(playbackStore.videoOffset - 1 / 15, true);
    };

    const logSyncForward = function () {
      setVideoOffset(playbackStore.videoOffset + 1 / 15, true);
    };

    const logSmartSync = function () {
      if (graphStore.hasMarker && logStore.hasVideo && logStore.hasLog) {
        try {
          setVideoOffset(
            playbackStore.videoOffset + (logStore.currentBlackboxTime - graphStore.markerTime) / 1000000,
            true,
          );
        } catch {
          console.log("Failed to set video offset");
        }
      }
      setMarker(!graphStore.hasMarker);
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

      if (graphConfig.length === 1) {
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

    // Workspace/navigation callbacks registered on stores
    workspaceStore.gotoBookmark = (index) => {
      if (workspaceStore.bookmarkTimes?.[index] != null) {
        setCurrentBlackboxTime(workspaceStore.bookmarkTimes[index]);
        invalidateGraph();
      }
    };

    // Spectrum callbacks registered on graphStore
    graphStore.spectrumExport = () => exportSpectrumToCsv(graph.getAnalyser(), appStore.logFilename);
    graphStore.spectrumImport = (files) => graph.getAnalyser()?.importSpectrumFromCSV(files);
    graphStore.spectrumClear = () => graph.getAnalyser()?.removeImportedSpectrums();

    // GPX export wired via Vue AppToolbar

    window.addEventListener("resize", function () {
      updateCanvasSize();
    });

    function toggleOverrideStatus(userSetting) {
      settingsStore.saveSetting(userSetting, !userSettings[userSetting]);
    }

    // Watch override settings and refresh graph when they change
    watch(
      () => [userSettings.graphSmoothOverride, userSettings.graphExpoOverride, userSettings.graphGridOverride],
      () => {
        if (graph) {
          graph.refreshOptions(userSettings);
          graph.refreshGraphConfig();
          invalidateGraph();
        }
      },
    );

    // Watch drawSticks and update graph renderer
    watch(
      () => userSettings.drawSticks,
      (val) => {
        if (graph) {
          graph.setDrawSticks(val);
          invalidateGraph();
        }
      },
    );

    // Middle-click pen reset wired via Vue LegendPanel

    function handleGraphCanvasWheel(e, delta) {
      const zoomStep = 10 + (e.altKey ? 15 : 0);
      if (delta < 0) {
        if (e.altKey || e.shiftKey) {
          setGraphZoom(graphStore.graphZoom - zoomStep, true);
        } else {
          logJumpBack(0.1);
        }
      } else {
        if (e.altKey || e.shiftKey) {
          setGraphZoom(graphStore.graphZoom + zoomStep, true);
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
          document.getElementById("log-graph"),
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

    document.addEventListener("keydown", createKeydownHandler({
      hasGraph: () => graph != null,
      graphStore, logStore, playbackStore, workspaceStore, appStore,
      logPlayPause, logJumpBack, logJumpForward, logJumpStart, logJumpEnd,
      logSmartSync, setGraphZoom, setVideoInTime, setVideoOutTime, setMarker,
      setCurrentBlackboxTime, showValueTable, showConfigFile, newGraphConfig,
      toggleOverrideStatus, invalidateGraph, makeScreenshot,
      onSwitchWorkspace, onSaveWorkspace,
      lastGraphConfig: () => lastGraphConfig,
    }));

    video.addEventListener("loadedmetadata", updateCanvasSize);
    video.addEventListener("error", reportVideoError);
    video.addEventListener("loadeddata", videoLoaded);

    // Speed/Zoom sliders and navbar toggle wired via Vue

    seekBar.onSeek = setCurrentBlackboxTime;

    // Drag-and-drop wired via App.vue

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
        playbackStore.videoConfig = item;
      } else {
        playbackStore.videoConfig = {
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

    // Legend actions: highlight, select, toggleField, legendVisibilityChange moved to graphStore
    // Legend callbacks: closure-dependent methods registered on graphStore
    graphStore.zoomGraphConfig = (gi) => zoomGraphConfig(gi);
    graphStore.expandGraphConfig = (gi) => expandGraphConfig(gi);
    graphStore.reorderGraphs = (newOrder) => {
      const oldGraphs = graphConfig;
      const newGraphs = newOrder.map((i) => oldGraphs[i]);
      newGraphConfig(newGraphs);
    };
    graphStore.resetPen = (gi, fi) => {
      const graphs = graphStore.activeGraphConfig.getGraphs();
      const msg = restorePenDefaults(graphs, String(gi), fi == null ? null : String(fi));
      applyPenChange(msg);
    };
    graphStore.fieldWheel = (gi, fi, delta, shiftKey, altKey, ctrlKey) => {
      const graphs = graphStore.activeGraphConfig.getGraphs();
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
    // Video sync callbacks registered on playbackStore
    playbackStore.logSyncHere = () => logSyncHere();
    playbackStore.logSyncBack = () => logSyncBack();
    playbackStore.logSyncForward = () => logSyncForward();
    playbackStore.logSmartSync = () => logSmartSync();
    playbackStore.setVideoOffsetValue = (val) => {
      const offset = Number.parseFloat(val);
      if (!Number.isNaN(offset)) {
        setVideoOffset(offset, true);
      }
    };
    playbackStore.setGraphTime = (timeStr) => {
      let newTime = stringTimetoMsec(timeStr);
      if (!isNaN(newTime)) {
        if (logStore.hasVideo) {
          setVideoTime(newTime / 1000000 + playbackStore.videoOffset);
        } else {
          newTime += logStore.flightLog?.getMinTime() ?? 0;
          setCurrentBlackboxTime(newTime);
        }
        invalidateGraph();
      }
    };
    graphStore.setSeekBarMode = (mode) => setSeekBarMode(mode);
    graphStore.selectLogIndex = (index) => {
      selectLog(Number.parseInt(index, 10));
      if (graph) {
        graph.setAnalyser(graphStore.hasAnalyserFullscreen);
      }
    };
    workspaceStore.switchWorkspace = (id) => {
      if (workspaceStore.workspaceGraphConfigs[id] != null) {
        onSwitchWorkspace(workspaceStore.workspaceGraphConfigs, id);
      }
    };
    workspaceStore.saveWorkspace = (id, title) => onSaveWorkspace(id, title);
    workspaceStore.applyDefaultWorkspace = (index) => {
      const presets = [null, structuredClone(ctzsnoozeWorkspace), structuredClone(supaflyWorkspace)];
      if (presets[index]) {
        onSwitchWorkspace(presets[index], 1);
      }
    };
  }

  // Callbacks registered on stores — replaces this.* controller bridge
  appStore.loadFiles = loadFiles;
  appStore.newGraphConfig = (newConfig, redrawChart) => newGraphConfig(newConfig, !redrawChart);
  appStore.exportCsv = () => {
    setGraphState(GRAPH_STATE_PAUSED);
    exportCsv(logStore.flightLog, appStore.logFilename);
  };
  appStore.exportGpx = () => {
    setGraphState(GRAPH_STATE_PAUSED);
    exportGpx(logStore.flightLog, appStore.logFilename);
  };
  appStore.exportWorkspaces = () => {
    setGraphState(GRAPH_STATE_PAUSED);
    saveWorkspaces(workspaceStore.workspaceGraphConfigs);
  };
  appStore.pauseForExport = () => setGraphState(GRAPH_STATE_PAUSED);
  appStore.getVideoExportParams = () => ({
    graphConfig: graphStore.activeGraphConfig,
    inTime: playbackStore.videoExportInTime,
    outTime: playbackStore.videoExportOutTime,
    flightVideo: logStore.hasVideo && appStore.viewVideo ? video.cloneNode() : false,
    flightVideoOffset: playbackStore.videoOffset,
    hasCraft: userSettings.drawCraft,
    hasAnalyser: graphStore.hasAnalyser,
    hasSticks: userSettings.drawSticks,
  });
  appStore.saveVideoConfig = (newConfig) => {
    playbackStore.videoConfig = newConfig;
    prefs.set("videoConfig", newConfig);
  };
  appStore.openNewWindow = () => createNewBlackboxWindow();
  appStore.saveUserSettings = (newSettings) => {
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
  graphStore.applyGraphZoom = (zoom) => setGraphZoom(zoom, false);
  playbackStore.applyPlaybackRate = (rate) => setPlaybackRate(rate, false);
  // Playback callbacks registered on playbackStore
  playbackStore.logPlayPause = () => logPlayPause();
  playbackStore.logJumpBack = () => logJumpBack(null);
  playbackStore.logJumpForward = () => logJumpForward(null);
  playbackStore.logJumpStart = () => logJumpStart();
  playbackStore.logJumpEnd = () => logJumpEnd();
  playbackStore.videoJumpStart = () => {
    setVideoTime(0);
    setGraphState(GRAPH_STATE_PAUSED);
  };
  playbackStore.videoJumpEnd = () => {
    if (video.duration) {
      setVideoTime(video.duration);
      setGraphState(GRAPH_STATE_PAUSED);
    }
  };

}

new BlackboxLogViewer(); // NOSONAR — constructor registers callbacks on Pinia stores

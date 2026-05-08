import "./vendor.js";

import { MapGrapher } from "./graph_map.js";
import { FlightLogGrapher } from "./grapher.js";
import { Configuration, ConfigurationDefaults } from "./configuration.js";
import { GraphConfig } from "./graph_config.js";
import { SeekBar } from "./seekbar.js";
import ctzsnoozeWorkspace from "./ws_ctzsnooze.json";
import supaflyWorkspace from "./ws_supafly.json";
import { FlightLog } from "./flightlog.js";
import {
  stringTimetoMsec,
  validate,
  mouseNotification,
} from "./tools.js";
import { restorePenDefaults, changePenSmoothing, changePenZoom, changePenExpo } from "./pen_adjustment.js";
import { createKeydownHandler } from "./keyboard_handler.js";
import { upgradeWorkspaceFormat, saveWorkspaces, loadWorkspaces } from "./workspace_io.js";
import { exportCsv, exportGpx, exportSpectrumToCsv } from "./export_utils.js";
import { syncLogToVideo, setVideoOffset, setVideoTime, setVideoInTime, setVideoOutTime, loadVideo, reportVideoError } from "./video_handler.js";
import { renderLogFileInfo, renderSelectedLogInfo, setSeekBarMode } from "./log_lifecycle.js";
import { invalidateGraph, updateCanvasSize, setGraphState, setCurrentBlackboxTime, setPlaybackRate, setGraphZoom, showConfigFile, showValueTable, logJumpBack, logJumpForward, logJumpStart, logJumpEnd, logPlayPause, setMarker, logSyncHere, logSyncBack, logSyncForward, logSmartSync, videoLoaded } from "./playback_controls.js";
import { PrefStorage } from "./pref_storage.js";
import { makeScreenshot } from "./screenshot.js";
import { DarkTheme } from "./dark_theme.js";
import { ThemeColors } from "./theme_colors.js";
import pinia from "./pinia_instance.js";
import { useLogStore } from "./stores/log.js";
import { useGraphStore } from "./stores/graph.js";
import { usePlaybackStore, GRAPH_STATE_PAUSED } from "./stores/playback.js";
import { useWorkspaceStore } from "./stores/workspace.js";
import { useAppStore } from "./stores/app.js";
import { useSettingsStore } from "./stores/settings.js";
import { watch } from "vue";


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

  let graph = null;
  const prefs = new PrefStorage();
  const configurationDefaults = new ConfigurationDefaults(prefs);
  const video = document.getElementById("logVideo");
  const canvas = document.getElementById("graphCanvas");
  const analyserCanvas = document.getElementById("analyserCanvas");
  const stickCanvas = document.getElementById("stickCanvas");
  const craftCanvas = document.getElementById("craftCanvas");
  let userSettings;
  const seekBarCanvas = document.getElementById("seekbarCanvas");
  const seekBar = new SeekBar(seekBarCanvas);
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
  graphStore.seekBar = seekBar;
  graphStore.canvasRefs = { canvas, analyserCanvas, stickCanvas, craftCanvas };
  playbackStore.videoElement = video;


  graphStore.invalidateGraph = invalidateGraph;
  graphStore.updateCanvasSize = updateCanvasSize;

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
            playbackStore.currentOffsetCache.index = i;
            break;
          }
        }

        if (!success) {
          throw "No logs in this file could be parsed successfully";
        }
      } else {
        logStore.flightLog.openLog(logIndex);
        playbackStore.currentOffsetCache.index = logIndex;
      }
    } catch (e) {
      alert(`Error opening log: ${e}`);
      playbackStore.currentOffsetCache.index = null;
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

    graphStore.activeGraphConfig.adaptGraphs(logStore.flightLog, graphStore.graphConfig);

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
    for (const cahesOffset of playbackStore.offsetCache) {
      if (
        playbackStore.currentOffsetCache.log === cahesOffset.log &&
        playbackStore.currentOffsetCache.index === cahesOffset.index &&
        playbackStore.currentOffsetCache.video === cahesOffset.video
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
            new Configuration(file); // NOSONAR — side effect: sets graphStore.configLines
            graphStore.hasConfig = true;
          }
        } catch {
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

      if (!graphStore.graphConfig) {
        graphStore.graphConfig = GraphConfig.getExampleGraphConfigs(logStore.flightLog, [
          "Motors",
          "Gyros",
        ]);
      }

      renderLogFileInfo(file);
      graphStore.seekBarMode = "avgThrottle";
      playbackStore.currentOffsetCache.log = file.name; // store the name of the loaded log file
      playbackStore.currentOffsetCache.index = null; // and clear the index

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
    graphStore.lastGraphConfig = graphStore.graphConfig; // Remember the last configuration.
    graphStore.graphConfig = newConfig;
    graphStore.activeGraphConfig.setRedrawChart(noRedraw ? false : true);
    graphStore.activeGraphConfig.adaptGraphs(logStore.flightLog, graphStore.graphConfig);

    prefs.set("graphConfig", graphStore.graphConfig);
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
      graphConfig: graphStore.graphConfig,
    };
    onSwitchWorkspace(workspaceStore.workspaceGraphConfigs, id);
  }

  graphStore.activeGraphConfig.addListener(function () {
    graphStore.buildLegendGraphs();
    invalidateGraph();
  });

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

    function expandGraphConfig(index) {
      // Put each of the fields into a separate graph

      const expandedGraphConfig = [];

      for (const field of graphStore.graphConfig[index].fields) {
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

      if (graphStore.graphConfig.length === 1) {
        // if there is only one graph, then return to previous configuration
        if (graphStore.lastGraphConfig != null) {
          newGraphConfig(graphStore.lastGraphConfig);
        }
      } else {
        const expandedGraphConfig = [];
        const singleGraph = { fields: [], label: "", height: 1 };

        for (const field of graphStore.graphConfig[index].fields) {
          // Loop through each of the fields
          singleGraph.fields.push(field);
          singleGraph.label = graphStore.graphConfig[index].label;
        }
        expandedGraphConfig.push(singleGraph);

        newGraphConfig(expandedGraphConfig);
      }
      invalidateGraph();
    }
    userSettings = settingsStore.userSettings;
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
      lastGraphConfig: () => graphStore.lastGraphConfig,
    }));

    video.addEventListener("loadedmetadata", updateCanvasSize);
    video.addEventListener("error", reportVideoError);
    video.addEventListener("loadeddata", videoLoaded);

    seekBar.onSeek = setCurrentBlackboxTime;

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
        graphStore.graphConfig = GraphConfig.load(item);
      }
    });

    // Get the offsetCache buffer
    prefs.get("offsetCache", function (item) {
      if (item) {
        playbackStore.offsetCache = item;
      }
    });

    graphStore.zoomGraphConfig = (gi) => zoomGraphConfig(gi);
    graphStore.expandGraphConfig = (gi) => expandGraphConfig(gi);
    graphStore.reorderGraphs = (newOrder) => {
      const oldGraphs = graphStore.graphConfig;
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
    playbackStore.logSyncHere = logSyncHere;
    playbackStore.logSyncBack = logSyncBack;
    playbackStore.logSyncForward = logSyncForward;
    playbackStore.logSmartSync = logSmartSync;
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
    graphStore.setSeekBarMode = setSeekBarMode;
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
  graphStore.applyGraphZoom = setGraphZoom;
  playbackStore.applyPlaybackRate = setPlaybackRate;
  playbackStore.logPlayPause = logPlayPause;
  playbackStore.logJumpBack = () => logJumpBack(null);
  playbackStore.logJumpForward = () => logJumpForward(null);
  playbackStore.logJumpStart = logJumpStart;
  playbackStore.logJumpEnd = logJumpEnd;
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

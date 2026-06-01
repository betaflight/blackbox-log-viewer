import "../vendor.js";

import { MapGrapher } from "../graph_map.js";
import { FlightLogGrapher } from "../grapher.js";
import { Configuration, ConfigurationDefaults } from "../configuration.js";
import { GraphConfig } from "../graph_config.js";
import { SeekBar } from "../seekbar.js";
import ctzsnoozeWorkspace from "../ws_ctzsnooze.json";
import supaflyWorkspace from "../ws_supafly.json";
import { FlightLog } from "../flightlog.js";
import {
  stringTimetoMsec,
  validate,
  mouseNotification,
} from "../tools.js";
import { restorePenDefaults, changePenSmoothing, changePenZoom, changePenExpo } from "../pen_adjustment.js";
import { createKeydownHandler } from "../keyboard_handler.js";
import { upgradeWorkspaceFormat, saveWorkspaces, loadWorkspaces } from "../workspace_io.js";
import { exportCsv, exportGpx, exportSpectrumToCsv } from "../export_utils.js";
import { syncLogToVideo, setVideoOffset, setVideoTime, setVideoInTime, setVideoOutTime, loadVideo, reportVideoError } from "../video_handler.js";
import { renderLogFileInfo, renderSelectedLogInfo, setSeekBarMode } from "../log_lifecycle.js";
import { invalidateGraph, updateCanvasSize, setGraphState, setCurrentBlackboxTime, setPlaybackRate, setGraphZoom, showConfigFile, showValueTable, logJumpBack, logJumpForward, logJumpStart, logJumpEnd, logPlayPause, setMarker, logSyncHere, logSyncBack, logSyncForward, logSmartSync, videoLoaded } from "../playback_controls.js";
import { PrefStorage } from "../pref_storage.js";
import { makeScreenshot } from "../screenshot.js";
import { DarkTheme } from "../dark_theme.js";
import { ThemeColors } from "../theme_colors.js";
import pinia from "../pinia_instance.js";
import { useLogStore } from "../stores/log.js";
import { useGraphStore } from "../stores/graph.js";
import { usePlaybackStore, GRAPH_STATE_PAUSED } from "../stores/playback.js";
import { useWorkspaceStore } from "../stores/workspace.js";
import { useAppStore } from "../stores/app.js";
import { useSettingsStore } from "../stores/settings.js";
import { watch } from "vue";
import type { BlackboxViewerOps } from "./blackbox_viewer_ops";

// flightLog, renderer instances, the user-settings bag and the various
// graph/workspace config objects are free-form structures from the still-loose
// layer; access stays loose, consistent with the rest of the migration.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

function createNewBlackboxWindow(_fileToOpen?: Loose) {
  globalThis.open(globalThis.location.href, "_blank")!.focus();
}

// Imperative operations exposed to components (the legacy callback bridge,
// collapsed). Shared by reference and populated by initBlackboxViewer().
const ops = {} as BlackboxViewerOps;
let initialized = false;

// Components call this in setup() to reach the operations. It does NOT trigger
// initialization — it just hands back the shared `ops` object (populated once
// the viewer is initialized at bootstrap).
export function useBlackboxViewer(): BlackboxViewerOps {
  return ops;
}

// Owns the renderer instances and wires the operations. Must run AFTER the Vue
// app has mounted, so Vue-rendered canvases (e.g. #analyserCanvas, rendered by
// SpectrumAnalyser.vue) exist. Called once from main.js.
export function initBlackboxViewer(): BlackboxViewerOps {
  if (initialized) {
    return ops;
  }
  initialized = true;

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

  let graph: Loose = null;
  const prefs = new (PrefStorage as unknown as new () => PrefStorage)();
  const configurationDefaults = new (ConfigurationDefaults as Loose)(prefs);
  const video = document.getElementById("logVideo") as HTMLVideoElement;
  const canvas = document.getElementById("graphCanvas") as HTMLCanvasElement;
  const analyserCanvas = document.getElementById("analyserCanvas") as HTMLCanvasElement;
  const stickCanvas = document.getElementById("stickCanvas") as HTMLCanvasElement;
  const craftCanvas = document.getElementById("craftCanvas") as HTMLCanvasElement;
  let userSettings: Loose;
  const seekBarCanvas = document.getElementById("seekbarCanvas") as HTMLCanvasElement;
  const seekBar = new (SeekBar as Loose)(seekBarCanvas);
  const mapGrapher = new (MapGrapher as Loose)();

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
  graphStore.activeGraphConfig = new (GraphConfig as Loose)();
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
  function selectLog(logIndex: number | null) {
    let success = false;

    try {
      if (logIndex === null) {
        for (let i = 0; i < (logStore.flightLog as Loose).getLogCount(); i++) {
          if ((logStore.flightLog as Loose).openLog(i)) {
            success = true;
            playbackStore.currentOffsetCache.index = i;
            break;
          }
        }

        if (!success) {
          throw "No logs in this file could be parsed successfully";
        }
      } else {
        (logStore.flightLog as Loose).openLog(logIndex);
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
      (logStore.flightLog as Loose).getSysConfig().looptime != null &&
      (logStore.flightLog as Loose).getSysConfig().frameIntervalPNum != null &&
      (logStore.flightLog as Loose).getSysConfig().frameIntervalPDenom != null
    ) {
      userSettings.analyserSampleRate =
        1000000 /
        (((logStore.flightLog as Loose).getSysConfig().looptime *
          validate((logStore.flightLog as Loose).getSysConfig().pid_process_denom, 1) *
          (logStore.flightLog as Loose).getSysConfig().frameIntervalPDenom) /
          (logStore.flightLog as Loose).getSysConfig().frameIntervalPNum);
    }

    graph = new (FlightLogGrapher as Loose)(
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

    graph.onSeek = function (offset: number) {
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
      logStore.currentBlackboxTime = (logStore.flightLog as Loose).getMinTime();
    }

    renderSelectedLogInfo();

    updateCanvasSize();

    setGraphState(GRAPH_STATE_PAUSED);
    setGraphZoom(graphStore.graphZoom, true);
  }

  function loadFiles(files: Loose) {
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
        loadWorkspaces(file, workspaceStore as Loose, onSwitchWorkspace);
      }
    }

    // finally, see if there is an offsetCache value already, and auto set the offset
    for (const cahesOffset of playbackStore.offsetCache) {
      if (
        playbackStore.currentOffsetCache.log === cahesOffset.log &&
        playbackStore.currentOffsetCache.index === cahesOffset.index &&
        playbackStore.currentOffsetCache.video === cahesOffset.video
      ) {
        setVideoOffset(cahesOffset.offset as number, true);
      }
    }
  }

  function loadLogFile(file: File) {
    const reader = new FileReader();

    reader.onload = function (e: Loose) {
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
            new (Configuration as Loose)(file); // NOSONAR — side effect: sets graphStore.configLines
            graphStore.hasConfig = true;
          }
        } catch {
          graphStore.hasConfig = false;
        }
        return;
      }

      logStore.flightLogDataArray = new Uint8Array(bytes);

      try {
        logStore.flightLog = new (FlightLog as unknown as new (d: Loose) => FlightLog)(logStore.flightLogDataArray);
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

  const refreshGraph = () => {
    if (graph !== null) {
      ThemeColors.clearCache();
      graph.refreshTheme();
      invalidateGraph();
    }
    if (seekBar !== null && typeof seekBar.refreshTheme === "function") {
      seekBar.refreshTheme();
    }
  };



  function newGraphConfig(newConfig: Loose, noRedraw?: Loose) {
    graphStore.lastGraphConfig = graphStore.graphConfig; // Remember the last configuration.
    graphStore.graphConfig = newConfig;
    graphStore.activeGraphConfig.setRedrawChart(!noRedraw);
    graphStore.activeGraphConfig.adaptGraphs(logStore.flightLog, graphStore.graphConfig);

    prefs.set("graphConfig", graphStore.graphConfig);
  }

  // Store to local cache and update Workspace Selector control
  function onSwitchWorkspace(newWorkspaces: Loose, newActiveId: Loose) {
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
  function onSaveWorkspace(id: Loose, title: Loose) {
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
        workspaceStore.workspaceGraphConfigs = upgradeWorkspaceFormat(item) as Loose;
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

    function expandGraphConfig(index: number) {
      // Put each of the fields into a separate graph

      const expandedGraphConfig = [];

      for (const field of graphStore.graphConfig[index].fields) {
        // Loop through each of the fields
        const singleGraph = { fields: [] as Loose[], label: "", height: 1 };
        singleGraph.fields.push(field);
        singleGraph.label = field.name;
        expandedGraphConfig.push(singleGraph);
      }

      newGraphConfig(expandedGraphConfig);
      invalidateGraph();
    }

    function zoomGraphConfig(index: number) {
      // Put each of the fields onto one graph and clear the others

      if (graphStore.graphConfig.length === 1) {
        // if there is only one graph, then return to previous configuration
        if (graphStore.lastGraphConfig != null) {
          newGraphConfig(graphStore.lastGraphConfig);
        }
      } else {
        const expandedGraphConfig = [];
        const singleGraph = { fields: [] as Loose[], label: "", height: 1 };

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
    ops.gotoBookmark = (index) => {
      if (workspaceStore.bookmarkTimes?.[index] != null) {
        setCurrentBlackboxTime(workspaceStore.bookmarkTimes[index]);
        invalidateGraph();
      }
    };

    // Spectrum operations (exposed via the composable return; no longer on graphStore)
    ops.spectrumExport = () => exportSpectrumToCsv(graph.getAnalyser(), appStore.logFilename);
    ops.spectrumImport = (files) => graph.getAnalyser()?.importSpectrumFromCSV(files);
    ops.spectrumClear = () => graph.getAnalyser()?.removeImportedSpectrums();

    window.addEventListener("resize", function () {
      updateCanvasSize();
    });

    function toggleOverrideStatus(userSetting: Loose) {
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
      (val: Loose) => {
        if (graph) {
          graph.setDrawSticks(val);
          invalidateGraph();
        }
      },
    );

    function handleGraphCanvasWheel(e: Loose, delta: number) {
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

    function applyPenChange(refreshRequired: Loose) {
      if (refreshRequired) {
        graph.refreshGraphConfig();
        invalidateGraph();
        mouseNotification.show(
          document.getElementById("log-graph")!,
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
      function (e: Loose) {
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
      (globalThis as Loose).launchQueue.setConsumer(async (launchParams: Loose) => {
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

    ops.zoomGraphConfig = (gi) => zoomGraphConfig(gi);
    ops.expandGraphConfig = (gi) => expandGraphConfig(gi);
    ops.reorderGraphs = (newOrder) => {
      const oldGraphs = graphStore.graphConfig;
      const newGraphs = newOrder.map((i) => oldGraphs[i]);
      newGraphConfig(newGraphs);
    };
    ops.resetPen = (gi, fi) => {
      const graphs = graphStore.activeGraphConfig.getGraphs();
      const msg = restorePenDefaults(graphs, String(gi), fi == null ? null : String(fi));
      applyPenChange(msg);
    };
    ops.fieldWheel = (gi, fi, delta, shiftKey, altKey, ctrlKey) => {
      const graphs = graphStore.activeGraphConfig.getGraphs();
      const g = String(gi);
      const f = String(fi);
      const increase = delta >= 0;
      let msg = null;
      if (shiftKey) {
        msg = changePenZoom(graphs, g, f, increase);
      } else if (altKey) {
        msg = changePenExpo(graphs, g, f, increase);
      } else if (ctrlKey) {
        msg = changePenSmoothing(graphs, g, f, increase);
      }
      applyPenChange(msg);
    };
    ops.logSyncHere = logSyncHere;
    ops.logSyncBack = logSyncBack;
    ops.logSyncForward = logSyncForward;
    ops.logSmartSync = logSmartSync;
    ops.setVideoOffsetValue = (val) => {
      const offset = Number.parseFloat(String(val));
      if (!Number.isNaN(offset)) {
        setVideoOffset(offset, true);
      }
    };
    ops.setGraphTime = (timeStr) => {
      let newTime = stringTimetoMsec(timeStr);
      if (!isNaN(newTime)) {
        if (logStore.hasVideo) {
          setVideoTime(newTime / 1000000 + playbackStore.videoOffset);
        } else {
          newTime += (logStore.flightLog as Loose)?.getMinTime() ?? 0;
          setCurrentBlackboxTime(newTime);
        }
        invalidateGraph();
      }
    };
    ops.setSeekBarMode = setSeekBarMode;
    ops.selectLogIndex = (index) => {
      selectLog(Number.parseInt(String(index), 10));
      if (graph) {
        graph.setAnalyser(graphStore.hasAnalyserFullscreen);
      }
    };
    ops.switchWorkspace = (id) => {
      if (workspaceStore.workspaceGraphConfigs[id] != null) {
        onSwitchWorkspace(workspaceStore.workspaceGraphConfigs, id);
      }
    };
    ops.saveWorkspace = (id, title) => onSaveWorkspace(id, title);
    ops.applyDefaultWorkspace = (index) => {
      const presets = [null, structuredClone(ctzsnoozeWorkspace), structuredClone(supaflyWorkspace)];
      if (presets[index]) {
        onSwitchWorkspace(presets[index], 1);
      }
    };
  }

  ops.applyGraphZoom = setGraphZoom;
  ops.applyPlaybackRate = setPlaybackRate;
  ops.logPlayPause = logPlayPause;
  ops.logJumpBack = () => logJumpBack(null);
  ops.logJumpForward = () => logJumpForward(null);
  ops.logJumpStart = logJumpStart;
  ops.logJumpEnd = logJumpEnd;
  ops.videoJumpStart = () => {
    setVideoTime(0);
    setGraphState(GRAPH_STATE_PAUSED);
  };
  ops.videoJumpEnd = () => {
    if (video.duration) {
      setVideoTime(video.duration);
      setGraphState(GRAPH_STATE_PAUSED);
    }
  };

  Object.assign(ops, {
    refreshGraph,
    loadFiles,
    // Note: internal newGraphConfig takes `noRedraw` (inverted). Callers pass `redrawChart` (true = redraw).
    newGraphConfig: (newConfig: Loose, redrawChart?: Loose) => newGraphConfig(newConfig, !redrawChart),
    exportCsv: () => {
      setGraphState(GRAPH_STATE_PAUSED);
      exportCsv(logStore.flightLog as Loose, appStore.logFilename);
    },
    exportGpx: () => {
      setGraphState(GRAPH_STATE_PAUSED);
      exportGpx(logStore.flightLog as Loose, appStore.logFilename);
    },
    exportWorkspaces: () => {
      setGraphState(GRAPH_STATE_PAUSED);
      saveWorkspaces(workspaceStore.workspaceGraphConfigs as Loose);
    },
    pauseForExport: () => setGraphState(GRAPH_STATE_PAUSED),
    getVideoExportParams: () => ({
      graphConfig: graphStore.activeGraphConfig,
      inTime: playbackStore.videoExportInTime,
      outTime: playbackStore.videoExportOutTime,
      flightVideo: logStore.hasVideo && appStore.viewVideo ? video.cloneNode() : false,
      flightVideoOffset: playbackStore.videoOffset,
      hasCraft: userSettings.drawCraft,
      hasAnalyser: graphStore.hasAnalyser,
      hasSticks: userSettings.drawSticks,
    }),
    saveVideoConfig: (newConfig: Loose) => {
      playbackStore.videoConfig = newConfig;
      prefs.set("videoConfig", newConfig);
    },
    openNewWindow: () => createNewBlackboxWindow(),
    saveUserSettings: (newSettings: Loose) => {
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
    },
  });
  return ops;
}

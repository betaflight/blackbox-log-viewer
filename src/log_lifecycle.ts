import pinia from "./pinia_instance.js";
import { useLogStore } from "./stores/log.js";
import { useGraphStore } from "./stores/graph.js";
import { useAppStore } from "./stores/app.js";
import { formatTime, stringLoopTime } from "./tools.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;


export function renderLogFileInfo(file: File) {
  const logStore = useLogStore(pinia);
  const appStore = useAppStore(pinia);

  appStore.logFilename = file.name;

  const logCount = (logStore.flightLog as Loose).getLogCount();
  const entries: Loose[] = [];
  for (let index = 0; index < logCount; index++) {
    const error = (logStore.flightLog as Loose).getLogError(index);
    let logLabel;
    if (error) {
      logLabel = error;
    } else {
      logLabel = `${formatTime(
        (logStore.flightLog as Loose).getMinTime(index) / 1000,
        false,
      )} - ${formatTime(
        (logStore.flightLog as Loose).getMaxTime(index) / 1000,
        false,
      )} [${formatTime(
        Math.ceil(
          ((logStore.flightLog as Loose).getMaxTime(index) - (logStore.flightLog as Loose).getMinTime(index)) / 1000,
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

export function renderSelectedLogInfo() {
  const logStore = useLogStore(pinia);
  const appStore = useAppStore(pinia);
  const graphStore = useGraphStore(pinia);

  logStore.activeLogIndex = (logStore.flightLog as Loose).getLogIndex();

  if ((logStore.flightLog as Loose).getNumCellsEstimate()) {
    appStore.statusCells = `${(logStore.flightLog as Loose).getNumCellsEstimate()}S (${Number(
      (logStore.flightLog as Loose).getReferenceVoltageMillivolts() / 1000,
    ).toFixed(2)}V)`;
  } else {
    appStore.statusCells = "";
  }

  const sysConfig = (logStore.flightLog as Loose).getSysConfig();

  const versionText =
    (sysConfig["Craft name"]?.length
      ? `${sysConfig["Craft name"]} : `
      : "") +
    (sysConfig["Firmware revision"] == null
      ? ""
      : `${sysConfig["Firmware revision"]}`) +
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

  const seekBar = graphStore.seekBar!;
  seekBar.setTimeRange(
    (logStore.flightLog as Loose).getMinTime(),
    (logStore.flightLog as Loose).getMaxTime(),
    logStore.currentBlackboxTime,
  );
  seekBar.setActivityRange(
    (logStore.flightLog as Loose).getSysConfig().motorOutput[0],
    (logStore.flightLog as Loose).getSysConfig().motorOutput[1],
  );

  const activity = (logStore.flightLog as Loose).getActivitySummary();
  seekBar.setActivity(
    activity.times,
    activity[graphStore.seekBarMode],
    activity.hasEvent,
  );
  seekBar.repaint();

  if ((logStore.flightLog as Loose).hasGpsData()) {
    graphStore.mapGrapher!.setFlightLog(logStore.flightLog);
  }
}

export function setSeekBarMode(mode: Loose) {
  const logStore = useLogStore(pinia);
  const graphStore = useGraphStore(pinia);

  graphStore.seekBarMode = mode;
  if (logStore.flightLog) {
    const activity = (logStore.flightLog as Loose).getActivitySummary();
    graphStore.seekBar!.setActivity(activity.times, activity[mode], activity.hasEvent);
    graphStore.seekBar!.repaint();
  }
}

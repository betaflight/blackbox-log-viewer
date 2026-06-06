import pinia from "./pinia_instance.js";
import { useLogStore } from "./stores/log.js";
import { useGraphStore } from "./stores/graph.js";
import { useAppStore } from "./stores/app.js";
import { formatTime, stringLoopTime } from "./tools.js";
import type { ActivitySummary } from "./flightlog_types.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

export function renderLogFileInfo(file: File) {
  const logStore = useLogStore(pinia);
  const appStore = useAppStore(pinia);
  // A log is always loaded when this runs; getMinTime/getMaxTime/getLogError
  // return number|false / unknown for invalid indexes, so cast at the use site.
  const flightLog = logStore.flightLog!;

  appStore.logFilename = file.name;

  const logCount = flightLog.getLogCount();
  const entries: Loose[] = [];
  for (let index = 0; index < logCount; index++) {
    const error = flightLog.getLogError(index);
    let logLabel: string;
    if (error) {
      logLabel = String(error);
    } else {
      logLabel = `${formatTime(
        (flightLog.getMinTime(index) as number) / 1000,
        false,
      )} - ${formatTime(
        (flightLog.getMaxTime(index) as number) / 1000,
        false,
      )} [${formatTime(
        Math.ceil(
          ((flightLog.getMaxTime(index) as number) -
            (flightLog.getMinTime(index) as number)) /
            1000,
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
  const flightLog = logStore.flightLog!;

  logStore.activeLogIndex = flightLog.getLogIndex();

  if (flightLog.getNumCellsEstimate()) {
    appStore.statusCells = `${flightLog.getNumCellsEstimate()}S (${Number(
      flightLog.getReferenceVoltageMillivolts() / 1000,
    ).toFixed(2)}V)`;
  } else {
    appStore.statusCells = "";
  }

  const sysConfig = flightLog.getSysConfig();

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
    flightLog.getMinTime() as number,
    flightLog.getMaxTime() as number,
    logStore.currentBlackboxTime,
  );
  seekBar.setActivityRange(
    sysConfig.motorOutput[0],
    sysConfig.motorOutput[1],
  );

  const activity = flightLog.getActivitySummary();
  seekBar.setActivity(
    activity.times,
    activity[graphStore.seekBarMode as keyof ActivitySummary],
    activity.hasEvent,
  );
  seekBar.repaint();

  if (flightLog.hasGpsData()) {
    graphStore.mapGrapher!.setFlightLog(flightLog);
  }
}

export function setSeekBarMode(mode: Loose) {
  const logStore = useLogStore(pinia);
  const graphStore = useGraphStore(pinia);

  graphStore.seekBarMode = mode;
  if (logStore.flightLog) {
    const activity = logStore.flightLog.getActivitySummary();
    graphStore.seekBar!.setActivity(
      activity.times,
      activity[mode as keyof ActivitySummary],
      activity.hasEvent,
    );
    graphStore.seekBar!.repaint();
  }
}

<template>
  <UModal v-model:open="open" fullscreen :close="false" :ui="{ body: 'overflow-y-auto min-h-0' }">
    <template #header>
      <div class="flex-1">
        <h4 class="font-semibold">{{ craftName }}</h4>
        <h5 v-if="revision" class="text-sm text-dimmed">{{ revision }}</h5>
        <h5 v-if="boardInfo" class="text-sm text-dimmed">{{ boardInfo }}</h5>
      </div>
      <UButton variant="outline" color="neutral" icon="i-lucide-x" label="Close" size="xs" class="ml-auto" @click="open = false" />
    </template>

    <template #body>
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 pb-6 text-[0.8rem]">
        <!-- Column 1: PIDs & Rates -->
        <div class="flex flex-col gap-4">
          <UiBox title="PID Settings">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-default text-xs text-dimmed">
                  <th class="text-left py-1" />
                  <th class="text-center py-1">P</th>
                  <th class="text-center py-1">I</th>
                  <th v-if="showDMax" class="text-center py-1">D Max</th>
                  <th class="text-center py-1">D</th>
                  <th v-if="!showDMax" class="text-center py-1" />
                  <th class="text-center py-1">FF</th>
                </tr>
              </thead>
              <tbody>
                <PidRow v-for="row in mainPids" :key="row.label" :row="row" :showDMax="showDMax" />
              </tbody>
            </table>
          </UiBox>

          <UiBox v-if="showBaroPids" title="Baro">
            <table class="w-full text-sm">
              <tbody>
                <PidRow v-for="row in baroPids" :key="row.label" :row="row" :showDMax="false" />
              </tbody>
            </table>
          </UiBox>

          <UiBox v-if="showMagPids" title="Mag">
            <table class="w-full text-sm">
              <tbody>
                <PidRow v-for="row in magPids" :key="row.label" :row="row" :showDMax="false" />
              </tbody>
            </table>
          </UiBox>

          <UiBox v-if="showGpsPids" title="GPS">
            <table class="w-full text-sm">
              <tbody>
                <PidRow v-for="row in gpsPids" :key="row.label" :row="row" :showDMax="false" />
              </tbody>
            </table>
          </UiBox>

          <UiBox v-if="pidSliderParams.length > 0" title="PID Sliders">
            <ParamTable :params="pidSliderParams" />
          </UiBox>

          <UiBox v-if="feedforwardParams.length > 0" title="Feedforward">
            <ParamTable :params="feedforwardParams" />
          </UiBox>

          <UiBox title="Rates">
            <ParamTable :params="rateParams" />
          </UiBox>

          <UiBox v-if="dMaxParams.length > 0" title="D Max">
            <ParamTable :params="dMaxParams" />
          </UiBox>

          <UiBox v-if="rateLimitParams.length > 0" title="Rate Limits">
            <ParamTable :params="rateLimitParams" />
          </UiBox>
        </div>

        <!-- Column 2: Parameters -->
        <div class="flex flex-col gap-4">
          <UiBox title="Parameters">
            <ParamTable :params="generalParams" />
          </UiBox>

          <UiBox v-if="antiGravityParams.length > 0" title="Anti Gravity">
            <ParamTable :params="antiGravityParams" />
          </UiBox>

          <UiBox title="Motor / ESC">
            <ParamTable :params="motorParams" />
          </UiBox>
        </div>

        <!-- Column 3: Filters -->
        <div class="flex flex-col gap-4">
          <UiBox title="Gyro Filters">
            <ParamTable :params="gyroFilterParams" />
          </UiBox>

          <UiBox title="D-Term Filters">
            <ParamTable :params="dtermFilterParams" />
          </UiBox>

          <UiBox v-if="dynNotchParams.length > 0" title="Dynamic Notch">
            <ParamTable :params="dynNotchParams" />
          </UiBox>

          <UiBox v-if="rpmFilterParams.length > 0" title="RPM Filter">
            <ParamTable :params="rpmFilterParams" />
          </UiBox>

          <UiBox v-if="rcSmoothingParams.length > 0" title="RC Smoothing">
            <ParamTable :params="rcSmoothingParams" />
          </UiBox>

          <UiBox v-if="otherParams.length > 0" title="Other">
            <ParamTable :params="otherParams" />
          </UiBox>
        </div>

        <!-- Column 4: Features & Fields -->
        <div class="flex flex-col gap-4">
          <UiBox v-if="featuresList.length > 0" title="Features">
            <table class="w-full text-sm">
              <tbody>
                <tr v-for="f in featuresList" :key="f.name" class="border-b border-default">
                  <td class="py-0.5 w-6 text-center">
                    <UIcon v-if="f.enabled" name="i-lucide-check" class="size-3.5 text-green-500" />
                    <UIcon v-else name="i-lucide-minus" class="size-3.5 text-muted" />
                  </td>
                  <td class="py-0.5 font-medium">{{ f.name }}</td>
                  <td class="py-0.5 text-dimmed text-xs">{{ f.description }}</td>
                </tr>
              </tbody>
            </table>
          </UiBox>

          <UiBox v-if="disabledFieldsList.length > 0" title="Disabled Fields">
            <table class="w-full text-sm">
              <tbody>
                <tr v-for="f in disabledFieldsList" :key="f.name" class="border-b border-default">
                  <td class="py-0.5 w-6 text-center">
                    <UIcon v-if="f.enabled" name="i-lucide-check" class="size-3.5 text-green-500" />
                    <UIcon v-else name="i-lucide-minus" class="size-3.5 text-muted" />
                  </td>
                  <td class="py-0.5 font-medium">{{ f.name }}</td>
                  <td class="py-0.5 text-dimmed text-xs">{{ f.description }}</td>
                </tr>
              </tbody>
            </table>
          </UiBox>

          <UiBox v-if="unknownHeaders.length > 0" title="Unknown Headers">
            <ParamTable :params="unknownHeaders" />
          </UiBox>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup>
import { computed, h } from "vue";
import UiBox from "./UiBox.vue";
import {
  OFF_ON,
  FAST_PROTOCOL,
  MOTOR_SYNC,
  SERIALRX_PROVIDER,
  ANTI_GRAVITY_MODE,
  RC_SMOOTHING_TYPE,
  RC_SMOOTHING_MODE,
  RC_SMOOTHING_DEBUG_AXIS,
  FILTER_TYPE,
  SUPER_EXPO_YAW,
  GYRO_LPF,
  GYRO_HARDWARE_LPF,
  GYRO_32KHZ_HARDWARE_LPF,
  ACC_HARDWARE,
  BARO_HARDWARE,
  MAG_HARDWARE,
  ITERM_RELAX,
  ITERM_RELAX_TYPE,
  RATES_TYPE,
  GYRO_TO_USE,
  FF_AVERAGING,
  SIMPLIFIED_PIDS_MODE,
  THROTTLE_LIMIT_TYPE,
  DEBUG_MODE,
} from "../flightlog_fielddefs";

const open = defineModel("open", { type: Boolean, default: false });

const props = defineProps({
  sysConfig: { type: Object, default: null },
});

// --- Functional sub-components ---

const ParamTable = (props) =>
  h("table", { class: "w-full text-sm" },
    h("tbody", props.params.map((p) =>
      h("tr", {
        key: p.name,
        class: [
          "border-b border-default",
          p.missing ? "opacity-40" : "",
        ],
      }, [
        h("td", { class: "py-0.5 text-dimmed w-1/2" }, p.name),
        h("td", { class: "py-0.5" }, p.value ?? "-"),
      ])
    ))
  );
ParamTable.props = ["params"];

const PidRow = (props) => {
  const { row, showDMax } = props;
  const cells = [
    h("td", { class: "py-1 font-medium" }, row.label),
    h("td", { class: "text-center py-1" }, fmtPid(row.p)),
    h("td", { class: "text-center py-1" }, fmtPid(row.i)),
  ];
  if (showDMax) cells.push(h("td", { class: "text-center py-1" }, fmtPid(row.dMax)));
  cells.push(h("td", { class: "text-center py-1" }, fmtPid(row.d)));
  if (!showDMax) cells.push(h("td"));
  cells.push(h("td", { class: "text-center py-1" }, fmtPid(row.f)));
  return h("tr", { class: row.missing ? "opacity-40 border-b border-default" : "border-b border-default" }, cells);
};
PidRow.props = ["row", "showDMax"];

function fmtPid(val) {
  if (val == null) return "-";
  return typeof val === "number" ? val.toFixed(0) : String(val);
}

// --- Helpers ---

const sc = computed(() => props.sysConfig || {});
const fwType = computed(() => sc.value.firmwareType);
const fwVer = computed(() => sc.value.firmwareVersion || "0.0.0");
const isBF = computed(() => fwType.value === FIRMWARE_TYPE_BETAFLIGHT);
const isINAV = computed(() => fwType.value === FIRMWARE_TYPE_INAV);

function gte(ver) {
  return semver.gte(fwVer.value, ver);
}
function lt(ver) {
  return semver.lt(fwVer.value, ver);
}
function lte(ver) {
  return semver.lte(fwVer.value, ver);
}

function fmtVal(data, decimalPlaces) {
  if (data == null) return null;
  return (data / Math.pow(10, decimalPlaces)).toFixed(decimalPlaces);
}

function fmtFloat(data, decimalPlaces) {
  if (data == null) return null;
  return data.toFixed(decimalPlaces);
}

function selectVal(data, list) {
  if (data == null || !list) return null;
  return list[data] ?? String(data);
}

function bitmaskVal(data, totalBits = 8) {
  if (data == null) return null;
  const bin = data.toString(2).padStart(totalBits, "0");
  return `${data} (${bin})`;
}

function param(name, value, opts = {}) {
  return { name, value: value ?? "-", missing: value == null, ...opts };
}

// --- Header ---

const craftName = computed(() =>
  sc.value["Craft name"] ? ` ${sc.value["Craft name"]}` : "Flight Log Header"
);
const revision = computed(() => {
  const rev = sc.value["Firmware revision"];
  const date = sc.value["Firmware date"];
  if (!rev && !date) return "";
  return `${rev || ""} - ${date || ""}`.trim();
});
const boardInfo = computed(() =>
  sc.value["Board information"] ? `Board: ${sc.value["Board information"]}` : ""
);

// --- PID Tables ---

const showDMax = computed(() => isBF.value && gte("4.0.0"));
const showBaroPids = computed(() => lt("3.4.0"));
const showMagPids = computed(() => lt("3.4.0"));
const showGpsPids = computed(() => lt("3.4.0"));

function pidRow(label, data) {
  if (!data) return { label, p: null, i: null, d: null, dMax: null, f: null, missing: true };
  return {
    label,
    p: data[0] ?? null,
    i: data[1] ?? null,
    d: data[2] ?? null,
    dMax: data[3] ?? null,
    f: data[4] ?? null,
    missing: false,
  };
}

const mainPids = computed(() => [
  pidRow("Roll", sc.value.rollPID),
  pidRow("Pitch", sc.value.pitchPID),
  pidRow("Yaw", sc.value.yawPID),
  pidRow("Level", sc.value.levelPID),
]);

const baroPids = computed(() => [
  pidRow("ALT", sc.value.altPID),
  pidRow("VEL", sc.value.velPID),
]);

const magPids = computed(() => [
  pidRow("MAG", sc.value.magPID),
]);

const gpsPids = computed(() => [
  pidRow("POS", sc.value.posPID),
  pidRow("POSR", sc.value.posrPID),
  pidRow("NAVR", sc.value.navrPID),
]);

// --- PID Sliders ---

const pidSliderParams = computed(() => {
  if (!isBF.value || !gte("4.3.0")) return [];
  const s = sc.value;
  return [
    param("Status", selectVal(s.simplified_pids_mode, SIMPLIFIED_PIDS_MODE)),
    param("PI gain", fmtVal(s.simplified_pi_gain, 0)),
    param("I gain", fmtVal(s.simplified_i_gain, 0)),
    param("D gain", fmtVal(s.simplified_d_gain, 0)),
    param("D Max", fmtVal(s.simplified_d_max_gain, 0)),
    param("FF gain", fmtVal(s.simplified_feedforward_gain, 0)),
    param("Pitch:Roll", fmtVal(s.simplified_pitch_d_gain, 0)),
    param("Pitch Gain", fmtVal(s.simplified_pitch_pi_gain, 0)),
    param("Master Gain", fmtVal(s.simplified_master_multiplier, 0)),
  ].filter((p) => !p.missing);
});

// --- Feedforward ---

const feedforwardParams = computed(() => {
  const s = sc.value;
  const result = [];
  result.push(param("Transition", fmtVal(s.ff_transition, 2)));
  if (isBF.value && gte("4.3.0")) {
    result.push(param("Average", selectVal(s.ff_averaging, FF_AVERAGING)));
    result.push(param("Smoothing", fmtVal(s.ff_smooth_factor, 0)));
    result.push(param("Jitter", fmtVal(s.ff_jitter_factor, 0)));
    result.push(param("MaxRate", fmtVal(s.ff_max_rate_limit, 0)));
  }
  result.push(param("Boost", fmtVal(s.ff_boost, 0)));
  return result.filter((p) => !p.missing);
});

// --- Rates ---

const rateParams = computed(() => {
  const s = sc.value;
  const isI = isINAV.value;
  const rMul = isI ? 10 : 1;
  const rDec = isI ? 0 : 2;
  return [
    param("Rates Type", selectVal(s.rates_type, RATES_TYPE)),
    param("RC Roll Rate", fmtVal(s.rc_rates?.[0], 2)),
    param("RC Roll Expo", fmtVal(s.rc_expo?.[0], 2)),
    param("Roll Rate", fmtVal(s.rates?.[0] != null ? s.rates[0] * rMul : null, rDec)),
    param("RC Pitch Rate", fmtVal(s.rc_rates?.[1], 2)),
    param("RC Pitch Expo", fmtVal(s.rc_expo?.[1], 2)),
    param("Pitch Rate", fmtVal(s.rates?.[1] != null ? s.rates[1] * rMul : null, rDec)),
    param("RC Yaw Rate", fmtVal(s.rc_rates?.[2], 2)),
    param("RC Yaw Expo", fmtVal(s.rc_expo?.[2], 2)),
    param("Yaw Rate", fmtVal(s.rates?.[2] != null ? s.rates[2] * rMul : null, rDec)),
  ].filter((p) => !p.missing);
});

// --- D Max ---

const dMaxParams = computed(() => {
  if (!isBF.value || !gte("4.0.0")) return [];
  const s = sc.value;
  return [
    param("Roll", fmtVal(s.d_max?.[0], 0)),
    param("Pitch", fmtVal(s.d_max?.[1], 0)),
    param("Yaw", fmtVal(s.d_max?.[2], 0)),
    param("Gain", fmtVal(s.d_max_gain, 0)),
    param("Advance", fmtVal(s.d_max_advance, 0)),
  ].filter((p) => !p.missing);
});

// --- Rate Limits ---

const rateLimitParams = computed(() => {
  if (!isBF.value || !gte("4.0.0")) return [];
  const s = sc.value;
  return [
    param("Roll", fmtVal(s.rate_limits?.[0], 0)),
    param("Pitch", fmtVal(s.rate_limits?.[1], 0)),
    param("Yaw", fmtVal(s.rate_limits?.[2], 0)),
  ].filter((p) => !p.missing);
});

// --- General Parameters ---

const generalParams = computed(() => {
  const s = sc.value;
  const vDec = (isBF.value && gte("4.0.0")) ? 2 : 1;
  const result = [
    param("Loop Time", fmtVal(s.looptime, 0)),
    param("Gyro Sync", fmtVal(s.gyro_sync_denom, 0)),
    param("PID Denom", fmtVal(s.pid_process_denom, 0)),
    param("Debug Mode", selectVal(s.debug_mode, DEBUG_MODE)),
    param("Deadband", fmtVal(s.deadband, 0)),
    param("Yaw Deadband", fmtVal(s.yaw_deadband, 0)),
    param("TPA Rate", fmtVal(s.tpa_rate, 2)),
    param("TPA Breakpoint", fmtVal(s.tpa_breakpoint, 0)),
    param("Vbat Scale", fmtVal(s.vbatscale, 0)),
    param("Vbat Ref", fmtVal(s.vbatref, 0)),
    param("Vbat Min Cell", fmtVal(s.vbatmincellvoltage, vDec)),
    param("Vbat Max Cell", fmtVal(s.vbatmaxcellvoltage, vDec)),
    param("Vbat Warning", fmtVal(s.vbatwarningcellvoltage, vDec)),
    param("Min Throttle", fmtVal(s.minthrottle, 0)),
    param("Max Throttle", fmtVal(s.maxthrottle, 0)),
    param("THR Mid", fmtVal(s.thrMid, 2)),
    param("THR Expo", fmtVal(s.thrExpo, 2)),
    param("Thrust Linear", fmtVal(s.thrust_linear, 0)),
    param("PID Sum Limit", fmtVal(s.pidSumLimit, 0)),
    param("PID Sum Limit Yaw", fmtVal(s.pidSumLimitYaw, 0)),
    param("Vbat Sag Comp", fmtVal(s.vbat_sag_compensation, 0)),
    param("I-Term Relax", selectVal(s.iterm_relax, ITERM_RELAX)),
    param("I-Term Relax Type", selectVal(s.iterm_relax_type, ITERM_RELAX_TYPE)),
    param("I-Term Relax Cutoff", fmtVal(s.iterm_relax_cutoff, 0)),
    param("Abs Control Gain", fmtVal(s.abs_control_gain, 0)),
    param("Yaw Rate Accel Limit", isBF.value && gte("3.1.0") ? fmtFloat(s.yawRateAccelLimit, 2) : fmtVal(s.yawRateAccelLimit, 1)),
    param("Rate Accel Limit", isBF.value && gte("3.1.0") ? fmtFloat(s.rateAccelLimit, 2) : fmtVal(s.rateAccelLimit, 1)),
    param("Setpoint Relax Ratio", fmtVal(s.setpointRelaxRatio, 2)),
    param("Use Integrated Yaw", selectVal(s.use_integrated_yaw, OFF_ON)),
  ];
  return result.filter((p) => !p.missing);
});

// --- Gyro Filters ---

const gyroFilterParams = computed(() => {
  const s = sc.value;
  const lpfList = (isBF.value && gte("3.4.0")) ? GYRO_HARDWARE_LPF : GYRO_LPF;
  const result = [
    param("Hardware LPF", selectVal(s.gyro_lpf, lpfList)),
    param("LPF Type", selectVal(s.gyro_soft_type, FILTER_TYPE)),
    param("LPF Hz", fmtVal(s.gyro_lowpass_hz, 0)),
    param("LPF2 Type", selectVal(s.gyro_soft2_type, FILTER_TYPE)),
    param("LPF2 Hz", fmtVal(s.gyro_lowpass2_hz, 0)),
  ];

  // Dynamic gyro LPF
  if (isBF.value && gte("4.0.0") && s.gyro_lowpass_dyn_hz?.[0] > 0 && s.gyro_lowpass_dyn_hz?.[1] > s.gyro_lowpass_dyn_hz?.[0]) {
    result.push(param("Dyn LPF Type", selectVal(s.gyro_soft_type, FILTER_TYPE)));
    result.push(param("Dyn LPF Min", fmtVal(s.gyro_lowpass_dyn_hz[0], 0)));
    result.push(param("Dyn LPF Max", fmtVal(s.gyro_lowpass_dyn_hz[1], 0)));
  }

  // Notch filters
  if (Array.isArray(s.gyro_notch_hz)) {
    result.push(param("Notch 1 Hz", fmtVal(s.gyro_notch_hz[0], 0)));
    result.push(param("Notch 1 Cutoff", fmtVal(s.gyro_notch_cutoff?.[0], 0)));
    result.push(param("Notch 2 Hz", fmtVal(s.gyro_notch_hz[1], 0)));
    result.push(param("Notch 2 Cutoff", fmtVal(s.gyro_notch_cutoff?.[1], 0)));
  } else {
    result.push(param("Notch Hz", fmtVal(s.gyro_notch_hz, 0)));
    result.push(param("Notch Cutoff", fmtVal(s.gyro_notch_cutoff, 0)));
  }

  // Simplified gyro filter
  if (isBF.value && gte("4.3.0")) {
    result.push(param("Simplified Filter", selectVal(s.simplified_gyro_filter, OFF_ON)));
    result.push(param("Simplified Multiplier", fmtVal(s.simplified_gyro_filter_multiplier, 0)));
  }

  // Acc LPF
  result.push(param("Acc LPF Hz", fmtVal(s.acc_lpf_hz, 2)));
  result.push(param("Acc Cut Hz", fmtVal(s.acc_cut_hz, 2)));

  return result.filter((p) => !p.missing);
});

// --- D-Term Filters ---

const dtermFilterParams = computed(() => {
  const s = sc.value;
  const result = [
    param("Filter Type", selectVal(s.dterm_filter_type, FILTER_TYPE)),
    param("LPF Hz", fmtVal(s.dterm_lpf_hz, 0)),
    param("Filter2 Type", selectVal(s.dterm_filter2_type, FILTER_TYPE)),
    param("LPF2 Hz", fmtVal(s.dterm_lpf2_hz, 0)),
    param("Notch Hz", fmtVal(s.dterm_notch_hz, 0)),
    param("Notch Cutoff", fmtVal(s.dterm_notch_cutoff, 0)),
    param("Cut Hz", fmtVal(s.dterm_cut_hz, 2)),
    param("Yaw LPF Hz", fmtVal(s.yaw_lpf_hz, 0)),
  ];

  // Dynamic D-term LPF
  if (isBF.value && gte("4.0.0") && s.dterm_lpf_dyn_hz?.[0] > 0 && s.dterm_lpf_dyn_hz?.[1] > s.dterm_lpf_dyn_hz?.[0]) {
    result.push(param("Dyn Type", selectVal(s.dterm_filter_type, FILTER_TYPE)));
    result.push(param("Dyn Min Hz", fmtVal(s.dterm_lpf_dyn_hz[0], 0)));
    result.push(param("Dyn Max Hz", fmtVal(s.dterm_lpf_dyn_hz[1], 0)));
  }

  // Simplified D-term filter
  if (isBF.value && gte("4.3.0")) {
    result.push(param("Simplified Filter", selectVal(s.simplified_dterm_filter, OFF_ON)));
    result.push(param("Simplified Multiplier", fmtVal(s.simplified_dterm_filter_multiplier, 0)));
  }

  return result.filter((p) => !p.missing);
});

// --- Dynamic Notch ---

const dynNotchParams = computed(() => {
  if (!isBF.value || !gte("4.1.0")) return [];
  const s = sc.value;
  const countLabel = gte("4.3.0") ? "Count" : "Width %";
  const countVal = gte("4.3.0") ? s.dyn_notch_count : s.dyn_notch_width_percent;
  return [
    param(countLabel, fmtVal(countVal, 0)),
    param("Q", fmtVal(s.dyn_notch_q, 0)),
    param("Min Hz", fmtVal(s.dyn_notch_min_hz, 0)),
    param("Max Hz", fmtVal(s.dyn_notch_max_hz, 0)),
  ].filter((p) => !p.missing);
});

// --- RPM Filter ---

const rpmFilterParams = computed(() => {
  const s = sc.value;
  if (s.gyro_rpm_notch_harmonics == null) return [];
  return [
    param("Harmonics", fmtVal(s.gyro_rpm_notch_harmonics, 0)),
    param("Q", fmtVal(s.gyro_rpm_notch_q, 0)),
    param("Min Hz", fmtVal(s.gyro_rpm_notch_min, 0)),
    param("Fade Range Hz", fmtVal(s.rpm_filter_fade_range_hz, 0)),
    param("Notch LPF", fmtVal(s.rpm_notch_lpf, 0)),
    param("D-Term Harmonics", fmtVal(s.dterm_rpm_notch_harmonics, 0)),
    param("D-Term Q", fmtVal(s.dterm_rpm_notch_q, 0)),
    param("D-Term Min Hz", fmtVal(s.dterm_rpm_notch_min, 0)),
  ].filter((p) => !p.missing);
});

// --- RC Smoothing ---

const rcSmoothingParams = computed(() => {
  if (!isBF.value) return [];
  const s = sc.value;
  const result = [];

  if (gte("4.3.0")) {
    result.push(param("Mode", selectVal(s.rc_smoothing_mode, RC_SMOOTHING_MODE)));
    result.push(param("Setpoint Hz", fmtVal(s.rc_smoothing_setpoint_hz, 0)));
    result.push(param("Auto Factor Setpoint", fmtVal(s.rc_smoothing_auto_factor_setpoint, 0)));
    result.push(param("Throttle Hz", fmtVal(s.rc_smoothing_throttle_hz, 0)));
    result.push(param("Auto Factor Throttle", fmtVal(s.rc_smoothing_auto_factor_throttle, 0)));

    if (!gte("2025.12.0")) {
      result.push(param("Feedforward Hz", fmtVal(s.rc_smoothing_feedforward_hz, 0)));
    }

    // Active cutoffs
    const ac = s.rc_smoothing_active_cutoffs_ff_sp_thr;
    if (ac) {
      if (gte("2025.12.0")) {
        result.push(param("Active Cutoff SP", fmtVal(ac[0], 0)));
        result.push(param("Active Cutoff THR", fmtVal(ac[1], 0)));
      } else {
        result.push(param("Active Cutoff FF", fmtVal(ac[0], 0)));
        result.push(param("Active Cutoff SP", fmtVal(ac[1], 0)));
        result.push(param("Active Cutoff THR", fmtVal(ac[2], 0)));
      }
    }
  } else if (gte("3.4.0")) {
    result.push(param("Mode", selectVal(s.rc_smoothing_mode, RC_SMOOTHING_TYPE)));
    const cutoffs = s.rc_smoothing_cutoffs;
    if (cutoffs) {
      result.push(param("Feedforward Hz", fmtVal(cutoffs[0], 0)));
      result.push(param("Setpoint Hz", fmtVal(cutoffs[1], 0)));
    }
    result.push(param("Auto Factor Setpoint", fmtVal(s.rc_smoothing_auto_factor_setpoint, 0)));
    const ac = s.rc_smoothing_active_cutoffs;
    if (ac) {
      result.push(param("Active Cutoff FF", fmtVal(ac[0], 0)));
      result.push(param("Active Cutoff SP", fmtVal(ac[1], 0)));
    }
  }

  if (gte("4.5.0")) {
    result.push(param("Rx Smoothed", fmtVal(s.rc_smoothing_rx_smoothed, 0)));
  } else {
    result.push(param("Rx Average", fmtVal(s.rc_smoothing_rx_average, 3)));
  }

  result.push(param("Debug Axis", selectVal(s.rc_smoothing_debug_axis, RC_SMOOTHING_DEBUG_AXIS)));

  return result.filter((p) => !p.missing);
});

// --- Motor / ESC ---

const motorParams = computed(() => {
  const s = sc.value;
  return [
    param("Unsynced Fast PWM", selectVal(s.unsynced_fast_pwm, MOTOR_SYNC)),
    param("Fast PWM Protocol", selectVal(s.fast_pwm_protocol, FAST_PROTOCOL)),
    param("Motor PWM Rate", fmtVal(s.motor_pwm_rate, 0)),
    param("DShot BiDir", selectVal(s.dshot_bidir, OFF_ON)),
    param("Motor Output Low", fmtVal(s.motorOutput?.[0], 0)),
    param("Motor Output High", fmtVal(s.motorOutput?.[1], 0)),
    param("Motor Idle", fmtVal(s.motor_idle, 2)),
    param("Digital Idle Offset", fmtVal(s.digitalIdleOffset, 2)),
    param("Motor Output Limit", fmtVal(s.motor_output_limit, 0)),
    param("Motor Poles", fmtVal(s.motor_poles, 0)),
    param("Throttle Limit Type", selectVal(s.throttle_limit_type, THROTTLE_LIMIT_TYPE)),
    param("Throttle Limit %", fmtVal(s.throttle_limit_percent, 0)),
    param("Throttle Boost", fmtVal(s.throttle_boost, 0)),
    param("Throttle Boost Cutoff", fmtVal(s.throttle_boost_cutoff, 0)),
    param("Dynamic Idle Min RPM", fmtVal(s.dynamic_idle_min_rpm, 0)),
    param("Dyn Idle P", fmtVal(s.dyn_idle_p_gain, 0)),
    param("Dyn Idle I", fmtVal(s.dyn_idle_i_gain, 0)),
    param("Dyn Idle D", fmtVal(s.dyn_idle_d_gain, 0)),
    param("Serial Rx", selectVal(s.serialrx_provider, SERIALRX_PROVIDER)),
    param("PID At Min Throttle", selectVal(s.pidAtMinThrottle, OFF_ON)),
  ].filter((p) => !p.missing);
});

// --- Anti Gravity ---

const antiGravityParams = computed(() => {
  const s = sc.value;
  if (s.anti_gravity_mode == null && s.anti_gravity_gain == null) return [];
  const gainDec = (isBF.value && gte("3.1.0") && lte("4.3.9")) ? 3 : 0;
  return [
    param("Mode", selectVal(s.anti_gravity_mode, ANTI_GRAVITY_MODE)),
    param("Gain", fmtVal(s.anti_gravity_gain, gainDec)),
    param("Threshold", fmtVal(s.anti_gravity_threshold, 0)),
    param("P Gain", fmtVal(s.anti_gravity_p_gain, 0)),
    param("Cutoff Hz", fmtVal(s.anti_gravity_cutoff_hz, 0)),
  ].filter((p) => !p.missing);
});

// --- Other ---

const otherParams = computed(() => {
  const s = sc.value;
  const result = [
    param("Acc Hardware", selectVal(s.acc_hardware, ACC_HARDWARE)),
    param("Baro Hardware", selectVal(s.baro_hardware, BARO_HARDWARE)),
    param("Mag Hardware", selectVal(s.mag_hardware, MAG_HARDWARE)),
    param("Current Offset", fmtVal(s.currentMeterOffset, 0)),
    param("Current Scale", fmtVal(s.currentMeterScale, 0)),
  ];
  // Gyro selection
  if (isBF.value && gte("2025.12.0")) {
    result.push(param("Gyro Bitmask", bitmaskVal(s.gyro_enabled_bitmask, 8)));
  } else if (isBF.value && gte("4.3.0")) {
    result.push(param("Gyro To Use", selectVal(s.gyro_to_use, GYRO_TO_USE)));
  }
  return result.filter((p) => !p.missing);
});

// --- Features ---

const featuresList = computed(() => {
  const s = sc.value;
  if (s.features == null) return [];
  const value = s.features;

  const features = [
    { bit: 0, name: "RX_PPM", description: "PPM Receiver" },
    { bit: 2, name: "INFLIGHT_ACC_CAL", description: "In-flight level cal" },
    { bit: 3, name: "RX_SERIAL", description: "Serial Receiver" },
    { bit: 4, name: "MOTOR_STOP", description: "Motor stop on low throttle" },
    { bit: 5, name: "SERVO_TILT", description: "Servo gimbal" },
    { bit: 6, name: "SOFTSERIAL", description: "CPU serial port" },
    { bit: 7, name: "GPS", description: "GPS connected" },
    { bit: 9, name: "SONAR", description: "Sonar" },
    { bit: 10, name: "TELEMETRY", description: "Telemetry output" },
    { bit: 12, name: "3D", description: "3D mode" },
    { bit: 13, name: "RX_PARALLEL_PWM", description: "PWM receiver" },
    { bit: 14, name: "RX_MSP", description: "Controller over MSP" },
    { bit: 15, name: "RSSI_ADC", description: "ADC RSSI" },
    { bit: 16, name: "LED_STRIP", description: "LED strip" },
    { bit: 17, name: "DISPLAY", description: "OLED display" },
    { bit: 20, name: "CHANNEL_FORWARDING", description: "Forward aux channels" },
    { bit: 21, name: "TRANSPONDER", description: "Race transponder" },
  ];

  if (lte("3.2.0")) {
    features.push(
      { bit: 1, name: "VBAT", description: "Battery monitoring" },
      { bit: 11, name: "CURRENT_METER", description: "Current monitoring" },
      { bit: 8, name: "FAILSAFE", description: "Failsafe" },
      { bit: 19, name: "BLACKBOX", description: "Blackbox recorder" },
    );
  }
  if (gte("2.8.0")) {
    features.push({ bit: 22, name: "AIRMODE", description: "Airmode always enabled" });
  }
  if (gte("2.8.0") && lt("3.0.0")) {
    features.push({ bit: 23, name: "SUPEREXPO_RATES", description: "Super expo" });
    features.push({ bit: 18, name: "ONESHOT125", description: "Oneshot 125" });
  }
  if (gte("3.0.0")) {
    features.push({ bit: 18, name: "OSD", description: "On-screen display" });
  }
  if (gte("3.1.0")) {
    features.push(
      { bit: 27, name: "ESC_SENSOR", description: "KISS ESC telemetry" },
      { bit: 28, name: "ANTI_GRAVITY", description: "Anti-gravity boost" },
    );
    if (lt("4.3.0")) {
      features.push({ bit: 29, name: "DYNAMIC_FILTER", description: "Dynamic gyro notch" });
    }
  }

  return features
    .sort((a, b) => a.bit - b.bit)
    .map((f) => ({
      name: f.name,
      description: f.description,
      enabled: !!(value & (1 << f.bit)),
    }));
});

// --- Disabled Fields ---

const disabledFieldsList = computed(() => {
  const s = sc.value;
  if (!isBF.value || !gte("4.3.0") || s.fields_disabled_mask == null) return [];
  const value = s.fields_disabled_mask;

  let fields;
  if (gte("2025.12.0")) {
    fields = [
      "PIDs", "RC Commands", "Setpoint", "Battery", "Magnetometer", "Altitude",
      "RSSI", "Filtered Gyroscope", "Attitude", "Accelerometer", "Debug",
      "Motors", "GPS", "RPM", "Unfiltered Gyroscope", "Servos",
    ];
  } else {
    fields = [
      "PIDs", "RC Commands", "Setpoint", "Battery", "Magnetometer", "Altitude",
      "RSSI", "Filtered Gyroscope", "Accelerometer", "Debug",
      "Motors", "GPS", "RPM", "Unfiltered Gyroscope",
    ];
  }

  return fields.map((name, i) => ({
    name,
    description: "",
    enabled: !!(value & (1 << i)),
  }));
});

// --- Unknown Headers ---

const unknownHeaders = computed(() => {
  const uh = sc.value.unknownHeaders;
  if (!uh || !Array.isArray(uh) || uh.length === 0) return [];
  return uh.map((h) => param(h.name, h.value));
});
</script>

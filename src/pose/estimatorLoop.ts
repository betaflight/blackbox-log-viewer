import { createEskf, eskfPredict, eskfUpdate } from './eskf.js';
import type { EskfOptions, EskfState, RobustOpts } from './eskf.js';
import {
  createGpsPositionFactor,
  createGpsVelocityFactor,
  createBaroFactor,
  createQuaternionPrior,
  createMagFactor,
  createDeclinationFactor,
  computeAdaptiveSigmaYaw,
  computeAdaptiveSigmaTilt,
  computeGpsNoise,
  SIGMA_YAW_DEFAULT_MAX,
  SIGMA_TILT_NOMINAL,
} from './measurements.js';
import type { NedMeas } from './measurements.js';
import { rtsSmooth } from './rtsSmoother.js';
import type { FilterResult, SmoothedResult, NominalState as RtsNominalState } from './rtsSmoother.js';
import { llhToNed, nedToLlh } from './geodesy.js';
import type { NedPos } from './geodesy.js';
import { createPoseTrack } from './poseTrack.js';
import type { PoseTrack } from './poseTrack.js';
import { quatToRot, quatFromAxisAngle, quatMultiply } from './imuMechanization.js';
import { pitchDeg, noseBearingDeg, tiltFromUprightDeg } from './acroGates.js';
import type { PoseSampleInternal, Vec3, Quat, LLA } from './poseSample.js';
import type {
  ImuEntry,
  GpsEntry,
  BaroEntry,
  QuatEntry,
  MagGaussEntry,
  CurrentEntry,
} from './flightIngestion.js';

type Mat = number[][];

export interface OnProgress {
  phase: string;
  iteration: number;
  totalIterations: number;
  fraction: number;
  detail: string;
}

export interface MagModelFusion {
  earthFieldNedGauss?: { n: number; e: number; d: number };
  qualityBounds?: {
    bounds_ok?: boolean;
    field_strength_mg?: number;
  };
  magNoiseGauss?: {
    sigma_xy?: number;
    sigma_z?: number;
    sigma?: number;
  };
}

export interface MagModelInput {
  version?: string | number;
  fusion?: MagModelFusion;
  [key: string]: unknown;
}

export interface EstimatorData {
  imu: ImuEntry[];
  gps: GpsEntry[];
  baro: BaroEntry[];
  quat: QuatEntry[];
  mag: MagGaussEntry[];
}

export interface EstimatorOrigin {
  lat: number;
  lon: number;
  alt: number;
}

export interface EstimatorOpts {
  outputHz?: number;
  gpsPosSigma?: number;
  gpsVelSigma?: number;
  baroSigma?: number;
  attSigma?: number;
  sigmaYaw?: number;
  sigmaYawMax?: number;
  maxIter?: number;
  magSigma?: number;
  declSigma?: number;
  magModel?: MagModelInput | null;
  useDcs?: boolean;
  current?: CurrentEntry[] | null;
  procSigmaAcc?: number;
  procSigmaGyro?: number;
  gpsPosGate?: number;
  gpsVelGate?: number;
  magGate?: number;
  /** Model-free raw-mag heading-bias estimate (rad).  When set and useMag is
   *  false, every FC quaternion is corrected by this angle about world-Z
   *  before entering the quaternion prior.  Computed by computeMagHeadingBias(). */
  rawMagBiasRad?: number;
  sigmaBaInit?: number;
  sigmaBgInit?: number;
  sigmaBaRW?: number;
  sigmaBgRW?: number;
  sigmaBgPrior?: number;
  onProgress?: (progress: OnProgress) => void;
  /** GPS transport delay in milliseconds (subtracted from GPS timestamps).
   *  Default 0. u-blox M10: ~150-200 ms. */
  gpsDelayMs?: number;
  /** GPS position sigma floor in metres. Only used when useGpsAccuracyScaling=true.
   *  Per-fix sigma = max(floor, numSat-model). Default 1.0 m. */
  gpsPosSigmaFloor?: number;
  /** When true, scale GPS position sigma per-fix from satellite count.
   *  Good sats (≥12) → tighter (~1.5m); degraded → looser. Default false. */
  useGpsAccuracyScaling?: boolean;
}

interface SmoothedPose {
  tUs: number;
  p: Vec3;
  v: Vec3;
  q: Quat;
  ba?: Vec3;
  bg?: Vec3;
  P: Mat;
  mEarth?: Vec3;
  mBody?: Vec3;
}

interface TraceEntry {
  tUs: number;
  sigmaTilt: number;
  sigmaYaw?: number;
  bg2_rads?: number;
  fwPos: Vec3;
  smPos?: Vec3;
  posErrFwSmM?: number;
  bg2_sm_rads?: number;
  gpsPos?: number[];
  posErrSmGpsM?: number;
}

/** Gyro rate threshold (deg/s) above which GPS velocity→yaw fusion is suppressed during snaps.
 *  Infinity = off (current behavior). Set to ~120 to gate during rapid rotation. */
const SNAP_GYRO_GATE_DPS = Infinity;

interface EstimationResult {
  smoothed: SmoothedPose[];
  t0Us: number;
  lat0: number;
  lon0: number;
  alt0: number;
  _traceForward: TraceEntry[];
}

interface StepState {
  p: Vec3;
  v: Vec3;
  q: Quat;
  ba: Vec3;
  bg: Vec3;
  mEarth?: Vec3;
  mBody?: Vec3;
  tUs: number;
}

interface Step {
  x: StepState;
  P: Mat;
  xPred: StepState;
  PPred: Mat;
  F: Mat;
  hasUpdate: boolean;
}

export interface LegacyPose {
  tMs: number;
  lat: number;
  lon: number;
  altMsl: number;
  q: Quat;
  vNed: Vec3;
  sigmaPos: number;
  sigmaAtt: number;
}

interface ConvergedParams {
  ba?: Vec3;
  bg?: Vec3;
  mEarth?: Vec3;
}

export function estimatePoses(
  data: EstimatorData,
  origin: EstimatorOrigin,
  opts: EstimatorOpts = {},
): LegacyPose[] {
  const track = estimatePoseTrack(data, origin, opts);
  const t0Us = track.samples.length > 0 ? track.samples[0].tUs : 0;
  return track.samples.map((s) => ({
    tMs: (s.tUs - t0Us) / 1000,
    lat: s.lla ? s.lla.lat : origin.lat,
    lon: s.lla ? s.lla.lon : origin.lon,
    altMsl: s.lla ? s.lla.alt : origin.alt,
    q: s.q,
    vNed: s.v,
    sigmaPos: Math.sqrt(
      Math.max(0, (s.covPos[0][0] + s.covPos[1][1] + s.covPos[2][2]) / 3),
    ),
    sigmaAtt:
      Math.sqrt(
        Math.max(0, (s.covAtt[0][0] + s.covAtt[1][1] + s.covAtt[2][2]) / 3),
      ) *
      (180 / Math.PI),
  }));
}

// ---------------------------------------------------------------------------
// Internal: shared estimation core
// ---------------------------------------------------------------------------

function _runEstimation(
  data: EstimatorData,
  origin: EstimatorOrigin,
  opts: EstimatorOpts = {},
): EstimationResult {
  const {
    outputHz = 20,
    gpsPosSigma = 2.5,
    gpsVelSigma = 0.5,
    baroSigma = 2.0,
    attSigma = 0.02,
    sigmaYaw = 0.15,
    sigmaYawMax = SIGMA_YAW_DEFAULT_MAX,
    maxIter = 3,
    magSigma = 0.05,
    declSigma = 0.34,
    magModel = null,
    useDcs = false,
    current = null,
    procSigmaAcc = 5.5,
    procSigmaGyro = 0.08,
    gpsPosGate = 4.5,
    gpsVelGate = 15.0,
    magGate = 3.0,
    rawMagBiasRad = 0,
    sigmaBaInit = 0.5,
    sigmaBgInit = 0.01,
    sigmaBaRW = 2e-4,
    sigmaBgRW = 3e-5,
    sigmaBgPrior = 0,
    onProgress,
    gpsDelayMs = 0,
    gpsPosSigmaFloor = 2.0,
    useGpsAccuracyScaling = true,
  } = opts;

  let { imu, gps, baro, quat, mag } = data;

  // ---- GPS position timing ----
  // GPS position and velocity use the ingested FC timestamps (flightIngestion
  // already applies gpsDelayMs).  The logged GPS_time (u-blox iTOW) field is
  // available but rate-matching it to FC time does not beat the simpler FC-time
  // approach on real logs (acro1: FC-time median 0.9 m vs scale-matched iTOW
  // median 1.1 m).  FC-time is also simpler — no clock-rate mismatch to correct.
  //
  // If a future log benefits from per-fix iTOW timing (e.g. heavy FC parse
  // jitter), re-enable the rate-matched iTOW path below.
  const _useItoW = false;


  // When iTOW timing is NOT active, apply gpsDelayMs to all GPS timestamps.
  // (flightIngestion already applied gpsDelayMs, so this is an additional shift
  // for users who want a manual override.  Default gpsDelayMs=0 → no-op.)
  if (gpsDelayMs > 0) {
    const delayUs = Math.round(gpsDelayMs * 1000);
    gps = gps.map((entry) => ({ ...entry, tUs: entry.tUs - delayUs }));
  }

  // Per-fix GPS position sigma from satellite count model (opt-in).
  // When enabled, GPS is trusted more tightly in good-sky conditions (~1.5m)
  // and loosened automatically when sats drop.
  const getGpsPosSigma = (numSat: number): number =>
    useGpsAccuracyScaling
      ? Math.max(gpsPosSigmaFloor, computeGpsNoise(numSat))
      : gpsPosSigma;
  if (!imu || imu.length === 0)
    return { smoothed: [], t0Us: 0, lat0: 0, lon0: 0, alt0: 0, _traceForward: [] };

  const { lat: lat0, lon: lon0, alt: alt0 } = origin;
  const t0Us = imu[0].tUs;

  // ---- Initial state from first GPS ----
  let p0: Vec3 = [0, 0, 0];
  let v0: Vec3 = [0, 0, 0];
  let q0: Quat = [1, 0, 0, 0];

  if (gps.length > 0) {
    const g0 = llhToNed(gps[0].lat, gps[0].lon, gps[0].alt ?? alt0, lat0, lon0, alt0);
    p0 = [g0.n, g0.e, g0.d];
    if (gps[0].velNed) v0 = [...gps[0].velNed] as Vec3;
    if (gps.length >= 2) {
      const dtS = (gps[1].tUs - gps[0].tUs) / 1e6;
      if (dtS > 0 && !gps[0].velNed) {
        const g1 = llhToNed(gps[1].lat, gps[1].lon, gps[1].alt ?? alt0, lat0, lon0, alt0);
        v0 = [
          (g1.n - g0.n) / dtS,
          (g1.e - g0.e) / dtS,
          (g1.d - g0.d) / dtS,
        ];
      }
    }
  }
  if (quat.length > 0) q0 = quat[0].q;

  // ---- Static-window bias initialization ----
  let bg0: Vec3 = [0, 0, 0];
  let _sigmaBgInit = sigmaBgInit;
  const staticWindowUs = 5e6;
  const staticImu = imu.filter((x) => x.tUs - imu[0].tUs <= staticWindowUs);
  if (staticImu.length > 100) {
    const sumG: Vec3 = [0, 0, 0];
    for (const x of staticImu) {
      sumG[0] += x.gyro[0];
      sumG[1] += x.gyro[1];
      sumG[2] += x.gyro[2];
    }
    const n = staticImu.length;
    bg0 = [sumG[0] / n, sumG[1] / n, sumG[2] / n];
    _sigmaBgInit = 0.01;
  }
  const ba0: Vec3 = [0, 0, 0];

  // Baro offset from first GPS altitude
  let baroOffset = 0;
  if (baro.length > 0 && gps.length > 0) {
    const baroAltAtGps0 = findBaroAtTime(baro, gps[0].tUs);
    if (baroAltAtGps0 !== null) {
      baroOffset = (gps[0].alt ?? alt0) - baroAltAtGps0;
    }
  }

  // ---- Build keyframe schedule ----
  const outputIntervalUs = 1e6 / outputHz;
  const kfTotal = Math.max(1, Math.ceil((imu[imu.length - 1].tUs - imu[0].tUs) / outputIntervalUs));

  const hasMag =
    magModel != null &&
    magModel.fusion?.earthFieldNedGauss != null &&
    mag != null &&
    mag.length > 0;
  const useMag = hasMag && magModel!.fusion?.qualityBounds?.bounds_ok !== false;
  let poses: SmoothedPose[] = [];
  const _traceForward: TraceEntry[] = [];

  const MIN_INFLIGHT_MAG_SIGMA = 0.02;
  let magSigmaXY = 0.05;
  let magSigmaZ = 0.05;
  const magFieldRefG =
    useMag && magModel!.fusion?.qualityBounds?.field_strength_mg != null
      ? magModel!.fusion!.qualityBounds!.field_strength_mg! / 1000
      : 0.539;

  if (useMag) {
    const mn = magModel!.fusion?.magNoiseGauss;
    magSigmaXY = mn?.sigma_xy != null ? mn.sigma_xy : (mn?.sigma ?? magSigma);
    magSigmaZ = mn?.sigma_z != null ? mn.sigma_z : magSigmaXY;
    if (magSigmaXY < MIN_INFLIGHT_MAG_SIGMA) magSigmaXY = MIN_INFLIGHT_MAG_SIGMA;
    if (magSigmaZ < MIN_INFLIGHT_MAG_SIGMA) magSigmaZ = MIN_INFLIGHT_MAG_SIGMA;
    console.log(
      `[MAG-R] sigma_xy=${magSigmaXY.toFixed(4)} G  sigma_z=${magSigmaZ.toFixed(4)} G  ` +
        `(model: xy=${mn?.sigma_xy?.toFixed(5)} z=${mn?.sigma_z?.toFixed(5)} G)`,
    );
  }

  // ---- Find nearest current sample for mag disturbance gating ----
  const findCurrent = (tUs: number): number => {
    if (!current || !current.length) return 0;
    let best = current[0];
    let bestDt = Math.abs(current[0].tUs - tUs);
    for (let ci = 1; ci < current.length; ci++) {
      const dt = Math.abs(current[ci].tUs - tUs);
      if (dt < bestDt) {
        bestDt = dt;
        best = current[ci];
      }
    }
    return best.amps;
  };

  for (let iter = 0; iter < maxIter; iter++) {
    // Within-iteration decile tracker for progress cadence.
    // Emits ~10 events per forward pass across ~4500 keyframes, so the
    // progress bar advances roughly every 2 s instead of freezing for 20 s.
    let kfIndex = 0;
    let lastDecile = -1;

    const eskfOpts: EskfOptions = {
      p0,
      v0,
      q0,
      sigmaPos: 5,
      sigmaVel: 2,
      sigmaAtt: 0.2,
      ba0,
      bg0,
      sigmaBa: sigmaBaInit,
      sigmaBg: _sigmaBgInit,
      sigmaBaRW,
      sigmaBgRW,
      procSigmaAcc,
      procSigmaGyro,
      bgClamp: sigmaBgPrior > 0 ? sigmaBgPrior : 0,
    };
    if (useMag) {
      const me = magModel!.fusion!.earthFieldNedGauss!;
      eskfOpts.mEarth0 = [me.n, me.e, me.d];
      eskfOpts.mBody0 = [0, 0, 0];
    }
    const eskf: EskfState = createEskf(eskfOpts);
    const steps: Step[] = [];
    let gpsPosIdx = 0;
    let gpsVelIdx = 0;
    let baroIdx = 0;
    let quatIdx = 0;
    let magIdx = 0;

    let imuIdx = 0;
    let nextKfUs = imu[0].tUs + outputIntervalUs;
    let F_acc: Mat = buildIdentityF(eskf.dim);

    while (imuIdx < imu.length) {
      const nowUs = imu[imuIdx].tUs;

      const dtUs =
        imuIdx < imu.length - 1 ? imu[imuIdx + 1].tUs - imu[imuIdx].tUs : 0;
      let F_step: Mat | null = null;
      if (dtUs > 0) {
        const result = eskfPredict(eskf, imu[imuIdx].gyro, imu[imuIdx].accel, dtUs / 1e6);
        F_step = result.F;
      }

      if (F_step) {
        F_acc = matMulFn(F_step, F_acc);
      }

      // ---- Updates at keyframe boundary ----
      if (nowUs >= nextKfUs || imuIdx === imu.length - 1) {
        const xPred: StepState = {
          p: [...eskf.p] as Vec3,
          v: [...eskf.v] as Vec3,
          q: [...eskf.q] as Quat,
          ba: [...eskf.ba] as Vec3,
          bg: [...eskf.bg] as Vec3,
          tUs: nowUs,
        };
        if (useMag) {
          xPred.mEarth = eskf.mEarth ? ([...eskf.mEarth] as Vec3) : undefined;
          xPred.mBody = eskf.mBody ? ([...eskf.mBody] as Vec3) : undefined;
        }
        const PPred: Mat = eskf.P.map((r) => [...r]);

        let hasUpdate = false;

        const currAmps = current && current.length ? findCurrent(nowUs) : 0;

        const gpsRobustOpts: RobustOpts = useDcs
          ? { dcs: true, dcsPhi: 1.0 }
          : {};

        // ---- GPS position update (FC-timed) ----
        while (
          gpsPosIdx < gps.length &&
          gps[gpsPosIdx].tUs <= nextKfUs + outputIntervalUs * 0.5
        ) {
          const gpsF = gps[gpsPosIdx];
          const gNed = llhToNed(
            gpsF.lat,
            gpsF.lon,
            gpsF.alt ?? alt0,
            lat0,
            lon0,
            alt0,
          );
          const effectivePosSigma = getGpsPosSigma(gpsF.numSat);
          const fP = createGpsPositionFactor(
            { n: gNed.n, e: gNed.e, d: gNed.d },
            effectivePosSigma,
          );
          if (
            eskfUpdate(
              eskf,
              fP as any,
              { n: gNed.n, e: gNed.e, d: gNed.d },
              gpsPosGate,
              gpsRobustOpts,
            )
          )
            hasUpdate = true;

          gpsPosIdx++;
        }

        // ---- GPS velocity update (always FC-timed; Doppler is near-instant) ----
        while (
          gpsVelIdx < gps.length &&
          gps[gpsVelIdx].tUs <= nextKfUs + outputIntervalUs * 0.5
        ) {
          const gpsF = gps[gpsVelIdx];

          if (gpsF.velNed) {
            // Suppress GPS velocity→yaw fusion during rapid rotation (snap turns).
            // Momentum keeps GPS track curving slowly while the nose has already
            // snapped → the −skew(R·a)·dt cross-covariance would mis-attribute the
            // velocity/heading mismatch as a yaw error. Gate the measurement,
            // not the propagation (which is legitimate physics).
            const peakGyroDps = Math.hypot(
              imu[imuIdx].gyro[0],
              imu[imuIdx].gyro[1],
              imu[imuIdx].gyro[2],
            ) * (180 / Math.PI);
            if (peakGyroDps >= SNAP_GYRO_GATE_DPS) {
              gpsVelIdx++;
              continue;
            }
            const fV = createGpsVelocityFactor(
              {
                n: gpsF.velNed[0],
                e: gpsF.velNed[1],
                d: gpsF.velNed[2],
              },
              gpsVelSigma,
            );
            if (
              eskfUpdate(
                eskf,
                fV as any,
                {
                  n: gpsF.velNed[0],
                  e: gpsF.velNed[1],
                  d: gpsF.velNed[2],
                },
                gpsVelGate,
                gpsRobustOpts,
              )
            )
              hasUpdate = true;
          }

          gpsVelIdx++;
        }

        // Baro update — only the LAST sample before this keyframe.
        // Dynamic baro R: inflates on high throttle/climb-rate (propwash / dynamic-pressure
        // spikes corrupt the barometer). Tight σ=1.0–2.0 in steady level flight; widens
        // to σ≈5–10 m during punch-outs where pressure fluctuations dominate.
        {
          let lastBaro: BaroEntry | null = null;
          while (baroIdx < baro.length && baro[baroIdx].tUs <= nextKfUs) {
            lastBaro = baro[baroIdx];
            baroIdx++;
          }
          if (lastBaro) {
            // Climb rate from current ESKF state (NED D-axis; negative = climbing)
            const climbRateMs = Math.abs(eskf.v[2]);
            // Inflate on high current (>20A) OR high climb rate (>5 m/s)
            let baroInflate = 1.0;
            if (currAmps > 20) baroInflate += (currAmps - 20) / 10;       // +1 sigma per 10A above 20A
            if (climbRateMs > 5) baroInflate += (climbRateMs - 5) * 0.5;   // +0.5 sigma per m/s above 5 m/s
            const effectiveBaroSigma = baroSigma * Math.max(1.0, baroInflate);

            const fB = createBaroFactor(lastBaro.alt, baroOffset, effectiveBaroSigma);
            if (eskfUpdate(eskf, fB as any, lastBaro.alt)) hasUpdate = true;
          }
        }

        // Quaternion prior — ALL samples per keyframe, UNCONDITIONAL.
        // Adaptive sigma yaw: σ_yaw couples to yaw observability (|R[2][0]|)
        // and mag disturbance scale (|B| anomaly + motor current).

        // Pre-compute shared signals for mag disturbance and yaw observability
        let magDisturbScale = 1.0;
        let yawObsScale = 1.0;
        if (useMag) {
          const R_est = quatToRot(eskf.q);
          const col0zAbs = Math.abs(R_est[2][0]);

          yawObsScale =
            col0zAbs > 0.7
              ? 1.0 + Math.pow((col0zAbs - 0.7) / 0.3, 2) * 10.0
              : 1.0;

          let peekMag: MagGaussEntry | null = null;
          let peekMagIdx = magIdx;
          while (peekMagIdx < mag.length && mag[peekMagIdx].tUs <= nextKfUs) {
            peekMag = mag[peekMagIdx];
            peekMagIdx++;
          }
          if (peekMag) {
            const magMag = Math.hypot(
              peekMag.meas[0],
              peekMag.meas[1],
              peekMag.meas[2],
            );
            const bFrac = Math.abs(magMag - magFieldRefG) / magFieldRefG;
            const bScale =
              bFrac > 0.15 ? 1.0 + (bFrac - 0.15) * 20.0 : 1.0;
            const currScale =
              currAmps > 15.0
                ? 1.0 + Math.pow((currAmps - 15.0) / 15.0, 2) * 3.0
                : 1.0;
            magDisturbScale = Math.max(bScale, currScale);
          }
        }

        // Adaptive sigma tilt with kinematic ω×v correction (planv5/06 §9.2).
        // Uses current IMU accel/gyro and ESKF velocity to isolate gravity
        // before choosing the branch (nominal / freefall / interpolated).
        const adaptiveSigmaTilt = computeAdaptiveSigmaTilt(
          imu[imuIdx].accel,
          imu[imuIdx].gyro,
          eskf.v,
          eskf.q,
        );

        const traceEntry: TraceEntry = {
          tUs: nowUs,
          sigmaTilt: adaptiveSigmaTilt,
          bg2_rads: eskf.bg ? eskf.bg[2] : undefined,
          fwPos: [...eskf.p] as Vec3,
        };

        // Raw-mag heading-bias pre-rotation: when no model is loaded but an
        // in-flight hard-iron bias has been estimated, rotate every FC
        // quaternion by +bias about world-Z before the quaternion prior sees it.
        // bias = median(mag_heading − fc_heading), so adding it corrects the
        // FC heading toward the mag's estimate of true heading.
        const applyRawMagBias = !useMag && rawMagBiasRad !== 0;
        const qMagBiasCorr = applyRawMagBias
          ? quatFromAxisAngle([0, 0, 1] as Vec3, rawMagBiasRad)
          : null;

        while (quatIdx < quat.length && quat[quatIdx].tUs <= nextKfUs) {
          const adaptiveSigmaYaw = useMag
            ? computeAdaptiveSigmaYaw(eskf.q, magDisturbScale, sigmaYawMax)
            : sigmaYaw;
          traceEntry.sigmaYaw = adaptiveSigmaYaw;

          const qMeas = applyRawMagBias
            ? quatMultiply(qMagBiasCorr!, quat[quatIdx].q)
            : quat[quatIdx].q;

          const fQ = createQuaternionPrior(
            qMeas,
            attSigma,
            adaptiveSigmaYaw,
          );
          if (eskfUpdate(eskf, fQ as any, qMeas, Infinity))
            hasUpdate = true;
          quatIdx++;
        }
        if (!traceEntry.sigmaYaw) traceEntry.sigmaYaw = sigmaYaw;
        _traceForward.push(traceEntry);

        // 3-axis mag update — 1 per keyframe (prevents over-counting)
        if (useMag) {
          let lastMag: MagGaussEntry | null = null;
          while (magIdx < mag.length && mag[magIdx].tUs <= nextKfUs) {
            lastMag = mag[magIdx];
            magIdx++;
          }
          if (lastMag) {
            const magRDisturbScale = magDisturbScale * yawObsScale;
            const effectiveSigmaXY = magSigmaXY * magRDisturbScale;
            const effectiveSigmaZ = magSigmaZ * magRDisturbScale;

            const fM = createMagFactor(
              lastMag.meas,
              effectiveSigmaXY,
              effectiveSigmaZ,
              currAmps,
            );
            if (eskfUpdate(eskf, fM as any, lastMag.meas, magGate))
              hasUpdate = true;
          }

          if (hasUpdate && magModel!.fusion?.earthFieldNedGauss) {
            const me = eskf.mEarth;
            if (me) {
              const decl = Math.atan2(
                magModel!.fusion!.earthFieldNedGauss!.e,
                magModel!.fusion!.earthFieldNedGauss!.n,
              );
              const fD = createDeclinationFactor(decl, declSigma);
              eskfUpdate(eskf, fD as any, decl);
            }
          }
        }

        const F_for_rts: Mat = F_acc.map((r) => [...r]);

        steps.push({
          x: {
            p: [...eskf.p] as Vec3,
            v: [...eskf.v] as Vec3,
            q: [...eskf.q] as Quat,
            ba: [...eskf.ba] as Vec3,
            bg: [...eskf.bg] as Vec3,
            tUs: nowUs,
            ...(useMag
              ? {
                  mEarth: eskf.mEarth
                    ? ([...eskf.mEarth] as Vec3)
                    : undefined,
                  mBody: eskf.mBody ? ([...eskf.mBody] as Vec3) : undefined,
                }
              : {}),
          },
          P: eskf.P.map((r) => [...r]),
          xPred: {
            p: [...xPred.p] as Vec3,
            v: [...xPred.v] as Vec3,
            q: [...xPred.q] as Quat,
            ba: [...xPred.ba] as Vec3,
            bg: [...xPred.bg] as Vec3,
            tUs: xPred.tUs,
            ...(useMag
              ? {
                  mEarth: xPred.mEarth
                    ? ([...xPred.mEarth] as Vec3)
                    : undefined,
                  mBody: xPred.mBody
                    ? ([...xPred.mBody] as Vec3)
                    : undefined,
                }
              : {}),
          },
          PPred,
          F: F_for_rts,
          hasUpdate,
        });

        // Emit progress whenever the keyframe decile changes.
        // Cap at 9 so the smooth event at (iter + 0.95)/maxIter is always
        // strictly after the last forward decile and before the next iteration.
        const decile = Math.min(9, Math.floor((kfIndex / kfTotal) * 10));
        if (onProgress && decile > lastDecile) {
          lastDecile = decile;
          onProgress({
            phase: 'forward',
            iteration: iter,
            totalIterations: maxIter,
            fraction: (iter + decile / 10) / maxIter,
            detail: `GN iteration ${iter + 1}/${maxIter}: ${decile * 10}% of keyframes`,
          });
        }
        kfIndex++;

        F_acc = buildIdentityF(eskf.dim);
        nextKfUs += outputIntervalUs;
      }

      imuIdx++;
    }

    // ---- RTS backward smooth ----
    if (onProgress) {
      onProgress({
        phase: 'smooth',
        iteration: iter,
        totalIterations: maxIter,
        fraction: (iter + 0.95) / maxIter,
        detail: `GN iteration ${iter + 1}/${maxIter}: RTS backward smooth`,
      });
    }

    const filterResults: FilterResult[] = steps.map((s) => ({
      x: s.x as RtsNominalState,
      P: s.P,
      xPred: s.xPred as RtsNominalState,
      PPred: s.PPred,
    }));
    const Fmatrices: (Mat | null)[] = steps.slice(1).map((s) => s.F);
    const smoothed: SmoothedResult[] = rtsSmooth(filterResults, Fmatrices);

    // Pair forward trace with smoothed positions + compute GPS errors (last iteration)
    if (iter === maxIter - 1 && _traceForward.length > 0) {
      const smByTus = new Map<number, { p: Vec3; bg?: Vec3 }>();
      for (const s of smoothed) {
        smByTus.set(s.x.tUs!, {
          p: [...s.x.p] as Vec3,
          bg: s.x.bg ? ([...s.x.bg] as Vec3) : undefined,
        });
      }
      const gpsByTus = new Map<number, number[]>();
      for (const g of gps) {
        const gn = llhToNed(g.lat, g.lon, g.alt ?? alt0, lat0, lon0, alt0);
        gpsByTus.set(g.tUs, [gn.n, gn.e, gn.d]);
      }

      for (const te of _traceForward) {
        const sm = smByTus.get(te.tUs);
        if (sm) {
          te.smPos = [...sm.p] as Vec3;
          te.posErrFwSmM = Math.hypot(
            te.fwPos[0] - sm.p[0],
            te.fwPos[1] - sm.p[1],
            te.fwPos[2] - sm.p[2],
          );
          te.bg2_sm_rads = sm.bg ? sm.bg[2] : undefined;
        }
        let bestGps: number[] | null = null;
        let bestDt = Infinity;
        for (const [t, gn] of gpsByTus) {
          const dt = Math.abs(t - te.tUs);
          if (dt < bestDt && dt < outputIntervalUs * 2) {
            bestDt = dt;
            bestGps = gn;
          }
        }
        if (bestGps) {
          te.gpsPos = bestGps;
          te.posErrSmGpsM = sm
            ? Math.hypot(
                sm.p[0] - bestGps[0],
                sm.p[1] - bestGps[1],
                sm.p[2] - bestGps[2],
              )
            : undefined;
        }
      }
    }

    // ---- Convert to output ----
    poses = smoothed.map((s) => ({
      tUs: s.x.tUs!,
      p: [...s.x.p] as Vec3,
      v: [...s.x.v] as Vec3,
      q: [...s.x.q] as Quat,
      ba: s.x.ba ? ([...s.x.ba] as Vec3) : undefined,
      bg: s.x.bg ? ([...s.x.bg] as Vec3) : undefined,
      P: s.P.map((r) => [...r]),
      mEarth: s.x.mEarth ? ([...s.x.mEarth] as Vec3) : undefined,
      mBody: s.x.mBody ? ([...s.x.mBody] as Vec3) : undefined,
    }));

    // Re-seed for next iteration
    if (poses.length > 0 && iter < maxIter - 1) {
      const first = smoothed[0];
      p0 = first.x.p;
      v0 = first.x.v;
      q0 = first.x.q;
    }
  }

  if (onProgress) {
    onProgress({
      phase: 'done',
      iteration: maxIter,
      totalIterations: maxIter,
      fraction: 1.0,
      detail: 'Estimation complete',
    });
  }

  return { smoothed: poses, t0Us, lat0, lon0, alt0, _traceForward };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface PoseTrackWithTrace extends PoseTrack {
  _traceForward?: TraceEntry[];
}

export function estimatePoseTrack(
  data: EstimatorData,
  origin: EstimatorOrigin,
  opts: EstimatorOpts = {},
): PoseTrackWithTrace {
  const { smoothed, lat0, lon0, alt0, _traceForward } = _runEstimation(
    data,
    origin,
    opts,
  );

  const DEG = 180 / Math.PI;

  const trackSamples: PoseSampleInternal[] = smoothed.map((s) => {
    const lla = nedToLlh({ n: s.p[0], e: s.p[1], d: s.p[2] }, lat0, lon0, alt0);

    const covPos: Mat = [
      s.P[0].slice(0, 3),
      s.P[1].slice(0, 3),
      s.P[2].slice(0, 3),
    ];

    const covAtt: Mat = [
      s.P[6].slice(6, 9),
      s.P[7].slice(6, 9),
      s.P[8].slice(6, 9),
    ];

    const R = quatToRot(s.q);
    const euler = {
      rollDeg: Math.atan2(R[2][1], R[2][2]) * DEG,
      pitchDeg: pitchDeg(s.q),
      headingDeg: noseBearingDeg(s.q),
      tiltDeg: tiltFromUprightDeg(s.q),
    };

    return {
      tUs: s.tUs,
      p: s.p,
      v: s.v,
      q: s.q,
      lla,
      covPos,
      covAtt,
      euler,
    };
  });

  const estimatedParams = computeConvergedParams(smoothed);

  const track: PoseTrackWithTrace = createPoseTrack({
    samples: trackSamples,
    georefOrigin: { lat: origin.lat, lon: origin.lon, alt: origin.alt },
    source: {
      log: 'Betaflight BBL',
      magModelSchema: opts.magModel
        ? String(opts.magModel.version || '2.x')
        : 'none',
      solverConfig: {
        outputHz: opts.outputHz || 20,
        gpsPosSigma: opts.gpsPosSigma || 2.5,
        gpsVelSigma: opts.gpsVelSigma || 0.5,
        gpsDelayMs: opts.gpsDelayMs || 0,
        gpsPosSigmaFloor: opts.gpsPosSigmaFloor ?? 1.0,
        baroSigma: opts.baroSigma || 1.0,
        attSigma: opts.attSigma || 0.1,
        useMag: !!(
          opts.magModel && opts.magModel.fusion?.earthFieldNedGauss
        ),
      },
      estimatedParams,
    },
  }) as PoseTrackWithTrace;
  track._traceForward = _traceForward;
  return track;
}

// ---------------------------------------------------------------------------
// Converged nuisance parameters
// ---------------------------------------------------------------------------

function computeConvergedParams(smoothed: SmoothedPose[]): ConvergedParams {
  const n = smoothed.length;
  if (n === 0) return {};
  const start = Math.floor(n * 0.75);
  const tail = smoothed.slice(start);
  const out: ConvergedParams = {};
  if (tail[0].ba) {
    const acc: Vec3 = [0, 0, 0];
    for (const s of tail)
      for (let i = 0; i < 3; i++) acc[i] += s.ba![i];
    out.ba = acc.map((x) => x / tail.length) as Vec3;
  }
  if (tail[0].bg) {
    const acc: Vec3 = [0, 0, 0];
    for (const s of tail)
      for (let i = 0; i < 3; i++) acc[i] += s.bg![i];
    out.bg = acc.map((x) => x / tail.length) as Vec3;
  }
  if (tail[0].mEarth) {
    const acc: Vec3 = [0, 0, 0];
    for (const s of tail)
      for (let i = 0; i < 3; i++) acc[i] += s.mEarth![i];
    out.mEarth = acc.map((x) => x / tail.length) as Vec3;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildIdentityF(n: number): Mat {
  const F = new Array<number[]>(n);
  for (let i = 0; i < n; i++) {
    F[i] = new Array<number>(n).fill(0);
    F[i][i] = 1;
  }
  return F;
}

function matMulFn(A: Mat, B: Mat): Mat {
  const n = A.length;
  const C = new Array<number[]>(n);
  for (let i = 0; i < n; i++) {
    C[i] = new Array<number>(n).fill(0);
    for (let k = 0; k < n; k++) {
      const aik = A[i][k];
      if (aik === 0) continue;
      for (let j = 0; j < n; j++) C[i][j] += aik * B[k][j];
    }
  }
  return C;
}

function findBaroAtTime(baro: BaroEntry[], tUs: number): number | null {
  if (baro.length === 0) return null;
  let best = baro[0];
  let bestDt = Math.abs(baro[0].tUs - tUs);
  for (let i = 1; i < baro.length; i++) {
    const dt = Math.abs(baro[i].tUs - tUs);
    if (dt < bestDt) {
      bestDt = dt;
      best = baro[i];
    }
  }
  return best.alt;
}

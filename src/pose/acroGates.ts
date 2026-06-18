/**
 * acroGates — reusable, log-rate-independent validation gates for real-flight fixtures.
 *
 * A "fixture" is a (blackbox + mag-model + manifest) triple. The manifest annotates
 * named maneuver windows in VIDEO time plus a clock offset; these gates assert that
 * the reconstructed PoseTrack reproduces each maneuver within tolerances justified by
 * consumer-grade hardware.
 *
 * Rate independence: every time quantity is derived from tUs, never from sample count.
 * All attitude/position gates run on a rate-independent stream.
 *
 * Frame conventions:
 *  - Body: FRD (Forward=X, Right=Y, Down=Z)
 *  - World: NED (North, East, Down)
 *  - Quaternion: Hamilton, body(FRD) → world(NED), scalar-first [w, x, y, z]
 */

import type { PoseSampleInternal, Quat, Vec3 } from './poseSample.js';
import type { ImuEntry, BaroEntry, QuatEntry, GpsEntry, MagGaussEntry } from './flightIngestion.js';

const D = 180 / Math.PI;

// ---------------------------------------------------------------------------
// Attitude geometry
// ---------------------------------------------------------------------------

export function quatToR(q: Quat): number[][] {
  const [w, x, y, z] = q;
  return [
    [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)],
    [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)],
    [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)],
  ];
}

export function noseBearingDeg(q: Quat): number {
  const m = quatToR(q);
  return ((Math.atan2(m[1][0], m[0][0]) * D) % 360 + 360) % 360;
}

/** ZYX pitch in degrees: negative = nose UP, positive = nose DOWN (per convention) */
export function pitchDeg(q: Quat): number {
  const m = quatToR(q);
  return -Math.asin(Math.max(-1, Math.min(1, m[2][0]))) * D;
}

/** Tilt from upright: 0 = level, 180 = inverted */
export function tiltFromUprightDeg(q: Quat): number {
  const m = quatToR(q);
  return Math.acos(Math.max(-1, Math.min(1, m[2][2]))) * D;
}

export function speed(v: Vec3): number {
  return Math.hypot(v[0], v[1]);
}

export function courseDeg(v: Vec3): number {
  return (Math.atan2(v[1], v[0]) * D % 360 + 360) % 360;
}

export function wrap(deg: number): number {
  let v = deg;
  while (v > 180) v -= 360;
  while (v < -180) v += 360;
  return v;
}

export function crabDeg(q: Quat, v: Vec3): number {
  return wrap(noseBearingDeg(q) - courseDeg(v));
}

export function quatAngleDeg(a: Quat, b: Quat): number {
  const d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
  return 2 * Math.acos(Math.min(1, d)) * D;
}

// ---------------------------------------------------------------------------
// Time / windowing
// ---------------------------------------------------------------------------

export const videoToTUs = (videoSec: number, offsetSec: number): number =>
  (videoSec - offsetSec) * 1e6;

export function windowSamples<T extends { tUs: number }>(
  samples: T[],
  t0Video: number,
  t1Video: number,
  offsetSec: number,
): T[] {
  const a = videoToTUs(t0Video, offsetSec);
  const b = videoToTUs(t1Video, offsetSec);
  return samples.filter((s) => s.tUs >= a && s.tUs <= b);
}

export function minAccelInWindow(
  imu: { tUs: number; accel: Vec3 }[],
  t0Video: number,
  t1Video: number,
  offsetSec: number,
): number {
  const a = videoToTUs(t0Video, offsetSec);
  const b = videoToTUs(t1Video, offsetSec);
  let m = Infinity;
  for (const im of imu) {
    if (im.tUs < a || im.tUs > b) continue;
    const g = Math.hypot(...im.accel);
    if (g < m) m = g;
  }
  return m;
}

function nearestByTUs<T extends { tUs: number }>(arr: T[], tUs: number): T {
  let lo = 0, hi = arr.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].tUs < tUs) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(arr[lo - 1].tUs - tUs) < Math.abs(arr[lo].tUs - tUs)) return arr[lo - 1];
  return arr[lo];
}

function median(xs: number[]): number {
  const a = [...xs].sort((p, q) => p - q);
  return a.length ? a[a.length >> 1] : NaN;
}

// ---------------------------------------------------------------------------
// Gate result
// ---------------------------------------------------------------------------

export interface GateResult {
  name: string;
  pass: boolean;
  message: string;
}

const mk = (name: string, pass: boolean, message: string): GateResult => ({ name, pass, message });

// ---------------------------------------------------------------------------
// Per-sample yaw rate series (rate-independent)
// ---------------------------------------------------------------------------

export function yawRateSeries(samples: PoseSampleInternal[]): number[] {
  const r = new Array(samples.length).fill(0);
  for (let i = 1; i < samples.length - 1; i++) {
    const dt = (samples[i + 1].tUs - samples[i - 1].tUs) / 1e6;
    if (dt > 0) {
      r[i] = wrap(noseBearingDeg(samples[i + 1].q) - noseBearingDeg(samples[i - 1].q)) / dt;
    }
  }
  return r;
}

// ============================ AUTO gates (no manifest) ============================

export function gateFinite(samples: PoseSampleInternal[]): GateResult {
  let bad = 0;
  for (const s of samples) {
    if (!s.p.every(Number.isFinite) || !s.q.every(Number.isFinite)) bad++;
  }
  return mk('finite', bad === 0, `${bad} non-finite samples of ${samples.length}`);
}

export function gateNotFrozen(samples: PoseSampleInternal[], minTotalDeg = 500): GateResult {
  let tot = 0;
  for (let i = 1; i < samples.length; i++) {
    tot += Math.abs(wrap(noseBearingDeg(samples[i].q) - noseBearingDeg(samples[i - 1].q)));
  }
  return mk('not-frozen', tot > minTotalDeg, `total |Δyaw| = ${tot.toFixed(0)}° (need > ${minTotalDeg}°)`);
}

/** Reconstructed attitude must track the FC's own logged quaternion. Uses MEDIAN
 *  geodesic error, not RMS: brief ~180° spikes from timing jitter during flips
 *  would dominate RMS; median measures typical tracking. */
export function gateAttitudeTracksFC(
  samples: PoseSampleInternal[],
  fcQuat: QuatEntry[],
  maxMedianDeg = 25,
): GateResult {
  const errs: number[] = [];
  for (const s of samples) {
    const f = nearestByTUs(fcQuat, s.tUs);
    errs.push(quatAngleDeg(s.q, f.q));
  }
  errs.sort((a, b) => a - b);
  const med = errs[errs.length >> 1];
  const p90 = errs[Math.floor(0.9 * (errs.length - 1))];
  return mk('attitude-tracks-FC', med < maxMedianDeg,
    `attitude error vs FC: median ${med.toFixed(1)}° (need < ${maxMedianDeg}°); p90 ${p90.toFixed(0)}° (tail = fast-flip timing jitter)`);
}

/** Reconstructed position must track raw GPS (no drift runaway). */
export function gatePositionTracksGPS(
  samples: PoseSampleInternal[],
  gpsNed: { tUs: number; n: number; e: number }[],
  maxDriftM = 25,
): GateResult {
  let maxD = 0;
  for (const s of samples) {
    const g = nearestByTUs(gpsNed, s.tUs);
    const h = Math.hypot(s.p[0] - g.n, s.p[1] - g.e);
    if (h > maxD) maxD = h;
  }
  return mk('position-tracks-GPS', maxD < maxDriftM,
    `max drift vs GPS = ${maxD.toFixed(1)} m (need < ${maxDriftM} m)`);
}

/** During straight forward flight, nose must track GPS course (small crab). */
export function gateForwardCrab(
  samples: PoseSampleInternal[],
  maxMedianCrabDeg = 30,
  minSpeed = 5,
  maxYawRate = 15,
): GateResult {
  const yr = yawRateSeries(samples);
  const crabs: number[] = [];
  for (let i = 0; i < samples.length; i++) {
    if (speed(samples[i].v) < minSpeed || Math.abs(yr[i]) > maxYawRate) continue;
    crabs.push(Math.abs(crabDeg(samples[i].q, samples[i].v)));
  }
  const med = median(crabs);
  return mk('forward-crab', crabs.length > 10 && med < maxMedianCrabDeg,
    `median |crab| on straight legs = ${Number.isFinite(med) ? med.toFixed(0) : 'n/a'}° over ${crabs.length} samples (need < ${maxMedianCrabDeg}°)`);
}

// ============================ MANIFEST (typed) gates ============================

export interface ManifestSegment {
  name: string;
  type: string;
  t0: number;
  t1: number;
  expect?: {
    headingDeg?: number;
    crabSign?: number;
    freefall?: [number, number];
    fall?: [number, number];
  };
  params?: Record<string, number>;
}

export interface GateContext {
  samples: PoseSampleInternal[];
  offsetSec: number;
  imu: ImuEntry[];
  baro: BaroEntry[];
  fcQuat?: QuatEntry[];
}

/** heading_anchor: at a declared moment the nose points a declared cardinal. */
export function gateHeadingAnchor(ctx: GateContext, seg: ManifestSegment): GateResult {
  const { tolDeg = 45 } = seg.params || {};
  const ws = windowSamples(ctx.samples, seg.t0, seg.t1, ctx.offsetSec);
  if (!ws.length) return mk(seg.name, false, 'no samples in window');
  let sx = 0, sy = 0;
  for (const s of ws) {
    const b = noseBearingDeg(s.q) / D;
    sx += Math.cos(b);
    sy += Math.sin(b);
  }
  const hdg = (Math.atan2(sy, sx) * D % 360 + 360) % 360;
  const err = Math.abs(wrap(hdg - (seg.expect?.headingDeg ?? 0)));
  return mk(seg.name, err < tolDeg,
    `heading ${hdg.toFixed(0)}° vs declared ${seg.expect?.headingDeg ?? 0}° → err ${err.toFixed(0)}° (tol ${tolDeg}°)`);
}

/** orbit: sustained crab with declared handedness sign. */
export function gateOrbit(ctx: GateContext, seg: ManifestSegment): GateResult {
  const { minMeanCrabDeg = 35 } = seg.params || {};
  const ws = windowSamples(ctx.samples, seg.t0, seg.t1, ctx.offsetSec);
  let sum = 0, n = 0;
  for (const s of ws) {
    if (speed(s.v) < 2) continue;
    sum += crabDeg(s.q, s.v);
    n++;
  }
  const mean = n ? sum / n : 0;
  const signOk = seg.expect?.crabSign ? Math.sign(mean) === Math.sign(seg.expect.crabSign) : true;
  const pass = n > 5 && Math.abs(mean) > minMeanCrabDeg && signOk;
  return mk(seg.name, pass,
    `mean crab = ${mean.toFixed(0)}° (need |·| > ${minMeanCrabDeg}°, sign ${(seg.expect?.crabSign ?? 0) > 0 ? '+' : '−'})`);
}

/** barrel_roll: attitude reaches inverted and returns; freefall present in sub-window. */
export function gateBarrelRoll(ctx: GateContext, seg: ManifestSegment): GateResult {
  const { minTiltDeg = 150, maxFreefallAccel = 3 } = seg.params || {};
  const ws = windowSamples(ctx.samples, seg.t0, seg.t1, ctx.offsetSec);
  let maxTilt = 0;
  const endTilt = ws.length ? tiltFromUprightDeg(ws[ws.length - 1].q) : 180;
  for (const s of ws) {
    const t = tiltFromUprightDeg(s.q);
    if (t > maxTilt) maxTilt = t;
  }
  const ff = seg.expect?.freefall
    ? minAccelInWindow(ctx.imu, seg.expect.freefall[0], seg.expect.freefall[1], ctx.offsetSec)
    : 0;
  const pass = maxTilt > minTiltDeg
    && (!seg.expect?.freefall || ff < maxFreefallAccel)
    && endTilt < 70;
  return mk(seg.name, pass,
    `maxTilt ${maxTilt.toFixed(0)}° (>${minTiltDeg}), freefall accel ${ff.toFixed(1)} (<${maxFreefallAccel}), endTilt ${endTilt.toFixed(0)}° (<70 = out of inversion)`);
}

/** pitch_flip: full pitch loop through vertical + inverted + freefall. */
export function gatePitchFlip(ctx: GateContext, seg: ManifestSegment): GateResult {
  const { minTiltDeg = 150, minPitchRangeDeg = 120, maxFreefallAccel = 3 } = seg.params || {};
  const ws = windowSamples(ctx.samples, seg.t0, seg.t1, ctx.offsetSec);
  let maxTilt = 0, minP = 999, maxP = -999;
  for (const s of ws) {
    const t = tiltFromUprightDeg(s.q);
    if (t > maxTilt) maxTilt = t;
    const p = pitchDeg(s.q);
    if (p < minP) minP = p;
    if (p > maxP) maxP = p;
  }
  const range = maxP - minP;
  const ff = seg.expect?.freefall
    ? minAccelInWindow(ctx.imu, seg.expect.freefall[0], seg.expect.freefall[1], ctx.offsetSec)
    : 0;
  const pass = maxTilt > minTiltDeg && range > minPitchRangeDeg
    && (!seg.expect?.freefall || ff < maxFreefallAccel);
  return mk(seg.name, pass,
    `maxTilt ${maxTilt.toFixed(0)}° (>${minTiltDeg}), pitchRange ${range.toFixed(0)}° (>${minPitchRangeDeg}), freefall ${ff.toFixed(1)} (<${maxFreefallAccel})`);
}

/** climb_fall: large altitude excursion, freefall in fall sub-window, nose-down during fall. */
export function gateClimbFall(ctx: GateContext, seg: ManifestSegment): GateResult {
  const {
    minClimbM = 25, baroTolM = 20, minTiltDeg = 60,
    maxFreefallAccel = 3, noseDownMaxPitchDeg = -20,
  } = seg.params || {};
  const ws = windowSamples(ctx.samples, seg.t0, seg.t1, ctx.offsetSec);
  if (!ws.length) return mk(seg.name, false, 'no samples in window');
  let dMin = Infinity, dMax = -Infinity, maxTilt = 0;
  for (const s of ws) {
    if (s.p[2] < dMin) dMin = s.p[2];
    if (s.p[2] > dMax) dMax = s.p[2];
    const t = tiltFromUprightDeg(s.q);
    if (t > maxTilt) maxTilt = t;
  }
  const reconClimb = dMax - dMin;
  const a = videoToTUs(seg.t0, ctx.offsetSec);
  const b = videoToTUs(seg.t1, ctx.offsetSec);
  let bMin = Infinity, bMax = -Infinity;
  for (const bb of ctx.baro) {
    if (bb.tUs < a || bb.tUs > b) continue;
    if (bb.alt < bMin) bMin = bb.alt;
    if (bb.alt > bMax) bMax = bb.alt;
  }
  const baroClimb = bMax - bMin;
  const ff = seg.expect?.fall
    ? minAccelInWindow(ctx.imu, seg.expect.fall[0], seg.expect.fall[1], ctx.offsetSec)
    : 0;

  let noseDownPass = true;
  let noseDownDetail = 'n/a';
  if (seg.expect?.fall) {
    const fallSamples = windowSamples(ctx.samples, seg.expect.fall[0], seg.expect.fall[1], ctx.offsetSec);
    if (fallSamples.length > 0) {
      const pitches = fallSamples.map((s) => pitchDeg(s.q));
      pitches.sort((a, b) => a - b);
      const medPitch = pitches[pitches.length >> 1];
      noseDownPass = medPitch < noseDownMaxPitchDeg;
      noseDownDetail = `median pitch ${medPitch.toFixed(0)}° (need < ${noseDownMaxPitchDeg}° = nose-down)`;
    } else {
      noseDownDetail = 'no fall samples';
    }
  }

  const pass = reconClimb > minClimbM
    && Math.abs(reconClimb - baroClimb) < baroTolM
    && maxTilt > minTiltDeg
    && (!seg.expect?.fall || ff < maxFreefallAccel)
    && noseDownPass;
  return mk(seg.name, pass,
    `reconClimb ${reconClimb.toFixed(0)} m vs baro ${baroClimb.toFixed(0)} m (Δ<${baroTolM}), maxTilt ${maxTilt.toFixed(0)}° (>${minTiltDeg} orientation change), freefall ${ff.toFixed(1)} (<${maxFreefallAccel}), ${noseDownDetail}`);
}

/** backward: nose ~opposite to travel somewhere in the window. */
export function gateBackward(ctx: GateContext, seg: ManifestSegment): GateResult {
  const { minCrabDeg = 110 } = seg.params || {};
  const ws = windowSamples(ctx.samples, seg.t0, seg.t1, ctx.offsetSec);
  let maxCrab = 0;
  for (const s of ws) {
    if (speed(s.v) < 3) continue;
    const c = Math.abs(crabDeg(s.q, s.v));
    if (c > maxCrab) maxCrab = c;
  }
  return mk(seg.name, maxCrab > minCrabDeg,
    `max |crab| = ${maxCrab.toFixed(0)}° (need > ${minCrabDeg}° = flying backward)`);
}

const SEGMENT_GATES: Record<string, (ctx: GateContext, seg: ManifestSegment) => GateResult> = {
  heading_anchor: gateHeadingAnchor,
  orbit: gateOrbit,
  barrel_roll: gateBarrelRoll,
  pitch_flip: gatePitchFlip,
  climb_fall: gateClimbFall,
  backward: gateBackward,
};

export function runSegmentGate(ctx: GateContext, seg: ManifestSegment): GateResult {
  const fn = SEGMENT_GATES[seg.type];
  if (!fn) return mk(seg.name, false, `unknown segment type "${seg.type}"`);
  return fn(ctx, seg);
}

// ---- coarse, pilot-reported ground truth ----

export function gateLoopClosure(samples: PoseSampleInternal[], maxM = 10): GateResult {
  const d = Math.hypot(
    samples[samples.length - 1].p[0] - samples[0].p[0],
    samples[samples.length - 1].p[1] - samples[0].p[1],
  );
  return mk('loop-closure', d < maxM, `takeoff↔landing = ${d.toFixed(1)} m (need < ${maxM} m)`);
}

export function gateAltDelta(samples: PoseSampleInternal[], expectedLowerM: number, tolM = 12): GateResult {
  const lower = samples[samples.length - 1].p[2] - samples[0].p[2];
  const pass = Math.abs(lower - expectedLowerM) < tolM;
  return mk('alt-delta', pass,
    `landed ${lower.toFixed(1)} m lower vs pilot ${expectedLowerM} m (tol ${tolM} m)`);
}

export function gateMaxClimb(samples: PoseSampleInternal[], expectedM: number, tolM = 30): GateResult {
  let dMin = Infinity;
  for (const s of samples) if (s.p[2] < dMin) dMin = s.p[2];
  const climb = samples[0].p[2] - dMin;
  return mk('max-climb', Math.abs(climb - expectedM) < tolM,
    `max climb = ${climb.toFixed(0)} m vs pilot ${expectedM} m (tol ${tolM} m)`);
}

/**
 * Mag-derived heading must track GPS course on straight forward legs.
 *
 * Tilt-compensates the body-frame magnetometer via the FC quaternion
 * (which has trustworthy tilt) — NOT the reconstruction quaternion.
 * This isolates the mag frame convention from the estimator's heading accuracy.
 */
export function gateMagHeadingTracksGPS(
  magBody: MagGaussEntry[],
  fcQuat: QuatEntry[],
  gps: GpsEntry[],
  declDeg: number,
  maxMedianErrDeg = 25,
  minSpeed = 5,
): GateResult {
  if (!magBody || !magBody.length) return mk('mag-heading-tracks-GPS', false, 'no mag data');
  if (!fcQuat || !fcQuat.length) return mk('mag-heading-tracks-GPS', false, 'no FC quat data');
  if (!gps || !gps.length) return mk('mag-heading-tracks-GPS', false, 'no GPS data');

  const gpsSorted = [...gps].sort((a, b) => a.tUs - b.tUs);

  function nearestGps(tUs: number): GpsEntry {
    let lo = 0, hi = gpsSorted.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (gpsSorted[mid].tUs < tUs) lo = mid + 1; else hi = mid; }
    if (lo > 0 && Math.abs(gpsSorted[lo - 1].tUs - tUs) < Math.abs(gpsSorted[lo].tUs - tUs)) return gpsSorted[lo - 1];
    return gpsSorted[lo];
  }

  function nearestFcQuat(tUs: number): QuatEntry {
    let lo = 0, hi = fcQuat.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (fcQuat[mid].tUs < tUs) lo = mid + 1; else hi = mid; }
    if (lo > 0 && Math.abs(fcQuat[lo - 1].tUs - tUs) < Math.abs(fcQuat[lo].tUs - tUs)) return fcQuat[lo - 1];
    return fcQuat[lo];
  }

  function rollPitchFromQuat(q: Quat): { roll: number; pitch: number } {
    const R = quatToR(q);
    const pitch = -Math.asin(Math.max(-1, Math.min(1, R[2][0])));
    const roll = Math.atan2(R[2][1], R[2][2]);
    return { roll, pitch };
  }

  function undoRollPitchVec(v: Vec3, roll: number, pitch: number): Vec3 {
    const cr = Math.cos(-roll), sr = Math.sin(-roll);
    const y1 = v[1] * cr - v[2] * sr;
    const z1 = v[1] * sr + v[2] * cr;
    const cp = Math.cos(-pitch), sp = Math.sin(-pitch);
    const x2 = v[0] * cp + z1 * sp;
    const y2 = y1;
    const z2 = -v[0] * sp + z1 * cp;
    return [x2, y2, z2];
  }

  const errors: number[] = [];
  let skippedNoSpeed = 0, skippedSlow = 0, skippedNoCourse = 0, skippedTilted = 0;

  for (const m of magBody) {
    const g = nearestGps(m.tUs);
    if (!g || Math.abs(g.tUs - m.tUs) > 1e6) continue;
    if (g.course == null || !isFinite(g.course)) { skippedNoCourse++; continue; }
    if (g.speed == null || !isFinite(g.speed)) { skippedNoSpeed++; continue; }
    if (g.speed < minSpeed) { skippedSlow++; continue; }

    const fq = nearestFcQuat(m.tUs);
    if (!fq || Math.abs(fq.tUs - m.tUs) > 1e6) continue;

    const { roll, pitch } = rollPitchFromQuat(fq.q);
    const tiltFromUpright = Math.acos(Math.cos(roll) * Math.cos(pitch)) * D;
    if (tiltFromUpright > 30) { skippedTilted++; continue; }

    const mLeveled = undoRollPitchVec(m.meas, roll, pitch);
    const hMag = Math.atan2(-mLeveled[1], mLeveled[0]) * D;
    const hTrue = ((hMag + declDeg) % 360 + 360) % 360;
    const err = wrap(hTrue - g.course);
    errors.push(err);
  }

  if (errors.length < 10) {
    return mk('mag-heading-tracks-GPS', false,
      `only ${errors.length} valid near-level samples (skipped: ${skippedNoSpeed} no-speed, ${skippedSlow} slow, ${skippedNoCourse} no-course, ${skippedTilted} tilted>30°)`);
  }

  const absErrs = errors.map((e) => Math.abs(e)).sort((a, b) => a - b);
  const medAbs = absErrs[absErrs.length >> 1];
  const signedMean = errors.reduce((a, b) => a + b, 0) / errors.length;
  const mirrorSuspect = Math.abs(signedMean) > 60 && absErrs[0] > 30;

  const pass = medAbs < maxMedianErrDeg && !mirrorSuspect;
  return mk('mag-heading-tracks-GPS', pass,
    `median |magHeading − GPS| = ${medAbs.toFixed(1)}° over ${errors.length} near-level samples ` +
    `(skipped ${skippedNoSpeed} no-speed, ${skippedSlow} slow, ${skippedNoCourse} no-course, ${skippedTilted} tilted) ` +
    `(need < ${maxMedianErrDeg}°). signed mean = ${signedMean.toFixed(1)}° ` +
    `${mirrorSuspect ? '(SUSPECT MIRROR)' : ''}`);
}

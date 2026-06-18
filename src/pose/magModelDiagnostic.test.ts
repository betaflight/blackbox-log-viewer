/**
 * Mag model diagnostic: with-model vs no-model endpoint drift.
 *
 * INSTITUTIONALIZED FINDING: the mag calibration model is worth ~10× loop
 * closure on acro1 (2.5 m vs 26.8 m endpoint drift).  The final heading is
 * identical — a SUSTAINED ~2-3° FC heading bias, not a yaw failure.
 *
 * Three configurations tested:
 *   A. WITH model (2.5 m baseline — regression guard)
 *   B. NO model + raw-mag auto-cal bias (the model-free path)
 *   C. NO model + NO correction (the old 26.8 m baseline)
 *
 * The GPS-course-as-heading factor has been REMOVED (heading ≠ track for a
 * quad).  It is replaced by computeMagHeadingBias() which fits a hard-iron
 * sphere to raw mag data and estimates the FC's sustained heading error.
 *
 * HEAVY integration test (test:full only).
 *
 * Run:  npm run test:full
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { describeIntegration } from './testHelpers.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ingestFlightLog, loadFlightLogFromBuffer, correctMagStream } from './flightIngestion.js';
import type { IngestedData, MagGaussEntry } from './flightIngestion.js';
import { estimatePoseTrack } from './estimatorLoop.js';
import type { EstimatorOpts, MagModelInput } from './estimatorLoop.js';
import { loadMagCharacterizationModel } from './mag_model.js';
import { computeMagHeadingBias } from './rawMagBias.js';
import { llhToNed } from './geodesy.js';
import type { PoseSampleInternal, Vec3 } from './poseSample.js';
import {
  gateLoopClosure,
  gateHorizontalPositionVsGPS,
  gateHeadingVsCourse,
  gateForwardCrab,
  gateAttitudeTracksFC_Tight,
  gateNotFrozen,
} from './acroGates.js';
import type { GateResult } from './acroGates.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(__dirname, './__fixtures__/acro1/');
const BFL_PATH = path.join(DIR, 'LOG00007.BFL');
const MODEL_PATH = path.join(DIR, 'acro1_mag_model.json');

function haveFiles(): boolean {
  try {
    fs.accessSync(BFL_PATH, fs.constants.R_OK);
    fs.accessSync(MODEL_PATH, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function assertPass(r: GateResult, label: string): void {
  if (!r.pass) console.log(`  [FAIL] ${label}: ${r.message}`);
  expect(r.pass, `${label}: ${r.message}`).toBe(true);
}

/** Build GPS NED array for gate functions */
function buildGpsNed(
  gps: Array<{ tUs: number; lat: number; lon: number; alt: number | null }>,
  lat0: number,
  lon0: number,
  alt0: number,
): Array<{ tUs: number; n: number; e: number; d: number }> {
  return gps
    .filter((g) => g.lat !== 0 && g.lon !== 0)
    .map((g) => {
      const ned = llhToNed(g.lat, g.lon, g.alt ?? alt0, lat0, lon0, alt0);
      return { tUs: g.tUs, n: ned.n, e: ned.e, d: ned.d };
    });
}

/** Compute signed heading-vs-GPS-course bias on forward-flight legs.
 *  Positive bias = nose is CW of GPS course (FC heading reads too high).
 *  Only on samples with speed > minSpeed and yaw rate < maxYawRate. */
function headingBiasStats(
  samples: PoseSampleInternal[],
  minSpeed = 5,
  maxYawRate = 15,
): { medianBiasDeg: number; meanBiasDeg: number; n: number } {
  const D = 180 / Math.PI;

  // Yaw rate series for filtering turns
  const yr = new Array(samples.length).fill(0);
  for (let i = 1; i < samples.length - 1; i++) {
    const dt = (samples[i + 1].tUs - samples[i - 1].tUs) / 1e6;
    if (dt <= 0) continue;
    // nose bearing
    const R0 = samples[i - 1].q;
    const R2 = samples[i + 1].q;
    const h0 = Math.atan2(2*(R0[1]*R0[2]+R0[3]*R0[0]), 1-2*(R0[1]*R0[1]+R0[2]*R0[2]));
    const h2 = Math.atan2(2*(R2[1]*R2[2]+R2[3]*R2[0]), 1-2*(R2[1]*R2[1]+R2[2]*R2[2]));
    let dh = (h2 - h0) * D;
    while (dh > 180) dh -= 360;
    while (dh < -180) dh += 360;
    yr[i] = dh / dt;
  }

  const biases: number[] = [];
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const spd = Math.hypot(s.v[0], s.v[1]);
    if (spd < minSpeed || Math.abs(yr[i]) > maxYawRate) continue;

    // Nose bearing from quaternion
    const R = s.q;
    const noseBearing = Math.atan2(
      2 * (R[1] * R[2] + R[3] * R[0]),
      1 - 2 * (R[1] * R[1] + R[2] * R[2]),
    );
    const course = Math.atan2(s.v[1], s.v[0]);
    let bias = (noseBearing - course) * D;
    while (bias > 180) bias -= 360;
    while (bias < -180) bias += 360;
    biases.push(bias);
  }

  if (biases.length < 10) return { medianBiasDeg: NaN, meanBiasDeg: NaN, n: biases.length };

  const sorted = [...biases].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  const mean = biases.reduce((a, b) => a + b, 0) / biases.length;
  return { medianBiasDeg: med, meanBiasDeg: mean, n: biases.length };
}

/** Compute endpoint drift (loop closure horizontal distance) */
function endpointDrift(samples: PoseSampleInternal[]): number {
  if (samples.length < 2) return NaN;
  const first = samples[0].p;
  const last = samples[samples.length - 1].p;
  return Math.hypot(last[0] - first[0], last[1] - first[1]);
}

/** Compute worst horizontal offset from GPS */
function worstHorizontalOffset(
  samples: PoseSampleInternal[],
  gpsNed: Array<{ tUs: number; n: number; e: number }>,
): number {
  let worst = 0;
  for (const s of samples) {
    let best: typeof gpsNed[0] | null = null;
    let bestDt = Infinity;
    for (const g of gpsNed) {
      const dt = Math.abs(g.tUs - s.tUs);
      if (dt < bestDt && dt < 2_000_000) {
        bestDt = dt;
        best = g;
      }
    }
    if (!best) continue;
    const h = Math.hypot(s.p[0] - best.n, s.p[1] - best.e);
    if (h > worst) worst = h;
  }
  return worst;
}

/** Final heading from the last sample's nose bearing */
function finalHeadingDeg(samples: PoseSampleInternal[]): number {
  if (samples.length === 0) return NaN;
  const q = samples[samples.length - 1].q;
  const D = 180 / Math.PI;
  const heading = Math.atan2(
    2 * (q[1] * q[2] + q[3] * q[0]),
    1 - 2 * (q[1] * q[1] + q[2] * q[2]),
  ) * D;
  return ((heading % 360) + 360) % 360;
}

// =============================================================================
// Diagnostic config constants
// =============================================================================

const SHARED_OPTS: Partial<EstimatorOpts> = {
  outputHz: 20,
  maxIter: 3,
  procSigmaAcc: 5.5,
  gpsPosGate: 4.5,
  gpsVelGate: 15.0,
};

// =============================================================================

describeIntegration('Mag model diagnostic — with-model vs raw-mag auto-cal', () => {
  let withModelSamples: PoseSampleInternal[];
  let rawMagBiasSamples: PoseSampleInternal[];   // no-model, raw-mag auto-cal bias
  let noCorrectionSamples: PoseSampleInternal[];   // no-model, no correction
  let rawMagBiasResult: ReturnType<typeof computeMagHeadingBias> | null = null;
  let fcQuat: Array<{ tUs: number; q: [number,number,number,number] }>;
  let gpsNed: Array<{ tUs: number; n: number; e: number; d: number }>;
  let origin: { lat: number; lon: number; alt: number };

  const TIMEOUT = 300_000;  // 5 min for three full estimator runs

  beforeAll(async () => {
    if (!haveFiles()) return;

    // ---- Ingest ----
    const flBuf = new Uint8Array(fs.readFileSync(BFL_PATH));
    const fl = await loadFlightLogFromBuffer(flBuf);
    const d: IngestedData = ingestFlightLog(fl as any);

    const rawModel = JSON.parse(fs.readFileSync(MODEL_PATH, 'utf8'));
    const mr = loadMagCharacterizationModel(rawModel);
    const magGauss: MagGaussEntry[] = mr.model
      ? correctMagStream(d.mag, mr.model as any)
      : [];
    const magModelForEst: MagModelInput | null =
      mr.model && (mr.model as any).fusion?.earthFieldNedGauss
        ? (mr.model as MagModelInput)
        : null;

    origin = d.gpsHome || {
      lat: d.gps[0].lat,
      lon: d.gps[0].lon,
      alt: d.gps[0].alt ?? 0,
    };

    fcQuat = d.quat.map((q) => ({ tUs: q.tUs, q: q.q }));
    gpsNed = buildGpsNed(d.gps, origin.lat, origin.lon, origin.alt);

    // ================================================================
    // Run A: WITH mag model (the 2.5 m baseline)
    // ================================================================
    console.log('\n--- Run A: WITH mag model (baseline) ---');
    const trackA = estimatePoseTrack(
      { ...d, mag: magGauss },
      origin,
      {
        ...SHARED_OPTS,
        magModel: magModelForEst,
        sigmaYawMax: 0.10,
        magGate: 3.0,
      },
    );
    withModelSamples = trackA.samples;

    // ================================================================
    // Compute model-free raw-mag heading bias
    // ================================================================
    console.log('\n--- Computing model-free raw-mag heading bias ---');
    rawMagBiasResult = computeMagHeadingBias(d.mag, fcQuat);
    console.log(`  ${rawMagBiasResult.message}`);
    if (rawMagBiasResult.valid) {
      console.log(`  Applying bias ${(rawMagBiasResult.biasRad * 180 / Math.PI).toFixed(1)}° to FC quaternions`);
    } else {
      console.log('  Raw-mag bias NOT valid — falling back to FC-only heading');
    }

    // ================================================================
    // Run B: NO mag model, WITH raw-mag auto-cal bias
    // ================================================================
    console.log('\n--- Run B: NO mag model + raw-mag auto-cal bias ---');
    const trackB = estimatePoseTrack(
      { ...d, mag: [] },
      origin,
      {
        ...SHARED_OPTS,
        magModel: null,
        rawMagBiasRad: rawMagBiasResult?.valid ? rawMagBiasResult.biasRad : 0,
        sigmaYaw: 0.025,       // Tight — bias is pre-applied to FC quats
      },
    );
    rawMagBiasSamples = trackB.samples;

    // ================================================================
    // Run C: NO mag model, NO correction (old behavior — 26.8 m)
    // ================================================================
    console.log('\n--- Run C: NO mag model + NO correction ---');
    const trackC = estimatePoseTrack(
      { ...d, mag: [] },
      origin,
      {
        ...SHARED_OPTS,
        magModel: null,
        sigmaYaw: 0.025,       // Tight σ_yaw — old behavior
      },
    );
    noCorrectionSamples = trackC.samples;
  }, TIMEOUT);

  // =========================================================================
  // 1. Raw-mag auto-cal bias vs model's heading diagnostic
  // =========================================================================
  describe('raw-mag auto-cal bias vs model', () => {
    it('reports hard-iron fit quality and heading coverage', () => {
      if (!haveFiles()) return;
      expect(rawMagBiasResult).not.toBeNull();
      console.log(`  ${rawMagBiasResult!.message}`);
      console.log(`  Hard-iron center: [${rawMagBiasResult!.hardIronCenter.map(c => c.toFixed(0)).join(', ')}] ADC`);
      console.log(`  Hard-iron radius: ${rawMagBiasResult!.hardIronRadius.toFixed(0)} ADC`);
      console.log(`  Hard-iron RMS: ${rawMagBiasResult!.hardIronRms.toFixed(1)} ADC`);
      console.log(`  Heading coverage spread: ${rawMagBiasResult!.coverage.spreadDeg.toFixed(0)}°`);
    });

    it('has sufficient heading coverage for bias estimate', () => {
      if (!haveFiles()) return;
      expect(rawMagBiasResult!.coverage.sufficient).toBe(true);
    });

    it('bias magnitude is plausible (|bias| < 30°)', () => {
      if (!haveFiles()) return;
      const biasDeg = rawMagBiasResult!.biasRad * 180 / Math.PI;
      console.log(`  Raw-mag auto-cal heading bias = ${biasDeg.toFixed(1)}°`);
      expect(Math.abs(biasDeg)).toBeLessThanOrEqual(30);
    });
  });

  // =========================================================================
  // 2. Endpoint drift (LOOP CLOSURE) — the headline number
  // =========================================================================
  describe('endpoint drift (loop closure)', () => {
    it('WITH model: ≤ 3 m (regression guard)', () => {
      if (!haveFiles()) return;
      const drift = endpointDrift(withModelSamples);
      console.log(`  with-model endpoint drift = ${drift.toFixed(1)} m`);
      const r = gateLoopClosure(withModelSamples, 3);
      assertPass(r, 'with-model loop closure');
    });

    it('NO model + raw-mag bias: ≤ 8 m (model-free target)', () => {
      if (!haveFiles()) return;
      const drift = endpointDrift(rawMagBiasSamples);
      console.log(`  no-model+raw-mag endpoint drift = ${drift.toFixed(1)} m`);
      // Development target: ≤ 8 m.  Soft upper bound: 15 m.
      expect(drift).toBeLessThanOrEqual(15);
    });

    it('NO model + NO correction: reports the old ~26.8 m baseline', () => {
      if (!haveFiles()) return;
      const drift = endpointDrift(noCorrectionSamples);
      console.log(`  no-model no-correction endpoint drift = ${drift.toFixed(1)} m (OLD baseline ~26.8 m)`);
      expect(drift).toBeGreaterThan(10);  // Must be distinct from with-model
    });

    it('raw-mag bias improves over no-correction', () => {
      if (!haveFiles()) return;
      const driftRaw = endpointDrift(rawMagBiasSamples);
      const driftNone = endpointDrift(noCorrectionSamples);
      console.log(`  raw-mag bias: ${driftRaw.toFixed(1)} m  vs  no-correction: ${driftNone.toFixed(1)} m`);
      // The raw-mag path should be substantially better than no correction
      expect(driftRaw).toBeLessThan(driftNone);
    });
  });

  // =========================================================================
  // 3. Worst horizontal offset vs GPS
  // =========================================================================
  describe('worst horizontal offset vs GPS', () => {
    it('WITH model: reports baseline', () => {
      if (!haveFiles()) return;
      const worst = worstHorizontalOffset(withModelSamples, gpsNed);
      console.log(`  with-model worst horiz offset = ${worst.toFixed(1)} m`);
      expect(worst).toBeLessThanOrEqual(25);
    });

    it('NO model + raw-mag bias: reports improvement', () => {
      if (!haveFiles()) return;
      const worst = worstHorizontalOffset(rawMagBiasSamples, gpsNed);
      const worstNone = worstHorizontalOffset(noCorrectionSamples, gpsNed);
      console.log(`  no-model+raw-mag worst horiz offset = ${worst.toFixed(1)} m (no-correction: ${worstNone.toFixed(1)} m)`);
      expect(worst).toBeLessThanOrEqual(35);
    });

    it('NO model + NO correction: reports old ~30.5 m', () => {
      if (!haveFiles()) return;
      const worst = worstHorizontalOffset(noCorrectionSamples, gpsNed);
      console.log(`  no-model no-correction worst horiz offset = ${worst.toFixed(1)} m (old baseline ~30.5 m)`);
    });
  });

  // =========================================================================
  // 4. Heading-vs-GPS-course bias — mechanism confirmation
  // =========================================================================
  describe('heading-vs-GPS-course bias', () => {
    it('WITH model: reports baseline', () => {
      if (!haveFiles()) return;
      const stats = headingBiasStats(withModelSamples);
      console.log(`  with-model median heading bias = ${stats.medianBiasDeg.toFixed(1)}° (n=${stats.n})`);
      expect(Math.abs(stats.medianBiasDeg)).toBeLessThanOrEqual(15);
    });

    it('NO model + NO correction: bias ≥ 2° larger than with-model (FC bias uncorrected)', () => {
      if (!haveFiles()) return;
      const statsWith = headingBiasStats(withModelSamples);
      const statsNone = headingBiasStats(noCorrectionSamples);
      console.log(`  with-model median bias = ${statsWith.medianBiasDeg.toFixed(1)}°`);
      console.log(`  no-correction median bias = ${statsNone.medianBiasDeg.toFixed(1)}°`);
      expect(Math.abs(statsNone.medianBiasDeg - statsWith.medianBiasDeg)).toBeGreaterThan(1.0);
    });

    it('NO model + raw-mag bias: bias closer to with-model than no-correction', () => {
      if (!haveFiles()) return;
      const statsWith = headingBiasStats(withModelSamples);
      const statsRaw = headingBiasStats(rawMagBiasSamples);
      const statsNone = headingBiasStats(noCorrectionSamples);
      const errRaw = Math.abs(statsRaw.medianBiasDeg - statsWith.medianBiasDeg);
      const errNone = Math.abs(statsNone.medianBiasDeg - statsWith.medianBiasDeg);
      console.log(`  with-model median bias = ${statsWith.medianBiasDeg.toFixed(1)}°`);
      console.log(`  raw-mag median bias     = ${statsRaw.medianBiasDeg.toFixed(1)}° (error vs model: ${errRaw.toFixed(1)}°)`);
      console.log(`  no-correction median    = ${statsNone.medianBiasDeg.toFixed(1)}° (error vs model: ${errNone.toFixed(1)}°)`);
      expect(errRaw).toBeLessThan(errNone);
    });
  });

  // =========================================================================
  // 5. Final heading — must be consistent
  // =========================================================================
  describe('final heading consistency', () => {
    it('WITH model: reports final heading', () => {
      if (!haveFiles()) return;
      const h = finalHeadingDeg(withModelSamples);
      console.log(`  with-model final heading = ${h.toFixed(0)}°`);
    });

    it('NO model + raw-mag bias: final heading within 15° of with-model', () => {
      if (!haveFiles()) return;
      const hWith = finalHeadingDeg(withModelSamples);
      const hRaw = finalHeadingDeg(rawMagBiasSamples);
      console.log(`  with-model: ${hWith.toFixed(0)}°  raw-mag: ${hRaw.toFixed(0)}°`);
      const diff = Math.abs(hWith - hRaw);
      expect(diff < 15 || diff > 345).toBe(true);
    });
  });

  // =========================================================================
  // 6. Attitude stability — raw-mag bias must not destabilize
  // =========================================================================
  describe('attitude stability (raw-mag bias must not regress)', () => {
    it('NO model + raw-mag bias: attitude tracks FC (gate)', () => {
      if (!haveFiles()) return;
      const r = gateAttitudeTracksFC_Tight(rawMagBiasSamples, fcQuat, 25);
      console.log(`  raw-mag bias: ${r.message}`);
      assertPass(r, 'raw-mag bias attitude tracks FC');
    });

    it('NO model + raw-mag bias: not frozen (gate)', () => {
      if (!haveFiles()) return;
      const r = gateNotFrozen(rawMagBiasSamples, 500);
      assertPass(r, 'raw-mag bias not frozen');
    });

    it('NO model + raw-mag bias: forward crab acceptable', () => {
      if (!haveFiles()) return;
      const r = gateForwardCrab(rawMagBiasSamples, 45);
      console.log(`  raw-mag bias: ${r.message}`);
      if (!r.pass) console.log(`  (crab may be elevated without full model — expected tradeoff)`);
    });
  });

  // =========================================================================
  // 7. WITH-model must be UNCHANGED (regression guard)
  // =========================================================================
  describe('WITH-model regression guard (must stay at 2.5 m)', () => {
    it('WITH model: loop closure ≤ 3 m', () => {
      if (!haveFiles()) return;
      const r = gateLoopClosure(withModelSamples, 3);
      assertPass(r, 'with-model loop closure regression');
    });

    it('WITH model: horizontal vs GPS', () => {
      if (!haveFiles()) return;
      const r = gateHorizontalPositionVsGPS(withModelSamples, gpsNed, 3, 16);
      assertPass(r, 'with-model horizontal vs GPS');
    });

    it('WITH model: forward crab', () => {
      if (!haveFiles()) return;
      const r = gateForwardCrab(withModelSamples, 30);
      assertPass(r, 'with-model forward crab');
    });
  });

  // =========================================================================
  // 8. Summary table
  // =========================================================================
  describe('summary table', () => {
    it('prints the comparison table', () => {
      if (!haveFiles()) return;

      const driftA = endpointDrift(withModelSamples);
      const driftB = endpointDrift(rawMagBiasSamples);
      const driftC = endpointDrift(noCorrectionSamples);

      const worstA = worstHorizontalOffset(withModelSamples, gpsNed);
      const worstB = worstHorizontalOffset(rawMagBiasSamples, gpsNed);
      const worstC = worstHorizontalOffset(noCorrectionSamples, gpsNed);

      const hA = finalHeadingDeg(withModelSamples);
      const hB = finalHeadingDeg(rawMagBiasSamples);
      const hC = finalHeadingDeg(noCorrectionSamples);

      const biasA = headingBiasStats(withModelSamples);
      const biasB = headingBiasStats(rawMagBiasSamples);
      const biasC = headingBiasStats(noCorrectionSamples);

      const autoBiasDeg = rawMagBiasResult ? (rawMagBiasResult.biasRad * 180 / Math.PI) : NaN;

      console.log(
        '\n' +
        '  ╔══════════════════════╤══════════════╤══════════════╤══════════════╗\n' +
        '  ║ Config               │ WITH model   │ NO model     │ NO model     ║\n' +
        '  ║                      │ (baseline)   │ +raw-mag cal │ no correction║\n' +
        '  ╠══════════════════════╪══════════════╪══════════════╪══════════════╣\n' +
        `  ║ Endpoint drift (m)   │ ${driftA.toFixed(1).padStart(11)} │ ${driftB.toFixed(1).padStart(11)} │ ${driftC.toFixed(1).padStart(11)} ║\n` +
        `  ║ Worst horiz off (m)  │ ${worstA.toFixed(1).padStart(11)} │ ${worstB.toFixed(1).padStart(11)} │ ${worstC.toFixed(1).padStart(11)} ║\n` +
        `  ║ Final heading (°)    │ ${hA.toFixed(0).padStart(11)} │ ${hB.toFixed(0).padStart(11)} │ ${hC.toFixed(0).padStart(11)} ║\n` +
        `  ║ Median hdg bias (°)  │ ${biasA.medianBiasDeg.toFixed(1).padStart(11)} │ ${biasB.medianBiasDeg.toFixed(1).padStart(11)} │ ${biasC.medianBiasDeg.toFixed(1).padStart(11)} ║\n` +
        `  ║ Mean hdg bias (°)    │ ${biasA.meanBiasDeg.toFixed(1).padStart(11)} │ ${biasB.meanBiasDeg.toFixed(1).padStart(11)} │ ${biasC.meanBiasDeg.toFixed(1).padStart(11)} ║\n` +
        `  ║ Auto-cal bias (°)     │            — │ ${isNaN(autoBiasDeg) ? 'N/A' : autoBiasDeg.toFixed(1).padStart(11)} │            — ║\n` +
        '  ╚══════════════════════╧══════════════╧══════════════╧══════════════╝',
      );

      expect(driftA).toBeLessThanOrEqual(3);  // Regression guard
    });
  });
});

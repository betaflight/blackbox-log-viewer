/**
 * Measurement models (factors) for a drone body-pose ESKF estimator.
 *
 * Error state δx = [δp(3), δv(3), δθ(3), b_a(3), b_g(3), m_earth(3), m_body(3), τ(1), k_I(3)]
 *   δp  = position error (NED, m)
 *   δv  = velocity error (NED, m/s)
 *   δθ  = attitude error (rotation vector in world frame, rad)
 *   b_a = accelerometer bias (FRD, m/s²)
 *   b_g = gyroscope bias (FRD, rad/s)
 *
 * Nominal state x = { p, v, q, ba, bg, mEarth?, mBody?, tauGps?, kI? }
 *   p = position in NED (m)
 *   v = velocity in NED (m/s)
 *   q = [w,x,y,z] scalar-first, body(FRD) → world(NED)
 *
 * Gravity: [0, 0, +9.80665] in NED
 *
 * State indices (25-state):
 *   0-2: δp, 3-5: δv, 6-8: δθ, 9-11: b_a, 12-14: b_g,
 *   15-17: m_earth, 18-20: m_body, 21: τ_gps, 22-24: k_I
 *
 * Jacobian row layout: each row is length matched to the state dimension.
 * Each factory returns an object with:
 *   h(x)         – measurement prediction
 *   H            – 1D N-element array per measurement row
 *   R            – noise covariance matrix
 *   residual(z,x)– computes r = z − h(x)
 */

import type { Quat, Vec3 } from './poseSample.js';

export interface NominalState {
  p: Vec3;
  v: Vec3;
  q: Quat;
  ba?: Vec3;
  bg?: Vec3;
  mEarth?: Vec3;
  mBody?: Vec3;
  tauGps?: number;
  kI?: Vec3;
}

export interface NedMeas {
  n: number;
  e: number;
  d: number;
}

export interface MeasurementFactor<Z = number[]> {
  h(x: NominalState): number | number[];
  readonly H: number[][];
  readonly R: number[][];
  residual(z: Z, x: NominalState): number[];
}

export const GRAVITY_MAG = 9.80665;

// --- Quaternion math helpers (flat row-major) --------------------------------

function quatMultiply(a: Quat, b: Quat): Quat {
  const [aw, ax, ay, az] = a;
  const [bw, bx, by, bz] = b;
  return [
    aw * bw - ax * bx - ay * by - az * bz,
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
  ];
}

function quatConjugate(q: Quat): Quat {
  return [q[0], -q[1], -q[2], -q[3]];
}

function quatToRotMat(q: Quat): number[] {
  const [w, x, y, z] = q;
  const xx = x * x, yy = y * y, zz = z * z;
  const xy = x * y, xz = x * z, yz = y * z;
  const wx = w * x, wy = w * y, wz = w * z;

  const m = new Array<number>(9);
  m[0] = 1 - 2 * (yy + zz);
  m[1] = 2 * (xy - wz);
  m[2] = 2 * (xz + wy);

  m[3] = 2 * (xy + wz);
  m[4] = 1 - 2 * (xx + zz);
  m[5] = 2 * (yz - wx);

  m[6] = 2 * (xz - wy);
  m[7] = 2 * (yz + wx);
  m[8] = 1 - 2 * (xx + yy);

  return m;
}

function logMap(R: number[]): Vec3 {
  const trace = R[0] + R[4] + R[8];
  const cosTheta = (trace - 1) / 2;
  const theta = Math.acos(Math.max(-1, Math.min(1, cosTheta)));

  if (Math.abs(theta) < 1e-12) {
    return [
      (R[7] - R[5]) / 2,
      (R[2] - R[6]) / 2,
      (R[3] - R[1]) / 2,
    ];
  }

  const factor = theta / (2 * Math.sin(theta));
  return [
    (R[7] - R[5]) * factor,
    (R[2] - R[6]) * factor,
    (R[3] - R[1]) * factor,
  ];
}

function matMul3x3(A: number[][], B: number[][]): number[][] {
    const C = [[0,0,0],[0,0,0],[0,0,0]];
    for (let i = 0; i < 3; i++)
        for (let k = 0; k < 3; k++)
            for (let j = 0; j < 3; j++)
                C[i][j] += A[i][k] * B[k][j];
    return C;
}

// --- Factory functions --------------------------------------------------------

/**
 * GPS position measurement in NED.
 *
 * @param meas  NED position (m)
 * @param sigma  1σ noise in metres
 */
export function createGpsPositionFactor(meas: NedMeas, sigma = 2.5): MeasurementFactor<NedMeas> {
  const varP = sigma * sigma;

  function h(x: NominalState): number[] {
    return [x.p[0], x.p[1], x.p[2]];
  }

  const H: number[][] = [
    [1, 0, 0,  0, 0, 0,  0, 0, 0],
    [0, 1, 0,  0, 0, 0,  0, 0, 0],
    [0, 0, 1,  0, 0, 0,  0, 0, 0],
  ];

  const R: number[][] = [
    [varP,    0,    0],
    [   0, varP,    0],
    [   0,    0, varP],
  ];

  function residual(z: NedMeas, x: NominalState): number[] {
    const hp = h(x);
    return [z.n - hp[0], z.e - hp[1], z.d - hp[2]];
  }

  return { h, H, R, residual };
}

/**
 * GPS velocity measurement in NED.
 *
 * @param meas  NED velocity (m/s)
 * @param sigma  1σ noise in m/s
 */
export function createGpsVelocityFactor(meas: NedMeas, sigma = 0.5): MeasurementFactor<NedMeas> {
  const varV = sigma * sigma;

  function h(x: NominalState): number[] {
    return [x.v[0], x.v[1], x.v[2]];
  }

  const H: number[][] = [
    [0, 0, 0,  1, 0, 0,  0, 0, 0],
    [0, 0, 0,  0, 1, 0,  0, 0, 0],
    [0, 0, 0,  0, 0, 1,  0, 0, 0],
  ];

  const R: number[][] = [
    [varV,    0,    0],
    [   0, varV,    0],
    [   0,    0, varV],
  ];

  function residual(z: NedMeas, x: NominalState): number[] {
    const hv = h(x);
    return [z.n - hv[0], z.e - hv[1], z.d - hv[2]];
  }

  return { h, H, R, residual };
}

/**
 * Barometer altitude measurement.
 *
 * The barometer reads altitude relative to the arming point.
 * baroOffset = GPS_alt_at_arm − baroAlt_at_arm converts baro-relative to MSL-absolute.
 * Measurement model: z ≈ −p_D.
 *
 * The baro reading is relative to the arm point; p_D is the NED down coordinate
 * relative to the origin. Since origin and arm are approximately the same physical
 * location, they match without an offset. Adding baroOffset (~GPS MSL altitude,
 * typically >100 m) creates a constant innovation offset that saturates the 3σ gate
 * and silently rejects all baro measurements — the D coordinate then drifts uncorrected.
 * Adding baroOffset creates a constant innovation offset that saturates the gate.
 *
 * @param baroAlt     Raw barometer altitude (m, relative to arm point)
 * @param baroOffset  (UNUSED — retained for API compat only)
 * @param sigma       1σ noise in metres
 */
export function createBaroFactor(baroAlt: number, baroOffset: number, sigma = 1.0): MeasurementFactor<number> {
  const varZ = sigma * sigma;

  function h(x: NominalState): number {
    return -x.p[2];
  }

  const H: number[][] = [[0, 0, -1, 0, 0, 0, 0, 0, 0]];

  const R: number[][] = [[varZ]];

  function residual(z: number, x: NominalState): number[] {
    return [z - h(x)];
  }

  return { h, H, R, residual };
}

/**
 * Quaternion attitude prior (soft prior from FC fused attitude).
 *
 * Supports both isotropic (single sigma) and anisotropic (sigmaTilt + sigmaYaw)
 * noise models. In anisotropic mode, the measurement covariance R is the
 * body-frame noise diag(σ_tilt², σ_tilt², σ_yaw²) rotated to the world frame
 * of the residual:  R_world = R_bw · R_body · R_bwᵀ.
 * The FC's tilt is gravity-bounded (~1°); yaw is gyro-only dead-reckoned
 * (drifting 10–30°/flight). The anisotropic R lets the quat-prior and mag
 * factor coexist: the prior owns tilt, the mag owns yaw.
 *
 * @param qMeas      Measured quaternion [w,x,y,z] scalar-first
 * @param sigmaTilt  1σ noise for tilt axes (roll, pitch) in radians
 * @param sigmaYaw   1σ noise for yaw axis in radians. If null,
 *                   isotropic mode: all axes use sigmaTilt.
 */
export function createQuaternionPrior(
  qMeas: Quat,
  sigmaTilt = 0.1,
  sigmaYaw: number | null = null,
): MeasurementFactor<Quat> {
  const anisotropic = (sigmaYaw !== null && sigmaYaw !== sigmaTilt);

  const H: number[][] = [
    [0, 0, 0,  0, 0, 0,  1, 0, 0],
    [0, 0, 0,  0, 0, 0,  0, 1, 0],
    [0, 0, 0,  0, 0, 0,  0, 0, 1],
  ];

  let R: number[][];
  if (anisotropic) {
    const varTilt = sigmaTilt * sigmaTilt;
    const varYaw = sigmaYaw! * sigmaYaw!;
    const Rbody: number[][] = [[varTilt, 0, 0], [0, varTilt, 0], [0, 0, varYaw]];

    const m = quatToRotMat(qMeas);
    const Rbw: number[][] = [[m[0], m[1], m[2]], [m[3], m[4], m[5]], [m[6], m[7], m[8]]];
    const RbwT: number[][] = [[m[0], m[3], m[6]], [m[1], m[4], m[7]], [m[2], m[5], m[8]]];

    const Rtemp = matMul3x3(Rbw, Rbody);
    R = matMul3x3(Rtemp, RbwT);
  } else {
    const varQ = sigmaTilt * sigmaTilt;
    R = [[varQ, 0, 0], [0, varQ, 0], [0, 0, varQ]];
  }

  function h(x: NominalState): Quat {
    return x.q.slice() as Quat;
  }

  function residual(_z: Quat, x: NominalState): number[] {
    const qRel = quatMultiply(qMeas, quatConjugate(x.q));
    const Rrel = quatToRotMat(qRel);
    const omega = logMap(Rrel);
    return [omega[0], omega[1], omega[2]];
  }

  return { h, H, R, residual };
}

export const SIGMA_YAW_DEFAULT_TIGHT = 0.025;
export const SIGMA_YAW_DEFAULT_MAX   = 0.10;
export const SIGMA_YAW_OBS_THRESH_LO = 0.70;
export const SIGMA_YAW_OBS_THRESH_HI = 1.00;

/**
 * Adaptive sigma yaw — modulates quat-prior yaw trust on TWO independent signals:
 *
 * 1. |R[2][0]| (= |world-Down component of nose|) — yaw observability from attitude.
 *    When the nose is near-level, the mag factor's ∂h/∂δθ_yaw is full-rank and the
 *    mag provides yaw information. During flips/dives (|R[2][0]| → 1), the mag's
 *    yaw-bearing projection collapses → trust the FC quat-prior more tightly.
 *
 * 2. Mag disturbance scale (|B| anomaly, motor current): when the mag is disturbed,
 *    the quat-prior must tighten EVEN at level flight because mag anchoring is
 *    unreliable. When disturbance is low, the prior can fully loosen, letting the
 *    mag override the FC's gyro-only dead-reckoned yaw.
 *
 * @param qEst             ESKF attitude [qw,qx,qy,qz] body(FRD)→world(NED)
 * @param magDisturbScale  mag-related disturbance scale (>=1, 1=clean)
 * @param sigmaYawMax      maximum σ_yaw at level flight when mag is clean (rad)
 * @returns adapted sigma yaw in radians
 */
export function computeAdaptiveSigmaYaw(
  qEst: Quat,
  magDisturbScale = 1.0,
  sigmaYawMax = SIGMA_YAW_DEFAULT_MAX,
): number {
    const m = quatToRotMat(qEst);
    const col0zAbs = Math.abs(m[6]);

    const range = SIGMA_YAW_OBS_THRESH_HI - SIGMA_YAW_OBS_THRESH_LO;
    const t = Math.max(0, Math.min(1, (col0zAbs - SIGMA_YAW_OBS_THRESH_LO) / range));
    const baseSigma = sigmaYawMax + t * (SIGMA_YAW_DEFAULT_TIGHT - sigmaYawMax);

    const d = Math.max(1.0, magDisturbScale);
    const sigma = Math.max(SIGMA_YAW_DEFAULT_TIGHT, Math.min(sigmaYawMax, baseSigma / d));

    return sigma;
}

/**
 * 3-axis magnetometer measurement (body frame, in Gauss).
 *
 * Measurement model: z_mag = R(q)^T · m_earth + m_body + k_I · I(t)
 *
 * H rows are dimensioned for the 25-state layout.
 *
 * The mag noise is ANISOTROPIC by the calibration fingerprint:
 *   sigma_xy = horizontal (heading-bearing) components (X,Y in body FRD)
 *   sigma_z  = vertical component (Z in body FRD)
 *
 * @param meas            mag reading [bx,by,bz] body FRD (Gauss)
 * @param sigmaOrSigmaXY  measurement noise 1σ (Gauss), scalar isotropic if
 *                         sigmaZ not provided, or sigma_xy if sigmaZ is provided
 * @param sigmaZ           vertical noise 1σ (Gauss). If provided, anisotropic
 *                         R = diag(sigma_xy²,sigma_xy²,sigma_z²) is used.
 * @param currentAmps     battery current in Amps (drives k_I term)
 */
export function createMagFactor(
  meas: Vec3,
  sigmaOrSigmaXY = 0.05,
  sigmaZ?: number,
  currentAmps = 0,
): MeasurementFactor<Vec3> {
    let Rnoise: number[][];
    if (sigmaZ !== undefined && sigmaZ !== null) {
        const varXY = sigmaOrSigmaXY * sigmaOrSigmaXY;
        const varZ = sigmaZ * sigmaZ;
        Rnoise = [[varXY, 0, 0], [0, varXY, 0], [0, 0, varZ]];
    } else {
        const varM = sigmaOrSigmaXY * sigmaOrSigmaXY;
        Rnoise = [[varM, 0, 0], [0, varM, 0], [0, 0, varM]];
    }

    let cachedH: number[][] | null = null;

    function h(x: NominalState): number[] {
        const m = quatToRotMat(x.q);
        const me = x.mEarth || [0, 0, 0];
        const mb = x.mBody || [0, 0, 0];
        const kI = x.kI || [0, 0, 0];
        return [
            m[0]*me[0] + m[3]*me[1] + m[6]*me[2] + mb[0] + kI[0] * currentAmps,
            m[1]*me[0] + m[4]*me[1] + m[7]*me[2] + mb[1] + kI[1] * currentAmps,
            m[2]*me[0] + m[5]*me[1] + m[8]*me[2] + mb[2] + kI[2] * currentAmps,
        ];
    }

    function residual(z: Vec3, x: NominalState): number[] {
        const m = quatToRotMat(x.q);
        const me = x.mEarth || [0, 0, 0];
        const me0 = me[0], me1 = me[1], me2 = me[2];

        const rowSkew = (r0: number, r1: number, r2: number): Vec3 => [
            r1*me2 - r2*me1,
            -r0*me2 + r2*me0,
            r0*me1 - r1*me0,
        ];
        const t0 = rowSkew(m[0], m[3], m[6]);
        const t1 = rowSkew(m[1], m[4], m[7]);
        const t2 = rowSkew(m[2], m[5], m[8]);

        cachedH = [
            [0,0,0, 0,0,0, t0[0],t0[1],t0[2], 0,0,0, 0,0,0, m[0],m[3],m[6], 1,0,0, 0, currentAmps,0,0],
            [0,0,0, 0,0,0, t1[0],t1[1],t1[2], 0,0,0, 0,0,0, m[1],m[4],m[7], 0,1,0, 0, 0,currentAmps,0],
            [0,0,0, 0,0,0, t2[0],t2[1],t2[2], 0,0,0, 0,0,0, m[2],m[5],m[8], 0,0,1, 0, 0,0,currentAmps],
        ];
        const hp = h(x);
        return [z[0]-hp[0], z[1]-hp[1], z[2]-hp[2]];
    }

    const defaultH: number[][] = [
        [0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,1,0,0, 0,currentAmps,0,0],
        [0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,1,0, 0,0,currentAmps,0],
        [0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,1, 0,0,0,currentAmps],
    ];

    return {
        h,
        get H() { return cachedH || defaultH; },
        R: Rnoise,
        residual,
    };
}

/**
 * Declination pseudo-measurement.
 *
 * Soft constraint: atan2(magE, magN) ≈ WMM_declination (radians).
 * Keeps the earth field vector from drifting.
 *
 * @param declRad  WMM declination at flight location (radians)
 * @param sigma    noise in radians
 */
export function createDeclinationFactor(declRad: number, sigma = 0.34): MeasurementFactor<number> {
    const varD = sigma * sigma;
    let cachedH: number[][] | null = null;

    function h(x: NominalState): number {
        const me = x.mEarth || [0,0,0];
        return Math.atan2(me[1], me[0]);
    }

    function residual(z: number, x: NominalState): number[] {
        const me = x.mEarth || [0,0,0];
        const n2e2 = me[0]*me[0] + me[1]*me[1];
        const dHdN = n2e2 > 1e-12 ? -me[1]/n2e2 : 0;
        const dHdE = n2e2 > 1e-12 ? me[0]/n2e2 : 0;
        cachedH = [[0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0, dHdN,dHdE,0, 0,0,0]];
        return [z - h(x)];
    }

    return {
        h,
        get H() { return cachedH || [[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]]; },
        R: [[varD]],
        residual,
    };
}

/**
 * Map GPS satellite count to 1σ position noise in metres.
 *
 * @param numSat  Number of satellites in view
 * @returns 1σ position noise (m)
 */
export function computeGpsNoise(numSat: number): number {
  if (numSat >= 12) return 1.5;
  if (numSat >= 8)  return 2.5;
  if (numSat >= 5)  return 4.0;
  return 8.0;
}

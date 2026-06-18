/**
 * IMU on-manifold preintegration between keyframes.
 * Implements Forster et al. (TRO 2017) mid-point integration.
 *
 * Accumulates IMU measurements between two keyframes (e.g. GPS fixes
 * ~100 ms apart, ~50 IMU samples) into a compact delta {ΔR, Δv, Δp}
 * with a 9×9 covariance, decoupled from the linearisation point.
 *
 * Frame conventions:
 *  - Body: FRD (Forward=X, Right=Y, Down=Z)
 *  - World: NED (North, East, Down)
 *  - Quaternion: Hamilton, body(FRD) → world(NED), scalar-first [w, x, y, z]
 *  - Gravity: [0, 0, +9.80665] in NED
 */

import { skew, rotToQuat } from './imuMechanization.js';
import type { Quat, Vec3 } from './poseSample.js';

// ---------------------------------------------------------------------------
// Default noise densities
// ---------------------------------------------------------------------------

/** Accelerometer noise density [m/s² / √Hz] */
const SIGMA_ACC = 0.01;

/** Gyroscope noise density [rad/s / √Hz] */
const SIGMA_GYRO = 0.001;

/** Gravitational acceleration in world NED [m/s²] */
const G_WORLD: Vec3 = [0, 0, 9.80665];

// ---------------------------------------------------------------------------
// 3×3 matrix helpers
// ---------------------------------------------------------------------------

type Mat3 = number[][];

function mat3Identity(): Mat3 {
  return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
}

function mat3Copy(A: Mat3): Mat3 {
  return [A[0].slice(), A[1].slice(), A[2].slice()];
}

function mat3Scale(A: Mat3, s: number): Mat3 {
  return [
    [A[0][0] * s, A[0][1] * s, A[0][2] * s],
    [A[1][0] * s, A[1][1] * s, A[1][2] * s],
    [A[2][0] * s, A[2][1] * s, A[2][2] * s],
  ];
}

function mat3Mul(A: Mat3, B: Mat3): Mat3 {
  return [
    [
      A[0][0] * B[0][0] + A[0][1] * B[1][0] + A[0][2] * B[2][0],
      A[0][0] * B[0][1] + A[0][1] * B[1][1] + A[0][2] * B[2][1],
      A[0][0] * B[0][2] + A[0][1] * B[1][2] + A[0][2] * B[2][2],
    ],
    [
      A[1][0] * B[0][0] + A[1][1] * B[1][0] + A[1][2] * B[2][0],
      A[1][0] * B[0][1] + A[1][1] * B[1][1] + A[1][2] * B[2][1],
      A[1][0] * B[0][2] + A[1][1] * B[1][2] + A[1][2] * B[2][2],
    ],
    [
      A[2][0] * B[0][0] + A[2][1] * B[1][0] + A[2][2] * B[2][0],
      A[2][0] * B[0][1] + A[2][1] * B[1][1] + A[2][2] * B[2][1],
      A[2][0] * B[0][2] + A[2][1] * B[1][2] + A[2][2] * B[2][2],
    ],
  ];
}

function mat3Transpose(A: Mat3): Mat3 {
  return [
    [A[0][0], A[1][0], A[2][0]],
    [A[0][1], A[1][1], A[2][1]],
    [A[0][2], A[1][2], A[2][2]],
  ];
}

function mat3VecMul(A: Mat3, v: Vec3): Vec3 {
  return [
    A[0][0] * v[0] + A[0][1] * v[1] + A[0][2] * v[2],
    A[1][0] * v[0] + A[1][1] * v[1] + A[1][2] * v[2],
    A[2][0] * v[0] + A[2][1] * v[1] + A[2][2] * v[2],
  ];
}

// ---------------------------------------------------------------------------
// Rodrigues formula
// ---------------------------------------------------------------------------

function expRodrigues(phi: Vec3): Mat3 {
  const [x, y, z] = phi;
  const t2 = x * x + y * y + z * z;

  if (t2 < 1e-14) {
    return [
      [1, -z, y],
      [z, 1, -x],
      [-y, x, 1],
    ];
  }

  const theta = Math.sqrt(t2);
  const s = Math.sin(theta);
  const c = Math.cos(theta);
  const a = s / theta;
  const b = (1 - c) / t2;

  const xy = x * y, xz = x * z, yz = y * z;

  return [
    [1 - b * (y * y + z * z), -a * z + b * xy, a * y + b * xz],
    [a * z + b * xy, 1 - b * (x * x + z * z), -a * x + b * yz],
    [-a * y + b * xz, a * x + b * yz, 1 - b * (x * x + y * y)],
  ];
}

// ---------------------------------------------------------------------------
// Simplified right Jacobian
// ---------------------------------------------------------------------------

function jrSimplified(phi: Vec3): Mat3 {
  const [x, y, z] = phi;
  return [
    [1, 0.5 * z, -0.5 * y],
    [-0.5 * z, 1, 0.5 * x],
    [0.5 * y, -0.5 * x, 1],
  ];
}

// ---------------------------------------------------------------------------
// Arbitrary-size matrix helpers
// ---------------------------------------------------------------------------

type Mat = number[][];

function matZero(n: number): Mat {
  const Z: Mat = new Array(n);
  for (let i = 0; i < n; i++) Z[i] = new Array(n).fill(0);
  return Z;
}

function matIdentity(n: number): Mat {
  const I: Mat = new Array(n);
  for (let i = 0; i < n; i++) {
    I[i] = new Array(n).fill(0);
    I[i][i] = 1;
  }
  return I;
}

function matAdd(A: Mat, B: Mat): Mat {
  const n = A.length;
  const C: Mat = new Array(n);
  for (let i = 0; i < n; i++) {
    C[i] = new Array(n);
    for (let j = 0; j < n; j++) C[i][j] = A[i][j] + B[i][j];
  }
  return C;
}

function matMulABAT(A: Mat, B: Mat): Mat {
  const n = A.length;
  const temp = matZero(n);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < n; k++) {
      const aik = A[i][k];
      if (aik === 0) continue;
      for (let j = 0; j < n; j++) temp[i][j] += aik * B[k][j];
    }
  }

  const result = matZero(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) sum += temp[i][k] * A[j][k];
      result[i][j] = sum;
    }
  }
  return result;
}

function matMulDiagBT(B: Mat, d: number[]): Mat {
  const n = B.length;
  const m = d.length;
  const result = matZero(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let k = 0; k < m; k++) sum += B[i][k] * d[k] * B[j][k];
      result[i][j] = sum;
    }
  }
  return result;
}

function matSetBlock(dst: Mat, r0: number, c0: number, src: Mat): void {
  const rows = src.length;
  const cols = src[0].length;
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++)
      dst[r0 + i][c0 + j] = src[i][j];
}

function matZeroNM(nRows: number, nCols: number): Mat {
  const Z: Mat = new Array(nRows);
  for (let i = 0; i < nRows; i++) Z[i] = new Array(nCols).fill(0);
  return Z;
}

// ---------------------------------------------------------------------------
// Preintegration API
// ---------------------------------------------------------------------------

export interface Preintegrator {
  dR: Mat3;
  dv: Vec3;
  dp: Vec3;
  cov: Mat;
  dtSum: number;
  dRdBg: Mat3 | null;
  dVdBg: Mat3 | null;
  dVdBa: Mat3 | null;
  dPdBg: Mat3 | null;
  dPdBa: Mat3 | null;
  _first: boolean;
  _prevOmega: Vec3;
  _prevAccel: Vec3;
}

export function createPreintegrator(): Preintegrator {
  return {
    dR: mat3Identity(),
    dv: [0, 0, 0],
    dp: [0, 0, 0],
    cov: matIdentity(9),
    dtSum: 0,
    dRdBg: null,
    dVdBg: null,
    dVdBa: null,
    dPdBg: null,
    dPdBa: null,
    _first: true,
    _prevOmega: [0, 0, 0],
    _prevAccel: [0, 0, 0],
  };
}

export function preintegrateStep(
  preint: Preintegrator,
  omega: Vec3,
  accel: Vec3,
  dt: number,
  prevOmega?: Vec3,
  prevAccel?: Vec3,
  b_g?: Vec3,
  b_a?: Vec3,
): void {
  const bg = b_g || [0, 0, 0];
  const ba = b_a || [0, 0, 0];

  if (preint._first) {
    preint._prevOmega = [omega[0], omega[1], omega[2]];
    preint._prevAccel = [accel[0], accel[1], accel[2]];
    preint._first = false;
    return;
  }

  const pOmega = preint._prevOmega;
  const pAccel = preint._prevAccel;

  // ---- mid-point de-biased IMU ------------------------------------------
  const omMid: Vec3 = [
    0.5 * (omega[0] + pOmega[0]) - bg[0],
    0.5 * (omega[1] + pOmega[1]) - bg[1],
    0.5 * (omega[2] + pOmega[2]) - bg[2],
  ];
  // Specific force = negative of de-biased sensor reading (MEMS convention)
  const axRaw = 0.5 * (accel[0] + pAccel[0]) - ba[0];
  const ayRaw = 0.5 * (accel[1] + pAccel[1]) - ba[1];
  const azRaw = 0.5 * (accel[2] + pAccel[2]) - ba[2];
  const acMid: Vec3 = [-axRaw, -ayRaw, -azRaw];

  // ---- SO(3) increment --------------------------------------------------
  const phi: Vec3 = [omMid[0] * dt, omMid[1] * dt, omMid[2] * dt];
  const theta = Math.sqrt(phi[0] * phi[0] + phi[1] * phi[1] + phi[2] * phi[2]);
  const dR_i = theta < 1e-10 ? mat3Identity() : expRodrigues(phi);

  // ---- save pre-update values --------------------------------------------
  const dR_prev = mat3Copy(preint.dR);
  const dv_prev: Vec3 = [preint.dv[0], preint.dv[1], preint.dv[2]];

  // ---- accumulated delta updates ----------------------------------------
  preint.dR = mat3Mul(dR_prev, dR_i);

  const aWorld = mat3VecMul(dR_prev, acMid);

  preint.dv[0] += aWorld[0] * dt;
  preint.dv[1] += aWorld[1] * dt;
  preint.dv[2] += aWorld[2] * dt;

  const halfDt2 = 0.5 * dt * dt;
  preint.dp[0] += dv_prev[0] * dt + aWorld[0] * halfDt2;
  preint.dp[1] += dv_prev[1] * dt + aWorld[1] * halfDt2;
  preint.dp[2] += dv_prev[2] * dt + aWorld[2] * halfDt2;

  // ---- covariance propagation (9×9) -------------------------------------
  const dR_iT = mat3Transpose(dR_i);

  const A = matIdentity(9);
  matSetBlock(A, 0, 0, dR_iT);

  const skAc = skew(acMid);
  const Rsk = mat3Mul(dR_prev, skAc);

  matSetBlock(A, 3, 0, mat3Scale(Rsk, -dt));
  matSetBlock(A, 6, 0, mat3Scale(Rsk, -halfDt2));

  const i3dt: Mat3 = [[dt, 0, 0], [0, dt, 0], [0, 0, dt]];
  matSetBlock(A, 6, 3, i3dt);

  const B = matZeroNM(9, 6);
  const Jr = jrSimplified(phi);
  matSetBlock(B, 0, 3, mat3Scale(Jr, dt));
  matSetBlock(B, 3, 0, mat3Scale(dR_prev, dt));
  matSetBlock(B, 6, 0, mat3Scale(dR_prev, halfDt2));

  const qDiag = [
    SIGMA_ACC * SIGMA_ACC,
    SIGMA_ACC * SIGMA_ACC,
    SIGMA_ACC * SIGMA_ACC,
    SIGMA_GYRO * SIGMA_GYRO,
    SIGMA_GYRO * SIGMA_GYRO,
    SIGMA_GYRO * SIGMA_GYRO,
  ];

  preint.cov = matAdd(
    matMulABAT(A, preint.cov),
    matMulDiagBT(B, qDiag),
  );

  preint.dtSum += dt;

  // ---- store for next call ----------------------------------------------
  preint._prevOmega = [omega[0], omega[1], omega[2]];
  preint._prevAccel = [accel[0], accel[1], accel[2]];
}

export interface PredictedState {
  p_j: Vec3;
  v_j: Vec3;
  q_j: Quat;
}

export function predictState(
  preint: Preintegrator,
  p_i: Vec3,
  v_i: Vec3,
  R_i: Mat3,
): PredictedState {
  const dtSum = preint.dtSum;

  const R_j = mat3Mul(R_i, preint.dR);

  const dVw = mat3VecMul(R_i, preint.dv);
  const dPw = mat3VecMul(R_i, preint.dp);

  const halfDt2 = 0.5 * dtSum * dtSum;

  const v_j: Vec3 = [
    dVw[0] + v_i[0] + G_WORLD[0] * dtSum,
    dVw[1] + v_i[1] + G_WORLD[1] * dtSum,
    dVw[2] + v_i[2] + G_WORLD[2] * dtSum,
  ];

  const p_j: Vec3 = [
    dPw[0] + p_i[0] + v_i[0] * dtSum + G_WORLD[0] * halfDt2,
    dPw[1] + p_i[1] + v_i[1] * dtSum + G_WORLD[1] * halfDt2,
    dPw[2] + p_i[2] + v_i[2] * dtSum + G_WORLD[2] * halfDt2,
  ];

  const q_j = rotToQuat(R_j);

  return { p_j, v_j, q_j };
}

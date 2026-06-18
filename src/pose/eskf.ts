/**
 * Error-State Kalman Filter with configurable state dimension.
 *
 * Base 15-state (UNCONDITIONAL): [dp(3), dv(3), dth(3), b_a(3), b_g(3)]
 * Extended adds magnetic field states m_earth(3) world + m_body(3) body (total 21).
 *
 * State indices:
 *   0-2: dp, 3-5: dv, 6-8: dth, 9-11: b_a, 12-14: b_g,
 *   15-17: m_earth, 18-20: m_body
 *
 * b_a/b_g are unconditional (Q3, planv5/18 S32.3). The knob is prior covariance,
 * not state presence. Tight prior from static window for b_g; moderate prior for
 * b_a (refined in flight via GPS/velned observability).
 *
 * Conventions:
 *   World: NED    Body: FRD
 *   Quaternions: Hamilton, body(FRD)->world(NED), scalar-first [w,x,y,z]
 *   Gravity: [0, 0, +9.80665] m/s^2 in NED
 */

import { quatToRot, quatMultiply, quatFromAxisAngle, strapdownPropagate } from './imuMechanization.js';
import type { Quat, Vec3 } from './poseSample.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Mat = number[][];

export interface EskfOptions {
    p0: Vec3;
    v0: Vec3;
    q0: Quat;
    sigmaPos?: number;
    sigmaVel?: number;
    sigmaAtt?: number;
    ba0?: Vec3;
    bg0?: Vec3;
    sigmaBa?: number;
    sigmaBg?: number;
    sigmaBaRW?: number;
    sigmaBgRW?: number;
    mEarth0?: Vec3;
    mBody0?: Vec3;
    sigmaMagEarth?: number;
    sigmaMagBody?: number;
    procSigmaAcc?: number;
    procSigmaGyro?: number;
    bgClamp?: number;
}

export interface NominalState {
    p: Vec3;
    v: Vec3;
    q: Quat;
    ba: Vec3;
    bg: Vec3;
    mEarth: Vec3 | null;
    mBody: Vec3 | null;
}

export interface MeasurementFactor {
    H: Mat;
    R: Mat;
    residual(z: unknown, x: NominalState): number[];
    h?: (x: NominalState) => number[];
}

export interface RobustOpts {
    dcs?: boolean;
    dcsPhi?: number;
}

export interface EskfState {
    dim: number;
    p: Vec3;
    v: Vec3;
    q: Quat;
    ba: Vec3;
    bg: Vec3;
    mEarth: Vec3 | null;
    mBody: Vec3 | null;
    P: Mat;
    sigmaAcc: number;
    sigmaGyro: number;
    sigmaBaRW: number;
    sigmaBgRW: number;
    sigmaMagEarthRW: number;
    sigmaMagBodyRW: number;
    bgClamp: number;
}

export interface EskfSnapshot {
    p: Vec3;
    v: Vec3;
    q: Quat;
    ba: Vec3 | null;
    bg: Vec3 | null;
    mEarth: Vec3 | null;
    mBody: Vec3 | null;
    sigmaPos: number;
    sigmaAtt: number;
}

// ---------------------------------------------------------------------------
// Sparse stencil cache -- precomputed non-zero column indices of F per dim
// ---------------------------------------------------------------------------

const _sparseStencilCache: Record<number, number[][]> = {};

/**
 * Return an array `stencil` where `stencil[j]` is the list of column indices k
 * where F[j][k] CAN be non-zero for the ESKF transition matrix at dimension dim.
 *
 * The sparsity pattern is invariant across calls (only values change, not
 * positions), so the stencil is built once per dim and reused.
 */
function getSparseStencil(dim: number): number[][] {
    if (!_sparseStencilCache[dim]) {
        const stencil = new Array<number[]>(dim);
        const hasBias = dim >= 12;
        const hasBg = dim >= 15;

        for (let j = 0; j < dim; j++) {
            const cols: number[] = [j];
            if (j < 3) {
                for (let k = 3; k <= 11 && k < dim; k++) cols.push(k);
            } else if (j < 6) {
                for (let k = 6; k <= 11 && k < dim; k++) cols.push(k);
            } else if (j < 9 && hasBg) {
                for (let k = 12; k <= 14 && k < dim; k++) cols.push(k);
            }
            stencil[j] = cols;
        }
        _sparseStencilCache[dim] = stencil;
    }
    return _sparseStencilCache[dim];
}

/**
 * Sparse-aware A * Ft.
 *
 * Computes result = A * Ft where A is dense n*n and F is the sparse ESKF
 * transition matrix.  Exploits F's sparsity (stencil) to skip zero-contributing
 * terms.  BIT-IDENTICAL to matMul(A, matTranspose(F)) -- only zero-contributing
 * multiply-adds are omitted; the accumulated floating-point sum order is the
 * same (k ascending).
 */
function matMulByBt(A: Mat, F: Mat, stencil: number[][]): Mat {
    const n = A.length;
    const C = new Array<number[]>(n);
    for (let i = 0; i < n; i++) {
        C[i] = new Array<number>(n);
        const Ai = A[i];
        for (let j = 0; j < n; j++) {
            let sum = 0;
            const cols = stencil[j];
            const Fj = F[j];
            for (let ci = 0; ci < cols.length; ci++) {
                const k = cols[ci];
                sum += Ai[k] * Fj[k];
            }
            C[i][j] = sum;
        }
    }
    return C;
}

// ---------------------------------------------------------------------------
// Matrix helpers
// ---------------------------------------------------------------------------

function matIdentity(n: number): Mat {
    const I = new Array<number[]>(n);
    for (let i = 0; i < n; i++) {
        I[i] = new Array<number>(n).fill(0);
        I[i][i] = 1;
    }
    return I;
}

function matMul(A: Mat, B: Mat): Mat {
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

function matAdd(A: Mat, B: Mat): Mat {
    const n = A.length;
    const C = new Array<number[]>(n);
    for (let i = 0; i < n; i++) {
        C[i] = new Array<number>(n);
        for (let j = 0; j < n; j++) C[i][j] = A[i][j] + B[i][j];
    }
    return C;
}

function matTranspose(A: Mat): Mat {
    const n = A.length;
    const T = new Array<number[]>(n);
    for (let i = 0; i < n; i++) {
        T[i] = new Array<number>(n);
        for (let j = 0; j < n; j++) T[i][j] = A[j][i];
    }
    return T;
}

function matInvertSym(A: Mat): Mat {
    const n = A.length;
    const aug = new Array<number[]>(n);
    for (let i = 0; i < n; i++) {
        aug[i] = new Array<number>(2 * n);
        for (let j = 0; j < n; j++) {
            aug[i][j] = A[i][j];
            aug[i][j + n] = i === j ? 1 : 0;
        }
    }
    for (let i = 0; i < n; i++) {
        let maxRow = i;
        let maxVal = Math.abs(aug[i][i]);
        for (let r = i + 1; r < n; r++) {
            if (Math.abs(aug[r][i]) > maxVal) { maxVal = Math.abs(aug[r][i]); maxRow = r; }
        }
        if (maxRow !== i) { const tmp = aug[i]; aug[i] = aug[maxRow]; aug[maxRow] = tmp; }
        const pivot = aug[i][i];
        if (Math.abs(pivot) < 1e-30) continue;
        for (let j = 0; j < 2 * n; j++) aug[i][j] /= pivot;
        for (let r = 0; r < n; r++) {
            if (r === i) continue;
            const factor = aug[r][i];
            for (let j = 0; j < 2 * n; j++) aug[r][j] -= factor * aug[i][j];
        }
    }
    const inv = new Array<number[]>(n);
    for (let i = 0; i < n; i++) {
        inv[i] = new Array<number>(n);
        for (let j = 0; j < n; j++) inv[i][j] = aug[i][j + n];
    }
    return inv;
}

// ---------------------------------------------------------------------------
// F and Q builders
// ---------------------------------------------------------------------------

/**
 * Rank-m Joseph covariance update (math-exact, Task B).
 *
 * P+ = P - K*(HP) - (K*(HP))t + K*S*Kt
 *
 * Uses the already-computed PHt (=P*Ht) and S (=HPHt+R).  m <= 3 for all
 * our measurement factors, so this runs in O(n^2*m) instead of the dense
 * O(n^3) I_KH form.
 */
function _rankMJosephUpdate(P: Mat, K: Mat, PHt: Mat, S: Mat, dim: number, m: number): Mat {
    const HP = new Array<number[]>(m);
    for (let ki = 0; ki < m; ki++) {
        HP[ki] = new Array<number>(dim);
        for (let i = 0; i < dim; i++) HP[ki][i] = PHt[i][ki];
    }

    const KHP = new Array<number[]>(dim);
    for (let i = 0; i < dim; i++) {
        KHP[i] = new Array<number>(dim);
        for (let j = 0; j < dim; j++) {
            let s = 0;
            for (let k = 0; k < m; k++) s += K[i][k] * HP[k][j];
            KHP[i][j] = s;
        }
    }

    const KS = new Array<number[]>(dim);
    for (let i = 0; i < dim; i++) {
        KS[i] = new Array<number>(m);
        for (let j = 0; j < m; j++) {
            let s = 0;
            for (let k = 0; k < m; k++) s += K[i][k] * S[k][j];
            KS[i][j] = s;
        }
    }

    const Pnew = new Array<number[]>(dim);
    for (let i = 0; i < dim; i++) {
        Pnew[i] = new Array<number>(dim);
        for (let j = 0; j < dim; j++) {
            let sum = P[i][j] - KHP[i][j] - KHP[j][i];
            for (let k = 0; k < m; k++) sum += KS[i][k] * K[j][k];
            Pnew[i][j] = sum;
        }
    }
    return Pnew;
}

/**
 * Dense O(n^3) Joseph covariance update -- the OLD form kept solely for
 * equivalence testing.  Equivalent to _rankMJosephUpdate but forms I-KH
 * and does two full n^3 matmuls.  NOT used in production.
 */
function _denseJosephUpdate(P: Mat, K: Mat, H: Mat, R: Mat, dim: number, m: number): Mat {
    const I_KH = matIdentity(dim);
    for (let i = 0; i < dim; i++)
        for (let j = 0; j < dim; j++)
            for (let k = 0; k < m; k++) I_KH[i][j] -= K[i][k] * H[k][j];

    const IKH_P = matMul(I_KH, P);
    const IKH_P_IKHt = matMul(IKH_P, matTranspose(I_KH));

    const KRKt = new Array<number[]>(dim);
    for (let i = 0; i < dim; i++) {
        KRKt[i] = new Array<number>(dim).fill(0);
        for (let j = 0; j < dim; j++)
            for (let ki = 0; ki < m; ki++)
                for (let kj = 0; kj < m; kj++)
                    KRKt[i][j] += K[i][ki] * R[ki][kj] * K[j][kj];
    }

    return matAdd(IKH_P_IKHt, KRKt);
}

export const IDX_BA = 9;
export const IDX_BG = 12;
export const IDX_ME = 15;
export const IDX_MB = 18;

function buildTransition(dim: number, q: Quat, sfAccel: Vec3, dt: number): Mat {
    const F = matIdentity(dim);
    const R = quatToRot(q);
    const [sx, sy, sz] = sfAccel;
    const dt2h = 0.5 * dt * dt;

    const fwx = R[0][0]*sx + R[0][1]*sy + R[0][2]*sz;
    const fwy = R[1][0]*sx + R[1][1]*sy + R[1][2]*sz;
    const fwz = R[2][0]*sx + R[2][1]*sy + R[2][2]*sz;

    const sr00 = 0,    sr01 = -fwz, sr02 = fwy;
    const sr10 = fwz,  sr11 = 0,    sr12 = -fwx;
    const sr20 = -fwy, sr21 = fwx,  sr22 = 0;

    F[0][3]=dt; F[1][4]=dt; F[2][5]=dt;
    F[0][6]=-sr00*dt2h; F[0][7]=-sr01*dt2h; F[0][8]=-sr02*dt2h;
    F[1][6]=-sr10*dt2h; F[1][7]=-sr11*dt2h; F[1][8]=-sr12*dt2h;
    F[2][6]=-sr20*dt2h; F[2][7]=-sr21*dt2h; F[2][8]=-sr22*dt2h;
    F[3][6]=-sr00*dt; F[3][7]=-sr01*dt; F[3][8]=-sr02*dt;
    F[4][6]=-sr10*dt; F[4][7]=-sr11*dt; F[4][8]=-sr12*dt;
    F[5][6]=-sr20*dt; F[5][7]=-sr21*dt; F[5][8]=-sr22*dt;

    const hasConvergedAtt = true;
    if (hasConvergedAtt) {
    F[6][12]=-dt*R[0][0];  F[6][13]=-dt*R[0][1];  F[6][14]=-dt*R[0][2];
    F[7][12]=-dt*R[1][0];  F[7][13]=-dt*R[1][1];  F[7][14]=-dt*R[1][2];
    F[8][12]=-dt*R[2][0];  F[8][13]=-dt*R[2][1];  F[8][14]=-dt*R[2][2];
    F[3][9]=dt*R[0][0];   F[3][10]=dt*R[0][1];   F[3][11]=dt*R[0][2];
    F[4][9]=dt*R[1][0];   F[4][10]=dt*R[1][1];   F[4][11]=dt*R[1][2];
    F[5][9]=dt*R[2][0];   F[5][10]=dt*R[2][1];   F[5][11]=dt*R[2][2];
    F[0][9]=dt2h*R[0][0]; F[0][10]=dt2h*R[0][1]; F[0][11]=dt2h*R[0][2];
    F[1][9]=dt2h*R[1][0]; F[1][10]=dt2h*R[1][1]; F[1][11]=dt2h*R[1][2];
    F[2][9]=dt2h*R[2][0]; F[2][10]=dt2h*R[2][1]; F[2][11]=dt2h*R[2][2];
    }

    return F;
}

function buildProcessNoise(dim: number, sigmaAcc: number, sigmaGyro: number, dt: number, sigmaBaRW: number, sigmaBgRW: number): Mat {
    const Q = new Array<number[]>(dim);
    for (let i = 0; i < dim; i++) Q[i] = new Array<number>(dim).fill(0);
    const sa2 = sigmaAcc * sigmaAcc;
    const sg2 = sigmaGyro * sigmaGyro;
    const dt2 = dt * dt;
    const pNoise = sa2 * dt2 * dt2 / 4;
    const vNoise = sa2 * dt2;
    const pvNoise = sa2 * dt2 * dt / 2;
    const gNoise = sg2 * dt2;
    Q[0][0]=Q[1][1]=Q[2][2]=pNoise;
    Q[3][3]=Q[4][4]=Q[5][5]=vNoise;
    Q[0][3]=Q[3][0]=Q[1][4]=Q[4][1]=Q[2][5]=Q[5][2]=pvNoise;
    Q[6][6]=Q[7][7]=Q[8][8]=gNoise;
    if (dim >= 15) {
        const baRw = (sigmaBaRW || 2e-4) * (sigmaBaRW || 2e-4) * dt;
        const bgRw = (sigmaBgRW || 3e-5) * (sigmaBgRW || 3e-5) * dt;
        Q[9][9]=Q[10][10]=Q[11][11]=baRw;
        Q[12][12]=Q[13][13]=Q[14][14]=bgRw;
    }
    return Q;
}

function symmetryForce(P: Mat): void {
    const n = P.length;
    for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++) {
            const avg = (P[i][j] + P[j][i]) * 0.5;
            P[i][j] = avg; P[j][i] = avg;
        }
}

function varianceFloor(P: Mat, minVal: number = 1e-6): void {
    for (let i = 0; i < P.length; i++)
        if (P[i][i] < minVal) P[i][i] = minVal;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createEskf({
    p0,
    v0,
    q0,
    sigmaPos = 5,
    sigmaVel = 2,
    sigmaAtt = 0.2,
    ba0,
    bg0,
    sigmaBa = 0.5,
    sigmaBg = 0.05,
    sigmaBaRW = 2e-4,
    sigmaBgRW = 3e-5,
    mEarth0,
    mBody0,
    sigmaMagEarth = 0.05,
    sigmaMagBody = 0.02,
    procSigmaAcc = 0.35,
    procSigmaGyro = 0.015,
    bgClamp = 0.05,
}: EskfOptions): EskfState {
    const hasMag = mEarth0 != null;
    let dim = 15;
    if (hasMag) dim = 21;

    const P = matIdentity(dim);
    P[0][0] = P[1][1] = P[2][2] = sigmaPos * sigmaPos;
    P[3][3] = P[4][4] = P[5][5] = sigmaVel * sigmaVel;
    P[6][6] = P[7][7] = P[8][8] = sigmaAtt * sigmaAtt;
    P[9][9] = P[10][10] = P[11][11] = sigmaBa * sigmaBa;
    P[12][12] = P[13][13] = P[14][14] = sigmaBg * sigmaBg;

    const ba: Vec3 = ba0 ? ba0.slice() as Vec3 : [0, 0, 0];
    const bg: Vec3 = bg0 ? bg0.slice() as Vec3 : [0, 0, 0];
    const me: Vec3 | null = hasMag ? mEarth0!.slice() as Vec3 : null;
    const mb: Vec3 | null = hasMag ? (mBody0 ? mBody0.slice() as Vec3 : [0, 0, 0]) : null;

    if (hasMag) {
        P[15][15] = P[16][16] = P[17][17] = sigmaMagEarth * sigmaMagEarth;
        P[18][18] = P[19][19] = P[20][20] = sigmaMagBody * sigmaMagBody;
    }

    return {
        dim,
        p: p0.slice() as Vec3,
        v: v0.slice() as Vec3,
        q: q0.slice() as Quat,
        ba,
        bg,
        mEarth: me,
        mBody: mb,
        P,
        sigmaAcc: procSigmaAcc,
        sigmaGyro: procSigmaGyro,
        sigmaBaRW,
        sigmaBgRW,
        sigmaMagEarthRW: 1e-3,
        sigmaMagBodyRW: 1e-4,
        bgClamp,
    };
}

/**
 * Predict step. Returns the transition matrix F used (for RTS smoother).
 */
export function eskfPredict(eskf: EskfState, omega: Vec3, accel: Vec3, dt: number): { F: Mat } {
    const { dim } = eskf;

    const sfX = -accel[0], sfY = -accel[1], sfZ = -accel[2];
    const F = buildTransition(dim, eskf.q, [sfX, sfY, sfZ], dt);
    const Q = buildProcessNoise(dim, eskf.sigmaAcc, eskf.sigmaGyro, dt, eskf.sigmaBaRW, eskf.sigmaBgRW);

    const next = strapdownPropagate(omega, accel, eskf.q, eskf.v, eskf.p, dt, eskf.bg, eskf.ba);
    eskf.p = next.p;
    eskf.v = next.v;
    eskf.q = next.q;

    if (dim >= 21) {
        const meRw = eskf.sigmaMagEarthRW * eskf.sigmaMagEarthRW * dt;
        const mbRw = eskf.sigmaMagBodyRW * eskf.sigmaMagBodyRW * dt;
        Q[15][15] += meRw; Q[16][16] += meRw; Q[17][17] += meRw;
        Q[18][18] += mbRw; Q[19][19] += mbRw; Q[20][20] += mbRw;
    }

    const FP = matMul(F, eskf.P);
    const stencil = getSparseStencil(dim);
    const FPFt = matMulByBt(FP, F, stencil);
    eskf.P = matAdd(FPFt, Q);
    symmetryForce(eskf.P);

    return { F };
}

/**
 * Update step with a measurement factor.
 * The factor's H rows must match eskf.dim in length.
 */
export function eskfUpdate(eskf: EskfState, factor: MeasurementFactor, z: unknown, gate: number = 3.0, robustOpts: RobustOpts = {}): boolean {
    const { dcs = false, dcsPhi = 1.0 } = robustOpts;
    const { dim } = eskf;
    const x: NominalState = { p: eskf.p, v: eskf.v, q: eskf.q, ba: eskf.ba, bg: eskf.bg, mEarth: eskf.mEarth, mBody: eskf.mBody };

    const r = factor.residual(z, x);
    let H = factor.H;
    const R = factor.R;
    const m = r.length;

    if (H[0].length < dim) {
        H = H.map((row) => {
            const padded = new Array<number>(dim).fill(0);
            for (let i = 0; i < row.length; i++) padded[i] = row[i];
            return padded;
        });
    }

    const PHt = new Array<number[]>(dim);
    for (let i = 0; i < dim; i++) {
        PHt[i] = new Array<number>(m).fill(0);
        for (let k = 0; k < dim; k++) {
            const pik = eskf.P[i][k];
            if (pik === 0) continue;
            for (let j = 0; j < m; j++) PHt[i][j] += pik * H[j][k];
        }
    }

    const S = new Array<number[]>(m);
    for (let i = 0; i < m; i++) {
        S[i] = new Array<number>(m).fill(0);
        for (let j = 0; j < m; j++) {
            for (let k = 0; k < dim; k++) S[i][j] += H[i][k] * PHt[k][j];
            S[i][j] += R[i][j];
        }
    }

    const S_inv = matInvertSym(S);
    let mahal = 0;
    for (let i = 0; i < m; i++)
        for (let j = 0; j < m; j++) mahal += r[i] * S_inv[i][j] * r[j];
    if (mahal > gate * gate * m) return false;

    let dcsScale = 1.0;
    if (dcs && mahal > 1e-6) {
        dcsScale = Math.min(1.0, (2.0 * dcsPhi) / (dcsPhi + mahal));
    }

    const K = new Array<number[]>(dim);
    for (let i = 0; i < dim; i++) {
        K[i] = new Array<number>(m);
        for (let j = 0; j < m; j++) {
            let s = 0;
            for (let k = 0; k < m; k++) s += PHt[i][k] * S_inv[k][j];
            K[i][j] = s * dcsScale;
        }
    }

    const dx = new Array<number>(dim).fill(0);
    for (let i = 0; i < dim; i++)
        for (let j = 0; j < m; j++) dx[i] += K[i][j] * r[j];

    eskf.p[0] += dx[0]; eskf.p[1] += dx[1]; eskf.p[2] += dx[2];
    eskf.v[0] += dx[3]; eskf.v[1] += dx[4]; eskf.v[2] += dx[5];

    const dtheta: Vec3 = [dx[6], dx[7], dx[8]];
    const dthetaNorm = Math.sqrt(dtheta[0]**2 + dtheta[1]**2 + dtheta[2]**2);
    if (dthetaNorm > 1e-12) {
        const axis: Vec3 = [dtheta[0]/dthetaNorm, dtheta[1]/dthetaNorm, dtheta[2]/dthetaNorm];
        const dq = quatFromAxisAngle(axis, dthetaNorm);
        const newQ = quatMultiply(dq, eskf.q);
        const nq = Math.sqrt(newQ[0]**2+newQ[1]**2+newQ[2]**2+newQ[3]**2);
        eskf.q = [newQ[0]/nq, newQ[1]/nq, newQ[2]/nq, newQ[3]/nq];
    }

    if (dx.length >= 12) {
        eskf.ba[0] += dx[9];  eskf.ba[1] += dx[10]; eskf.ba[2] += dx[11];
        eskf.bg[0] += dx[12]; eskf.bg[1] += dx[13]; eskf.bg[2] += dx[14];
        if (eskf.bgClamp > 0) {
            for (let i = 0; i < 3; i++) {
                if (eskf.bg[i] > eskf.bgClamp) eskf.bg[i] = eskf.bgClamp;
                else if (eskf.bg[i] < -eskf.bgClamp) eskf.bg[i] = -eskf.bgClamp;
            }
        }
    }

    if (eskf.mEarth) {
        eskf.mEarth[0] += dx[15]; eskf.mEarth[1] += dx[16]; eskf.mEarth[2] += dx[17];
    }
    if (eskf.mBody) {
        eskf.mBody[0] += dx[18]; eskf.mBody[1] += dx[19]; eskf.mBody[2] += dx[20];
    }

    eskf.P = _rankMJosephUpdate(eskf.P, K, PHt, S, dim, m);
    symmetryForce(eskf.P);
    varianceFloor(eskf.P);
    return true;
}

export function eskfGetState(eskf: EskfState): EskfSnapshot {
    return {
        p: eskf.p.slice() as Vec3,
        v: eskf.v.slice() as Vec3,
        q: eskf.q.slice() as Quat,
        ba: eskf.ba ? eskf.ba.slice() as Vec3 : null,
        bg: eskf.bg ? eskf.bg.slice() as Vec3 : null,
        mEarth: eskf.mEarth ? eskf.mEarth.slice() as Vec3 : null,
        mBody: eskf.mBody ? eskf.mBody.slice() as Vec3 : null,
        sigmaPos: Math.sqrt(Math.max(0, (eskf.P[0][0]+eskf.P[1][1]+eskf.P[2][2])/3)),
        sigmaAtt: Math.sqrt(Math.max(0, (eskf.P[6][6]+eskf.P[7][7]+eskf.P[8][8])/3))*(180/Math.PI),
    };
}

export { matMul, matTranspose, matAdd, matMulByBt, getSparseStencil, buildTransition, _rankMJosephUpdate, _denseJosephUpdate };

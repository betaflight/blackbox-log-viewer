import { describe, it, expect } from 'vitest';
import { createPreintegrator, preintegrateStep, predictState } from './imuPreintegration.js';

describe('imuPreintegration', () => {
  it('accumulates zero delta when drone is hovering (no motion)', () => {
    const preint = createPreintegrator();

    const omega: [number, number, number] = [0, 0, 0];
    const accel: [number, number, number] = [0, 0, 9.80665];
    const dt = 0.01;

    for (let i = 0; i < 51; i++) {
      preintegrateStep(preint, omega, accel, dt);
    }

    expect(preint.dtSum).toBeCloseTo(0.5, 2);

    const dR = preint.dR;
    expect(dR[0][0]).toBeCloseTo(1, 5);
    expect(dR[0][1]).toBeCloseTo(0, 5);
    expect(dR[2][2]).toBeCloseTo(1, 5);

    const p_i: [number, number, number] = [0, 0, 0];
    const v_i: [number, number, number] = [0, 0, 0];
    const R_i = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    const pred = predictState(preint, p_i, v_i, R_i);

    expect(pred.v_j[2]).toBeCloseTo(0, 4);
    expect(pred.p_j[2]).toBeCloseTo(0, 3);
  });

  it('predicts correct forward motion for horizontal acceleration', () => {
    const preint = createPreintegrator();

    const omega: [number, number, number] = [0, 0, 0];
    const accel: [number, number, number] = [1.0, 0, 9.80665];
    const dt = 0.01;

    for (let i = 0; i < 51; i++) {
      preintegrateStep(preint, omega, accel, dt);
    }

    expect(preint.dtSum).toBeCloseTo(0.5, 2);

    const p_i: [number, number, number] = [0, 0, 0];
    const v_i: [number, number, number] = [0, 0, 0];
    const R_i = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    const pred = predictState(preint, p_i, v_i, R_i);

    expect(pred.v_j[0]).toBeCloseTo(-0.5, 1);
    expect(pred.v_j[2]).toBeCloseTo(0, 4);
  });

  it('covariance grows with accumulation', () => {
    const preint = createPreintegrator();
    const initTrace = preint.cov[0][0] + preint.cov[4][4] + preint.cov[8][8];

    const omega: [number, number, number] = [0, 0, 0];
    const accel: [number, number, number] = [0, 0, 9.80665];
    const dt = 0.01;

    for (let i = 0; i < 100; i++) {
      preintegrateStep(preint, omega, accel, dt);
    }

    const finalTrace = preint.cov[0][0] + preint.cov[4][4] + preint.cov[8][8];
    expect(finalTrace).toBeGreaterThan(initTrace);
  });

  it('rotation integration works for yaw turn', () => {
    const preint = createPreintegrator();

    const omega: [number, number, number] = [0, 0, 1.0];
    const accel: [number, number, number] = [0, 0, 9.80665];
    const dt = 0.01;

    for (let i = 0; i < 51; i++) {
      preintegrateStep(preint, omega, accel, dt);
    }

    expect(preint.dtSum).toBeCloseTo(0.5, 2);

    const dR = preint.dR;
    expect(dR[0][0]).toBeCloseTo(Math.cos(0.5), 1);
    expect(dR[0][1]).toBeCloseTo(-Math.sin(0.5), 1);
    expect(dR[1][0]).toBeCloseTo(Math.sin(0.5), 1);
    expect(dR[1][1]).toBeCloseTo(Math.cos(0.5), 1);
    expect(dR[2][2]).toBeCloseTo(1, 5);
  });
});

/**
 * GPS home decode — regression guard + documented ground truth.
 *
 * GPS home is logged in H-FRAMES, a separate frame stream from the main I/P frames.
 * Its fields (GPS_home[0..2]) are NOT in the main field table, so they cannot be read
 * via getMainFieldIndexByName() — doing so silently yields gpsHome=null (the bug this
 * guards against). The viewer decodes the H-frame into the intraframe directory; the
 * accessor is flightLog.getGPSHome(). Units: lat/lon are 1e7-scaled integers, alt is
 * decimetres MSL. G-frames carry position as a delta from home (predictor 7 HOME_COORD).
 *
 * Ground truth for acro1 / LOG00007.BFL (BF 2026.6.0-alpha, FLYWOOH743), independently
 * confirmed by a from-scratch H-frame decode:
 *   home = 48.4023468 N, -71.1696256 W, 134.2 m MSL   (raw 484023468, -711696256, 1342)
 * The drone was stationary at home pre-arm, so home == the first GPS fix to ~1e-7 deg.
 *
 * The BFL is not committed; this suite skips gracefully when absent.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ingestFlightLog, loadFlightLogFromBuffer } from './flightIngestion.js';
import type { GpsHome } from './flightIngestion.js';

const __dirname: string = path.dirname(fileURLToPath(import.meta.url));
const BFL: string = path.resolve(__dirname, './__fixtures__/acro1/LOG00007.BFL');
const have = (): boolean => { try { fs.accessSync(BFL, fs.constants.R_OK); return true; } catch { return false; } };

interface HomeCoords {
    lat: number;
    lon: number;
    alt: number;
}

const HOME: HomeCoords = { lat: 48.4023468, lon: -71.1696256, alt: 134.2 };

describe("GPS home decode (H-frame) — acro1/LOG00007.BFL", () => {
    it("decodes home from the H-frame via getGPSHome() and ingestion", async () => {
        if (!have()) { console.warn("SKIP gpsHomeDecode: LOG00007.BFL not present"); return; }
        const fl = await loadFlightLogFromBuffer(new Uint8Array(fs.readFileSync(BFL)));

        const home: GpsHome | null = (fl as { getGPSHome(): GpsHome | null }).getGPSHome();
        expect(home, "getGPSHome() must decode the H-frame, not return null").not.toBeNull();
        expect(home!.lat, `home.lat=${home!.lat}`).toBeCloseTo(HOME.lat, 6);
        expect(home!.lon, `home.lon=${home!.lon}`).toBeCloseTo(HOME.lon, 6);
        expect(home!.alt, `home.alt=${home!.alt}`).toBeCloseTo(HOME.alt, 1);

        const d = ingestFlightLog(fl as Parameters<typeof ingestFlightLog>[0]);
        expect(d.gpsHome, "ingestFlightLog must surface gpsHome").not.toBeNull();
        expect(d.gpsHome!.lat).toBeCloseTo(HOME.lat, 6);
        expect(d.gpsHome!.lon).toBeCloseTo(HOME.lon, 6);
        expect(d.gpsHome!.alt).toBeCloseTo(HOME.alt, 1);

        const g0 = d.gps[0];
        const dN: number = (g0.lat - home!.lat) * 111320;
        const dE: number = (g0.lon - home!.lon) * 111320 * Math.cos(home!.lat * Math.PI / 180);
        const sep: number = Math.hypot(dN, dE);
        expect(sep, `home↔first-fix separation = ${sep.toFixed(2)} m (drone static at home)`).toBeLessThan(3);
    });
});

/**
 * Quick diagnostic: extract baro, GPS, and recon altitude series
 * through the climb+drop window. Writes CSV to stdout.
 *
 * Run:  cd blackbox-log-viewer && node --import=./register.js src/pose/verticalDiag.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ingestFlightLog, loadFlightLogFromBuffer, correctMagStream } from './flightIngestion.js';
import { estimatePoseTrack } from './estimatorLoop.js';
import { loadMagCharacterizationModel } from './mag_model.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(__dirname, '../../../../planv5/blackbox/acro1/');
const BFL_PATH = path.join(DIR, 'LOG00007.BFL');
const MODEL_PATH = path.join(DIR, 'acro1_mag_model.json');

const VIDEO_OFFSET_S = -195.323;
function videoToTUs(vs) { return (vs - VIDEO_OFFSET_S) * 1e6; }
function tUsToVideo(tUs) { return tUs / 1e6 + VIDEO_OFFSET_S; }

async function main() {
  const fl = await loadFlightLogFromBuffer(new Uint8Array(fs.readFileSync(BFL_PATH)));
  const data = ingestFlightLog(fl);

  const mr = loadMagCharacterizationModel(JSON.parse(fs.readFileSync(MODEL_PATH, 'utf-8')));
  const magGauss = mr.model ? correctMagStream(data.mag, mr.model) : [];
  const magModelForEst = mr.model && mr.model.fusion?.earthFieldNedGauss ? mr.model : null;

  const origin = data.gpsHome || { lat: data.gps[0].lat, lon: data.gps[0].lon, alt: data.gps[0].alt ?? 134.2 };

  const track = estimatePoseTrack({ ...data, mag: magGauss }, origin, {
    outputHz: 20, maxIter: 3, sigmaYawMax: 0.1,
    magModel: magModelForEst,
  });

  const climbStartUs = videoToTUs(150);
  const climbEndUs = videoToTUs(175);

  // Baro offset from first GPS
  let baroOffset = 0;
  if (data.baro.length > 0 && data.gps.length > 0) {
    const g0 = data.gps[0];
    let best = data.baro[0];
    for (const b of data.baro) {
      if (Math.abs(b.tUs - g0.tUs) < Math.abs(best.tUs - g0.tUs)) best = b;
    }
    baroOffset = (g0.alt ?? origin.alt) - best.alt;
  }

  console.log('video_s,tUs,baro_alt,baro_corrected,gps_alt,recon_alt,diff_recon_gps,launch_alt');

  for (const s of track.samples) {
    if (s.tUs < climbStartUs || s.tUs > climbEndUs) continue;
    if (!s.lla) continue;

    // Nearest GPS
    let bestGpsAlt = null;
    let bestDt = Infinity;
    for (const g of data.gps) {
      const dt = Math.abs(g.tUs - s.tUs);
      if (dt < bestDt && dt < 2e6) { bestDt = dt; bestGpsAlt = g.alt; }
    }

    // Nearest baro
    let bestBaroAlt = null;
    bestDt = Infinity;
    for (const b of data.baro) {
      const dt = Math.abs(b.tUs - s.tUs);
      if (dt < bestDt && dt < 1e6) { bestDt = dt; bestBaroAlt = b.alt; }
    }

    const videoS = tUsToVideo(s.tUs);
    const baroCorrected = bestBaroAlt !== null ? bestBaroAlt + baroOffset : null;
    const diff = bestGpsAlt !== null ? s.lla.alt - bestGpsAlt : null;

    console.log(`${videoS.toFixed(2)},${s.tUs},${bestBaroAlt ?? ''},${baroCorrected?.toFixed(1) ?? ''},${bestGpsAlt?.toFixed(1) ?? ''},${s.lla.alt.toFixed(1)},${diff?.toFixed(1) ?? ''},${origin.alt.toFixed(1)}`);
  }
}

main().catch(console.error);

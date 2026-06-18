/**
 * GPX serializer — thin adapter over the PoseTrack IR.
 *
 * GPX has no native per-point orientation; we surface euler angles via
 * <extensions> with a pose: namespace. The triad KML is the primary
 * attitude output — the GPX extensions are a convenience for GIS tools
 * that can consume per-point metadata.
 *
 * Eulers per planv5/01 §7 (pitch: negative=nose UP) §8 (heading: 0=North CW+).
 */

import type { PoseTrack } from '../poseTrack.js';

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface GpxOpts {
  /** GPX track name (default "Betaflight Track") */
  trackName?: string;
}

/**
 * Serialize a PoseTrack to GPX 1.1 string.
 */
export function poseTrackToGpx(poseTrack: PoseTrack, opts: GpxOpts = {}): string {
  const { trackName = 'Betaflight Track' } = opts;
  const { samples } = poseTrack;
  if (!samples || samples.length === 0) {
    return '<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Betaflight Pose Estimator"><trk><name>Empty</name><trkseg></trkseg></trk></gpx>';
  }

  const t0Us = samples[0].tUs;

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    '<gpx version="1.1" creator="Betaflight Pose Estimator" xmlns="http://www.topografix.com/GPX/1/1" xmlns:pose="https://betaflight.com/pose/v1">',
  );
  lines.push(`  <trk>`);
  lines.push(`    <name>${esc(trackName)}</name>`);
  lines.push(`    <trkseg>`);

  for (const s of samples) {
    if (!s.lla) continue;
    if (s.tUs == null) continue;
    const tMs = (s.tUs - t0Us) / 1000;
    const d = new Date(tMs);
    if (isNaN(d.getTime())) continue;
    const iso = d.toISOString();

    lines.push(`      <trkpt lat="${s.lla.lat}" lon="${s.lla.lon}">`);
    lines.push(`        <ele>${s.lla.alt}</ele>`);
    lines.push(`        <time>${iso}</time>`);
    // Extensions: euler angles when available (roll/pitch/heading/tilt in degrees)
    if (s.euler) {
      lines.push(`        <extensions>`);
      lines.push(`          <pose:rollDeg>${s.euler.rollDeg.toFixed(2)}</pose:rollDeg>`);
      lines.push(`          <pose:pitchDeg>${s.euler.pitchDeg.toFixed(2)}</pose:pitchDeg>`);
      lines.push(`          <pose:headingDeg>${s.euler.headingDeg.toFixed(2)}</pose:headingDeg>`);
      lines.push(`          <pose:tiltDeg>${s.euler.tiltDeg.toFixed(2)}</pose:tiltDeg>`);
      lines.push(`        </extensions>`);
    }
    lines.push(`      </trkpt>`);
  }

  lines.push(`    </trkseg>`);
  lines.push(`  </trk>`);
  lines.push(`</gpx>`);

  return `${lines.join('\n')}\n`;
}

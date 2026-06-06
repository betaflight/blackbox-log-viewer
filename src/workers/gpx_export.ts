import { getExportRows, type FramesPayload } from "./export_rows";

export interface GpxExportPayload extends FramesPayload {
  fieldNames: string[];
  sysConfig: Record<string, unknown>;
}

const HEADER = `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://www.topografix.com/GPX/1/1" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd http://www.topografix.com/GPX/gpx_style/0/2 http://www.topografix.com/GPX/gpx_style/0/2/gpx_style.xsd" xmlns:gpx_style="http://www.topografix.com/GPX/gpx_style/0/2" 
  version="1.1" 
  creator="https://github.com/betaflight/blackbox-log-viewer">
  <metadata>
    <author>
      <name>Betaflight Blackbox Explorer</name>
      <link href="https://github.com/betaflight/blackbox-log-viewer"></link>
    </author>
  </metadata>`;

const FOOTER = `</gpx>`;

// Pure GPX serialization (no worker globals), so it is unit/golden-testable.
export function buildGpx(data: GpxExportPayload): string {
  const timeIndex = data.fieldNames.indexOf("time");
  const latIndex = data.fieldNames.indexOf("GPS_coord[0]");
  const lngIndex = data.fieldNames.indexOf("GPS_coord[1]");
  const altitudeIndex = data.fieldNames.indexOf("GPS_altitude");

  let trkpts = "";
  for (const frame of getExportRows(data)) {
    if (!frame[latIndex] || !frame[lngIndex]) {
      continue;
    }
    const timeMillis = Math.floor((frame[timeIndex] as number) / 1000);
    const lat = (frame[latIndex] as number) / 10000000;
    const lng = (frame[lngIndex] as number) / 10000000;
    const altitude = (frame[altitudeIndex] as number) / 10;

    const date = new Date(data.sysConfig["Log start datetime"] as string);
    date.setTime(date.getTime() + timeMillis);

    trkpts += `<trkpt lat="${lat}" lon="${lng}"><ele>${altitude}</ele><time>${date.toISOString()}</time></trkpt>\n`;
  }

  const trk = `  <trk>
    <trkseg>
      ${trkpts}
    </trkseg>
  </trk>`;

  return `${HEADER}\n${trk}\n${FOOTER}`;
}

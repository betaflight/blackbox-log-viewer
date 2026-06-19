export class FlightLog {
  constructor(data: Uint8Array);
  openLog(index: number): void;
  getMainFieldIndexByName(name: string): number | null;
  getSysConfig(): Record<string, unknown>;
  getChunksInTimeRange(startUs: number, endUs: number): Array<{ frames: number[][] }>;
  getGPSHome?(): { lat: number; lon: number; alt: number } | null;
}

// Module worker entry: thin shell around the pure buildSpectrumCsv serializer.
import { buildSpectrumCsv } from "./spectrum_export";

const ctx = globalThis as unknown as Worker;
ctx.onmessage = (event: MessageEvent) => {
  ctx.postMessage(buildSpectrumCsv(event.data));
};

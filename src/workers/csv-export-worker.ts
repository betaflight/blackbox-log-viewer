// Module worker entry: thin shell around the pure buildCsv serializer.
import { buildCsv } from "./csv_export";

const ctx = globalThis as unknown as Worker;
ctx.onmessage = (event: MessageEvent) => {
  ctx.postMessage(buildCsv(event.data));
};

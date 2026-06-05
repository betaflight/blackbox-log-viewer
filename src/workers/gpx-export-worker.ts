// Module worker entry: thin shell around the pure buildGpx serializer.
import { buildGpx } from "./gpx_export";

const ctx = self as unknown as Worker;
ctx.onmessage = (event: MessageEvent) => {
  ctx.postMessage(buildGpx(event.data));
};

import html2canvas from "html2canvas";
import { useAppStore } from "./stores/app.js";

export function makeScreenshot() {
  const el = document.getElementById("screenshot-frame");
  const now = new Date();
  const pad2 = (n) => String(n).padStart(2, "0");
  const timestamp = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}-${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
  const baseFilename =
    useAppStore().logFilename?.replace(".", "_") || "blackbox-log";
  const defaultFilename = `${baseFilename}-${timestamp}.png`;
  html2canvas(el).then((canvas) => {
    const anchor = document.createElement("a");
    anchor.download = defaultFilename;
    anchor.href = canvas.toDataURL();
    anchor.click();
  });
}

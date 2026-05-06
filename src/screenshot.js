import html2canvas from "html2canvas";
import { useAppStore } from "./stores/app.js";

export function makeScreenshot() {
  const el = document.getElementById("screenshot-frame");
  const now = new Date();
  const timestamp = `${now.getFullYear()}${`00${now.getMonth() + 1}`.slice(
    -2,
  )}${`00${now.getDate()}`.slice(-2)}-${`00${now.getHours()}`.slice(
    -2,
  )}${`00${now.getMinutes()}`.slice(-2)}${`00${now.getSeconds()}`.slice(-2)}`;
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

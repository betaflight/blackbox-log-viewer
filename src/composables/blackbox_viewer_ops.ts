// Public operations exposed by useBlackboxViewer(). The composable is still JS
// (it owns the renderer instances); this interface types its return for the
// (now TypeScript) component consumers. When the composable is converted to TS
// it should implement this shape.

export interface BlackboxViewerOps {
  // Spectrum analyser
  spectrumExport(): void;
  spectrumImport(files: FileList | File[] | null): void;
  spectrumClear(): void;

  // App-level
  refreshGraph(): void;
  loadFiles(files: FileList | File[]): void;
  newGraphConfig(newConfig: unknown, redrawChart?: boolean): void;
  exportCsv(): void;
  exportGpx(): void;
  exportWorkspaces(): void;
  pauseForExport(): void;
  getVideoExportParams(): unknown;
  saveVideoConfig(newConfig: unknown): void;
  openNewWindow(): void;
  saveUserSettings(newSettings: Record<string, unknown>): void;

  // Graph config / pen ops
  zoomGraphConfig(gi: number): void;
  expandGraphConfig(gi: number): void;
  reorderGraphs(newOrder: number[]): void;
  resetPen(gi: number, fi: number | null): void;
  fieldWheel(
    gi: number,
    fi: number,
    delta: number,
    shiftKey: boolean,
    altKey: boolean,
    ctrlKey: boolean,
  ): void;
  applyGraphZoom(zoom: number, instant?: boolean): void;
  selectLogIndex(index: number | string): void;
  setSeekBarMode(mode: string): void;

  // Workspaces
  switchWorkspace(id: number): void;
  saveWorkspace(id: number, title: string): void;
  applyDefaultWorkspace(index: number): void;
  gotoBookmark(index: number): void;

  // Playback
  logPlayPause(): void;
  logJumpBack(): void;
  logJumpForward(): void;
  logJumpStart(): void;
  logJumpEnd(): void;
  videoJumpStart(): void;
  videoJumpEnd(): void;
  logSyncHere(): void;
  logSyncBack(): void;
  logSyncForward(): void;
  logSmartSync(): void;
  setVideoOffsetValue(val: string | number): void;
  setGraphTime(timeStr: string): void;
  applyPlaybackRate(rate: number): void;
}

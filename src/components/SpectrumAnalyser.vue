<template>
  <div id="analyser" class="analyser">
    <canvas width="0" height="0" id="analyserCanvas"></canvas>

    <span id="spectrumToolbar">
      <div id="spectrumType" title="Type of Spectrum">
        <select id="spectrumTypeSelect">
          <option value="0">Frequency</option>
          <option value="1">Freq. vs Throttle</option>
          <option value="2">Freq. vs RPM</option>
          <option value="3">Power Spectral Density</option>
          <option value="4">PSD vs Throttle</option>
          <option value="5">PSD vs RPM</option>
          <option value="6">Error vs Setpoint</option>
        </select>
      </div>

      <div id="overdrawSpectrumType" title="Show Filters">
        <select id="overdrawSpectrumTypeSelect">
          <option value="0">Show all filters</option>
          <option value="1">Show only Gyro filters</option>
          <option value="2">Show only D-Term filters</option>
          <option value="3">Show only Yaw filters</option>
          <option value="4">Hide all filters</option>
          <option value="5">Auto</option>
        </select>
      </div>

      <div id="spectrumComparison" title="Spectrum comparison">
        <button id="btn-spectrum-export" type="button" title="Export spectrum to CSV">Exp</button>
        <button type="button" @click="triggerImport" title="Import spectrum from CSV">Imp</button>
        <input type="file" id="btn-spectrum-import" accept=".csv" style="display:none" multiple/>
        <button type="button" id="btn-spectrum-clear" title="Clear imported spectrums">Clr</button>
      </div>

      <div id="analyserResize" class="view-analyser-fullscreen cursor-pointer text-neutral-400 hover:text-white" title="Zoom Analyser Window" @click="toggleFullscreen">
        <span class="icon-resize-full">&#x26F6;</span>
        <span class="icon-resize-small">&#x2716;</span>
      </div>
    </span>

    <input id="analyserZoomX" class="onlyFullScreen" type="range" name="analyserZoomX" value="100" min="100" max="500" step="10" title="" list="analyserZoomXTicks" />
    <input id="analyserZoomY" class="onlyFullScreen" type="range" name="analyserZoomY" value="100" min="10" max="1000" step="10" list="analyserZoomYTicks" />
    <input id="analyserSegmentLengthPowerAt2" class="onlyFullScreen" type="number" name="analyserSegmentLengthPowerAt2" value="9" min="6" max="20" step="1" />
    <label id="analyserSegmentLengthPowerAt2Label" name="analyserSegmentLengthPowerAt2Label" class="onlyFullScreen">
      Segment&nbsp;length&nbsp;<br>power&nbsp;at&nbsp;2:
    </label>
    <input id="analyserLowLevelPSD" class="onlyFullScreen" type="number" name="analyserLowLevelPSD" value="-40" min="-40" max="10" step="5" />
    <label id="analyserLowLevelPSDLabel" name="analyserLowLevelPSDLabel" class="onlyFullScreen">
      Limit&nbsp;dBm
    </label>
    <input id="analyserMaxPSD" class="onlyFullScreen" type="number" name="analyserMaxPSD" value="10" min="-35" max="100" step="5" />
    <label id="analyserMaxPSDLabel" name="analyserMaxPSDLabel" class="onlyFullScreen">
      Max&nbsp;dBm
    </label>
    <input id="analyserMinPSD" class="onlyFullScreen" type="number" name="analyserMinPSD" value="-40" min="-100" max="5" step="5" />
    <label id="analyserMinPSDLabel" name="analyserMinPSDLabel" class="onlyFullScreen">
      Min&nbsp;dBm
    </label>

    <datalist id="analyserZoomXTicks">
      <option>100</option>
      <option>200</option>
      <option>300</option>
      <option>400</option>
      <option>500</option>
    </datalist>
    <datalist id="analyserZoomYTicks">
      <option>100</option>
    </datalist>
  </div>
</template>

<script setup>
function triggerImport() {
  document.getElementById("btn-spectrum-import").click();
}

function toggleFullscreen() {
  globalThis.blackboxLogViewer?.toggleAnalyserFullscreen?.();
}
</script>

<template>
  <div class="log-field-values" id="log-field-values">
    <h4 class="text-sm font-semibold px-2 py-1 bg-elevated rounded-t">Field values</h4>
    <table class="field-values-table">
      <thead>
        <tr class="text-xs text-dimmed">
          <th>&nbsp;</th>
          <th>Raw value</th>
          <th>Decoded</th>
          <th>&nbsp;</th>
          <th>Raw value</th>
          <th>Decoded</th>
        </tr>
      </thead>
      <tbody>
      </tbody>
    </table>

    <h4 class="text-sm font-semibold px-2 py-1 bg-elevated mt-2 rounded-t">Statistics</h4>
    <table id="stats-table" class="field-values-table">
      <caption class="text-xs text-dimmed text-left px-2 py-0.5">Min/max values from this log</caption>
      <thead>
        <tr class="text-xs text-dimmed">
          <th>&nbsp;</th>
          <th>Min</th>
          <th>Max</th>
          <th>Mean</th>
        </tr>
      </thead>
      <tbody>
      </tbody>
    </table>
  </div>
</template>

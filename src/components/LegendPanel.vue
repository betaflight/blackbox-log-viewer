<template>
  <div class="log-graph-config">
    <h2 id="legend_title">Legend
      <span class="log-close-legend-dialog glyphicon glyphicon-remove" data-toggle="tooltip" title="Hide the legend"></span>
    </h2>
    <div class="log-index"></div>
    <div class="log-graph-legend">
    </div>

    <div class="btn-group override-button-group" role="group">
      <button type="button" class="btn btn-nobg btn-svg-icon toggle-expo" data-toggle="tooltip" title="Expo On/Off">
        <svg width="24" height="24" viewBox="0 0 8.467 8.467">
          <path fill="none" stroke="#FFF" stroke-linecap="round" stroke-width=".5" d="M0 4.233s2.117 5.292 4.233 0c2.117-5.291 4.234 0 4.234 0"/>
          <path fill="#FFF" d="M4.233 0L3.175 1.058h2.117L4.233 0zm0 1.058L3.175 2.117h.794V6.35h-.794l1.058 1.058L5.292 6.35h-.794V2.117h.794L4.233 1.058zm0 6.35H3.175l1.058 1.059 1.059-1.059H4.233z"/>
        </svg>
      </button>
      <button type="button" class="btn btn-nobg btn-svg-icon toggle-smoothing" data-toggle="tooltip" title="Smoothing On/Off">
        <svg width="24" height="24" viewBox="0 0 8.467 8.467">
          <path fill="none" stroke="#FFF" stroke-linecap="round" stroke-width=".5" d="M0 4.233s2.117 5.292 4.233 0c2.117-5.291 4.234 0 4.234 0"></path>
          <path fill="none" stroke="#FFF" stroke-linecap="round" stroke-linejoin="round" stroke-width=".265"
            d="M0 4.233l1.058 3.97 1.059-2.911 1.058 2.91 1.058-7.144 1.059 4.234L6.35.265l1.058 3.968h1.059"></path>
        </svg>
      </button>
      <button type="button" class="btn btn-nobg btn-svg-icon toggle-grid" data-toggle="tooltip" title="Grid On/Off">
        <svg width="24" height="24" viewBox="0 0 8.467 8.467">
          <path fill="none" stroke="#FFF" stroke-linecap="round" stroke-width=".5" d="M0 4.233s2.117 5.292 4.233 0c2.117-5.291 4.234 0 4.234 0"/>
          <g fill="none" stroke="#FFF" stroke-width=".198">
            <path d="M0 3.175h8.467M0 7.408h8.467M0 5.292h8.467M0 1.058h8.467" opacity=".75"/>
          </g>
        </svg>
      </button>
    </div>

    <UButton color="primary" variant="solid" block class="open-graph-configuration-dialog" label="Graph setup" />
  </div>
</template>

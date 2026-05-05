/**
 * Theme Colors Helper
 *
 * Provides JavaScript access to CSS variables defined in theme.css.
 * Used by canvas rendering code (grapher.js, seekbar.js) to get
 * theme-aware colors that update when the theme changes.
 */

export const ThemeColors = {
  colorCache: {},

  getCSSVariable: function (variableName) {
    if (this.colorCache[variableName]) {
      return this.colorCache[variableName];
    }
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue(variableName)
      .trim();
    this.colorCache[variableName] = value;
    return value;
  },

  clearCache: function () {
    this.colorCache = {};
  },

  isDarkTheme: function () {
    return document.body.classList.contains("dark-theme");
  },

  getGraphBackground: function () {
    return this.getCSSVariable("--graph-background");
  },

  getGraphGrid: function () {
    return this.getCSSVariable("--graph-grid");
  },

  getGraphText: function () {
    return this.getCSSVariable("--graph-text");
  },

  getGraphTextSecondary: function () {
    return this.getCSSVariable("--graph-text-secondary");
  },

  getGraphAxis: function () {
    return this.getCSSVariable("--graph-axis");
  },
};

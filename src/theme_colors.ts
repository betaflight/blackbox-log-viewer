/**
 * Theme Colors Helper
 *
 * Provides JavaScript access to CSS variables defined in theme.css.
 * Used by canvas rendering code (grapher.js, seekbar.js) to get
 * theme-aware colors that update when the theme changes.
 */

import { useAppStore } from "./stores/app.js";

export const ThemeColors = {
  colorCache: {} as Record<string, string>,

  getCSSVariable: function (variableName: string) {
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
    return useAppStore().darkThemeEnabled;
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

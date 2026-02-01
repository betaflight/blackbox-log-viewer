/**
 * Theme Colors Helper
 *
 * This module provides JavaScript access to CSS variables defined in theme.css.
 * It's used by canvas rendering code (grapher.js, seekbar.js, etc.) to get
 * theme-aware colors that update when the theme changes.
 *
 * The module includes a cache for performance, which should be cleared when
 * the theme changes to force re-reading of the new colors.
 */

export const ThemeColors = {
  // Cache for computed colors to avoid repeated getComputedStyle calls
  colorCache: {},

  /**
   * Get a CSS variable value from the document
   * @param {string} variableName - CSS variable name (e.g., '--graph-background')
   * @returns {string} The computed color value
   */
  getCSSVariable: function(variableName) {
    // Return cached value if available
    if (this.colorCache[variableName]) {
      return this.colorCache[variableName];
    }

    // Compute the value from the current styles
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue(variableName)
      .trim();

    // Cache it for future use
    this.colorCache[variableName] = value;

    return value;
  },

  /**
   * Clear the color cache
   * Should be called when the theme changes to force re-reading of colors
   */
  clearCache: function() {
    this.colorCache = {};
  },

  /**
   * Check if dark theme is currently active
   * @returns {boolean} True if dark theme is enabled
   */
  isDarkTheme: function() {
    return document.body.classList.contains('dark-theme');
  },

  // ===== Graph/Canvas Color Getters =====

  /**
   * Get the graph background color
   * @returns {string} Color value (e.g., '#000000' or '#1a1a1a')
   */
  getGraphBackground: function() {
    return this.getCSSVariable('--graph-background');
  },

  /**
   * Get the graph grid line color
   * @returns {string} Color value with alpha (e.g., 'rgba(255,255,255,0.15)')
   */
  getGraphGrid: function() {
    return this.getCSSVariable('--graph-grid');
  },

  /**
   * Get the primary graph text color
   * @returns {string} Color value with alpha
   */
  getGraphText: function() {
    return this.getCSSVariable('--graph-text');
  },

  /**
   * Get the secondary graph text color (for less important text)
   * @returns {string} Color value with alpha
   */
  getGraphTextSecondary: function() {
    return this.getCSSVariable('--graph-text-secondary');
  },

  /**
   * Get the graph axis color
   * @returns {string} Color value with alpha
   */
  getGraphAxis: function() {
    return this.getCSSVariable('--graph-axis');
  },

  // ===== Text Color Getters =====

  /**
   * Get the primary text color
   * @returns {string} Color value
   */
  getTextPrimary: function() {
    return this.getCSSVariable('--text-primary');
  },

  /**
   * Get the secondary text color
   * @returns {string} Color value
   */
  getTextSecondary: function() {
    return this.getCSSVariable('--text-secondary');
  },

  /**
   * Get the muted text color
   * @returns {string} Color value
   */
  getTextMuted: function() {
    return this.getCSSVariable('--text-muted');
  },

  /**
   * Get the inverse text color (for use on contrasting backgrounds)
   * @returns {string} Color value
   */
  getTextInverse: function() {
    return this.getCSSVariable('--text-inverse');
  },

  // ===== Surface Color Getters =====

  /**
   * Get a surface color by level (0-950)
   * @param {number} level - Surface level (0, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950)
   * @returns {string} Color value
   */
  getSurface: function(level) {
    return this.getCSSVariable(`--surface-${level}`);
  },

  // ===== Primary Color Getters =====

  /**
   * Get the primary brand color
   * @returns {string} Color value (Betaflight orange)
   */
  getPrimary: function() {
    return this.getCSSVariable('--primary-500');
  },

  /**
   * Get a primary color by level (50-950)
   * @param {number} level - Primary color level
   * @returns {string} Color value
   */
  getPrimaryLevel: function(level) {
    return this.getCSSVariable(`--primary-${level}`);
  },

  // ===== Semantic Color Getters =====

  /**
   * Get success color
   * @returns {string} Color value
   */
  getSuccess: function() {
    return this.getCSSVariable('--success-500');
  },

  /**
   * Get error color
   * @returns {string} Color value
   */
  getError: function() {
    return this.getCSSVariable('--error-500');
  },

  /**
   * Get warning color
   * @returns {string} Color value
   */
  getWarning: function() {
    return this.getCSSVariable('--warning-500');
  },

  /**
   * Get info color
   * @returns {string} Color value
   */
  getInfo: function() {
    return this.getCSSVariable('--info-500');
  },

  // ===== Border Color Getters =====

  /**
   * Get the default border color
   * @returns {string} Color value
   */
  getBorderColor: function() {
    return this.getCSSVariable('--border-color');
  },

  /**
   * Get the light border color
   * @returns {string} Color value
   */
  getBorderColorLight: function() {
    return this.getCSSVariable('--border-color-light');
  },

  /**
   * Get the dark border color
   * @returns {string} Color value
   */
  getBorderColorDark: function() {
    return this.getCSSVariable('--border-color-dark');
  },

  // ===== UI Element Color Getters =====

  /**
   * Get button background color
   * @returns {string} Color value
   */
  getButtonBg: function() {
    return this.getCSSVariable('--button-bg');
  },

  /**
   * Get input background color
   * @returns {string} Color value
   */
  getInputBg: function() {
    return this.getCSSVariable('--input-bg');
  },

  /**
   * Get input border color
   * @returns {string} Color value
   */
  getInputBorder: function() {
    return this.getCSSVariable('--input-border');
  },
};

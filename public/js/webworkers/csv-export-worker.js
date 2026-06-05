onmessage = function(event) {

  /**
   * Converts `null` and other empty non-numeric values to empty string.
   *
   * @param {object} value is not a number
   * @returns {string}
   */
  function normalizeEmpty(value) {
    return !!value ? value : "";
  }

  /**
   * @param {array} columns
   * @returns {string}
   */
  function joinColumns(columns) {
    return columns
      .map(value =>
        typeof value === "number"
        ? value
        : stringDelim + normalizeEmpty(value) + stringDelim)
      .join(opts.columnDelimiter);
  }

  /**
   * Converts `null` entries in columns and other empty non-numeric values to NaN value string.
   * Uses a plain loop so it works on both Array rows and (transferred)
   * Float64Array rows.
   *
   * @param {array|Float64Array} columns
   * @returns {string}
   */
  function joinColumnValues(columns) {
    let row = "";
    for (let i = 0; i < columns.length; i++) {
      if (i > 0) {
        row += opts.columnDelimiter;
      }
      const value = columns[i];
      row += (typeof value === "number" || value) ? value : "NaN";
    }
    return row;
  }

  /**
   * Rows arrive either as the original nested frames array (chunks of frames)
   * or as a flat Float64Array (rowCount × rowLength) transferred zero-copy.
   *
   * @returns {Array<Array|Float64Array>}
   */
  function getRows() {
    if (event.data.flat) {
      const flat = event.data.flat,
        rowLength = event.data.rowLength,
        rowCount = event.data.rowCount,
        rows = new Array(rowCount);
      for (let r = 0; r < rowCount; r++) {
        rows[r] = flat.subarray(r * rowLength, (r + 1) * rowLength);
      }
      return rows;
    }
    return event.data.frames.flat();
  }

  let opts = event.data.opts,
    stringDelim = opts.quoteStrings
      ? opts.stringDelimiter
      : "",
    mainFields = [joinColumns(event.data.fieldNames)]
      .concat(getRows()
        .map(row => joinColumnValues(row)))
      .join("\n"),
    headers = Object.entries(event.data.sysConfig)
      .map(([key, value]) => joinColumns([key, value]))
      .join("\n"),
    result = headers + "\n" + mainFields;

  postMessage(result);

};

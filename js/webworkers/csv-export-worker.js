importScripts("/js/vendor/lodash.min.js");

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
        return _(columns)
            .map(value => 
                _.isNumber(value)
                ? value
                : stringDelim + normalizeEmpty(value) + stringDelim)
            .join(opts.columnDelimiter);
    }

    let opts = event.data.opts,
        stringDelim = opts.quoteStrings
            ? opts.stringDelimiter
            : "",
        mainFields = _([joinColumns(event.data.fieldNames)])
            .concat(_(event.data.frames)
                .flatten()
                .map(row => joinColumns(row))
                .value())
            .join("\n"),
        headers = _(event.data.sysConfig)
            .map((value, key) => joinColumns([key, value]))
            .join("\n"),
        result = headers + "\n" + mainFields;

    postMessage(result);
    
};
"use strict";

/**
 * @typedef {object} ExportOptions
 * @property {string} columnDelimiter
 * @property {string} stringDelimiter
 * @property {boolean} quoteStrings
 */

/**
 * @constructor
 * @param {FlightLog} flightLog 
 * @param {ExportOptions} [opts={}]
 */
let CsvExporter = function(flightLog, opts={}) {

    var opts = _.merge({
        columnDelimiter: ",",
        stringDelimiter: "\"",
        quoteStrings: true,
    }, opts);

    /** 
     * @param {function} success is a callback triggered when export is done
     */
    function dump(success) {
        let frames = _(flightLog.getChunksInTimeRange(flightLog.getMinTime(), flightLog.getMaxTime()))
                .map(chunk => chunk.frames).value(),
            worker = new Worker("/js/webworkers/csv-export-worker.js");

        worker.onmessage = event => {
            success(event.data);
            worker.terminate();
        };
        worker.postMessage({
            sysConfig: flightLog.getSysConfig(),
            fieldNames: flightLog.getMainFieldNames(),
            frames: frames,
            opts: opts,
        });
    }

    // exposed functions
    return {
        dump: dump,
    };
};
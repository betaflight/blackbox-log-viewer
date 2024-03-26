/**
 * @constructor
 * @param {FlightLog} flightLog 
 */
export function GpxExporter(flightLog) {

    /** 
     * @param {function} success is a callback triggered when export is done
     */
    function dump(success) {
        let frames = _(flightLog.getChunksInTimeRange(flightLog.getMinTime(), flightLog.getMaxTime()))
                .map(chunk => chunk.frames).value(),
            worker = new Worker("/js/webworkers/gpx-export-worker.js");

        worker.onmessage = event => {
            success(event.data);
            worker.terminate();
        };
        worker.postMessage({
            sysConfig: flightLog.getSysConfig(),
            fieldNames: flightLog.getMainFieldNames(),
            frames: frames,
        });
    }

    // exposed functions
    return {
        dump: dump,
    };
};

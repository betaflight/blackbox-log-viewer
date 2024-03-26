export function SimpleStats(flightLog) {
    const frames = _(flightLog.getChunksInTimeRange(flightLog.getMinTime(), flightLog.getMaxTime()))
        .map(chunk => chunk.frames).flatten().value(),
        fields = _.map(flightLog.getMainFieldNames(), (f) => {
            // fix typo. potential bug in either FW or BBE
            if (f === "BaroAlt") { return "baroAlt"; } else { return f; }
        });

    const getMinMaxMean = (fieldName) => {
        const index = _.findIndex(fields, (f) => f === fieldName);
        if (index === -1 || !frames.length || !(index in frames[0])) {
            return undefined;
        }
        const result = _.mapValues({
            "min": _.minBy(frames, (f) => f[index])[index],
            "max": _.maxBy(frames, (f) => f[index])[index],
            "mean": _.meanBy(frames, (f) => f[index]),
        });
        result["name"] = fieldName;
        return result;
    };

    const template = {
        "roll": () => getMinMaxMean("rcCommand[0]"),
        "pitch": () => getMinMaxMean("rcCommand[1]"),
        "yaw": () => getMinMaxMean("rcCommand[2]"),
        "throttle": () => getMinMaxMean("rcCommand[3]"),
        "vbat": () => getMinMaxMean("vbatLatest"),
        "amps": () => getMinMaxMean("amperageLatest"),
        "rssi": () => getMinMaxMean("rssi"),
        "alt_baro": () => getMinMaxMean("baroAlt"),
        "alt_gps": () => getMinMaxMean("GPS_altitude"),
    };

    function calculate() {
        return _.mapValues(template, (f) => f.call());
    }

    return {
        calculate: calculate,
    };
};

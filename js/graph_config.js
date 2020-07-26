"use strict";

function GraphConfig(graphConfig) {
    var
        graphs = graphConfig ? graphConfig : [],
        listeners = [],
        that = this;
    
    function notifyListeners() {
        for (var i = 0; i < listeners.length; i++) {
            listeners[i](that);
        }
    }
    
    this.selectedFieldName  = null;
    this.selectedGraphIndex = 0;
    this.selectedFieldIndex = 0;

    this.highlightGraphIndex = null;
    this.highlightFieldIndex = null;

    this.getGraphs = function() {
        return graphs;
    };
    
    /**
     * newGraphs is an array of objects like {label: "graph label", height:, fields:[{name: curve:{offset:, power:, inputRange:, outputRange:, steps:}, color:, }, ...]}
     */
    this.setGraphs = function(newGraphs) {
        graphs = newGraphs;
        
        notifyListeners();
    };
    
    /**
     * Convert the given graph configs to make them appropriate for the given flight log.
     */
    this.adaptGraphs = function(flightLog, graphs) {
        var 
            logFieldNames = flightLog.getMainFieldNames(),
            
            // Make copies of graphs into here so we can modify them without wrecking caller's copy
            newGraphs = [];
                    
        for (var i = 0; i < graphs.length; i++) {
            var 
                graph = graphs[i],
                newGraph = $.extend(
                    // Default values for missing properties:
                    {
                        height: 1
                    }, 
                    // The old graph
                    graph, 
                    // New fields to replace the old ones:
                    {
                        fields:[]
                    }
                ),
                colorIndex = 0;
            
            for (var j = 0; j < graph.fields.length; j++) {
                var
                    field = graph.fields[j],
                    matches;
                
                var adaptField = function(field, colorIndexOffset, forceNewCurve) {
                    const defaultCurve = GraphConfig.getDefaultCurveForField(flightLog, field.name);
                    

                    if (field.curve === undefined || forceNewCurve) {
                        field.curve = defaultCurve;
                    } else {
                        /* The curve may have been originally created for a craft with different endpoints, so use the 
                         * recommended offset and input range instead of the provided one.
                         */
                        field.curve.offset = defaultCurve.offset;
                        field.curve.inputRange = defaultCurve.inputRange;
                    }
                    
                    if(colorIndexOffset!=null && field.color != undefined) { // auto offset the actual color (to expand [all] selections)
                        var index;
                        for(index=0; index < GraphConfig.PALETTE.length; index++)
                            {
                                if(GraphConfig.PALETTE[index].color == field.color) break;
                            }
                        field.color = GraphConfig.PALETTE[(index + colorIndexOffset) % GraphConfig.PALETTE.length].color
                    }

                    if (field.color === undefined) {
                        field.color = GraphConfig.PALETTE[colorIndex % GraphConfig.PALETTE.length].color;
                        colorIndex++;
                    }
                    
                    if (field.smoothing === undefined) {
                        field.smoothing = GraphConfig.getDefaultSmoothingForField(flightLog, field.name);
                    }
                    
                    return field;
                };
                
                if ((matches = field.name.match(/^(.+)\[all\]$/))) {
                    var 
                        nameRoot = matches[1],
                        nameRegex = new RegExp("^" + nameRoot + "\[[0-9]+\]$"),
                        colorIndexOffset = 0;
                    
                    for (var k = 0; k < logFieldNames.length; k++) {
                        if (logFieldNames[k].match(nameRegex)) {
                            // add special condition for rcCommands and debug as each of the fields requires a different scaling.
                            let forceNewCurve = (nameRoot=='rcCommand') || (nameRoot=='rcCommands') || (nameRoot=='debug');
                            newGraph.fields.push(adaptField($.extend({}, field, {curve: $.extend({}, field.curve), name: logFieldNames[k], friendlyName: FlightLogFieldPresenter.fieldNameToFriendly(logFieldNames[k], flightLog.getSysConfig().debug_mode)}), colorIndexOffset, forceNewCurve));
                            colorIndexOffset++;
                        }
                    }
                } else {
                    // Don't add fields if they don't exist in this log
                    if (flightLog.getMainFieldIndexByName(field.name) !== undefined) {
                        newGraph.fields.push(adaptField($.extend({}, field, {curve: $.extend({}, field.curve), friendlyName: FlightLogFieldPresenter.fieldNameToFriendly(field.name, flightLog.getSysConfig().debug_mode)})));
                    }
                }
            }
            
            newGraphs.push(newGraph);
        }
        
        this.setGraphs(newGraphs);
    };
    
    this.addListener = function(listener) {
        listeners.push(listener);
    };
}

GraphConfig.PALETTE = [
    {color: "#fb8072", name: "Red" },
    {color: "#8dd3c7", name: "Cyan" },
    {color: "#ffffb3", name: "Yellow" },
    {color: "#bebada", name: "Purple" },
    {color: "#80b1d3", name: "Blue" },
    {color: "#fdb462", name: "Orange" },
    {color: "#b3de69", name: "Green" },
    {color: "#fccde5", name: "Pink" },
    {color: "#d9d9d9", name: "Grey" },
    {color: "#bc80bd", name: "Dark Purple" },
    {color: "#ccebc5", name: "Light Green" },
    {color: "#ffed6f", name: "Dark Yellow" }
];


GraphConfig.load = function(config) {
    // Upgrade legacy configs to suit the newer standard by translating field names
    if (config) {
        for (var i = 0; i < config.length; i++) {
            var graph = config[i];
            
            for (var j = 0; j < graph.fields.length; j++) {
                var 
                    field = graph.fields[j],
                    matches;
                
                if ((matches = field.name.match(/^gyroData(.+)$/))) {
                    field.name = "gyroADC" + matches[1];
                }
            }
        }
    } else {
        config = false;
    }
    
    return config;
};

(function() {
    GraphConfig.getDefaultSmoothingForField = function(flightLog, fieldName) {
        try{
            if (fieldName.match(/^motor\[/)) {
                return 5000;
            } else if (fieldName.match(/^servo\[/)) {
                return 5000;
            } else if (fieldName.match(/^gyroADC.*\[/)) {
                return 3000;
            } else if (fieldName.match(/^accSmooth\[/)) {
                return 3000;
            } else if (fieldName.match(/^axis.+\[/)) {
                return 3000;
            } else {
                return 0;
            }
        } catch (e) { return 0;}
    };
    

    GraphConfig.getDefaultCurveForField = function(flightLog, fieldName) {
        var
            sysConfig = flightLog.getSysConfig();

        var maxDegreesSecond = function(scale) {
            switch(sysConfig["rates_type"]){
                case RATES_TYPE.indexOf('ACTUAL'):
                case RATES_TYPE.indexOf('QUICK'):
                    return Math.max(sysConfig["rates"][0] * 10.0 * scale,
                                    sysConfig["rates"][1] * 10.0 * scale,
                                    sysConfig["rates"][2] * 10.0 * scale);
                default:
                    return Math.max(flightLog.rcCommandRawToDegreesPerSecond(500,0) * scale, 
                                    flightLog.rcCommandRawToDegreesPerSecond(500,1) * scale, 
                                    flightLog.rcCommandRawToDegreesPerSecond(500,2) * scale);
            }
        }
        
        var getMinMaxForFields = function(/* fieldName1, fieldName2, ... */) {
            // helper to make a curve scale based on the combined min/max of one or more fields
            var
                stats = flightLog.getStats(),
                min = Number.MAX_VALUE,
                max = Number.MIN_VALUE;
            
            for(var i in arguments) {
                var
                    fieldIndex = flightLog.getMainFieldIndexByName(arguments[i]),
                    fieldStat = fieldIndex !== undefined ? stats.field[fieldIndex] : false;

                if (fieldStat) {
                    min = Math.min(min, fieldStat.min);
                    max = Math.max(max, fieldStat.max);
                }
            }

            if (min != Number.MAX_VALUE && max != Number.MIN_VALUE) {
                return {min:min, max:max};
            }

            return {min:-500, max:500};
        }

        var getCurveForMinMaxFields = function(/* fieldName1, fieldName2, ... */) {
            var mm = getMinMaxForFields.apply(null, arguments);

            return {
                offset: -(mm.max + mm.min) / 2,
                power: 1.0,
                inputRange: Math.max((mm.max - mm.min) / 2, 1.0),
                outputRange: 1.0
            };
        }

        var getCurveForMinMaxFieldsZeroOffset = function(/* fieldName1, fieldName2, ... */) {
            var mm = getMinMaxForFields.apply(null, arguments);

            return {
                offset: 0,
                power: 1.0,
                inputRange: Math.max(Math.max(Math.abs(mm.max), Math.abs(mm.min)), 1.0),
                outputRange: 1.0
            };
        }

        const gyroScaleMargin = 1.20; // Give a 20% margin for gyro graphs

        try {
            if (fieldName.match(/^motor\[/)) {
                return {
                    offset: -(sysConfig.motorOutput[1] + sysConfig.motorOutput[0]) / 2,
                    power: 1.0,
                    inputRange: (sysConfig.motorOutput[1] - sysConfig.motorOutput[0]) / 2,
                    outputRange: 1.0
                };
            } else if (fieldName.match(/^servo\[/)) {
                return {
                    offset: -1500,
                    power: 1.0,
                    inputRange: 500,
                    outputRange: 1.0
                };
            } else if (fieldName.match(/^accSmooth\[/)) {
                return {
                    offset: 0,
                    power: 0.5,
                    inputRange: sysConfig.acc_1G * 16.0, /* Reasonable typical maximum for acc */
                    outputRange: 1.0
                };
            } else if (fieldName == "rcCommands[3]") { // Throttle scaled
                return {
                    offset: -50,
                    power: 1.0, /* Make this 1.0 to scale linearly */
                    inputRange: 50,
                    outputRange: 1.0
                };
            } else if (fieldName.match(/^axisError\[/)  ||     // Gyro, Gyro Scaled, RC Command Scaled and axisError
                       fieldName.match(/^rcCommands\[/) ||     // These use the same scaling as they are in the
                       fieldName.match(/^gyroADC\[/)) {        // same range.
                return {
                    offset: 0,
                    power: 0.25, /* Make this 1.0 to scale linearly */
                    inputRange: maxDegreesSecond(gyroScaleMargin), // Maximum grad/s + 20% 
                    outputRange: 1.0
                };
            } else if (fieldName.match(/^axis.+\[/)) {
                return {
                    offset: 0,
                    power: 0.3,
                    inputRange: 1000, // Was 400 ?
                    outputRange: 1.0
                };
            } else if (fieldName == "rcCommand[3]") { // Throttle
                return {
                    offset: -1500,
                    power: 1.0,
                    inputRange: 500, 
                    outputRange: 1.0
                };
            } else if (fieldName.match(/^rcCommand\[/)) {
                return {
                    offset: 0,
                    power: 0.25,
                    inputRange: 500 * gyroScaleMargin, // +20% to let compare in the same scale with the rccommands 
                    outputRange: 1.0
                };
            } else if (fieldName == "heading[2]") {
                return {
                    offset: -Math.PI,
                    power: 1.0,
                    inputRange: Math.PI,
                    outputRange: 1.0
                };
            } else if (fieldName.match(/^heading\[/)) {
                return {
                    offset: 0,
                    power: 1.0,
                    inputRange: Math.PI,
                    outputRange: 1.0
                };
            } else if (fieldName.match(/^sonar.*/)) {
                return {
                    offset: -200,
                    power: 1.0,
                    inputRange: 200,
                    outputRange: 1.0
                };
            } else if (fieldName.match(/^rssi.*/)) {
                return {
                    offset: -512,
                    power: 1.0,
                    inputRange: 512,
                    outputRange: 1.0
                };
            } else if (fieldName.match(/^debug.*/) && sysConfig.debug_mode!=null) {

                var debugModeName = DEBUG_MODE[sysConfig.debug_mode]; 
                switch (debugModeName) {
                    case 'CYCLETIME':
                        switch (fieldName) {
                            case 'debug[1]': //CPU Load
                                return {
                                    offset: -50,
                                    power: 1,
                                    inputRange: 50,
                                    outputRange: 1.0
                                };                            
                            default:
                                return {
                                    offset: -1000,    // zero offset
                                    power: 1.0,
                                    inputRange: 1000, //  0-2000uS
                                    outputRange: 1.0
                                };
                        }
                    case 'PIDLOOP': 
                            return {
                                offset: -250,    // zero offset
                                power: 1.0,
                                inputRange: 250, //  0-500uS
                                outputRange: 1.0
                            };       
                    case 'GYRO':
                    case 'GYRO_FILTERED':
                    case 'GYRO_SCALED':
                    case 'DUAL_GYRO':
                    case 'DUAL_GYRO_COMBINED':
                    case 'DUAL_GYRO_DIFF':
                    case 'DUAL_GYRO_RAW':
                    case 'NOTCH':
                    case 'AC_CORRECTION':
                    case 'AC_ERROR':
                        return {
                            offset: 0,
                            power: 0.25,
                            inputRange: maxDegreesSecond(gyroScaleMargin), // Maximum grad/s + 20%
                            outputRange: 1.0
                        };
                    case 'ACCELEROMETER':
                        return {
                            offset: 0,
                            power: 0.5,
                            inputRange: sysConfig.acc_1G * 16.0, /* Reasonable typical maximum for acc */
                            outputRange: 1.0
                        };
                    case 'MIXER':
                        return {
                            offset: -(sysConfig.motorOutput[1] + sysConfig.motorOutput[0]) / 2,
                            power: 1.0,
                            inputRange: (sysConfig.motorOutput[1] - sysConfig.motorOutput[0]) / 2,
                            outputRange: 1.0
                        };
                    case 'BATTERY':
                        switch (fieldName) {
                            case 'debug[0]': //Raw Value (0-4095)
                                return {
                                    offset: -2048,
                                    power: 1,
                                    inputRange: 2048,
                                    outputRange: 1.0
                                };                            
                            default:
                                return {
                                    offset: -130,
                                    power: 1.0,
                                    inputRange: 130, // 0-26.0v
                                    outputRange: 1.0
                                };
                        }
                    case 'RC_INTERPOLATION':
                        switch (fieldName) {
                            case 'debug[0]': // Roll RC Command
                            case 'debug[3]': // refresh period
                                return getCurveForMinMaxFieldsZeroOffset(fieldName);
                        }
                        break;
                    case 'RC_SMOOTHING':
                        switch (fieldName) {
                            case 'debug[0]': // raw RC command
                                return {
                                    offset: 0,
                                    power: 0.25,
                                    inputRange: 500 * gyroScaleMargin, // +20% to let compare in the same scale with the rccommands 
                                    outputRange: 1.0
                                };
                            case 'debug[1]': // raw RC command derivative
                            case 'debug[2]': // smoothed RC command derivative
                                return getCurveForMinMaxFieldsZeroOffset('debug[1]', 'debug[2]');
                        }
                        break;
                    case 'RC_SMOOTHING_RATE':
                        switch (fieldName) {
                            case 'debug[0]': // current frame rate [us]
                            case 'debug[2]': // average frame rate [us]
                                return getCurveForMinMaxFields('debug[0]', 'debug[2]');
                        }
                        break;
                    case 'ANGLERATE':
                        return {
                            offset: 0,
                            power: 0.25, /* Make this 1.0 to scale linearly */
                            inputRange: maxDegreesSecond(gyroScaleMargin), // Maximum grad/s + 20%
                            outputRange: 1.0
                        };
                    case 'FFT':
                        switch (fieldName) {
                            case 'debug[0]': // gyro scaled [for selected axis]
                            case 'debug[1]': // pre-dyn notch gyro [for selected axis]
                            case 'debug[2]': // pre-dyn notch gyro FFT downsampled [roll]
                                return {
                                    offset: 0,
                                    power: 0.25,
                                    inputRange: maxDegreesSecond(gyroScaleMargin), // Maximum grad/s + 20%
                                    outputRange: 1.0
                                };
                        }
                        break;
                    case 'FFT_FREQ':
                        switch (fieldName) {
                            case 'debug[0]': // roll center freq
                            case 'debug[1]': // pitch center freq
                                return getCurveForMinMaxFields('debug[0]', 'debug[1]');
                            case 'debug[2]': // pre-dyn notch gyro [for selected axis]
                            case 'debug[3]': // raw gyro [for selected axis]
                                return {
                                    offset: 0,
                                    power: 0.25,
                                    inputRange: maxDegreesSecond(gyroScaleMargin), // Maximum grad/s + 20%
                                    outputRange: 1.0
                                };
                        }
                        break;
                    case 'DYN_LPF':
                        switch (fieldName) {
                            case 'debug[1]': // Notch center
                            case 'debug[2]': // Lowpass Cutoff
                                return getCurveForMinMaxFields('debug[1]', 'debug[2]');
                            case 'debug[0]': // gyro scaled [for selected axis]
                            case 'debug[3]': // pre-dyn notch gyro [for selected axis]
                                return {
                                    offset: 0,
                                    power: 0.25,
                                    inputRange: maxDegreesSecond(gyroScaleMargin), // Maximum grad/s + 20%
                                    outputRange: 1.0
                                };
                        }
                        break;
                    case 'FFT_TIME':
                        return {
                            offset: 0,
                            power: 1.0,
                            inputRange: 100,
                            outputRange: 1.0
                        };   
                    case 'ESC_SENSOR_RPM':
                    case 'DSHOT_RPM_TELEMETRY':
                    case 'RPM_FILTER':
                        return getCurveForMinMaxFields('debug[0]', 'debug[1]', 'debug[2]', 'debug[3]');
                    case 'D_MIN':
                        switch (fieldName) {
                            case 'debug[0]': // roll gyro factor
                            case 'debug[1]': // roll setpoint Factor
                                return getCurveForMinMaxFields('debug[0]', 'debug[1]');
                            case 'debug[2]': // roll actual D
                            case 'debug[3]': // pitch actual D
                                return getCurveForMinMaxFields('debug[2]', 'debug[3]');
                        }
                        break;
                    case 'ITERM_RELAX':
                        switch (fieldName) {
                            case 'debug[2]': // roll I relaxed error
                            case 'debug[3]': // roll absolute control axis error
                                return getCurveForMinMaxFieldsZeroOffset(fieldName);
                        }
                        break;
                }
            }
            // if not found above then
            // Scale and center the field based on the whole-log observed ranges for that field
            return getCurveForMinMaxFields(fieldName);
        } catch(e) {
            return {
                offset: 0,
                power: 1.0,
                inputRange: 500,
                outputRange: 1.0
            };
        }
    };
    
    /**
     * Get an array of suggested graph configurations will be usable for the fields available in the given flightlog.
     * 
     * Supply an array of strings `graphNames` to only fetch the graph with the given names.
     */
    GraphConfig.getExampleGraphConfigs = function(flightLog, graphNames) {
        var
            result = [],
            i, j;

        const disabledFields=flightLog.getSysConfig().fields_disabled_mask;
        let EXAMPLE_GRAPHS = [];

        if (!(disabledFields & 1<<10)) {
            EXAMPLE_GRAPHS.push({label: "Motors",fields: ["motor[all]", "servo[5]"]});
        }
        if (!(disabledFields & 1<<7)) {
            EXAMPLE_GRAPHS.push({label: "Gyros",fields: ["gyroADC[all]"]});
        }
        if (!(disabledFields & 1<<2)) {
            EXAMPLE_GRAPHS.push({label: "RC Rates",fields: ["rcCommands[all]"]});
        }
        if (!(disabledFields & 1<<1)) {
            EXAMPLE_GRAPHS.push({label: "RC Command",fields: ["rcCommand[all]"]});
        }
        if (!(disabledFields & 1<<0)) {
            EXAMPLE_GRAPHS.push({label: "PIDs",fields: ["axisSum[all]"]});
        }
        if (!((disabledFields & 1<<7) || (disabledFields & 1<<0))) {
            EXAMPLE_GRAPHS.push({label: "PID Error",fields: ["axisError[all]"]},
                                {label: "Gyro + PID roll",fields: ["axisP[0]", "axisI[0]", "axisD[0]", "axisF[0]", "gyroADC[0]"]},
                                {label: "Gyro + PID pitch",fields: ["axisP[1]", "axisI[1]", "axisD[1]", "axisF[1]", "gyroADC[1]"]},
                                {label: "Gyro + PID yaw",fields: ["axisP[2]", "axisI[2]", "axisD[2]", "axisF[2]", "gyroADC[2]"]});
        }
        if (!(disabledFields & 1<<8)) {
            EXAMPLE_GRAPHS.push({label: "Accelerometers",fields: ["accSmooth[all]"]});
        }
        if (!(disabledFields & 1<<9)) {
            EXAMPLE_GRAPHS.push({label: "Debug",fields: ["debug[all]"]});
        }

        for (i = 0; i < EXAMPLE_GRAPHS.length; i++) {
            var
                srcGraph = EXAMPLE_GRAPHS[i],
                destGraph = {
                    label: srcGraph.label, 
                    fields: [],
                    height: srcGraph.height || 1
                },
                found;
            
            if (graphNames !== undefined) {
                found = false;
                for (j = 0; j < graphNames.length; j++) {
                    if (srcGraph.label == graphNames[j]) {
                        found = true;
                        break;
                    }
                }
                
                if (!found) {
                    continue;
                }
            }
            
            for (j = 0; j < srcGraph.fields.length; j++) {
                var 
                    srcFieldName = srcGraph.fields[j],
                    destField = {
                        name: srcFieldName
                    };
                
                destGraph.fields.push(destField);
            }
            
            result.push(destGraph);
        }
        
        return result;
    };
})();

"use strict";

function makeReadOnly(x) {
    // Make read-only if browser supports it:
    if (Object.freeze) {
        return Object.freeze(x);
    }
    
    // Otherwise a no-op
    return x;
}

var 
    FlightLogEvent = makeReadOnly({
        SYNC_BEEP: 0,
        
        AUTOTUNE_CYCLE_START: 10,
        AUTOTUNE_CYCLE_RESULT: 11,
        AUTOTUNE_TARGETS: 12,
        INFLIGHT_ADJUSTMENT: 13,
        LOGGING_RESUME: 14,
        
        GTUNE_CYCLE_RESULT: 20,
        FLIGHT_MODE: 30, // New Event type
        
        CUSTOM : 250, // Virtual Event Code - Never part of Log File.
        LOG_END: 255
    }),

    // Add a general axis index.
    AXIS = makeReadOnly({
            ROLL:  0,
            PITCH: 1,
            YAW:   2
    }),

        
    FLIGHT_LOG_FLIGHT_MODE_NAME = makeReadOnly([
            'ARM',
            'ANGLE',
            'HORIZON',
            'BARO',
            'MAG',
            'HEADFREE',
            'HEADADJ',
            'CAMSTAB',
            'CAMTRIG',
            'GPSHOME',
            'GPSHOLD',
            'PASSTHRU',
            'BEEPER',
            'LEDMAX',
            'LEDLOW',
            'LLIGHTS',
            'CALIB',
            'GOV',
            'OSD',
            'TELEMETRY',
            'GTUNE',
            'SONAR',
            'SERVO1',
            'SERVO2',
            'SERVO3',
            'BLACKBOX',
            'FAILSAFE',
            'AIRMODE',
            'SUPEREXPO',
            '3DDISABLESWITCH',
            'CHECKBOX_ITEM_COUNT'
    ]),

    FLIGHT_LOG_FLIGHT_STATE_NAME = makeReadOnly([
        "GPS_FIX_HOME",
        "GPS_FIX",
        "CALIBRATE_MAG",
        "SMALL_ANGLE",
        "FIXED_WING"
    ]),
    
    FLIGHT_LOG_FAILSAFE_PHASE_NAME = makeReadOnly([
        "IDLE",
        "RX_LOSS_DETECTED",
        "LANDING",
        "LANDED"
    ]);

var 
    FlightLogEvent = {
        SYNC_BEEP: 0,
        
        AUTOTUNE_CYCLE_START: 10,
        AUTOTUNE_CYCLE_RESULT: 11,
        AUTOTUNE_TARGETS: 12,
        
        LOG_END: 255
    };

// Make read-only if browser supports it:
if (Object.freeze) {
    FlightLogEvent = Object.freeze(FlightLogEvent);
}
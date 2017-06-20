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
        TWITCH_TEST: 40, // Feature for latency testing
        
        CUSTOM : 250, // Virtual Event Code - Never part of Log File.
        CUSTOM_BLANK : 251, // Virtual Event Code - Never part of Log File. - No line shown
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
            'VARIO',
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
            'VTX',
            'CHECKBOX_ITEM_COUNT'
    ]),

    FLIGHT_LOG_FEATURES = makeReadOnly([
            'RX_PPM',
            'VBAT',
            'INFLIGHT_ACC_CAL',
            'RX_SERIAL',
            'MOTOR_STOP',
            'SERVO_TILT',
            'SOFTSERIAL',
            'GPS',
            'FAILSAFE',
            'SONAR',
            'TELEMETRY',
            'CURRENT_METER',
            '3D',
            'RX_PARALLEL_PWM',
            'RX_MSP',
            'RSSI_ADC',
            'LED_STRIP',
            'DISPLAY',
            'ONESHOT125',
            'BLACKBOX',
            'CHANNEL_FORWARDING',
            'TRANSPONDER',
            'AIRMODE',
            'SUPEREXPO_RATES'
    ]),

    PID_CONTROLLER_TYPE = ([
            'UNUSED',
            'MWREWRITE',
            'LUXFLOAT'
    ]),

    PID_DELTA_TYPE = makeReadOnly([
            'ERROR',
            'MEASUREMENT'
    ]),

    OFF_ON = makeReadOnly([
            "OFF",
            "ON"
    ]),

    FAST_PROTOCOL = makeReadOnly([
            "PWM",
            "ONESHOT125",
            "ONESHOT42", 
            "MULTISHOT",
            "BRUSHED",
            "DSHOT150",
            "DSHOT300",
            "DSHOT600",
            "DSHOT1200"
    ]),

    MOTOR_SYNC = makeReadOnly([
            "SYNCED",
            "UNSYNCED" 
    ]),

    SERIALRX_PROVIDER = makeReadOnly([
			"SPEK1024",
			"SPEK2048",
			"SBUS",
			"SUMD",
			"SUMH",
			"XB-B",
			"XB-B-RJ01",
			"IBUS",
			"JETIEXBUS"
    ]),

    RC_INTERPOLATION = makeReadOnly([
            "OFF",
            "DEFAULT",
            "AUTO",
            "MANUAL"             
    ]),

    FILTER_TYPE = makeReadOnly([
            "PT1",
            "BIQUAD",
    ]),

    DEBUG_MODE = makeReadOnly([
			"NONE",
			"CYCLETIME",
			"BATTERY",
			"GYRO",
			"ACCELEROMETER",
			"MIXER",
			"AIRMODE",
			"PIDLOOP",
			"NOTCH",
			"RC_INTERPOLATION",
			"VELOCITY",
			"DTERM_FILTER",
            "ANGLERATE",
            "ESC_SENSOR",
            "SCHEDULER",
            "STACK",
            "DEBUG_ESC_SENSOR_RPM",
            "DEBUG_ESC_SENSOR_TMP",
            "DEBUG_ALTITUDE",
            "DEBUG_FFT",
            "DEBUG_FFT_TIME",
            "DEBUG_FFT_FREQ"
    ]),

    SUPER_EXPO_YAW = makeReadOnly([
            "OFF",
            "ON",
            "ALWAYS"
    ]),

    DTERM_DIFFERENTIATOR = makeReadOnly([
            "STANDARD",
            "ENHANCED"
    ]),

    GYRO_LPF = makeReadOnly([
            "OFF",
            "188HZ",
            "98HZ",
            "42HZ",
            "20HZ",
            "10HZ",
            "5HZ",
            "EXPERIMENTAL"
    ]),

    ACC_HARDWARE = makeReadOnly([
	        "AUTO",
	        "NONE",
	        "ADXL345",
	        "MPU6050",
	        "MMA8452",
	        "BMA280",
	        "LSM303DLHC",
	        "MPU6000",
	        "MPU6500",
	        "FAKE"
    ]),

    BARO_HARDWARE = makeReadOnly([
            "AUTO",
            "NONE",
            "BMP085",
            "MS5611",
            "BMP280"
    ]),

    MAG_HARDWARE = makeReadOnly([
            "AUTO",
            "NONE",
            "HMC5883",
            "AK8975",
            "AK8963"
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

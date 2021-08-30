"use strict";

function makeReadOnly(x) {
    // Make read-only if browser supports it:
    if (Object.freeze) {
        return Object.freeze(x);
    }
    
    // Otherwise a no-op
    return x;
}

// Some constants used at different places
const MAX_MOTOR_NUMBER = 8;
const DSHOT_MIN_VALUE = 48;
const DSHOT_MAX_VALUE = 2047;
const DSHOT_RANGE = DSHOT_MAX_VALUE - DSHOT_MIN_VALUE;
const ANALOG_MIN_VALUE = 1000;

// Fields definitions for lists
var 
    FlightLogEvent = makeReadOnly({
        SYNC_BEEP: 0,
        
        AUTOTUNE_CYCLE_START: 10,
        AUTOTUNE_CYCLE_RESULT: 11,
        AUTOTUNE_TARGETS: 12,
        INFLIGHT_ADJUSTMENT: 13,
        LOGGING_RESUME: 14,
        DISARM: 15,
        
        GTUNE_CYCLE_RESULT: 20,
        FLIGHT_MODE: 30,
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

    FLIGHT_LOG_FLIGHT_MODE_NAME = [],
    
    FLIGHT_LOG_FLIGHT_MODE_NAME_PRE_3_3 = makeReadOnly([
            'ARM',
            'ANGLE',
            'HORIZON',
            'BARO',
            'ANTIGRAVITY',
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
            '3DDISABLE',
            'FPVANGLEMIX',
            'BLACKBOXERASE',
            'CAMERA1',
            'CAMERA2',
            'CAMERA3',
            'FLIPOVERAFTERCRASH',
            'PREARM',
    ]),

    FLIGHT_LOG_FLIGHT_MODE_NAME_POST_3_3 = makeReadOnly([
        'ARM',
        'ANGLE',
        'HORIZON',
        'MAG',
        'BARO',
        'GPSHOME',
        'GPSHOLD',
        'HEADFREE',
        'PASSTHRU',
        'RANGEFINDER',
        'FAILSAFE',
        'GPSRESCUE',
        'ANTIGRAVITY',
        'HEADADJ',
        'CAMSTAB',
        'CAMTRIG',
        'BEEPER',
        'LEDMAX',
        'LEDLOW',
        'LLIGHTS',
        'CALIB',
        'GOV',
        'OSD',
        'TELEMETRY',
        'GTUNE',
        'SERVO1',
        'SERVO2',
        'SERVO3',
        'BLACKBOX',
        'AIRMODE',
        '3D',
        'FPVANGLEMIX',
        'BLACKBOXERASE',
        'CAMERA1',
        'CAMERA2',
        'CAMERA3',
        'FLIPOVERAFTERCRASH',
        'PREARM',
        'BEEPGPSCOUNT',
        'VTXPITMODE',
        'USER1',
        'USER2',
        'USER3',
        'USER4',
        'PIDAUDIO',
        'ACROTRAINER',
        'VTXCONTROLDISABLE',
        'LAUNCHCONTROL',
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
            "DSHOT1200",
            "PROSHOT1000",
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
			"JETIEXBUS",
            "CRSF",
            "SRXL",
            "CUSTOM",
            "FPORT",
    ]),

    ANTI_GRAVITY_MODE = makeReadOnly([
        "SMOOTH",
        "STEP"
    ]),

    RC_SMOOTHING_TYPE = makeReadOnly([
        "INTERPOLATION", 
        "FILTER"
    ]),

    RC_SMOOTHING_INPUT_TYPE = makeReadOnly([
        "PT1", 
        "BIQUAD"
    ]),

    RC_SMOOTHING_DERIVATIVE_TYPE = makeReadOnly([
        "PT1", 
        "BIQUAD"
    ]),

    RC_SMOOTHING_MODE = makeReadOnly([
        "OFF", 
        "ON"
    ]),

    RC_SMOOTHING_DEBUG_AXIS = makeReadOnly([
        "ROLL", 
        "PITCH", 
        "YAW", 
        "THROTTLE"
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
        "PT2",
        "PT3",
    ]),

    DEBUG_MODE = [],

    DEBUG_MODE_COMPLETE = makeReadOnly([
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
            "ESC_SENSOR_RPM",
            "ESC_SENSOR_TMP",
            "ALTITUDE",
            "FFT",
            "FFT_TIME",
            "FFT_FREQ",
            "RX_FRSKY_SPI",
            "GYRO_RAW",
            "DUAL_GYRO",
            "DUAL_GYRO_RAW",
            "DUAL_GYRO_COMBINED",
            "DUAL_GYRO_DIFF",
            "MAX7456_SIGNAL",
            "MAX7456_SPICLOCK",
            "SBUS",
            "FPORT",
            "RANGEFINDER",
            "RANGEFINDER_QUALITY",
            "LIDAR_TF",
            "ADC_INTERNAL",
            "RUNAWAY_TAKEOFF",
            "SDIO",
            "CURRENT_SENSOR",
            "USB",
            "SMARTAUDIO",
            "RTH",
            "ITERM_RELAX",
            "ACRO_TRAINER",
            "RC_SMOOTHING",
            "RX_SIGNAL_LOSS",
            "RC_SMOOTHING_RATE",
            "ANTI_GRAVITY",
            "DYN_LPF",
            "RX_SPECTRUM_SPI",
            "DSHOT_RPM_TELEMETRY",
            "RPM_FILTER",
            "D_MIN",
            "AC_CORRECTION",
            "AC_ERROR",
            "DUAL_GYRO_SCALED",
            "DSHOT_RPM_ERRORS",
            "CRSF_LINK_STATISTICS_UPLINK",
            "CRSF_LINK_STATISTICS_PWR",
            "CRSF_LINK_STATISTICS_DOWN",
            "BARO",
            "GPS_RESCUE_THROTTLE_PID",
            "DYN_IDLE",
            "FF_LIMIT",
            "FF_INTERPOLATED",
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

    GYRO_HARDWARE_LPF = makeReadOnly([
            "NORMAL",
            "EXPERIMENTAL",
            "1KHZ_SAMPLING"
    ]),

    GYRO_32KHZ_HARDWARE_LPF = makeReadOnly([
            "NORMAL",
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
    ]),

    FFT_CALC_STEPS = makeReadOnly([
        "ARM_CFFT_F32",
        "BITREVERSAL",
        "STAGE_RFFT_F32",
        "ARM_CMPLX_MAG_F32",
        "CALC_FREQUENCIES",
        "UPDATE_FILTERS",
        "HANNING"
    ]),

    ITERM_RELAX = makeReadOnly([
        "OFF",
        "RP",
        "RPY", 
        "RP_INC",
        "RPY_INC", 
    ]),

    ITERM_RELAX_TYPE = makeReadOnly([
        "GYRO",
        "SETPOINT",
    ]),

    DYN_NOTCH_RANGE = makeReadOnly([
        "HIGH",
        "MEDIUM",
        "LOW",
        "AUTO",
    ]),

    FLIGHT_LOG_DISARM_REASON = makeReadOnly([
        "ARMING_DISABLED",
        "FAILSAFE",
        "THROTTLE_TIMEOUT",
        "STICKS",
        "SWITCH",
        "CRASH_PROTECTION",
        "RUNAWAY_TAKEOFF",
        "GPS_RESCUE",
        "SERIAL_IO",
    ]),

    RATES_TYPE = makeReadOnly([
        "BETAFLIGHT",
        "RACEFLIGHT",
        "KISS",
        "ACTUAL",
        "QUICK",
    ]),

    GYRO_TO_USE = makeReadOnly([
        "FIRST",
        "SECOND",
        "BOTH",
    ]),

    FF_AVERAGING = makeReadOnly([
        "OFF",
        "2_POINT",
        "3_POINT",
        "4_POINT",
    ]);

function adjustFieldDefsList(firmwareType, firmwareVersion) {
    if((firmwareType == FIRMWARE_TYPE_BETAFLIGHT) && semver.gte(firmwareVersion, '3.3.0')) {

        // Debug names
        DEBUG_MODE = DEBUG_MODE_COMPLETE.slice(0);
        DEBUG_MODE.splice(DEBUG_MODE.indexOf('MIXER'),        1);
        DEBUG_MODE.splice(DEBUG_MODE.indexOf('AIRMODE'),      1);
        DEBUG_MODE.splice(DEBUG_MODE.indexOf('VELOCITY'),     1);
        DEBUG_MODE.splice(DEBUG_MODE.indexOf('DTERM_FILTER'), 1);
        
        if(semver.gte(firmwareVersion, '3.4.0')) {
            DEBUG_MODE.splice(DEBUG_MODE.indexOf('GYRO'),     1, 'GYRO_FILTERED');
            DEBUG_MODE.splice(DEBUG_MODE.indexOf('NOTCH'),    1, 'GYRO_SCALED');
        }
        if(semver.gte(firmwareVersion, '4.0.0')) {
            DEBUG_MODE.splice(DEBUG_MODE.indexOf('GYRO_RAW'), 0, 'RX_SFHSS_SPI');
        }
        if(semver.gte(firmwareVersion, '4.1.0')) {
            DEBUG_MODE.splice(DEBUG_MODE.indexOf('DUAL_GYRO'),          1);
            DEBUG_MODE.splice(DEBUG_MODE.indexOf('DUAL_GYRO_COMBINED'), 1);
        }
        DEBUG_MODE = makeReadOnly(DEBUG_MODE);

        // Flight mode names
        FLIGHT_LOG_FLIGHT_MODE_NAME = FLIGHT_LOG_FLIGHT_MODE_NAME_POST_3_3.slice(0);
        if (semver.lt(firmwareVersion, '3.4.0')) {
            FLIGHT_LOG_FLIGHT_MODE_NAME.splice(FLIGHT_LOG_FLIGHT_MODE_NAME.indexOf('GPSRESCUE'), 1);
        }
        if (semver.gte(firmwareVersion, '3.5.0')) {
            FLIGHT_LOG_FLIGHT_MODE_NAME.splice(FLIGHT_LOG_FLIGHT_MODE_NAME.indexOf('RANGEFINDER'), 1);
            FLIGHT_LOG_FLIGHT_MODE_NAME.splice(FLIGHT_LOG_FLIGHT_MODE_NAME.indexOf('CAMTRIG'),     1);
            FLIGHT_LOG_FLIGHT_MODE_NAME.splice(FLIGHT_LOG_FLIGHT_MODE_NAME.indexOf('LEDMAX'),      1);
            FLIGHT_LOG_FLIGHT_MODE_NAME.splice(FLIGHT_LOG_FLIGHT_MODE_NAME.indexOf('LLIGHTS'),     1);
            FLIGHT_LOG_FLIGHT_MODE_NAME.splice(FLIGHT_LOG_FLIGHT_MODE_NAME.indexOf('GOV'),         1);
            FLIGHT_LOG_FLIGHT_MODE_NAME.splice(FLIGHT_LOG_FLIGHT_MODE_NAME.indexOf('GTUNE'),       1);
        }
        if (semver.gte(firmwareVersion, '4.0.0')) {
            FLIGHT_LOG_FLIGHT_MODE_NAME.splice(FLIGHT_LOG_FLIGHT_MODE_NAME.indexOf('BARO'),    1);
            FLIGHT_LOG_FLIGHT_MODE_NAME.splice(FLIGHT_LOG_FLIGHT_MODE_NAME.indexOf('GPSHOME'), 1);
            FLIGHT_LOG_FLIGHT_MODE_NAME.splice(FLIGHT_LOG_FLIGHT_MODE_NAME.indexOf('GPSHOLD'), 1);
        }
        FLIGHT_LOG_FLIGHT_MODE_NAME = makeReadOnly(FLIGHT_LOG_FLIGHT_MODE_NAME);

    } else {
        DEBUG_MODE = DEBUG_MODE_COMPLETE;

        FLIGHT_LOG_FLIGHT_MODE_NAME = FLIGHT_LOG_FLIGHT_MODE_NAME_PRE_3_3.slice(0);

        if((firmwareType == FIRMWARE_TYPE_BETAFLIGHT) && semver.lte(firmwareVersion, '3.1.6')) {
            FLIGHT_LOG_FLIGHT_MODE_NAME.splice(FLIGHT_LOG_FLIGHT_MODE_NAME.indexOf('ANTIGRAVITY'), 1);
        }

        FLIGHT_LOG_FLIGHT_MODE_NAME = makeReadOnly(FLIGHT_LOG_FLIGHT_MODE_NAME);
    }
}

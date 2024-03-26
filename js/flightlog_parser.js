import { FlightLogFieldPresenter } from "./flightlog_fields_presenter";
import { adjustFieldDefsList } from "./flightlog_fielddefs";

globalThis.FIRMWARE_TYPE_UNKNOWN = 0;
globalThis.FIRMWARE_TYPE_BASEFLIGHT = 1;
globalThis.FIRMWARE_TYPE_CLEANFLIGHT = 2;
globalThis.FIRMWARE_TYPE_BETAFLIGHT = 3;
globalThis.FIRMWARE_TYPE_INAV = 4;

export function FlightLogParser(logData) {
    //Private constants:
    var
        FLIGHT_LOG_MAX_FIELDS = 128,
        FLIGHT_LOG_MAX_FRAME_LENGTH = 256,

        //Assume that even in the most woeful logging situation, we won't miss 10 seconds of frames
        MAXIMUM_TIME_JUMP_BETWEEN_FRAMES = (10 * 1000000),

        //Likewise for iteration count
        MAXIMUM_ITERATION_JUMP_BETWEEN_FRAMES = (500 * 10),

        // Flight log field predictors:

        //No prediction:
        FLIGHT_LOG_FIELD_PREDICTOR_0              = 0,

        //Predict that the field is the same as last frame:
        FLIGHT_LOG_FIELD_PREDICTOR_PREVIOUS       = 1,

        //Predict that the slope between this field and the previous item is the same as that between the past two history items:
        FLIGHT_LOG_FIELD_PREDICTOR_STRAIGHT_LINE  = 2,

        //Predict that this field is the same as the average of the last two history items:
        FLIGHT_LOG_FIELD_PREDICTOR_AVERAGE_2      = 3,

        //Predict that this field is minthrottle
        FLIGHT_LOG_FIELD_PREDICTOR_MINTHROTTLE    = 4,

        //Predict that this field is the same as motor 0
        FLIGHT_LOG_FIELD_PREDICTOR_MOTOR_0        = 5,

        //This field always increments
        FLIGHT_LOG_FIELD_PREDICTOR_INC            = 6,

        //Predict this GPS co-ordinate is the GPS home co-ordinate (or no prediction if that coordinate is not set)
        FLIGHT_LOG_FIELD_PREDICTOR_HOME_COORD     = 7,

        //Predict 1500
        FLIGHT_LOG_FIELD_PREDICTOR_1500           = 8,

        //Predict vbatref, the reference ADC level stored in the header
        FLIGHT_LOG_FIELD_PREDICTOR_VBATREF        = 9,

        //Predict the last time value written in the main stream
        FLIGHT_LOG_FIELD_PREDICTOR_LAST_MAIN_FRAME_TIME = 10,

        //Predict that this field is minthrottle
        FLIGHT_LOG_FIELD_PREDICTOR_MINMOTOR       = 11,

        //Home coord predictors appear in pairs (two copies of FLIGHT_LOG_FIELD_PREDICTOR_HOME_COORD). Rewrite the second
        //one we see to this to make parsing easier
        FLIGHT_LOG_FIELD_PREDICTOR_HOME_COORD_1   = 256,

        FLIGHT_LOG_FIELD_ENCODING_SIGNED_VB       = 0, // Signed variable-byte
        FLIGHT_LOG_FIELD_ENCODING_UNSIGNED_VB     = 1, // Unsigned variable-byte
        FLIGHT_LOG_FIELD_ENCODING_NEG_14BIT       = 3, // Unsigned variable-byte but we negate the value before storing, value is 14 bits
        FLIGHT_LOG_FIELD_ENCODING_TAG8_8SVB       = 6,
        FLIGHT_LOG_FIELD_ENCODING_TAG2_3S32       = 7,
        FLIGHT_LOG_FIELD_ENCODING_TAG8_4S16       = 8,
        FLIGHT_LOG_FIELD_ENCODING_NULL            = 9, // Nothing is written to the file, take value to be zero
        FLIGHT_LOG_FIELD_ENCODING_TAG2_3SVARIABLE = 10,

        FLIGHT_LOG_EVENT_LOG_END = 255,

        EOF = ArrayDataStream.prototype.EOF,
        NEWLINE  = '\n'.charCodeAt(0),

        INFLIGHT_ADJUSTMENT_FUNCTIONS = [
            {
                name: 'None'
            },
            {
                name: 'RC Rate',
                scale: 0.01
            },
            {
                name : 'RC Expo',
                scale: 0.01
            },
            {
                name: 'Throttle Expo',
                scale: 0.01
            },
            {
                name: 'Pitch & Roll Rate',
                scale: 0.01
            },
            {
                name: 'Yaw rate',
                scale: 0.01
            },
            {
                name: 'Pitch & Roll P',
                scale: 0.1,
                scalef: 1
            },
            {
                name: 'Pitch & Roll I',
                scale: 0.001,
                scalef: 0.1
            },
            {
                name: 'Pitch & Roll D',
                scalef: 1000
            },
            {
                name: 'Yaw P',
                scale: 0.1,
                scalef: 1
            },
            {
                name: 'Yaw I',
                scale: 0.001,
                scalef: 0.1
            },
            {
                name: 'Yaw D',
                scalef: 1000
            },
            {
                name: "Rate Profile"
            },
            {
                name: 'Pitch Rate',
                scale: 0.01
            },
            {
                name: 'Roll Rate',
                scale: 0.01
            },
            {
                name: 'Pitch P',
                scale: 0.1,
                scalef: 1
            },
            {
                name: 'Pitch I',
                scale: 0.001,
                scalef: 0.1
            },
            {
                name: 'Pitch D',
                scalef: 1000
            },
            {
                name: 'Roll P',
                scale: 0.1,
                scalef: 1
            },
            {
                name : 'Roll I',
                scale: 0.001,
                scalef: 0.1
            },
            {
                name: 'Roll D',
                scalef: 1000
            }
        ];

    //Private variables:
    var
        that = this,

        dataVersion,

        defaultSysConfig = {
            frameIntervalI: 32,
            frameIntervalPNum: 1,
            frameIntervalPDenom: 1,
            firmwareType: FIRMWARE_TYPE_UNKNOWN,
            rcRate: 90,
            vbatscale: 110,
            vbatref: 4095,
            vbatmincellvoltage: 33,
            vbatmaxcellvoltage:43,
            vbatwarningcellvoltage: 35,
            gyroScale: 0.0001, // Not even close to the default, but it's hardware specific so we can't do much better
            acc_1G: 2048, // Ditto ^
            minthrottle: 1150,
            maxthrottle: 1850,
            currentMeterOffset: 0,
            currentMeterScale: 400,
            deviceUID: null
        },

        // Blackbox log header parameter names.
        // each name should exist in the blackbox log of the current firmware, or
        // be an older name which is translated into a current name in the table below

        defaultSysConfigExtension = {
            abs_control_gain:null,                  // Absolute control gain
            anti_gravity_gain:null,                 // Anti gravity gain
            anti_gravity_p_gain:null,               // Anti gravity P gain
            anti_gravity_mode:null,                 // Anti gravity mode
            anti_gravity_threshold:null,            // Anti gravity threshold for step mode
            anti_gravity_cutoff_hz:null,            // Anti gravity Cutoff
            blackbox_high_resolution:null,          // Blackbox high resolution mode
            thrMid:null,                            // Throttle Mid Position
            thrExpo:null,                           // Throttle Expo
            tpa_mode:null,                          // TPA Mode
            tpa_breakpoint:null,                    // TPA Breakpoint
            airmode_activate_throttle:null,         // airmode activation level
            serialrx_provider:null,                 // name of the serial rx provider
            superExpoFactor:null,                   // Super Expo Factor
            rates:[null, null, null],               // Rates [ROLL, PITCH, YAW]
            rate_limits:[1998, 1998, 1998],         // Limits [ROLL, PITCH, YAW] with defaults for backward compatibility
            rc_rates:[null, null, null],            // RC Rates [ROLL, PITCH, YAW]
            rc_expo:[null, null, null],             // RC Expo [ROLL, PITCH, YAW]
            looptime:null,                          // Looptime
            gyro_sync_denom:null,                   // Gyro Sync Denom
            pid_process_denom:null,                 // PID Process Denom
            pidController:null,                     // Active PID Controller
            rollPID:[null, null, null],             // Roll [P, I, D]
            pitchPID:[null, null, null],            // Pitch[P, I, D]
            yawPID:[null, null, null],              // Yaw  [P, I, D]
            altPID:[null, null, null],              // Altitude Hold [P, I, D]
            posPID:[null, null, null],              // Position Hold [P, I, D]
            posrPID:[null, null, null],             // Position Rate [P, I, D]
            navrPID:[null, null, null],             // Nav Rate      [P, I, D]
            levelPID:[null, null, null],            // Level Mode    [P, I, D]
            magPID:null,                            // Magnetometer   P
            velPID:[null, null, null],              // Velocity      [P, I, D]
            yaw_p_limit:null,                       // Yaw P Limit
            yaw_lpf_hz:null,                        // Yaw LowPass Filter Hz
            dterm_average_count:null,               // DTerm Average Count
            rollPitchItermResetRate:null,           // ITerm Reset rate for Roll and Pitch
            yawItermResetRate:null,                 // ITerm Reset Rate for Yaw
            dshot_bidir:null,                       // DShot bidir protocol enabled
            dterm_lpf_hz:null,                      // DTerm Lowpass Filter Hz
            dterm_lpf_dyn_hz:[null, null],          // DTerm Lowpass Dynamic Filter Min and Max Hz
            dterm_lpf_dyn_expo:null,                // DTerm Lowpass Dynamic Filter Expo
            dterm_lpf2_hz:null,                     // DTerm Lowpass Filter Hz 2
            dterm_differentiator:null,              // DTerm Differentiator
            H_sensitivity:null,                     // Horizon Sensitivity
            iterm_reset_offset:null,                // I-Term reset offset
            deadband:null,                          // Roll, Pitch Deadband
            yaw_deadband:null,                      // Yaw Deadband
            gyro_lpf:null,                          // Gyro lpf setting.
            gyro_32khz_hardware_lpf:null,           // Gyro 32khz hardware lpf setting. (post BF3.4)
            gyro_lowpass_hz:null,                   // Gyro Soft Lowpass Filter Hz
            gyro_lowpass_dyn_hz:[null, null],       // Gyro Soft Lowpass Dynamic Filter Min and Max Hz
            gyro_lowpass_dyn_expo:null,             // Gyro Soft Lowpass Dynamic Filter Expo
            gyro_lowpass2_hz:null,                  // Gyro Soft Lowpass Filter Hz 2
            gyro_notch_hz:null,                     // Gyro Notch Frequency
            gyro_notch_cutoff:null,                 // Gyro Notch Cutoff
            gyro_rpm_notch_harmonics:null,          // Number of Harmonics in the gyro rpm filter
            gyro_rpm_notch_q:null,                  // Value of Q in the gyro rpm filter
            gyro_rpm_notch_min:null,                // Min Hz for the gyro rpm filter
            rpm_notch_lpf:null,                     // Cutoff for smoothing rpm filter data
            dterm_rpm_notch_harmonics:null,         // Number of Harmonics in the dterm rpm filter
            dterm_rpm_notch_q:null,                 // Value of Q in the dterm rpm filter
            dterm_rpm_notch_min:null,               // Min Hz for the dterm rpm filter
            dterm_notch_hz:null,                    // Dterm Notch Frequency
            dterm_notch_cutoff:null,                // Dterm Notch Cutoff
            acc_lpf_hz:null,                        // Accelerometer Lowpass filter Hz
            acc_hardware:null,                      // Accelerometer Hardware type
            baro_hardware:null,                     // Barometer Hardware type
            mag_hardware:null,                      // Magnetometer Hardware type
            gyro_cal_on_first_arm:null,             // Gyro Calibrate on first arm
            vbat_pid_compensation:null,             // VBAT PID compensation
            rate_limits:[null, null, null],         // RC Rate limits
            rc_smoothing:null,                      // RC Control Smoothing
            rc_interpolation:null,                  // RC Control Interpolation type
            rc_interpolation_channels:null,         // RC Control Interpotlation channels
            rc_interpolation_interval:null,         // RC Control Interpolation Interval
            rc_smoothing_active_cutoffs:[null,null],// RC Smoothing active cutoffs
            rc_smoothing_cutoffs:[null, null],      // RC Smoothing input and derivative cutoff
            rc_smoothing_filter_type:[null,null],   // RC Smoothing input and derivative type
            rc_smoothing_rx_average:null,           // RC Smoothing rx average read in ms
            rc_smoothing_debug_axis:null,           // Axis recorded in the debug mode of rc_smoothing
            dterm_filter_type:null,                 // D term filtering type (PT1, BIQUAD, PT2, PT3)
            dterm_filter2_type:null,                // D term 2 filtering type (PT1, BIQUAD, PT2, PT3)
            pidAtMinThrottle:null,                  // Stabilisation at zero throttle
            itermThrottleGain:null,                 // Betaflight PID
            ptermSetpointWeight:null,               // Betaflight PID
            dtermSetpointWeight:null,               // Betaflight PID
            yawRateAccelLimit:null,                 // Betaflight PID
            rateAccelLimit:null,                    // Betaflight PID
            gyro_soft_type:null,                    // Gyro soft filter type (PT1, BIQUAD, PT2, PT3)
            gyro_soft2_type:null,                   // Gyro soft filter 2 type (PT1, BIQUAD, PT2, PT3)
            debug_mode:null,                        // Selected Debug Mode
            features:null,                          // Activated features (e.g. MOTORSTOP etc)
            Craft_name:null,                        // Craft Name
            motorOutput:[null,null],                // Minimum and maximum outputs to motor's
            digitalIdleOffset:null,                 // min throttle for d-shot (as a percentage)
            pidSumLimit:null,                       // PID sum limit
            pidSumLimitYaw:null,                    // PID sum limit yaw
            use_integrated_yaw : null,              // Use integrated yaw
            d_min : [null, null, null],             // D_Min [P, I, D]
            d_min_gain : null,                      // D_Min gain - D_Max in 4.3
            d_min_advance : null,                   // D_Min advance - D_Max in 4.3
            iterm_relax: null,                      // ITerm Relax mode
            iterm_relax_type: null,                 // ITerm Relax type
            iterm_relax_cutoff: null,               // ITerm Relax cutoff
            dyn_notch_range: null,                  // Dyn Notch Range (LOW, MED, HIGH or AUTO)
            dyn_notch_width_percent: null,          // Dyn Notch width percent distance between the two notches
            dyn_notch_q: null,                      // Dyn Notch width of each dynamic filter
            dyn_notch_min_hz: null,                 // Dyn Notch min limit in Hz for the filter
            dyn_notch_max_hz: null,                 // Dyn Notch max limit in Hz for the filter
            rates_type: null,
            fields_disabled_mask: null,
            vbat_sag_compensation: null,
            gyro_to_use: null,
            dynamic_idle_min_rpm: null,
            motor_poles: 1,
            ff_transition: null,
            ff_averaging: null,
            ff_smooth_factor: null,
            ff_jitter_factor: null,
            ff_boost: null,
            ff_max_rate_limit: null,
            rc_smoothing_mode:null,                 // ** 4.3** RC on or off (0 or 1)
            rc_smoothing_feedforward_hz:null,       // RC Smoothing manual cutoff for feedforward
            rc_smoothing_setpoint_hz:null,          // RC Smoothing manual cutoff for setpoint
            rc_smoothing_auto_factor_setpoint:null, // RC Smoothing auto factor for roll, pitch and yaw setpoint
            rc_smoothing_throttle_hz:null,          // RC Smoothing manual cutoff for throttle
            rc_smoothing_auto_factor_throttle:null, // RC Smoothing cutoff for throttle
            rc_smoothing_active_cutoffs_ff_sp_thr:[null,null,null],// RC Smoothing active cutoffs feedforward, setpoint, throttle
            dyn_notch_count: null,                  // Number of dynamic notches 4.3
            rpm_filter_fade_range_hz: null,         // Fade range for RPM notch filters in Hz
            dyn_idle_p_gain: null,
            dyn_idle_i_gain: null,
            dyn_idle_d_gain: null,
            dyn_idle_max_increase: null,
            simplified_pids_mode: null,             // Simplified / slider PIDS
            simplified_pi_gain: null,
            simplified_i_gain: null,
            simplified_d_gain: null,
            simplified_dmax_gain: null,
            simplified_feedforward_gain: null,
            simplified_pitch_d_gain: null,
            simplified_pitch_pi_gain: null,
            simplified_master_multiplier: null,
            simplified_dterm_filter: null,
            simplified_dterm_filter_multiplier: null,
            simplified_gyro_filter: null,
            simplified_gyro_filter_multiplier: null,
            motor_output_limit: null,                // motor output limit
            throttle_limit_type: null,               // throttle limit
            throttle_limit_percent: null,
            throttle_boost: null,                    // throttle boost
            throttle_boost_cutoff: null,
            thrust_linear: null,
            tpa_low_rate: null,
            tpa_low_breakpoint: null,
            tpa_low_always: null,
            mixer_type: null,
            unknownHeaders : []                     // Unknown Extra Headers
        },

        // Translation of the field values name to the sysConfig var where it must be stored
        // on the left are field names from the latest versions of blackbox.c
        // on the right are older field names that must exist in the list above

        translationValues = {
            acc_limit_yaw             : "yawRateAccelLimit",
            accel_limit               : "rateAccelLimit",
            acc_limit                 : "rateAccelLimit",
            anti_gravity_thresh       : "anti_gravity_threshold",
            currentSensor             : "currentMeter",
            d_notch_cut               : "dterm_notch_cutoff",
            d_setpoint_weight         : "dtermSetpointWeight",
            dterm_lowpass_hz          : "dterm_lpf_hz",
            dterm_lowpass_dyn_hz      : "dterm_lpf_dyn_hz",
            dterm_lowpass2_hz         : "dterm_lpf2_hz",
            dterm_lpf1_type           : "dterm_filter_type",
            dterm_lpf1_static_hz      : "dterm_lpf_hz",
            dterm_lpf1_dyn_hz         : "dterm_lpf_dyn_hz",
            dterm_lpf1_dyn_expo       : "dterm_lpf_dyn_expo",
            dterm_lpf2_type           : "dterm_filter2_type",
            dterm_lpf2_static_hz      : "dterm_lpf2_hz",
            dterm_setpoint_weight     : "dtermSetpointWeight",
            digital_idle_value        : "digitalIdleOffset",
            d_max_gain                : "d_min_gain",
            d_max_advance             : "d_min_advance",
            dshot_idle_value          : "digitalIdleOffset",
            dyn_idle_min_rpm          : "dynamic_idle_min_rpm",
            feedforward_transition    : "ff_transition",
            feedforward_averaging     : "ff_averaging",
            feedforward_smooth_factor : "ff_smooth_factor",
            feedforward_jitter_factor : "ff_jitter_factor",
            feedforward_boost         : "ff_boost",
            feedforward_max_rate_limit : "ff_max_rate_limit",
            feedforward_weight        : "dtermSetpointWeight",
            gyro_hardware_lpf         : "gyro_lpf",
            gyro_lowpass              : "gyro_lowpass_hz",
            gyro_lowpass_type         : "gyro_soft_type",
            gyro_lowpass2_type        : "gyro_soft2_type",
            gyro_lpf1_type            : "gyro_soft_type",
            gyro_lpf1_static_hz       : "gyro_lowpass_hz",
            gyro_lpf1_dyn_hz          : "gyro_lowpass_dyn_hz",
            gyro_lpf1_dyn_expo        : "gyro_lowpass_dyn_expo",
            gyro_lpf2_type            : "gyro_soft2_type",
            gyro_lpf2_static_hz       : "gyro_lowpass2_hz",
            "gyro.scale"              : "gyro_scale",
            iterm_windup              : "itermWindupPointPercent",
            motor_pwm_protocol        : "fast_pwm_protocol",
            pid_at_min_throttle       : "pidAtMinThrottle",
            pidsum_limit              : "pidSumLimit",
            pidsum_limit_yaw          : "pidSumLimitYaw",
            rc_expo_yaw               : "rcYawExpo",
            rc_interp                 : "rc_interpolation",
            rc_interp_int             : "rc_interpolation_interval",
            rc_rate                   : "rc_rates",
            rc_rate_yaw               : "rcYawRate",
            rc_smoothing              : "rc_smoothing_mode",
            rc_smoothing_auto_factor  : "rc_smoothing_auto_factor_setpoint",
            rc_smoothing_feedforward_cutoff : "rc_smoothing_feedforward_hz",
            rc_smoothing_setpoint_cutoff : "rc_smoothing_setpoint_hz",
            rc_smoothing_throttle_cutoff : "rc_smoothing_throttle_hz",
            rc_smoothing_type         : "rc_smoothing_mode",
            rc_yaw_expo               : "rcYawExpo",
            rcExpo                    : "rc_expo",
            rcRate                    : "rc_rates",
            rpm_filter_harmonics      : "gyro_rpm_notch_harmonics",
            rpm_filter_q              : "gyro_rpm_notch_q",
            rpm_filter_min_hz         : "gyro_rpm_notch_min",
            rpm_filter_lpf_hz         : "rpm_notch_lpf",
            setpoint_relax_ratio      : "setpointRelaxRatio",
            setpoint_relaxation_ratio : "setpointRelaxRatio",
            thr_expo                  : "thrExpo",
            thr_mid                   : "thrMid",
            dynThrPID                 : "tpa_rate",
            use_unsynced_pwm          : "unsynced_fast_pwm",
            vbat_scale                : "vbatscale",
            vbat_pid_gain             : "vbat_pid_compensation",
            yaw_accel_limit           : "yawRateAccelLimit",
            yaw_lowpass_hz            : "yaw_lpf_hz",
            thrust_linear             : "thrust_linear",
            tpa_low_rate              : "tpa_low_rate",
            tpa_low_breakpoint        : "tpa_low_breakpoint",
            tpa_low_always            : "tpa_low_always",
            mixer_type                : "mixer_type",
        },

        frameTypes,

        // Blackbox state:
        mainHistoryRing,

        /* Points into blackboxHistoryRing to give us a circular buffer.
        *
        * 0 - space to decode new frames into, 1 - previous frame, 2 - previous previous frame
        *
        * Previous frame pointers are null when no valid history exists of that age.
        */
        mainHistory = [null, null, null],
        mainStreamIsValid = false,

        gpsHomeHistory = new Array(2), // 0 - space to decode new frames into, 1 - previous frame
        gpsHomeIsValid = false,

        //Because these events don't depend on previous events, we don't keep copies of the old state, just the current one:
        lastEvent,
        lastGPS,
        lastSlow,

        // How many intentionally un-logged frames did we skip over before we decoded the current frame?
        lastSkippedFrames,

        // Details about the last main frame that was successfully parsed
        lastMainFrameIteration,
        lastMainFrameTime,

        //The actual log data stream we're reading:
        stream;

    //Public fields:

    /* Information about the frame types the log contains, along with details on their fields.
     * Each entry is an object with field details {encoding:[], predictor:[], name:[], count:0, signed:[]}
     */
    this.frameDefs = {};

    // Lets add the custom extensions
    var completeSysConfig = $.extend({}, defaultSysConfig, defaultSysConfigExtension);
    this.sysConfig = Object.create(completeSysConfig); // Object.create(defaultSysConfig);

    /*
     * Event handler of the signature (frameValid, frame, frameType, frameOffset, frameSize)
     * called when a frame has been decoded.
     */
    this.onFrameReady = null;

    function mapFieldNamesToIndex(fieldNames) {
        var
            result = {};

        for (var i = 0; i < fieldNames.length; i++) {
            result[fieldNames[i]] = i;
        }

        return result;
    }

    /**
     * Translates old field names in the given array to their modern equivalents and return the passed array.
     */
    function translateLegacyFieldNames(names) {
        for (var i = 0; i < names.length; i++) {
            var
                matches;

            if ((matches = names[i].match(/^gyroData(.+)$/))) {
                names[i] = "gyroADC" + matches[1];
            }
        }

        return names;
    }

    /**
     * Translates the name of a field to the parameter in sysConfig object equivalent
     *
     * fieldName Name of the field to translate
     * returns The equivalent in the sysConfig object or the fieldName if not found
     */
    function translateFieldName(fieldName) {
        var translation = translationValues[fieldName];
        if (typeof translation !== 'undefined') {
        	return translation;
        } else {
        	return fieldName;
        }
    }

    function parseHeaderLine() {
        var
            COLON = ":".charCodeAt(0),

            fieldName, fieldValue,
            lineStart, lineEnd, separatorPos = false,
            matches,
            i, c;

        if (stream.peekChar() != ' ')
            return;

        //Skip the leading space
        stream.readChar();

        lineStart = stream.pos;

        for (; stream.pos < lineStart + 1024 && stream.pos < stream.end; stream.pos++) {
            if (separatorPos === false && stream.data[stream.pos] == COLON)
                separatorPos = stream.pos;

            if (stream.data[stream.pos] == NEWLINE || stream.data[stream.pos] === 0)
                break;
        }

        if (stream.data[stream.pos] != NEWLINE || separatorPos === false)
            return;

        lineEnd = stream.pos;

        fieldName = asciiArrayToString(stream.data.subarray(lineStart, separatorPos));
        fieldValue = asciiArrayToString(stream.data.subarray(separatorPos + 1, lineEnd));

        // Translate the fieldName to the sysConfig parameter name. The fieldName has been changing between versions
        // In this way is easier to maintain the code
        fieldName = translateFieldName(fieldName);

        switch (fieldName) {
            case "I interval":
                that.sysConfig.frameIntervalI = parseInt(fieldValue, 10);
                if (that.sysConfig.frameIntervalI < 1)
                    that.sysConfig.frameIntervalI = 1;
            break;
            case "P interval":
                matches = fieldValue.match(/(\d+)\/(\d+)/);

                if (matches) {
                    that.sysConfig.frameIntervalPNum = parseInt(matches[1], 10);
                    that.sysConfig.frameIntervalPDenom = parseInt(matches[2], 10);
                } else {
                    that.sysConfig.frameIntervalPNum = 1;
                    that.sysConfig.frameIntervalPDenom = parseInt(fieldValue, 10);
                }
            break;
            case "P denom":
            case "P ratio":
                // Don't do nothing with this, because is the same than frameIntervalI/frameIntervalPDenom so we don't need it
            break;
            case "Data version":
                dataVersion = parseInt(fieldValue, 10);
            break;
            case "Firmware type":
                switch (fieldValue) {
                    case "Cleanflight":
                        that.sysConfig.firmwareType = FIRMWARE_TYPE_CLEANFLIGHT;
                        $('html').removeClass('isBaseF');
    					$('html').addClass('isCF');
                        $('html').removeClass('isBF');
                        $('html').removeClass('isINAV');
                    break;
                    default:
                        that.sysConfig.firmwareType = FIRMWARE_TYPE_BASEFLIGHT;
                        $('html').addClass('isBaseF');
    					$('html').removeClass('isCF');
                        $('html').removeClass('isBF');
                        $('html').removeClass('isINAV');
                }
            break;

            // Betaflight Log Header Parameters
            case "minthrottle":
                that.sysConfig[fieldName] = parseInt(fieldValue, 10);
                that.sysConfig.motorOutput[0] = that.sysConfig[fieldName]; // by default, set the minMotorOutput to match minThrottle
            break;
            case "maxthrottle":
                that.sysConfig[fieldName] = parseInt(fieldValue, 10);
                that.sysConfig.motorOutput[1] = that.sysConfig[fieldName]; // by default, set the maxMotorOutput to match maxThrottle
            break;
            case "rcRate":
            case "thrMid":
            case "thrExpo":
            case "tpa_rate":
            case "tpa_mode":
            case "tpa_breakpoint":
            case "airmode_activate_throttle":
            case "serialrx_provider":
            case "looptime":
            case "gyro_sync_denom":
            case "pid_process_denom":
            case "pidController":
            case "yaw_p_limit":
            case "dterm_average_count":
            case "rollPitchItermResetRate":
            case "yawItermResetRate":
            case "rollPitchItermIgnoreRate":
            case "yawItermIgnoreRate":
            case "dterm_differentiator":
            case "deltaMethod":
            case "dynamic_dterm_threshold":
            case "dynamic_pterm":
            case "iterm_reset_offset":
            case "deadband":
            case "yaw_deadband":
            case "gyro_lpf":
            case "gyro_hardware_lpf":
            case "gyro_32khz_hardware_lpf":
            case "acc_lpf_hz":
            case "acc_hardware":
            case "baro_hardware":
            case "mag_hardware":
            case "gyro_cal_on_first_arm":
            case "vbat_pid_compensation":
            case "rc_smoothing":
            case "rc_smoothing_type":
            case "rc_smoothing_debug_axis":
            case "rc_smoothing_rx_average":
            case "rc_smoothing_mode":  // 4.3 rc smoothing stuff
            case "rc_smoothing_auto_factor_setpoint":
            case "rc_smoothing_auto_factor_throttle":
            case "rc_smoothing_feedforward_hz":
            case "rc_smoothing_setpoint_hz":
            case "rc_smoothing_feedforward_hz":
            case "rc_smoothing_throttle_hz":
            case "superExpoYawMode":
            case "features":
            case "dynamic_pid":
            case "rc_interpolation":
            case "rc_interpolation_channels":
            case "rc_interpolation_interval":
            case "unsynced_fast_pwm":
            case "fast_pwm_protocol":
            case "motor_pwm_rate":
            case "vbatscale":
            case "vbatref":
            case "acc_1G":
            case "dterm_filter_type":
            case "dterm_filter2_type":
            case "pidAtMinThrottle":
            case "pidSumLimit":
            case "pidSumLimitYaw":
            case "anti_gravity_threshold":
            case "itermWindupPointPercent":
            case "ptermSRateWeight":
            case "setpointRelaxRatio":
            case "ff_transition":
            case "ff_averaging":
            case "ff_smooth_factor":
            case "ff_jitter_factor":
            case "ff_boost":
            case "ff_max_rate_limit":
            case "dtermSetpointWeight":
            case "gyro_soft_type":
            case "gyro_soft2_type":
            case "debug_mode":
            case "anti_gravity_mode":
            case "anti_gravity_gain":
            case "anti_gravity_p_gain":
            case "anti_gravity_cutoff_hz":
            case "abs_control_gain":
            case "use_integrated_yaw":
            case "d_min_gain":
            case "d_min_advance":
            case "dshot_bidir":
            case "gyro_rpm_notch_harmonics":
            case "gyro_rpm_notch_q":
            case "gyro_rpm_notch_min":
            case "rpm_filter_fade_range_hz":
            case "rpm_notch_lpf":
            case "dterm_rpm_notch_harmonics":
            case "dterm_rpm_notch_q":
            case "dterm_rpm_notch_min":
            case "iterm_relax":
            case "iterm_relax_type":
            case "iterm_relax_cutoff":
            case "dyn_notch_range":
            case "dyn_notch_width_percent":
            case "dyn_notch_q":
            case "dyn_notch_count":
            case "dyn_notch_min_hz":
            case "dyn_notch_max_hz":
            case "rates_type":
            case "vbat_sag_compensation":
            case "fields_disabled_mask":
            case "motor_pwm_protocol":
            case "gyro_to_use":
            case "dynamic_idle_min_rpm":
            case "dyn_idle_p_gain":
            case "dyn_idle_i_gain":
            case "dyn_idle_d_gain":
            case "dyn_idle_max_increase":
            case "simplified_pids_mode":
            case "simplified_pi_gain":
            case "simplified_i_gain":
            case "simplified_d_gain":
            case "simplified_dmax_gain":
            case "simplified_feedforward_gain":
            case "simplified_pitch_d_gain":
            case "simplified_pitch_pi_gain":
            case "simplified_master_multiplier":

            case "simplified_dterm_filter":
            case "simplified_dterm_filter_multiplier":
            case "simplified_gyro_filter":
            case "simplified_gyro_filter_multiplier":

            case "motor_output_limit":
            case "throttle_limit_type":
            case "throttle_limit_percent":
            case "throttle_boost":
            case "throttle_boost_cutoff":

            case "motor_poles":

            case "blackbox_high_resolution":
                that.sysConfig[fieldName] = parseInt(fieldValue, 10);
            break;
            case "rc_expo":
            case "rc_rates":
                if(stringHasComma(fieldValue)) {
                    that.sysConfig[fieldName] = parseCommaSeparatedString(fieldValue);
                } else {
                    that.sysConfig[fieldName][0] = parseInt(fieldValue, 10);
                    that.sysConfig[fieldName][1] = parseInt(fieldValue, 10);
                }
            break;
            case "rcYawExpo":
                that.sysConfig["rc_expo"][2] = parseInt(fieldValue, 10);
            break;
            case "rcYawRate":
                that.sysConfig["rc_rates"][2] = parseInt(fieldValue, 10);
            break;


            case "yawRateAccelLimit":
            case "rateAccelLimit":
                if((that.sysConfig.firmwareType == FIRMWARE_TYPE_BETAFLIGHT  && semver.gte(that.sysConfig.firmwareVersion, '3.1.0')) ||
                   (that.sysConfig.firmwareType == FIRMWARE_TYPE_CLEANFLIGHT && semver.gte(that.sysConfig.firmwareVersion, '2.0.0'))) {
                    that.sysConfig[fieldName] = parseInt(fieldValue, 10)/1000;
                } else {
                    that.sysConfig[fieldName] = parseInt(fieldValue, 10);
                }
                break;

            case "yaw_lpf_hz":
            case "gyro_lowpass_hz":
            case "gyro_lowpass2_hz":
            case "dterm_notch_hz":
            case "dterm_notch_cutoff":
            case "dterm_lpf_hz":
            case "dterm_lpf2_hz":
                if((that.sysConfig.firmwareType == FIRMWARE_TYPE_BETAFLIGHT  && semver.gte(that.sysConfig.firmwareVersion, '3.0.1')) ||
                   (that.sysConfig.firmwareType == FIRMWARE_TYPE_CLEANFLIGHT && semver.gte(that.sysConfig.firmwareVersion, '2.0.0'))) {
                    that.sysConfig[fieldName] = parseInt(fieldValue, 10);
                } else {
                    that.sysConfig[fieldName] = parseInt(fieldValue, 10) / 100.0;
                }
            break;

            case "gyro_notch_hz":
            case "gyro_notch_cutoff":
                if((that.sysConfig.firmwareType == FIRMWARE_TYPE_BETAFLIGHT  && semver.gte(that.sysConfig.firmwareVersion, '3.0.1')) ||
                   (that.sysConfig.firmwareType == FIRMWARE_TYPE_CLEANFLIGHT && semver.gte(that.sysConfig.firmwareVersion, '2.0.0'))) {
                    that.sysConfig[fieldName] = parseCommaSeparatedString(fieldValue);
                } else {
                    that.sysConfig[fieldName] = parseInt(fieldValue, 10) / 100.0;
                }
            break;

            case "digitalIdleOffset":
                    that.sysConfig[fieldName] = parseInt(fieldValue, 10) / 100.0;

            /**  Cleanflight Only log headers **/
            case "dterm_cut_hz":
            case "acc_cut_hz":
                 that.sysConfig[fieldName] = parseInt(fieldValue, 10);
            break;
            /** End of cleanflight only log headers **/

            case "superExpoFactor":
                if(stringHasComma(fieldValue)) {
                    var expoParams = parseCommaSeparatedString(fieldValue);
                    that.sysConfig.superExpoFactor    = expoParams[0];
                    that.sysConfig.superExpoFactorYaw = expoParams[1];
                } else {
                    that.sysConfig.superExpoFactor = parseInt(fieldValue, 10);
                }
            break;

            /* CSV packed values */

            case "rates":
            case "rate_limits":
            case "rollPID":
            case "pitchPID":
            case "yawPID":
            case "altPID":
            case "posPID":
            case "posrPID":
            case "navrPID":
            case "levelPID":
            case "velPID":
            case "motorOutput":
            case "rate_limits":
            case "rc_smoothing_cutoffs":
            case "rc_smoothing_active_cutoffs":
            case "rc_smoothing_active_cutoffs_ff_sp_thr":
            case "gyro_lowpass_dyn_hz":
            case "gyro_lowpass_dyn_expo":
            case "dterm_lpf_dyn_expo":
            case "thrust_linear":
            case "tpa_low_rate":
            case "tpa_low_breakpoint":
            case "tpa_low_always":
            case "mixer_type":
            case "dterm_lpf_dyn_hz":
                that.sysConfig[fieldName] = parseCommaSeparatedString(fieldValue);
            break;
            case "magPID":
                that.sysConfig.magPID = parseCommaSeparatedString(fieldValue,3); //[parseInt(fieldValue, 10), null, null];
            break;
            case "d_min":
                // Add Dmin values as Derivative numbers to PID array
                 var dMinValues = parseCommaSeparatedString(fieldValue);
                 that.sysConfig["rollPID"].push(dMinValues[0]);
                 that.sysConfig["pitchPID"].push(dMinValues[1]);
                 that.sysConfig["yawPID"].push(dMinValues[2]);
            break;
            case "ff_weight":
                // Add feedforward values to the PID array
                var ffValues = parseCommaSeparatedString(fieldValue);
                that.sysConfig["rollPID"].push(ffValues[0]);
                that.sysConfig["pitchPID"].push(ffValues[1]);
                that.sysConfig["yawPID"].push(ffValues[2]);
            break;

            /* End of CSV packed values */

            case "vbatcellvoltage":
                var vbatcellvoltageParams = parseCommaSeparatedString(fieldValue);
                that.sysConfig.vbatmincellvoltage = vbatcellvoltageParams[0];
                that.sysConfig.vbatwarningcellvoltage = vbatcellvoltageParams[1];
                that.sysConfig.vbatmaxcellvoltage = vbatcellvoltageParams[2];
            break;
            case "currentMeter":
            case "currentSensor":
                var currentMeterParams = parseCommaSeparatedString(fieldValue);
                that.sysConfig.currentMeterOffset = currentMeterParams[0];
                that.sysConfig.currentMeterScale = currentMeterParams[1];
            break;
            case "gyro.scale":
            case "gyro_scale":
                    that.sysConfig.gyroScale = hexToFloat(fieldValue);
                    /* Baseflight uses a gyroScale that'll give radians per microsecond as output, whereas Cleanflight produces degrees
                     * per second and leaves the conversion to radians per us to the IMU. Let's just convert Cleanflight's scale to
                     * match Baseflight so we can use Baseflight's IMU for both: */
                    if (that.sysConfig.firmwareType == FIRMWARE_TYPE_INAV ||
                        that.sysConfig.firmwareType == FIRMWARE_TYPE_CLEANFLIGHT ||
                        that.sysConfig.firmwareType == FIRMWARE_TYPE_BETAFLIGHT) {
                        that.sysConfig.gyroScale = that.sysConfig.gyroScale * (Math.PI / 180.0) * 0.000001;
                    }
            break;
            case "Firmware revision":

                //TODO Unify this somehow...

                // Extract the firmware revision in case of Betaflight/Raceflight/Cleanfligh 2.x/Other
                var matches = fieldValue.match(/(.*flight).* (\d+)\.(\d+)(\.(\d+))*/i);
                if(matches!=null) {

                    // Detecting Betaflight requires looking at the revision string
                    if (matches[1] === "Betaflight") {
                        that.sysConfig.firmwareType = FIRMWARE_TYPE_BETAFLIGHT;
                        $('html').removeClass('isBaseF');
                        $('html').removeClass('isCF');
                        $('html').addClass('isBF');
                        $('html').removeClass('isINAV');
                    }

                    that.sysConfig.firmware        = parseFloat(matches[2] + '.' + matches[3]).toFixed(1);
                    that.sysConfig.firmwarePatch   = (matches[5] != null)?parseInt(matches[5]):'0';
                    that.sysConfig.firmwareVersion = that.sysConfig.firmware + '.' + that.sysConfig.firmwarePatch;

                } else {

                    /*
                     * Try to detect INAV
                     */
                    var matches = fieldValue.match(/(INAV).* (\d+)\.(\d+).(\d+)*/i);
                    if(matches!=null) {
                        that.sysConfig.firmwareType  = FIRMWARE_TYPE_INAV;
                        that.sysConfig.firmware      = parseFloat(matches[2] + '.' + matches[3]);
                        that.sysConfig.firmwarePatch = (matches[5] != null)?parseInt(matches[5]):'';
                        //added class definition as the isBF, isCF etc classes are only used for colors and
                        //a few images in the css.
                        $('html').removeClass('isBaseF');
                        $('html').removeClass('isCF');
                        $('html').removeClass('isBF');
                        $('html').addClass('isINAV');
                    } else {

                    	// Cleanflight 1.x and others
                        that.sysConfig.firmwareVersion = '0.0.0';
                        that.sysConfig.firmware        = 0.0;
                        that.sysConfig.firmwarePatch   = 0;
                    }
                }
                that.sysConfig[fieldName] = fieldValue;

            break;
            case "Product":
            case "Blackbox version":
            case "Firmware date":
            case "Board information":
            case "Craft name":
            case "Log start datetime":
                // These fields are not presently used for anything, ignore them here so we don't warn about unsupported headers
                // Just Add them anyway
                that.sysConfig[fieldName] = fieldValue;
            break;
            case "Device UID":
                that.sysConfig.deviceUID = fieldValue;
            break;
            default:
                if ((matches = fieldName.match(/^Field (.) (.+)$/))) {
                    var
                        frameName = matches[1],
                        frameInfo = matches[2],
                        frameDef;

                    if (!that.frameDefs[frameName]) {
                        that.frameDefs[frameName] = {
                            name: [],
                            nameToIndex: {},
                            count: 0,
                            signed: [],
                            predictor: [],
                            encoding: [],
                        };
                    }

                    frameDef = that.frameDefs[frameName];

                    switch (frameInfo) {
                        case "predictor":
                            frameDef.predictor = parseCommaSeparatedString(fieldValue);
                        break;
                        case "encoding":
                            frameDef.encoding = parseCommaSeparatedString(fieldValue);
                        break;
                        case "name":
                            frameDef.name = translateLegacyFieldNames(fieldValue.split(","));
                            frameDef.count = frameDef.name.length;

                            frameDef.nameToIndex = mapFieldNamesToIndex(frameDef.name);

                            /*
                             * We could survive with the `signed` header just being filled with zeros, so if it is absent
                             * then resize it to length.
                             */
                            frameDef.signed.length = frameDef.count;
                        break;
                        case "signed":
                            frameDef.signed = parseCommaSeparatedString(fieldValue);
                        break;
                        default:
                            console.log("Saw unsupported field header \"" + fieldName + "\"");
                    }
                } else {
                    console.log(`Ignoring unsupported header ${fieldName} ${fieldValue}`);
                    if (that.sysConfig.unknownHeaders === null) {
                        that.sysConfig.unknownHeaders = new Array();
                    }
                    that.sysConfig.unknownHeaders.push({ name: fieldName, value: fieldValue }); // Save the unknown headers
                }
            break;
        }
    }

    function invalidateMainStream() {
        mainStreamIsValid = false;

        mainHistory[0] = mainHistoryRing ? mainHistoryRing[0]: null;
        mainHistory[1] = null;
        mainHistory[2] = null;
    }

    /**
     * Use data from the given frame to update field statistics for the given frame type.
     */
    function updateFieldStatistics(frameType, frame) {
        var
            i, fieldStats;

        fieldStats = that.stats.frame[frameType].field;

        for (i = 0; i < frame.length; i++) {
            if (!fieldStats[i]) {
                fieldStats[i] = {
                    max: frame[i],
                    min: frame[i]
                };
            } else {
                fieldStats[i].max = frame[i] > fieldStats[i].max ? frame[i] : fieldStats[i].max;
                fieldStats[i].min = frame[i] < fieldStats[i].min ? frame[i] : fieldStats[i].min;
            }
        }
    }

    function completeIntraframe(frameType, frameStart, frameEnd, raw) {
        var acceptFrame = true;

        // Do we have a previous frame to use as a reference to validate field values against?
        if (!raw && lastMainFrameIteration != -1) {
            /*
             * Check that iteration count and time didn't move backwards, and didn't move forward too much.
             */
            acceptFrame =
                mainHistory[0][FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_ITERATION] >= lastMainFrameIteration
                && mainHistory[0][FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_ITERATION] < lastMainFrameIteration + MAXIMUM_ITERATION_JUMP_BETWEEN_FRAMES
                && mainHistory[0][FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME] >= lastMainFrameTime
                && mainHistory[0][FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME] < lastMainFrameTime + MAXIMUM_TIME_JUMP_BETWEEN_FRAMES;
        }

        if (acceptFrame) {
            that.stats.intentionallyAbsentIterations += countIntentionallySkippedFramesTo(mainHistory[0][FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_ITERATION]);

            lastMainFrameIteration = mainHistory[0][FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_ITERATION];
            lastMainFrameTime = mainHistory[0][FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME];

            mainStreamIsValid = true;

            updateFieldStatistics(frameType, mainHistory[0]);
        } else {
            invalidateMainStream();
        }

        if (that.onFrameReady)
            that.onFrameReady(mainStreamIsValid, mainHistory[0], frameType, frameStart, frameEnd - frameStart);

        // Rotate history buffers

        // Both the previous and previous-previous states become the I-frame, because we can't look further into the past than the I-frame
        mainHistory[1] = mainHistory[0];
        mainHistory[2] = mainHistory[0];

        // And advance the current frame into an empty space ready to be filled
        if (mainHistory[0] == mainHistoryRing[0])
            mainHistory[0] = mainHistoryRing[1];
        else if (mainHistory[0] == mainHistoryRing[1])
            mainHistory[0] = mainHistoryRing[2];
        else
            mainHistory[0] = mainHistoryRing[0];
    }

    /**
     * Should a frame with the given index exist in this log (based on the user's selection of sampling rates)?
     */
    function shouldHaveFrame(frameIndex)
    {
        return (frameIndex % that.sysConfig.frameIntervalI + that.sysConfig.frameIntervalPNum - 1)
            % that.sysConfig.frameIntervalPDenom < that.sysConfig.frameIntervalPNum;
    }

    /**
     * Attempt to parse the frame of into the supplied `current` buffer using the encoding/predictor
     * definitions from `frameDefs`. The previous frame values are used for predictions.
     *
     * frameDef - The definition for the frame type being parsed (from this.frameDefs)
     * raw - Set to true to disable predictions (and so store raw values)
     * skippedFrames - Set to the number of field iterations that were skipped over by rate settings since the last frame.
     */
    function parseFrame(frameDef, current, previous, previous2, skippedFrames, raw)
    {
        var
            predictor = frameDef.predictor,
            encoding = frameDef.encoding,
            values = new Array(8),
            i, j, groupCount;

        i = 0;
        while (i < frameDef.count) {
            var
                value;

            if (predictor[i] == FLIGHT_LOG_FIELD_PREDICTOR_INC) {
                current[i] = skippedFrames + 1;

                if (previous)
                    current[i] += previous[i];

                i++;
            } else {
                switch (encoding[i]) {
                    case FLIGHT_LOG_FIELD_ENCODING_SIGNED_VB:
                        value = stream.readSignedVB();
                    break;
                    case FLIGHT_LOG_FIELD_ENCODING_UNSIGNED_VB:
                        value = stream.readUnsignedVB();
                    break;
                    case FLIGHT_LOG_FIELD_ENCODING_NEG_14BIT:
                        value = -signExtend14Bit(stream.readUnsignedVB());
                    break;
                    case FLIGHT_LOG_FIELD_ENCODING_TAG8_4S16:
                        if (dataVersion < 2)
                            stream.readTag8_4S16_v1(values);
                        else
                            stream.readTag8_4S16_v2(values);

                        //Apply the predictors for the fields:
                        for (j = 0; j < 4; j++, i++)
                            current[i] = applyPrediction(i, raw ? FLIGHT_LOG_FIELD_PREDICTOR_0 : predictor[i], values[j], current, previous, previous2);

                        continue;
                    break;
                    case FLIGHT_LOG_FIELD_ENCODING_TAG2_3S32:
                        stream.readTag2_3S32(values);

                        //Apply the predictors for the fields:
                        for (j = 0; j < 3; j++, i++)
                            current[i] = applyPrediction(i, raw ? FLIGHT_LOG_FIELD_PREDICTOR_0 : predictor[i], values[j], current, previous, previous2);

                        continue;
                    break;
                    case FLIGHT_LOG_FIELD_ENCODING_TAG2_3SVARIABLE:
                        stream.readTag2_3SVariable(values);

                        //Apply the predictors for the fields:
                        for (j = 0; j < 3; j++, i++)
                            current[i] = applyPrediction(i, raw ? FLIGHT_LOG_FIELD_PREDICTOR_0 : predictor[i], values[j], current, previous, previous2);

                        continue;
                    break;
                    case FLIGHT_LOG_FIELD_ENCODING_TAG8_8SVB:
                        //How many fields are in this encoded group? Check the subsequent field encodings:
                        for (j = i + 1; j < i + 8 && j < frameDef.count; j++)
                            if (encoding[j] != FLIGHT_LOG_FIELD_ENCODING_TAG8_8SVB)
                                break;

                        groupCount = j - i;

                        stream.readTag8_8SVB(values, groupCount);

                        for (j = 0; j < groupCount; j++, i++)
                            current[i] = applyPrediction(i, raw ? FLIGHT_LOG_FIELD_PREDICTOR_0 : predictor[i], values[j], current, previous, previous2);

                        continue;
                    break;
                    case FLIGHT_LOG_FIELD_ENCODING_NULL:
                        //Nothing to read
                        value = 0;
                    break;
                    default:
                        if (encoding[i] === undefined)
                            throw "Missing field encoding header for field #" + i + " '" + frameDef.name[i] + "'";
                        else
                            throw "Unsupported field encoding " + encoding[i];
                }

                current[i] = applyPrediction(i, raw ? FLIGHT_LOG_FIELD_PREDICTOR_0 : predictor[i], value, current, previous, previous2);
                i++;
            }
        }
    }

    function parseIntraframe(raw) {
        var
            current = mainHistory[0],
            previous = mainHistory[1];

        parseFrame(that.frameDefs.I, current, previous, null, 0, raw);
    }

    function completeGPSHomeFrame(frameType, frameStart, frameEnd, raw) {
        updateFieldStatistics(frameType, gpsHomeHistory[0]);

        that.setGPSHomeHistory(gpsHomeHistory[0]);

        if (that.onFrameReady) {
            that.onFrameReady(true, gpsHomeHistory[0], frameType, frameStart, frameEnd - frameStart);
        }

        return true;
    }

    function completeGPSFrame(frameType, frameStart, frameEnd, raw) {
        if (gpsHomeIsValid) {
            updateFieldStatistics(frameType, lastGPS);
        }

        if (that.onFrameReady) {
            that.onFrameReady(gpsHomeIsValid, lastGPS, frameType, frameStart, frameEnd - frameStart);
        }

        return true;
    }

    function completeSlowFrame(frameType, frameStart, frameEnd, raw) {
        updateFieldStatistics(frameType, lastSlow);

        if (that.onFrameReady) {
            that.onFrameReady(true, lastSlow, frameType, frameStart, frameEnd - frameStart);
        }
    }

    function completeInterframe(frameType, frameStart, frameEnd, raw) {
        // Reject this frame if the time or iteration count jumped too far
        if (mainStreamIsValid && !raw
                && (
                    mainHistory[0][FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME] > lastMainFrameTime + MAXIMUM_TIME_JUMP_BETWEEN_FRAMES
                    || mainHistory[0][FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_ITERATION] > lastMainFrameIteration + MAXIMUM_ITERATION_JUMP_BETWEEN_FRAMES
                )) {
            mainStreamIsValid = false;
        }

        if (mainStreamIsValid) {
            lastMainFrameIteration = mainHistory[0][FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_ITERATION];
            lastMainFrameTime = mainHistory[0][FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME];

            that.stats.intentionallyAbsentIterations += lastSkippedFrames;

            updateFieldStatistics(frameType, mainHistory[0]);
        }

        //Receiving a P frame can't resynchronise the stream so it doesn't set mainStreamIsValid to true

        if (that.onFrameReady)
            that.onFrameReady(mainStreamIsValid, mainHistory[0], frameType, frameStart, frameEnd - frameStart);

        if (mainStreamIsValid) {
            // Rotate history buffers

            mainHistory[2] = mainHistory[1];
            mainHistory[1] = mainHistory[0];

            // And advance the current frame into an empty space ready to be filled
            if (mainHistory[0] == mainHistoryRing[0])
                mainHistory[0] = mainHistoryRing[1];
            else if (mainHistory[0] == mainHistoryRing[1])
                mainHistory[0] = mainHistoryRing[2];
            else
                mainHistory[0] = mainHistoryRing[0];
        }
    }

    /**
     * Take the raw value for a a field, apply the prediction that is configured for it, and return it.
     */
    function applyPrediction(fieldIndex, predictor, value, current, previous, previous2)
    {
        switch (predictor) {
            case FLIGHT_LOG_FIELD_PREDICTOR_0:
                // No correction to apply
            break;
            case FLIGHT_LOG_FIELD_PREDICTOR_MINTHROTTLE:
                /*
                 * Force the value to be a *signed* 32-bit integer. Encoded motor values can be negative when motors are
                 * below minthrottle, but despite this motor[0] is encoded in I-frames using *unsigned* encoding (to
                 * save space for positive values). So we need to convert those very large unsigned values into their
                 * corresponding 32-bit signed values.
                 */
                value = (value | 0) + that.sysConfig.minthrottle;
            break;
            case FLIGHT_LOG_FIELD_PREDICTOR_MINMOTOR:
                /*
                 * Force the value to be a *signed* 32-bit integer. Encoded motor values can be negative when motors are
                 * below minthrottle, but despite this motor[0] is encoded in I-frames using *unsigned* encoding (to
                 * save space for positive values). So we need to convert those very large unsigned values into their
                 * corresponding 32-bit signed values.
                 */
                value = (value | 0) + (that.sysConfig.motorOutput[0] | 0); // motorOutput[0] is the min motor output
            break;
            case FLIGHT_LOG_FIELD_PREDICTOR_1500:
                value += 1500;
            break;
            case FLIGHT_LOG_FIELD_PREDICTOR_MOTOR_0:
                if (that.frameDefs.I.nameToIndex["motor[0]"] < 0) {
                    throw "Attempted to base I-field prediction on motor0 before it was read";
                }
                value += current[that.frameDefs.I.nameToIndex["motor[0]"]];
            break;
            case FLIGHT_LOG_FIELD_PREDICTOR_VBATREF:
                value += that.sysConfig.vbatref;
            break;
            case FLIGHT_LOG_FIELD_PREDICTOR_PREVIOUS:
                if (!previous)
                    break;

                value += previous[fieldIndex];
            break;
            case FLIGHT_LOG_FIELD_PREDICTOR_STRAIGHT_LINE:
                if (!previous)
                    break;

                value += 2 * previous[fieldIndex] - previous2[fieldIndex];
            break;
            case FLIGHT_LOG_FIELD_PREDICTOR_AVERAGE_2:
                if (!previous)
                    break;

                //Round toward zero like C would do for integer division:
                value += ~~((previous[fieldIndex] + previous2[fieldIndex]) / 2);
            break;
            case FLIGHT_LOG_FIELD_PREDICTOR_HOME_COORD:
                if (!that.frameDefs.H || that.frameDefs.H.nameToIndex["GPS_home[0]"] === undefined) {
                    throw "Attempted to base prediction on GPS home position without GPS home frame definition";
                }

                value += gpsHomeHistory[1][that.frameDefs.H.nameToIndex["GPS_home[0]"]];
            break;
            case FLIGHT_LOG_FIELD_PREDICTOR_HOME_COORD_1:
                if (!that.frameDefs.H || that.frameDefs.H.nameToIndex["GPS_home[1]"] === undefined) {
                    throw "Attempted to base prediction on GPS home position without GPS home frame definition";
                }

                value += gpsHomeHistory[1][that.frameDefs.H.nameToIndex["GPS_home[1]"]];
            break;
            case FLIGHT_LOG_FIELD_PREDICTOR_LAST_MAIN_FRAME_TIME:
                if (mainHistory[1])
                    value += mainHistory[1][FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME];
            break;
            default:
                throw "Unsupported field predictor " + predictor;
        }

        return value;
    }

    /*
     * Based on the log sampling rate, work out how many frames would have been skipped after the last frame that was
     * parsed until we get to the next logged iteration.
     */
    function countIntentionallySkippedFrames()
    {
        var
            count = 0, frameIndex;

        if (lastMainFrameIteration == -1) {
            // Haven't parsed a frame yet so there's no frames to skip
            return 0;
        } else {
            for (frameIndex = lastMainFrameIteration + 1; !shouldHaveFrame(frameIndex); frameIndex++) {
                count++;
            }
        }

        return count;
    }

    /*
     * Based on the log sampling rate, work out how many frames would have been skipped after the last frame that was
     * parsed until we get to the iteration with the given index.
     */
    function countIntentionallySkippedFramesTo(targetIteration)
    {
        var
            count = 0, frameIndex;

        if (lastMainFrameIteration == -1) {
            // Haven't parsed a frame yet so there's no frames to skip
            return 0;
        } else {
            for (frameIndex = lastMainFrameIteration + 1; frameIndex < targetIteration; frameIndex++) {
                if (!shouldHaveFrame(frameIndex)) {
                    count++;
                }
            }
        }

        return count;
    }

    function parseInterframe(raw) {
        var
            current = mainHistory[0],
            previous = mainHistory[1],
            previous2 = mainHistory[2];

        lastSkippedFrames = countIntentionallySkippedFrames();

        parseFrame(that.frameDefs.P, current, previous, previous2, lastSkippedFrames, raw);
    }

    function parseGPSFrame(raw) {
        // Only parse a GPS frame if we have GPS header definitions
        if (that.frameDefs.G) {
            parseFrame(that.frameDefs.G, lastGPS, null, null, 0, raw);
        }
    }

    function parseGPSHomeFrame(raw) {
        if (that.frameDefs.H) {
            parseFrame(that.frameDefs.H, gpsHomeHistory[0], null, null, 0, raw);
        }
    }

    function parseSlowFrame(raw) {
        if (that.frameDefs.S) {
            parseFrame(that.frameDefs.S, lastSlow, null, null, 0, raw);
        }
    }

    function completeEventFrame(frameType, frameStart, frameEnd, raw) {
        if (lastEvent) {
            switch (lastEvent.event) {
                case FlightLogEvent.LOGGING_RESUME:
                    /*
                     * Bring the "last time" and "last iteration" up to the new resume time so we accept the sudden jump into
                     * the future.
                     */
                    lastMainFrameIteration = lastEvent.data.logIteration;
                    lastMainFrameTime = lastEvent.data.currentTime;
                break;
            }

            if (that.onFrameReady) {
                that.onFrameReady(true, lastEvent, frameType, frameStart, frameEnd - frameStart);
            }

            return true;
        }

        return false;
    }

    function parseEventFrame(raw) {
        var
            END_OF_LOG_MESSAGE = "End of log\0",

            eventType = stream.readByte();

        lastEvent = {
            event: eventType,
            data: {}
        };

        switch (eventType) {
            case FlightLogEvent.SYNC_BEEP:
                lastEvent.data.time = stream.readUnsignedVB();
                lastEvent.time = lastEvent.data.time;
            break;
            case FlightLogEvent.FLIGHT_MODE: // get the flag status change
                lastEvent.data.newFlags = stream.readUnsignedVB();
                lastEvent.data.lastFlags = stream.readUnsignedVB();
            break;
            case FlightLogEvent.DISARM:
                lastEvent.data.reason = stream.readUnsignedVB();
            break;
            case FlightLogEvent.AUTOTUNE_CYCLE_START:
                lastEvent.data.phase = stream.readByte();

                var cycleAndRising = stream.readByte();

                lastEvent.data.cycle = cycleAndRising & 0x7F;
                lastEvent.data.rising = (cycleAndRising >> 7) & 0x01;

                lastEvent.data.p = stream.readByte();
                lastEvent.data.i = stream.readByte();
                lastEvent.data.d = stream.readByte();
            break;
            case FlightLogEvent.AUTOTUNE_CYCLE_RESULT:
                lastEvent.data.overshot = stream.readByte();
                lastEvent.data.p = stream.readByte();
                lastEvent.data.i = stream.readByte();
                lastEvent.data.d = stream.readByte();
            break;
            case FlightLogEvent.AUTOTUNE_TARGETS:
                //Convert the angles from decidegrees back to plain old degrees for ease of use
                lastEvent.data.currentAngle = stream.readS16() / 10.0;

                lastEvent.data.targetAngle = stream.readS8();
                lastEvent.data.targetAngleAtPeak = stream.readS8();

                lastEvent.data.firstPeakAngle = stream.readS16() / 10.0;
                lastEvent.data.secondPeakAngle = stream.readS16() / 10.0;
            break;
            case FlightLogEvent.GTUNE_CYCLE_RESULT:
                lastEvent.data.axis = stream.readU8();
                lastEvent.data.gyroAVG = stream.readSignedVB();
                lastEvent.data.newP = stream.readS16();
            break;
            case FlightLogEvent.INFLIGHT_ADJUSTMENT:
                var tmp = stream.readU8();
                lastEvent.data.name = 'Unknown';
                lastEvent.data.func = tmp & 127;
                lastEvent.data.value = tmp < 128 ? stream.readSignedVB() : uint32ToFloat(stream.readU32());
                if (INFLIGHT_ADJUSTMENT_FUNCTIONS[lastEvent.data.func] !== undefined) {
                    var descr = INFLIGHT_ADJUSTMENT_FUNCTIONS[lastEvent.data.func];
                    lastEvent.data.name = descr.name;
                    var scale = 1;
                    if (descr.scale !== undefined) {
                        scale = descr.scale;
                    }
                    if (tmp >= 128 && descr.scalef !== undefined) {
                        scale = descr.scalef;
                    }
                    lastEvent.data.value = Math.round((lastEvent.data.value * scale) * 10000) / 10000;
                }
            break;
            case FlightLogEvent.TWITCH_TEST:
                //lastEvent.data.stage = stream.readU8();
                var tmp = stream.readU8();
                switch (tmp) {
                    case(1):
                        lastEvent.data.name = "Response Time->";
                        break;
                    case(2):
                        lastEvent.data.name = "Half Setpoint Time->";
                        break;
                    case(3):
                        lastEvent.data.name = "Setpoint Time->";
                        break;
                    case(4):
                        lastEvent.data.name = "Negative Setpoint->";
                        break;
                    case(5):
                        lastEvent.data.name = "Initial Setpoint->";
                }
                lastEvent.data.value = uint32ToFloat(stream.readU32());
            break;
            case FlightLogEvent.LOGGING_RESUME:
                lastEvent.data.logIteration = stream.readUnsignedVB();
                lastEvent.data.currentTime = stream.readUnsignedVB();
            break;
            case FlightLogEvent.LOG_END:
                var endMessage = stream.readString(END_OF_LOG_MESSAGE.length);

                if (endMessage == END_OF_LOG_MESSAGE) {
                    //Adjust the end of stream so we stop reading, this log is done
                    stream.end = stream.pos;
                } else {
                    /*
                     * This isn't the real end of log message, it's probably just some bytes that happened to look like
                     * an event header.
                     */
                    lastEvent = null;
                }
            break;
            default:
                lastEvent = null;
        }
    }

    function getFrameType(command) {
        return frameTypes[command];
    }

    // Reset parsing state from the data section of the current log (don't reset header information). Useful for seeking.
    this.resetDataState = function() {
        lastSkippedFrames = 0;

        lastMainFrameIteration = -1;
        lastMainFrameTime = -1;

        invalidateMainStream();
        gpsHomeIsValid = false;
        lastEvent = null;
    };

    // Reset any parsed information from previous parses (header & data)
    this.resetAllState = function() {
        this.resetStats();

        //Reset system configuration to MW's defaults
        // Lets add the custom extensions
        var completeSysConfig = $.extend({}, defaultSysConfig, defaultSysConfigExtension);
        this.sysConfig = Object.create(completeSysConfig); // Object.create(defaultSysConfig);

        this.frameDefs = {};

        this.resetDataState();
    };

    // Check that the given frame definition contains some fields and the right number of predictors & encodings to match
    function isFrameDefComplete(frameDef) {
        return frameDef && frameDef.count > 0 && frameDef.encoding.length == frameDef.count && frameDef.predictor.length == frameDef.count;
    }

    this.parseHeader = function(startOffset, endOffset) {
        this.resetAllState();

        //Set parsing ranges up
        stream.start = startOffset === undefined ? stream.pos : startOffset;
        stream.pos = stream.start;
        stream.end = endOffset === undefined ? stream.end : endOffset;
        stream.eof = false;

        mainloop:
        while (true) {
            var command = stream.readChar();

            switch (command) {
                case "H":
                    parseHeaderLine();
                break;
                case EOF:
                    break mainloop;
                default:
                    /*
                     * If we see something that looks like the beginning of a data frame, assume it
                     * is and terminate the header.
                     */
                    if (getFrameType(command)) {
                        stream.unreadChar(command);

                        break mainloop;
                    } // else skip garbage which apparently precedes the first data frame
                break;
            }
        }

        adjustFieldDefsList(that.sysConfig.firmwareType, that.sysConfig.firmwareVersion);
        FlightLogFieldPresenter.adjustDebugDefsList(that.sysConfig.firmwareType, that.sysConfig.firmwareVersion);

        if (!isFrameDefComplete(this.frameDefs.I)) {
            throw "Log is missing required definitions for I frames, header may be corrupt";
        }

        if (!this.frameDefs.P) {
            throw "Log is missing required definitions for P frames, header may be corrupt";
        }

        // P frames are derived from I frames so copy over frame definition information to those
        this.frameDefs.P.count = this.frameDefs.I.count;
        this.frameDefs.P.name = this.frameDefs.I.name;
        this.frameDefs.P.nameToIndex = this.frameDefs.I.nameToIndex;
        this.frameDefs.P.signed = this.frameDefs.I.signed;

        if (!isFrameDefComplete(this.frameDefs.P)) {
            throw "Log is missing required definitions for P frames, header may be corrupt";
        }

        // Now we know our field counts, we can allocate arrays to hold parsed data
        mainHistoryRing = [new Array(this.frameDefs.I.count), new Array(this.frameDefs.I.count), new Array(this.frameDefs.I.count)];

        if (this.frameDefs.H && this.frameDefs.G) {
            gpsHomeHistory = [new Array(this.frameDefs.H.count), new Array(this.frameDefs.H.count)];
            lastGPS = new Array(this.frameDefs.G.count);

            /* Home coord predictors appear in pairs (lat/lon), but the predictor ID is the same for both. It's easier to
             * apply the right predictor during parsing if we rewrite the predictor ID for the second half of the pair here:
             */
            for (var i = 1; i < this.frameDefs.G.count; i++) {
                if (this.frameDefs.G.predictor[i - 1] == FLIGHT_LOG_FIELD_PREDICTOR_HOME_COORD &&
                        this.frameDefs.G.predictor[i] == FLIGHT_LOG_FIELD_PREDICTOR_HOME_COORD) {
                    this.frameDefs.G.predictor[i] = FLIGHT_LOG_FIELD_PREDICTOR_HOME_COORD_1;
                }
            }
        } else {
            gpsHomeHistory = [];
            lastGPS = [];
        }

        if (this.frameDefs.S) {
            lastSlow = new Array(this.frameDefs.S.count);
        } else {
            lastSlow = [];
        }
    };

    /**
     * Set the current GPS home data to the given frame. Pass an empty array in in order to invalidate the GPS home
     * frame data.
     *
     * (The data is stored in gpsHomeHistory[1])
     */
    this.setGPSHomeHistory = function(newGPSHome) {
        if (newGPSHome.length == that.frameDefs.H.count) {
            //Copy the decoded frame into the "last state" entry of gpsHomeHistory to publish it:
            for (var i = 0; i < newGPSHome.length; i++) {
                gpsHomeHistory[1][i] = newGPSHome[i];
            }

            gpsHomeIsValid = true;
        } else {
            gpsHomeIsValid = false;
        }
    };


    /**
     * Continue the current parse by scanning the given range of offsets for data. To begin an independent parse,
     * call resetDataState() first.
     */
    this.parseLogData = function(raw, startOffset, endOffset) {
        var
            looksLikeFrameCompleted = false,
            prematureEof = false,
            frameStart = 0,
            frameType = null,
            lastFrameType = null;

        invalidateMainStream();

        //Set parsing ranges up for the log the caller selected
        stream.start = startOffset === undefined ? stream.pos : startOffset;
        stream.pos = stream.start;
        stream.end = endOffset === undefined ? stream.end : endOffset;
        stream.eof = false;

        while (true) {
            var command = stream.readChar();

            if (lastFrameType) {
                var
                    lastFrameSize = stream.pos - frameStart,
                    frameTypeStats;

                // Is this the beginning of a new frame?
                looksLikeFrameCompleted = getFrameType(command) || (!prematureEof && command == EOF);

                if (!this.stats.frame[lastFrameType.marker]) {
                    this.stats.frame[lastFrameType.marker] = {
                        bytes: 0,
                        sizeCount: new Int32Array(256), /* int32 arrays are zero-filled, handy! */
                        validCount: 0,
                        corruptCount: 0,
                        field: []
                    };
                }

                frameTypeStats = this.stats.frame[lastFrameType.marker];

                // If we see what looks like the beginning of a new frame, assume that the previous frame was valid:
                if (lastFrameSize <= FLIGHT_LOG_MAX_FRAME_LENGTH && looksLikeFrameCompleted) {
                    var frameAccepted = true;

                    if (lastFrameType.complete)
                        frameAccepted = lastFrameType.complete(lastFrameType.marker, frameStart, stream.pos, raw);

                    if (frameAccepted) {
                        //Update statistics for this frame type
                        frameTypeStats.bytes += lastFrameSize;
                        frameTypeStats.sizeCount[lastFrameSize]++;
                        frameTypeStats.validCount++;
                    } else {
                        frameTypeStats.desyncCount++;
                    }
                } else {
                    //The previous frame was corrupt

                    //We need to resynchronise before we can deliver another main frame:
                    mainStreamIsValid = false;
                    frameTypeStats.corruptCount++;
                    this.stats.totalCorruptFrames++;

                    //Let the caller know there was a corrupt frame (don't give them a pointer to the frame data because it is totally worthless)
                    if (this.onFrameReady)
                        this.onFrameReady(false, null, lastFrameType.marker, frameStart, lastFrameSize);

                    /*
                     * Start the search for a frame beginning after the first byte of the previous corrupt frame.
                     * This way we can find the start of the next frame after the corrupt frame if the corrupt frame
                     * was truncated.
                     */
                    stream.pos = frameStart + 1;
                    lastFrameType = null;
                    prematureEof = false;
                    stream.eof = false;
                    continue;
                }
            }

            if (command == EOF)
                break;

            frameStart = stream.pos - 1;
            frameType = getFrameType(command);

            // Reject the frame if it is one that we have no definitions for in the header
            if (frameType && (command == 'E' || that.frameDefs[command])) {
                lastFrameType = frameType;
                frameType.parse(raw);

                //We shouldn't read an EOF during reading a frame (that'd imply the frame was truncated)
                if (stream.eof) {
                    prematureEof = true;
                }
            } else {
                mainStreamIsValid = false;
                lastFrameType = null;
            }
        }

        this.stats.totalBytes += stream.end - stream.start;

        return true;
    };

    frameTypes = {
        "I": {marker: "I", parse: parseIntraframe,   complete: completeIntraframe},
        "P": {marker: "P", parse: parseInterframe,   complete: completeInterframe},
        "G": {marker: "G", parse: parseGPSFrame,     complete: completeGPSFrame},
        "H": {marker: "H", parse: parseGPSHomeFrame, complete: completeGPSHomeFrame},
        "S": {marker: "S", parse: parseSlowFrame,    complete: completeSlowFrame},
        "E": {marker: "E", parse: parseEventFrame,   complete: completeEventFrame}
    };

    stream = new ArrayDataStream(logData);
};

FlightLogParser.prototype.resetStats = function() {
    this.stats = {
        totalBytes: 0,

        // Number of frames that failed to decode:
        totalCorruptFrames: 0,

        //If our sampling rate is less than 1, we won't log every loop iteration, and that is accounted for here:
        intentionallyAbsentIterations: 0,

        // Statistics for each frame type ("I", "P" etc)
        frame: {}
    };
};

FlightLogParser.prototype.FLIGHT_LOG_START_MARKER = asciiStringToByteArray("H Product:Blackbox flight data recorder by Nicholas Sherlock\n");

FlightLogParser.prototype.FLIGHT_LOG_FIELD_UNSIGNED = 0;
FlightLogParser.prototype.FLIGHT_LOG_FIELD_SIGNED   = 1;

FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_ITERATION = 0;
FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME = 1;

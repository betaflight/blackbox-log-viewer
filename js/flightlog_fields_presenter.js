"use strict";

function FlightLogFieldPresenter() {
}

(function() {
    const FRIENDLY_FIELD_NAMES = {

        'axisP[all]': 'PID P',
        'axisP[0]': 'PID P [roll]',
        'axisP[1]': 'PID P [pitch]',
        'axisP[2]': 'PID P [yaw]',

        'axisI[all]': 'PID I',
        'axisI[0]': 'PID I [roll]',
        'axisI[1]': 'PID I [pitch]',
        'axisI[2]': 'PID I [yaw]',

        'axisD[all]': 'PID D',
        'axisD[0]': 'PID D [roll]',
        'axisD[1]': 'PID D [pitch]',
        'axisD[2]': 'PID D [yaw]',

        'axisF[all]': 'PID Feedforward',
        'axisF[0]': 'PID Feedforward [roll]',
        'axisF[1]': 'PID Feedforward [pitch]',
        'axisF[2]': 'PID Feedforward [yaw]',

        //Virtual field
        'axisSum[all]': 'PID Sum',
        'axisSum[0]' : 'PID Sum [roll]',
        'axisSum[1]' : 'PID Sum [pitch]',
        'axisSum[2]' : 'PID Sum [yaw]',

        //Virtual field
        'axisError[all]': 'PID Error',
        'axisError[0]' : 'PID Error [roll]',
        'axisError[1]' : 'PID Error [pitch]',
        'axisError[2]' : 'PID Error [yaw]',

        //Virtual field
        'rcCommands[all]': 'Setpoints',
        'rcCommands[0]' : 'Setpoint [roll]',
        'rcCommands[1]' : 'Setpoint [pitch]',
        'rcCommands[2]' : 'Setpoint [yaw]',
        'rcCommands[3]' : 'Setpoint [throttle]',

        'rcCommand[all]': 'RC Commands',
        'rcCommand[0]': 'RC Command [roll]',
        'rcCommand[1]': 'RC Command [pitch]',
        'rcCommand[2]': 'RC Command [yaw]',
        'rcCommand[3]': 'RC Command [throttle]',

        'gyroADC[all]': 'Gyros',
        'gyroADC[0]': 'Gyro [roll]',
        'gyroADC[1]': 'Gyro [pitch]',
        'gyroADC[2]': 'Gyro [yaw]',

        //End-users prefer 1-based indexing
        'motor[all]': 'Motors',
        'motor[0]': 'Motor [1]',
        'motor[1]': 'Motor [2]',
        'motor[2]': 'Motor [3]',
        'motor[3]': 'Motor [4]',
        'motor[4]': 'Motor [5]',
        'motor[5]': 'Motor [6]',
        'motor[6]': 'Motor [7]',
        'motor[7]': 'Motor [8]',

        'motorLegacy[all]': 'Motors (Legacy)',
        'motorLegacy[0]': 'Motor (Legacy) [1]',
        'motorLegacy[1]': 'Motor (Legacy) [2]',
        'motorLegacy[2]': 'Motor (Legacy) [3]',
        'motorLegacy[3]': 'Motor (Legacy) [4]',
        'motorLegacy[4]': 'Motor (Legacy) [5]',
        'motorLegacy[5]': 'Motor (Legacy) [6]',
        'motorLegacy[6]': 'Motor (Legacy) [7]',
        'motorLegacy[7]': 'Motor (Legacy) [8]',

        'servo[all]': 'Servos',
        'servo[5]': 'Servo Tail',

        'vbatLatest': 'Battery volt.',
        'amperageLatest': 'Amperage',
        'BaroAlt': 'Barometer',

        'heading[all]': 'Heading',
        'heading[0]': 'Heading [roll]',
        'heading[1]': 'Heading [pitch]',
        'heading[2]': 'Heading [yaw]',

        'accSmooth[all]': 'Accel.',
        'accSmooth[0]': 'Accel. [X]',
        'accSmooth[1]': 'Accel. [Y]',
        'accSmooth[2]': 'Accel. [Z]',

        'magADC[all]': 'Compass',
        'magADC[0]': 'Compass [X]',
        'magADC[1]': 'Compass [Y]',
        'magADC[2]': 'Compass [Z]',

        'flightModeFlags': 'Flight Mode Flags',
        'stateFlags': 'State Flags',
        'failsafePhase': 'Failsafe Phase',
        'rxSignalReceived': 'RX Signal Received',
        'rxFlightChannelsValid': 'RX Flight Ch. Valid',
        'rssi': 'RSSI',
    };

    	var DEBUG_FRIENDLY_FIELD_NAMES = { 
			'NONE' : 	{
							'debug[all]':'Debug [all]',	
							'debug[0]':'Debug [0]',
							'debug[1]':'Debug [1]',
							'debug[2]':'Debug [2]',
							'debug[3]':'Debug [3]',
						},
			'CYCLETIME' : 	{	
							'debug[all]':'Debug Cycle Time',	
							'debug[0]':'Cycle Time',
							'debug[1]':'CPU Load',
							'debug[2]':'Motor Update',
							'debug[3]':'Motor Deviation',
						},
			'BATTERY' : 	{	
							'debug[all]':'Debug Battery',	
							'debug[0]':'Battery Volt. ADC',
							'debug[1]':'Battery Volt.',
							'debug[2]':'Not Used',
							'debug[3]':'Not Used',
						},
			'GYRO' : 	{	
							'debug[all]':'Debug Gyro',	
							'debug[0]':'Gyro Raw [X]',
							'debug[1]':'Gyro Raw [Y]',
							'debug[2]':'Gyro Raw [Z]',
							'debug[3]':'Not Used',
						},
            'GYRO_FILTERED' : {
                            'debug[all]':'Debug Gyro Filtered',  
                            'debug[0]':'Gyro Filtered [X]',
                            'debug[1]':'Gyro Filtered [Y]',
                            'debug[2]':'Gyro Filtered [Z]',
                            'debug[3]':'Not Used',
                        },
			'ACCELEROMETER' : 	{	
							'debug[all]':'Debug Accel.',	
							'debug[0]':'Accel. Raw [X]',
							'debug[1]':'Accel. Raw [Y]',
							'debug[2]':'Accel. Raw [Z]',
							'debug[3]':'Not Used',
						},
			'MIXER' : 	{	
							'debug[all]':'Debug Mixer',	
							'debug[0]':'Roll-Pitch-Yaw Mix [0]',
							'debug[1]':'Roll-Pitch-Yaw Mix [1]',
							'debug[2]':'Roll-Pitch-Yaw Mix [2]',
							'debug[3]':'Roll-Pitch-Yaw Mix [3]',
						},
			'PIDLOOP' : 	{	
							'debug[all]':'Debug PID',	
							'debug[0]':'Wait Time',
							'debug[1]':'Sub Update Time',
							'debug[2]':'PID Update Time',
							'debug[3]':'Motor Update Time',
						},
			'NOTCH' : 	{	
							'debug[all]':'Debug Notch',	
							'debug[0]':'Gyro Pre-Notch [roll]',
							'debug[1]':'Gyro Pre-Notch [pitch]',
							'debug[2]':'Gyro Pre-Notch [yaw]',
							'debug[3]':'Not Used',
						},
            'GYRO_SCALED' : {
                            'debug[all]':'Debug Gyro Scaled', 
                            'debug[0]':'Gyro Scaled [roll]',
                            'debug[1]':'Gyro Scaled [pitch]',
                            'debug[2]':'Gyro Scaled [yaw]',
                            'debug[3]':'Not Used',
                        },
            'RC_INTERPOLATION' : {
                            'debug[all]':'Debug RC Interpolation',
                            'debug[0]':'Raw RC Command [roll]',
                            'debug[1]':'Current RX Refresh Rate',
                            'debug[2]':'Interpolation Step Count',
                            'debug[3]':'RC Setpoint [roll]',
                        },
            'RC_SMOOTHING' : {
                            'debug[all]':'Debug RC Smoothing',
                            'debug[0]':'Raw RC Command',
                            'debug[1]':'Raw RC Derivative',
                            'debug[2]':'Smoothed RC Derivative',
                            'debug[3]':'RX Refresh Rate',
                        },
            'RC_SMOOTHING_RATE' : {
                            'debug[all]':'Debug RC Smoothing Rate',
                            'debug[0]':'Current RX Refresh Rate',
                            'debug[1]':'Training Step Count',
                            'debug[2]':'Average RX Refresh Rate',
                            'debug[3]':'Sampling State',
                        },
			'DTERM_FILTER' : 	{	
							'debug[all]':'Debug Filter',	
							'debug[0]':'DTerm Filter [roll]',
							'debug[1]':'DTerm Filter [pitch]',
							'debug[2]':'Not Used',
							'debug[3]':'Not Used',
						},
			'ANGLERATE' : 	{	
							'debug[all]':'Debug Angle Rate',	
							'debug[0]':'Angle Rate[roll]',
							'debug[1]':'Angle Rate[pitch]',
							'debug[2]':'Angle Rate[yaw]',
							'debug[3]':'Not Used',
						},						
            'ESC_SENSOR' : 	{
                            'debug[all]':'ESC Sensor',
                            'debug[0]':'Motor Index',
                            'debug[1]':'Timeouts',
                            'debug[2]':'CNC errors',
                            'debug[3]':'Data age',
            },
            'SCHEDULER' : 	{
                            'debug[all]':'Scheduler',
                            'debug[0]':'Not Used',
                            'debug[1]':'Not Used',
                            'debug[2]':'Schedule Time',
                            'debug[3]':'Function Exec Time',
            },
            'STACK' : 	{
                            'debug[all]':'Stack',
                            'debug[0]':'Stack High Mem',
                            'debug[1]':'Stack Low Mem',
                            'debug[2]':'Stack Current',
                            'debug[3]':'Stack p',
            },
            'FFT' : {
                            'debug[all]':'Debug FFT',
                            'debug[0]':'Gyro Scaled [dbg-axis]',
                            'debug[1]':'Gyro Pre-Dyn [dbg-axis]',
                            'debug[2]':'Gyro Downsampled [roll]',
                            'debug[3]':'FFT Center Index [roll]',
    		},
            'FFT_TIME' : {
                            'debug[all]':'Debug FFT TIME',
                            'debug[0]':'Active calc step',
                            'debug[1]':'Step duration',
                            'debug[2]':'Additional steps',
                            'debug[3]':'Not used',
            },
            'FFT_FREQ' : {
                            'debug[all]':'Debug FFT FREQ',
                            'debug[0]':'Center Freq [roll]',
                            'debug[1]':'Center Freq [pitch]',
                            'debug[2]':'Gyro Pre-Dyn [dbg-axis]',
                            'debug[3]':'Gyro Scaled [dbg-axis]',
            },
            'GYRO_RAW' :   {
                            'debug[all]':'Debug Gyro Raw', 
                            'debug[0]':'Gyro Raw [X]',
                            'debug[1]':'Gyro Raw [Y]',
                            'debug[2]':'Gyro Raw [Z]',
                            'debug[3]':'Not Used',
                        },
            'DUAL_GYRO' : {
                            'debug[all]':'Debug Dual Gyro', 
                            'debug[0]':'Gyro 1 Filtered [roll]',
                            'debug[1]':'Gyro 1 Filtered [pitch]',
                            'debug[2]':'Gyro 2 Filtered [roll]',
                            'debug[3]':'Gyro 2 Filtered [pitch]',
            },
            'DUAL_GYRO_RAW': {
                            'debug[all]':'Debug Dual Gyro Raw', 
                            'debug[0]':'Gyro 1 Raw [roll]',
                            'debug[1]':'Gyro 1 Raw [pitch]',
                            'debug[2]':'Gyro 2 Raw [roll]',
                            'debug[3]':'Gyro 2 Raw [pitch]',
            },
            'DUAL_GYRO_COMBINED': {
                            'debug[all]':'Debug Dual Combined', 
                            'debug[0]':'Not Used',
                            'debug[1]':'Gyro Filtered [roll]',
                            'debug[2]':'Gyro Filtered [pitch]',
                            'debug[3]':'Not Used',
            },
            'DUAL_GYRO_DIFF': {
                            'debug[all]':'Debug Dual Gyro Diff', 
                            'debug[0]':'Gyro Diff [roll]',
                            'debug[1]':'Gyro Diff [pitch]',
                            'debug[2]':'Gyro Diff [yaw]',
                            'debug[3]':'Not Used',
            },
            'ESC_SENSOR_RPM' :   {
                            'debug[all]':'ESC RPM', 
                            'debug[0]':'ESC RPM [1]',
                            'debug[1]':'ESC RPM [2]',
                            'debug[2]':'ESC RPM [3]',
                            'debug[3]':'ESC RPM [4]',
                        },
            'DSHOT_RPM_TELEMETRY' :   {
                            'debug[all]':'DSHOT RPM', 
                            'debug[0]':'DSHOT RPM [1]',
                            'debug[1]':'DSHOT RPM [2]',
                            'debug[2]':'DSHOT RPM [3]',
                            'debug[3]':'DSHOT RPM [4]',
                        },
            'RPM_FILTER' :   {
                            'debug[all]':'RPM Filter', 
                            'debug[0]':'RPM Filter [1]',
                            'debug[1]':'RPM Filter [2]',
                            'debug[2]':'RPM Filter [3]',
                            'debug[3]':'RPM Filter [4]',
                        },
            'D_MIN' :   {
                            'debug[all]':'D_MIN',
                            'debug[0]':'Gyro Factor [roll]',
                            'debug[1]':'Setpoint Factor [roll]',
                            'debug[2]':'Actual D [roll]',
                            'debug[3]':'Actual D [pitch]',
                        },
            'ITERM_RELAX' :   {
                            'debug[all]':'I-term Relax',
                            'debug[0]':'Setpoint HPF [roll]',
                            'debug[1]':'I Relax Factor [roll]',
                            'debug[2]':'Relaxed I Error [roll]',
                            'debug[3]':'Axis Error [roll]',
                        },
            'DYN_LPF' : {
                            'debug[all]':'Debug Dyn LPF',
                            'debug[0]':'Gyro Scaled [dbg-axis]',
                            'debug[1]':'Notch Center [roll]',
                            'debug[2]':'Lowpass Cutoff',
                            'debug[3]':'Gyro Pre-Dyn [dbg-axis]',
            },
            'AC_CORRECTION' : {
                            'debug[all]':'AC Correction',
                            'debug[0]':'AC Correction [roll]',
                            'debug[1]':'AC Correction [pitch]',
                            'debug[2]':'AC Correction [yaw]',
                            'debug[3]':'Not Used',
            },
            'AC_ERROR' : {
                            'debug[all]':'AC Error',
                            'debug[0]':'AC Error [roll]',
                            'debug[1]':'AC Error [pitch]',
                            'debug[2]':'AC Error [yaw]',
                            'debug[3]':'Not Used',
            },
            'DUAL_GYRO_SCALED' : {
                            'debug[all]':'Dual Gyro Scaled',
                            'debug[0]':'Gyro 1 [roll]',
                            'debug[1]':'Gyro 1 [pitch]',
                            'debug[2]':'Gyro 2 [roll]',
                            'debug[3]':'Gyro 2 [pitch]',
            },
            'DSHOT_RPM_ERRORS' : {
                            'debug[all]':'DSHOT RPM Error', 
                            'debug[0]':'DSHOT RPM Error [1]',
                            'debug[1]':'DSHOT RPM Error [2]',
                            'debug[2]':'DSHOT RPM Error [3]',
                            'debug[3]':'DSHOT RPM Error [4]',
            },
            'CRSF_LINK_STATISTICS_UPLINK' : {
                            'debug[all]':'CRSF Stats Uplink', 
                            'debug[0]':'Uplink RSSI 1',
                            'debug[1]':'Uplink RSSI 2',
                            'debug[2]':'Uplink Link Quality',
                            'debug[3]':'RF Mode',
            },
            'CRSF_LINK_STATISTICS_PWR' : {
                            'debug[all]':'CRSF Stats Power', 
                            'debug[0]':'Antenna',
                            'debug[1]':'SNR',
                            'debug[2]':'TX Power',
                            'debug[3]':'Not Used',
            },
            'CRSF_LINK_STATISTICS_DOWN' : {
                            'debug[all]':'CRSF Stats Downlink', 
                            'debug[0]':'Downlink RSSI',
                            'debug[1]':'Downlink Link Quality',
                            'debug[2]':'Downlink SNR',
                            'debug[3]':'Not Used',
            },
            'BARO' : {
                            'debug[all]':'Debug Barometer', 
                            'debug[0]':'Baro State',
                            'debug[1]':'Baro Temperature',
                            'debug[2]':'Baro Pressure',
                            'debug[3]':'Baro Pressure Sum',
            },
            'GPS_RESCUE_THROTTLE_PID' : {
                            'debug[all]':'GPS Rescue Throttle PID', 
                            'debug[0]':'Throttle P',
                            'debug[1]':'Throttle I',
                            'debug[2]':'Throttle D',
                            'debug[3]':'Z Velocity',
            },
            'DYN_IDLE' : {
                            'debug[all]':'Dyn Idle', 
                            'debug[0]':'Motor Range Min Inc',
                            'debug[1]':'Target RPS Change Rate',
                            'debug[2]':'Error',
                            'debug[3]':'Min RPS',
            },
            'FF_LIMIT' : {
                            'debug[all]':'FF Limit', 
                            'debug[0]':'FF [Roll]',
                            'debug[1]':'FF [Pitch]',
                            'debug[2]':'FF Final [Roll]',
                            'debug[3]':'Not Used',
            },
            'FF_INTERPOLATED' : {
                            'debug[all]':'FF Interpolated', 
                            'debug[0]':'Setpoint Delta Impl [Roll]',
                            'debug[1]':'Boost Amount',
                            'debug[2]':'Boost Amount Clip [Roll]',
                            'debug[3]':'Clip',
            },
            'RTH' : {
                            'debug[all]':'RTH',
                            'debug[0]':'Rescue Throttle',
                            'debug[1]':'Rescue Angle',
                            'debug[2]':'Altitude Adjustment',
                            'debug[3]':'Rescue State',
            },
        };
    
    function presentFlags(flags, flagNames) {
        var 
            printedFlag = false,
            i,
            result = "";
        
        i = 0;
        
        while (flags > 0) {
            if ((flags & 1) != 0) {
                if (printedFlag) {
                    result += "|";
                } else {
                    printedFlag = true;
                }
                
                result += flagNames[i];
            }
            
            flags >>= 1;
            i++;
        }
        
        if (printedFlag) {
            return result;
        } else {
            return "0"; //No flags set
        }
    }

    // Only list events that have changed, flag with eirer go ON or OFF.
    FlightLogFieldPresenter.presentChangeEvent = function presentChangeEvent(flags, lastFlags, flagNames) {
        var eventState = '';
        var found = false;        
        for(var i = 0; i < flagNames.length; i++) {
           if((1<<i) & (flags ^ lastFlags)) { // State Changed
               eventState += '|' + flagNames[i] + ' ' + (((1<<i) & flags)?'ON':'OFF')
               found = true;
           } 
        }
        if(!found) {eventState += ' | ACRO';} // Catch the state when all flags are off, which is ACRO of course
        return eventState;
    }
    
    FlightLogFieldPresenter.presentEnum = function presentEnum(value, enumNames) {
        if (enumNames[value] === undefined)
            return value;
        
        return enumNames[value];
    };

    /**
     * Attempt to decode the given raw logged value into something more human readable, or return an empty string if
     * no better representation is available.
     * 
     * @param fieldName Name of the field
     * @param value Value of the field
     */
    FlightLogFieldPresenter.decodeFieldToFriendly = function(flightLog, fieldName, value, currentFlightMode) {
        if (value === undefined)
            return "";
        
        switch (fieldName) {
            case 'time':
                return formatTime(value / 1000, true);
            
            case 'gyroADC[0]':
            case 'gyroADC[1]':
            case 'gyroADC[2]':
                return Math.round(flightLog.gyroRawToDegreesPerSecond(value)) + " deg/s";
                
            case 'gyroADCs[0]':
            case 'gyroADCs[1]':
            case 'gyroADCs[2]':
                return value.toFixed(0) + " deg/s";

            case 'axisError[0]':
            case 'axisError[1]':
            case 'axisError[2]':
                return Math.round(value) + " deg/s";

            case 'rcCommand[0]':
            case 'rcCommand[1]':
            case 'rcCommand[2]':
                return (value + 1500).toFixed(0) + " us";
            case 'rcCommand[3]':
                return value.toFixed(0) + " us";

            case 'motor[0]':
            case 'motor[1]':
            case 'motor[2]':
            case 'motor[3]':
            case 'motor[4]':
            case 'motor[5]':
            case 'motor[6]':
            case 'motor[7]':
                return `${flightLog.rcMotorRawToPctPhysical(value).toFixed(2)} %`;

            case 'motorLegacy[0]':
            case 'motorLegacy[1]':
            case 'motorLegacy[2]':
            case 'motorLegacy[3]':
            case 'motorLegacy[4]':
            case 'motorLegacy[5]':
            case 'motorLegacy[6]':
            case 'motorLegacy[7]':
                return `${flightLog.rcMotorRawToPctEffective(value).toFixed(2)} % (${value})`;

            case 'rcCommands[0]':
            case 'rcCommands[1]':
            case 'rcCommands[2]':
                return value.toFixed(0) + " deg/s";
            case 'rcCommands[3]':
                return value.toFixed(1) + "%";

            case 'axisSum[0]':
            case 'axisSum[1]':
            case 'axisSum[2]':
            case 'axisP[0]':
            case 'axisP[1]':
            case 'axisP[2]':
            case 'axisI[0]':
            case 'axisI[1]':
            case 'axisI[2]':
            case 'axisD[0]':
            case 'axisD[1]':
            case 'axisD[2]':
            case 'axisF[0]':
            case 'axisF[1]':
            case 'axisF[2]':
                return flightLog.getPIDPercentage(value).toFixed(1) + "%";

            case 'accSmooth[0]':
            case 'accSmooth[1]':
            case 'accSmooth[2]':
                return flightLog.accRawToGs(value).toFixed(2) + "g";
            
            case 'vbatLatest':
                if(flightLog.getSysConfig().firmwareType == FIRMWARE_TYPE_BETAFLIGHT  && semver.gte(flightLog.getSysConfig().firmwareVersion, '4.0.0')) {
                    return (value / 100).toFixed(2) + "V" + ", " + (value / 100 / flightLog.getNumCellsEstimate()).toFixed(2) + "V/cell";
                } else if((flightLog.getSysConfig().firmwareType == FIRMWARE_TYPE_BETAFLIGHT  && semver.gte(flightLog.getSysConfig().firmwareVersion, '3.1.0')) ||
                   (flightLog.getSysConfig().firmwareType == FIRMWARE_TYPE_CLEANFLIGHT && semver.gte(flightLog.getSysConfig().firmwareVersion, '2.0.0'))) {
                    return (value / 10).toFixed(2) + "V" + ", " + (value / 10 / flightLog.getNumCellsEstimate()).toFixed(2) + "V/cell";
                } else {
                    return (flightLog.vbatADCToMillivolts(value) / 1000).toFixed(2) + "V" + ", " + (flightLog.vbatADCToMillivolts(value) / 1000 / flightLog.getNumCellsEstimate()).toFixed(2) + "V/cell";
                }

            case 'amperageLatest':
                if((flightLog.getSysConfig().firmwareType == FIRMWARE_TYPE_BETAFLIGHT  && semver.gte(flightLog.getSysConfig().firmwareVersion, '3.1.7')) ||
                   (flightLog.getSysConfig().firmwareType == FIRMWARE_TYPE_CLEANFLIGHT && semver.gte(flightLog.getSysConfig().firmwareVersion, '2.0.0'))) {
                       return (value / 100).toFixed(2) + "A" + ", " + (value / 100 / flightLog.getNumMotors()).toFixed(2) + "A/motor";
                } else if(flightLog.getSysConfig().firmwareType == FIRMWARE_TYPE_BETAFLIGHT  && semver.gte(flightLog.getSysConfig().firmwareVersion, '3.1.0')) {
                    return (value / 100).toFixed(2) + "A" + ", " + (value / 100 / flightLog.getNumMotors()).toFixed(2) + "A/motor";
                } else {
                    return (flightLog.amperageADCToMillivolts(value) / 1000).toFixed(2) + "A" + ", " + (flightLog.amperageADCToMillivolts(value) / 1000 / flightLog.getNumMotors()).toFixed(2) + "A/motor";
                }

            case 'heading[0]':
            case 'heading[1]':
            case 'heading[2]':
                return (value / Math.PI * 180).toFixed(1) + "°";
            
            case 'BaroAlt':
                return (value / 100).toFixed(1) + "m";
            
            case 'flightModeFlags':
                return presentFlags(value, FLIGHT_LOG_FLIGHT_MODE_NAME);
                
            case 'stateFlags':
                return presentFlags(value, FLIGHT_LOG_FLIGHT_STATE_NAME);
                
            case 'failsafePhase':
                return FlightLogFieldPresenter.presentEnum(value, FLIGHT_LOG_FAILSAFE_PHASE_NAME);
                
            case 'features':
                return FlightLogFieldPresenter.presentEnum(value, FLIGHT_LOG_FEATURES); 

            case 'rssi':
                return (value / 1024 * 100).toFixed(2) + "%";

            case 'debug[0]':
            case 'debug[1]':
            case 'debug[2]':
            case 'debug[3]':
            	return FlightLogFieldPresenter.decodeDebugFieldToFriendly(flightLog, fieldName, value, currentFlightMode);

            default:
                return "";
        }
    };
    
    FlightLogFieldPresenter.decodeDebugFieldToFriendly = function(flightLog, fieldName, value, currentFlightMode) {
		if(flightLog) {
			var debugModeName = DEBUG_MODE[flightLog.getSysConfig().debug_mode]; // convert to recognisable name
			switch (debugModeName) {
				case 'NONE':
				case 'AIRMODE':
				case 'VELOCITY':
					return "";
				case 'CYCLETIME':
					switch (fieldName) {
						case 'debug[1]':
							return value.toFixed(0) + "%";
						default:
							return value.toFixed(0) + "\u03BCS";
					}				
				case 'PIDLOOP': 
					return value.toFixed(0) + "\u03BCS";
				case 'BATTERY':
					switch (fieldName) {
						case 'debug[0]':
							return value.toFixed(0);
						default:
							return (value/10).toFixed(1) + "V"
					}	
                case 'GYRO':
                case 'GYRO_FILTERED':
                case 'GYRO_SCALED':
                case 'NOTCH':
                case 'DUAL_GYRO':
                case 'DUAL_GYRO_COMBINED':
                case 'DUAL_GYRO_DIFF':
                case 'DUAL_GYRO_RAW':
                    return Math.round(flightLog.gyroRawToDegreesPerSecond(value)) + "deg/s";
				case 'ACCELEROMETER':
				    return flightLog.accRawToGs(value).toFixed(2) + "g";
				case 'MIXER':
					return Math.round(flightLog.rcCommandRawToThrottle(value)) + " %";
                case 'RC_INTERPOLATION':
                    switch (fieldName) {
                        case 'debug[1]': // current RX refresh rate
                            return value.toFixed(0) + 'ms';
                        case 'debug[3]': // setpoint [roll]
                            return value.toFixed(0) + 'deg/s';
                    }
                    break;
                case 'RC_SMOOTHING':
                    switch (fieldName) {
                        case 'debug[0]':
                            return (value + 1500).toFixed(0) + " us";
                        case 'debug[3]': // rx frame rate [us]
                            return (value / 1000).toFixed(1) + 'ms';
                    }
                    break;
                case 'RC_SMOOTHING_RATE':
                    switch (fieldName) {
                        case 'debug[0]': // current frame rate [us]
                        case 'debug[2]': // average frame rate [us]
                            return (value / 1000).toFixed(2) + 'ms';
                    }
                    break;
				case 'DFILTER':
					return "";
                case 'ANGLERATE':
                    return value.toFixed(0) + "deg/s";
                case 'ESC_SENSOR':
                    switch (fieldName) {
                        case 'debug[3]':
                            return value.toFixed(0) + "\u03BCS";
                        default:
                            return value.toFixed(0) + "";
                    }
                case 'ESC_SENSOR_RPM':
                    return value.toFixed(0) + "rpm";
                case 'ESC_SENSOR_TMP':
                    return value.toFixed(0) + "°C";
                case 'SCHEDULER':
                    return value.toFixed(0) + "\u03BCS";
                case 'STACK':
                    return value.toFixed(0);
                case 'FFT':
                    switch (fieldName) {
                    case 'debug[0]': // gyro scaled [for selected axis]
                    case 'debug[1]': // pre-dyn notch gyro [for selected axis]
                    case 'debug[2]': // pre-dyn notch gyro FFT downsampled [roll]
                        return Math.round(flightLog.gyroRawToDegreesPerSecond(value)) + "deg/s";
                    case 'debug[3]': // FFT bin mean index
                        return (value / 100).toFixed(2);
                    }
                    break;
                case 'FFT_TIME':
                    switch (fieldName) {
                    case 'debug[0]':
                        return FlightLogFieldPresenter.presentEnum(value, FFT_CALC_STEPS);
                    case 'debug[1]':
                    case 'debug[2]':
                        return value.toFixed(0) + "\u03BCs";
                    }
                    break;
                case 'FFT_FREQ':
                    switch (fieldName) {
                    case 'debug[2]': // pre-dyn notch gyro [for selected axis]
                    case 'debug[3]': // raw gyro [for selected axis]
                        return Math.round(flightLog.gyroRawToDegreesPerSecond(value)) + "deg/s";
                    default:
                        return value.toFixed(0) + "Hz";
                    }
                case 'DSHOT_RPM_TELEMETRY':
                    return value.toFixed(0) + "erpm";
                case 'RPM_FILTER':
                    return value.toFixed(0) + "Hz";
                case 'D_MIN':
                    switch (fieldName) {
                        case 'debug[0]': // roll gyro factor
                        case 'debug[1]': // roll setpoint Factor
                            return value.toFixed(0) + '%';
                        case 'debug[2]': // roll actual D
                        case 'debug[3]': // pitch actual D
                            return (value / 10).toFixed(1);
                    }
                    break;
                case 'ITERM_RELAX':
                    switch (fieldName) {
                        case 'debug[0]': // roll setpoint high-pass filtered
                            return value.toFixed(0) + 'deg/s';
                        case 'debug[1]': // roll I-term relax factor
                            return value.toFixed(0) + '%';
                        case 'debug[3]': // roll absolute control axis error
                            return (value / 10).toFixed(1) + 'deg';
                    }
                    break;
                case 'DYN_LPF':
                    switch (fieldName) {
                        case 'debug[0]': // gyro scaled [for selected axis]
                        case 'debug[3]': // pre-dyn notch gyro [for selected axis]
                            return Math.round(flightLog.gyroRawToDegreesPerSecond(value)) + "deg/s";
                        default:
                            return value.toFixed(0) + "Hz";
                    }
                    break;
                case 'AC_ERROR':
                    return (value / 10).toFixed(1) + 'deg';
                case 'AC_CORRECTION':
                    return (value / 10).toFixed(1) + 'deg/s';
                case 'GPS_RESCUE_THROTTLE_PID':
                        return value.toFixed(0);
                case 'RTH':
                    switch(fieldName) {
                        case 'debug[1]':
                            return (value / 100).toFixed(1) + 'deg';
                        default:
                            return value.toFixed(0);
                        }
                        break;
            }
            return value.toFixed(0);
		}
		return "";
	};
        
    FlightLogFieldPresenter.fieldNameToFriendly = function(fieldName, debugMode) {
        if (debugMode) {
			if(fieldName.includes('debug')) {
                var debugModeName = DEBUG_MODE[debugMode];
                var debugFields;
                if (debugModeName) {
				    debugFields = DEBUG_FRIENDLY_FIELD_NAMES[debugModeName];
                }

                if (!debugFields) {
                    if (fieldName === 'debug[all]') {
                        return 'Debug (' + (debugModeName || debugMode) + ')';
                    }
                    debugFields = DEBUG_FRIENDLY_FIELD_NAMES[DEBUG_MODE[0]];
                }

				return debugFields[fieldName];
			}			
    	}
        if (FRIENDLY_FIELD_NAMES[fieldName]) {
            return FRIENDLY_FIELD_NAMES[fieldName];
        }
        
        return fieldName;
    };
})();

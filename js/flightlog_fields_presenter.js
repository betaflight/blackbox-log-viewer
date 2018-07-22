"use strict";

function FlightLogFieldPresenter() {
}

(function() {
    var FRIENDLY_FIELD_NAMES = {

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
        'rcCommands[all]': 'RC Rates',
        'rcCommands[0]' : 'RC Rate [roll]',
        'rcCommands[1]' : 'RC Rate [pitch]',
        'rcCommands[2]' : 'RC Rate [yaw]',
        'rcCommands[3]' : 'RC Rate [throttle]',

        'rcCommand[all]': 'RC Commands',
        'rcCommand[0]': 'RC Command [roll]',
        'rcCommand[1]': 'RC Command [pitch]',
        'rcCommand[2]': 'RC Command [yaw]',
        'rcCommand[3]': 'RC Command [throttle]',

        'gyroADC[all]': 'Gyros',
        'gyroADC[0]': 'Gyro [roll]',
        'gyroADC[1]': 'Gyro [pitch]',
        'gyroADC[2]': 'Gyro [yaw]',

        //Virtual field
        'gyroADCs[all]': 'Gyros Scaled',
        'gyroADCs[0]': 'Gyro Scaled [roll]',
        'gyroADCs[1]': 'Gyro Scaled [pitch]',
        'gyroADCs[2]': 'Gyro Scaled [yaw]',

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
			'RC_INTERPOLATION' : 	{	
							'debug[all]':'Debug RC',	
							'debug[0]':'RC Command Raw [roll]',
							'debug[1]':'RC Command Raw [pitch]',
							'debug[2]':'RC Command Raw [yaw]',
							'debug[3]':'RX Refresh Rate',
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
    		                'debug[0]':'Gyro Raw [roll]',
    		                'debug[1]':'Gyro Dyn Notch [roll]',
    		                'debug[2]':'Gyro BPF [roll]',
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
                            'debug[2]':'Center Freq [yaw]',
                            'debug[3]':'Not used',
            },
            'GYRO_RAW' :   {
                            'debug[all]':'Debug Gyro Raw', 
                            'debug[0]':'Gyro Raw [X]',
                            'debug[1]':'Gyro Raw [Y]',
                            'debug[2]':'Gyro Raw [Z]',
                            'debug[3]':'Not Used',
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
        for(var i=0; i<=31; i++) {
           if((1<<i) & (flags ^ lastFlags)) { // State Changed
               eventState += '|' + flagNames[i] + ' ' + (((1<<i) & flags)?'ON':'OFF')
               found = true;
           } 
        }
        if(!found) {eventState += ' | ACRO';} // Catch the state when all flags are off, which is ACRO of course
        return eventState;
    }
    
    function presentEnum(value, enumNames) {
        if (enumNames[value] === undefined)
            return value;
        
        return enumNames[value];
    }

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
                return Math.round(flightLog.rcMotorRawToPct(value)) + " %";

            case 'rcCommands[0]':
            case 'rcCommands[1]':
            case 'rcCommands[2]':
                return value.toFixed(0) + " deg/s";
            case 'rcCommands[3]':
                return value.toFixed(0) + "%";

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
                if((flightLog.getSysConfig().firmwareType == FIRMWARE_TYPE_BETAFLIGHT  && semver.gte(flightLog.getSysConfig().firmwareVersion, '3.1.0')) ||
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
                return presentEnum(value, FLIGHT_LOG_FAILSAFE_PHASE_NAME);
                
            case 'features':
                return presentEnum(value, FLIGHT_LOG_FEATURES); 

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
                    return Math.round(flightLog.gyroRawToDegreesPerSecond(value)) + "deg/s";
				case 'ACCELEROMETER':
				    return flightLog.accRawToGs(value).toFixed(2) + "g";
				case 'MIXER':
					return Math.round(flightLog.rcCommandRawToThrottle(value)) + " %";
				case 'RC_INTERPOLATION':
					switch (fieldName) {
						case 'debug[3]':
							return (value / 1000).toFixed(0) + 'mS';
						default:
							return value.toFixed(0);
					}				
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
                    return Math.round(flightLog.gyroRawToDegreesPerSecond(value)) + "deg/s";
                case 'FFT_TIME':
                    return value.toFixed(0) + "\u03BCS";
                case 'FFT_FREQ':
                    return value.toFixed(0) + "Hz";
                default:
					return value.toFixed(0);
			}	
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

"use strict";

function FlightLogFieldPresenter() {
}

(function() {
    var FRIENDLY_FIELD_NAMES = {
        'axisP[all]': 'PID_P',
        'axisP[0]': 'PID_P[roll]',
        'axisP[1]': 'PID_P[pitch]',
        'axisP[2]': 'PID_P[yaw]',
        'axisI[all]': 'PID_I',
        'axisI[0]': 'PID_I[roll]',
        'axisI[1]': 'PID_I[pitch]',
        'axisI[2]': 'PID_I[yaw]',
        'axisD[all]': 'PID_D',
        'axisD[0]': 'PID_D[roll]',
        'axisD[1]': 'PID_D[pitch]',
        'axisD[2]': 'PID_D[yaw]',
        
        'rcCommand[all]': 'rcCommand',
        'rcCommand[0]': 'rcCommand[roll]',
        'rcCommand[1]': 'rcCommand[pitch]',
        'rcCommand[2]': 'rcCommand[yaw]',
        'rcCommand[3]': 'rcCommand[throttle]',
    
        'gyroADC[all]': 'gyro',
        'gyroADC[0]': 'gyro[roll]',
        'gyroADC[1]': 'gyro[pitch]',
        'gyroADC[2]': 'gyro[yaw]',
    
        'accSmooth[all]': 'acc',
        'accSmooth[0]': 'acc[X]',
        'accSmooth[1]': 'acc[Y]',
        'accSmooth[2]': 'acc[Z]',
        
        'magADC[all]': 'mag',
        'magADC[0]': 'mag[X]',
        'magADC[1]': 'mag[Y]',
        'magADC[2]': 'mag[Z]',
    
        'vbatLatest': 'vbat',
        'BaroAlt': 'baro',
        
        'servo[all]': 'servos',
        'servo[5]': 'tail servo',
        
        'heading[all]': 'heading',
        'heading[0]': 'heading[roll]',
        'heading[1]': 'heading[pitch]',
        'heading[2]': 'heading[yaw]',
        
        //End-users prefer 1-based indexing
        'motor[all]': 'motors',
        'motor[0]': 'motor[1]', 'motor[1]': 'motor[2]', 'motor[2]': 'motor[3]', 'motor[3]': 'motor[4]',
        'motor[4]': 'motor[5]', 'motor[5]': 'motor[6]', 'motor[6]': 'motor[7]', 'motor[7]': 'motor[8]',
        
        //Virtual fields
        'axisSum[all]': 'PID_sum',
        'axisSum[0]' : 'PID_sum[roll]',
        'axisSum[1]' : 'PID_sum[pitch]',
        'axisSum[2]' : 'PID_sum[yaw]',

        //Virtual fields - Add the Error fields
        'axisError[all]': 'PID_Error',
        'axisError[0]' : 'PID_Error[roll]',
        'axisError[1]' : 'PID_Error[pitch]',
        'axisError[2]' : 'PID_Error[yaw]',

        //Virtual fields - add the Scaled rcCommands
        'rcCommands[all]': 'setpointRates',
        'rcCommands[0]' : 'setpointRate[roll]',
        'rcCommands[1]' : 'setpointRate[pitch]',
        'rcCommands[2]' : 'setpointRate[yaw]',

        //Virtual fields - add the Scaled gyros
        'gyroADCs[all]': 'gyros',
        'gyroADCs[0]': 'gyros[roll]',
        'gyroADCs[1]': 'gyros[pitch]',
        'gyroADCs[2]': 'gyros[yaw]'        

    };
    
    	var DEBUG_FRIENDLY_FIELD_NAMES = { 
			'NONE' : 	{
							'debug[all]':'debug[all]',	
							'debug[0]':'debug[0]',
							'debug[1]':'debug[1]',
							'debug[2]':'debug[2]',
							'debug[3]':'debug[3]',
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
							'debug[0]':'vbat_ADC',
							'debug[1]':'vbat',
							'debug[2]':'Not Used',
							'debug[3]':'Not Used',
						},
			'GYRO' : 	{	
							'debug[all]':'Debug Gyro',	
							'debug[0]':'gyro_raw[X]',
							'debug[1]':'gyro_raw[Y]',
							'debug[2]':'gyro_raw[Z]',
							'debug[3]':'Not Used',
						},
			'ACCELEROMETER' : 	{	
							'debug[all]':'Debug Acc',	
							'debug[0]':'acc_raw[X]',
							'debug[1]':'acc_raw[Y]',
							'debug[2]':'acc_raw[Z]',
							'debug[3]':'Not Used',
						},
			'MIXER' : 	{	
							'debug[all]':'Debug Mixer',	
							'debug[0]':'rollPitchYawMix[0]',
							'debug[1]':'rollPitchYawMix[1]',
							'debug[2]':'rollPitchYawMix[2]',
							'debug[3]':'rollPitchYawMix[3]',
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
							'debug[0]':'gyro_preNotch[roll]',
							'debug[1]':'gyro_preNotch[pitch]',
							'debug[2]':'gyro_preNotch[yaw]',
							'debug[3]':'Not Used',
						},
			'RC_INTERPOLATION' : 	{	
							'debug[all]':'Debug RC',	
							'debug[0]':'rcCommand_raw[roll]',
							'debug[1]':'rcCommand_raw[pitch]',
							'debug[2]':'rcCommand_raw[yaw]',
							'debug[3]':'rxRefreshRate',
						},
			'DTERM_FILTER' : 	{	
							'debug[all]':'Debug Filter',	
							'debug[0]':'dterm_filter[roll]',
							'debug[1]':'dterm_filter[pitch]',
							'debug[2]':'Not Used',
							'debug[3]':'Not Used',
						},
			'ANGLERATE' : 	{	
							'debug[all]':'Debug Anglerate',	
							'debug[0]':'Anglerate[roll]',
							'debug[1]':'Anglerate[pitch]',
							'debug[2]':'Anglerate[yaw]',
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
    		                'debug[0]':'gyro_raw[roll]',
    		                'debug[1]':'gyro_dyn_notch[roll]',
    		                'debug[2]':'gyro_bpf[roll]',
    		                'debug[3]':'fft_center_index[roll]',    		
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
                            'debug[0]':'center_freq[roll]',
                            'debug[1]':'center_freq[pitch]',
                            'debug[2]':'center_freq[yaw]',
                            'debug[3]':'Not used',
            },
            'GYRO_RAW' :   {
                            'debug[all]':'Debug Gyro Raw', 
                            'debug[0]':'gyro_raw[X]',
                            'debug[1]':'gyro_raw[Y]',
                            'debug[2]':'gyro_raw[Z]',
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
                return Math.round(flightLog.rcCommandRawToDegreesPerSecond(value,0), currentFlightMode) + " deg/s";
            case 'rcCommand[1]':
                return Math.round(flightLog.rcCommandRawToDegreesPerSecond(value,1), currentFlightMode) + " deg/s";
            case 'rcCommand[2]':
                return Math.round(flightLog.rcCommandRawToDegreesPerSecond(value,2), currentFlightMode) + " deg/s";

            case 'rcCommand[3]':
                return Math.round(flightLog.rcCommandRawToThrottle(value)) + " %";
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
                if((flightLog.getSysConfig().firmwareType == FIRMWARE_TYPE_BETAFLIGHT  && semver.gte(flightLog.getSysConfig().firmwareVersion, '3.1.0')) ||
                   (flightLog.getSysConfig().firmwareType == FIRMWARE_TYPE_CLEANFLIGHT && semver.gte(flightLog.getSysConfig().firmwareVersion, '2.0.0'))) {
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
                case 'DEBUG_ESC_SENSOR_RPM':
                    return value.toFixed(0) + "rpm";
                case 'DEBUG_ESC_SENSOR_TMP':
                    return value.toFixed(0) + "°C";
                case 'SCHEDULER':
                    return value.toFixed(0) + "\u03BCS";
                case 'STACK':
                    return value.toFixed(0);
                case 'DEBUG_FFT':
                    return Math.round(flightLog.gyroRawToDegreesPerSecond(value)) + "deg/s";
                case 'DEBUG_FFT_TIME':
                    return value.toFixed(0) + "\u03BCS";
                case 'DEBUG_FFT_FREQ':
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

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
        'rcCommands[all]': 'rcCommands',
        'rcCommands[0]' : 'rcCommands[roll]',
        'rcCommands[1]' : 'rcCommands[pitch]',
        'rcCommands[2]' : 'rcCommands[yaw]',

        //Virtual fields - add the Scaled gyros
        'gyroADCs[all]': 'gyros',
        'gyroADCs[0]': 'gyros[roll]',
        'gyroADCs[1]': 'gyros[pitch]',
        'gyroADCs[2]': 'gyros[yaw]'        

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

            case 'rcCommands[0]':
            case 'rcCommands[1]':
            case 'rcCommands[2]':
                return value.toFixed(0) + " deg/s";
               
            case 'accSmooth[0]':
            case 'accSmooth[1]':
            case 'accSmooth[2]':
                return flightLog.accRawToGs(value).toFixed(2) + "g";
            
            case 'vbatLatest':
                return (flightLog.vbatADCToMillivolts(value) / 1000).toFixed(2) + "V" + ", " + (flightLog.vbatADCToMillivolts(value) / 1000 / flightLog.getNumCellsEstimate()).toFixed(2) + "V/cell";
    
            case 'amperageLatest':
                return (flightLog.amperageADCToMillivolts(value) / 1000).toFixed(2) + "A" + ", " + (flightLog.amperageADCToMillivolts(value) / 1000 / flightLog.getNumMotors()).toFixed(2) + "A/motor";
    
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
                
            default:
                return "";
        }
    };
        
    FlightLogFieldPresenter.fieldNameToFriendly = function(fieldName) {
        if (FRIENDLY_FIELD_NAMES[fieldName]) {
            return FRIENDLY_FIELD_NAMES[fieldName];
        }
        
        return fieldName;
    };
})();

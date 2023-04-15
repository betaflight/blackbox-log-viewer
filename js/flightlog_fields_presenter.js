"use strict";

function FlightLogFieldPresenter() {
    // this is intentional
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

        'servo[all]': 'Servos',
        'servo[5]': 'Servo Tail',

        'vbatLatest': 'Battery volt.',
        'amperageLatest': 'Amperage',
        'baroAlt': 'Barometer',

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

        'GPS_numSat': "GPS Sat Count",
        'GPS_coord[0]': "GPS Latitude",
        'GPS_coord[1]': "GPS Longitude",
        'GPS_altitude': "GPS Altitude ASL",
        'GPS_speed': "GPS Speed",
        'GPS_ground_course': "GPS Heading",
    };

    const DEBUG_FRIENDLY_FIELD_NAMES_INITIAL = {
        'NONE' : {
            'debug[all]':'Debug [all]',
            'debug[0]':'Debug [0]',
            'debug[1]':'Debug [1]',
            'debug[2]':'Debug [2]',
            'debug[3]':'Debug [3]',
            'debug[4]':'Debug [4]',
            'debug[5]':'Debug [5]',
            'debug[6]':'Debug [6]',
            'debug[7]':'Debug [7]',
        },
        'CYCLETIME' : {
            'debug[all]':'Debug Cycle Time',
            'debug[0]':'Cycle Time',
            'debug[1]':'CPU Load',
            'debug[2]':'Motor Update',
            'debug[3]':'Motor Deviation',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'BATTERY' : {
            'debug[all]':'Debug Battery',
            'debug[0]':'Battery Volt ADC',
            'debug[1]':'Battery Volt',
            'debug[2]':'Not Used',
            'debug[3]':'Not Used',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'GYRO' : {
            'debug[all]':'Debug Gyro',
            'debug[0]':'Gyro Raw [X]',
            'debug[1]':'Gyro Raw [Y]',
            'debug[2]':'Gyro Raw [Z]',
            'debug[3]':'Not Used',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'GYRO_FILTERED' : {
            'debug[all]':'Debug Gyro Filtered',
            'debug[0]':'Gyro Filtered [X]',
            'debug[1]':'Gyro Filtered [Y]',
            'debug[2]':'Gyro Filtered [Z]',
            'debug[3]':'Not Used',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'ACCELEROMETER' : {
            'debug[all]':'Debug Accel.',
            'debug[0]':'Accel. Raw [X]',
            'debug[1]':'Accel. Raw [Y]',
            'debug[2]':'Accel. Raw [Z]',
            'debug[3]':'Not Used',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'MIXER' : {
            'debug[all]':'Debug Mixer',
            'debug[0]':'Roll-Pitch-Yaw Mix [0]',
            'debug[1]':'Roll-Pitch-Yaw Mix [1]',
            'debug[2]':'Roll-Pitch-Yaw Mix [2]',
            'debug[3]':'Roll-Pitch-Yaw Mix [3]',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'PIDLOOP' : {
            'debug[all]':'Debug PID',
            'debug[0]':'Wait Time',
            'debug[1]':'Sub Update Time',
            'debug[2]':'PID Update Time',
            'debug[3]':'Motor Update Time',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'NOTCH' : {
            'debug[all]':'Debug Notch',
            'debug[0]':'Gyro Pre-Notch [roll]',
            'debug[1]':'Gyro Pre-Notch [pitch]',
            'debug[2]':'Gyro Pre-Notch [yaw]',
            'debug[3]':'Not Used',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'GYRO_SCALED' : {
            'debug[all]':'Debug Gyro Scaled',
            'debug[0]':'Gyro Scaled [roll]',
            'debug[1]':'Gyro Scaled [pitch]',
            'debug[2]':'Gyro Scaled [yaw]',
            'debug[3]':'Not Used',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'RC_INTERPOLATION' : {
            'debug[all]':'Debug RC Interpolation',
            'debug[0]':'Raw RC Command [roll]',
            'debug[1]':'Current RX Refresh Rate',
            'debug[2]':'Interpolation Step Count',
            'debug[3]':'RC Setpoint [roll]',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'DTERM_FILTER' : {
            'debug[all]':'Debug Filter',
            'debug[0]':'DTerm Filter [roll]',
            'debug[1]':'DTerm Filter [pitch]',
            'debug[2]':'Not Used',
            'debug[3]':'Not Used',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'ANGLERATE' : {
            'debug[all]':'Debug Angle Rate',
            'debug[0]':'Angle Rate[roll]',
            'debug[1]':'Angle Rate[pitch]',
            'debug[2]':'Angle Rate[yaw]',
            'debug[3]':'Not Used',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'ESC_SENSOR' : {
            'debug[all]':'ESC Sensor',
            'debug[0]':'Motor Index',
            'debug[1]':'Timeouts',
            'debug[2]':'CNC errors',
            'debug[3]':'Data age',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'SCHEDULER' : {
            'debug[all]':'Scheduler',
            'debug[0]':'Not Used',
            'debug[1]':'Not Used',
            'debug[2]':'Schedule Time',
            'debug[3]':'Function Exec Time',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'STACK' : {
            'debug[all]':'Stack',
            'debug[0]':'Stack High Mem',
            'debug[1]':'Stack Low Mem',
            'debug[2]':'Stack Current',
            'debug[3]':'Stack p',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'ESC_SENSOR_RPM' : {
            'debug[all]':'ESC Sensor RPM',
            'debug[0]':'Motor 1',
            'debug[1]':'Motor 2',
            'debug[2]':'Motor 3',
            'debug[3]':'Motor 4',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'ESC_SENSOR_TMP' : {
            'debug[all]':'ESC Sensor Temp',
            'debug[0]':'Motor 1',
            'debug[1]':'Motor 2',
            'debug[2]':'Motor 3',
            'debug[3]':'Motor 4',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'ALTITUDE' : {
            'debug[all]':'Altitude',
            'debug[0]':'GPS Trust * 100',
            'debug[1]':'Baro Altitude',
            'debug[2]':'GPS Altitude',
            'debug[3]':'Vario',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'FFT' : {
            'debug[all]':'Debug FFT',
            'debug[0]':'Gyro Scaled [dbg-axis]',
            'debug[1]':'Gyro Pre-Dyn [dbg-axis]',
            'debug[2]':'Gyro Downsampled [roll]',
            'debug[3]':'FFT Center Index [roll]',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'FFT_TIME' : {
            'debug[all]':'Debug FFT TIME',
            'debug[0]':'Active calc step',
            'debug[1]':'Step duration',
            'debug[2]':'Additional steps',
            'debug[3]':'Not used',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'FFT_FREQ' : {
            'debug[all]':'Debug FFT FREQ',
            'debug[0]':'Center Freq [roll]',
            'debug[1]':'Center Freq [pitch]',
            'debug[2]':'Gyro Pre-Dyn [dbg-axis]',
            'debug[3]':'Gyro Scaled [dbg-axis]',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'RX_FRSKY_SPI' : {
            'debug[all]':'FrSky SPI Rx',
            'debug[0]':'Looptime',
            'debug[1]':'Packet',
            'debug[2]':'Missing Packets',
            'debug[3]':'State',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'RX_SFHSS_SPI' : {
            'debug[all]':'SFHSS SPI Rx',
            'debug[0]':'State',
            'debug[1]':'Missing Frame',
            'debug[2]':'Offset Max',
            'debug[3]':'Offset Min',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'GYRO_RAW' : {
            'debug[all]':'Debug Gyro Raw',
            'debug[0]':'Gyro Raw [X]',
            'debug[1]':'Gyro Raw [Y]',
            'debug[2]':'Gyro Raw [Z]',
            'debug[3]':'Not Used',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'DUAL_GYRO' : {
            'debug[all]':'Debug Dual Gyro',
            'debug[0]':'Gyro 1 Filtered [roll]',
            'debug[1]':'Gyro 1 Filtered [pitch]',
            'debug[2]':'Gyro 2 Filtered [roll]',
            'debug[3]':'Gyro 2 Filtered [pitch]',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'DUAL_GYRO_RAW': {
            'debug[all]':'Debug Dual Gyro Raw',
            'debug[0]':'Gyro 1 Raw [roll]',
            'debug[1]':'Gyro 1 Raw [pitch]',
            'debug[2]':'Gyro 2 Raw [roll]',
            'debug[3]':'Gyro 2 Raw [pitch]',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'DUAL_GYRO_COMBINED': {
            'debug[all]':'Debug Dual Combined',
            'debug[0]':'Not Used',
            'debug[1]':'Gyro Filtered [roll]',
            'debug[2]':'Gyro Filtered [pitch]',
            'debug[3]':'Not Used',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'DUAL_GYRO_DIFF': {
            'debug[all]':'Debug Dual Gyro Diff',
            'debug[0]':'Gyro Diff [roll]',
            'debug[1]':'Gyro Diff [pitch]',
            'debug[2]':'Gyro Diff [yaw]',
            'debug[3]':'Not Used',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'MAX7456_SIGNAL' : {
            'debug[all]':'Max7456 Signal',
            'debug[0]':'Mode Reg',
            'debug[1]':'Sense',
            'debug[2]':'ReInit',
            'debug[3]':'Rows',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'MAX7456_SPICLOCK' : {
            'debug[all]':'Max7456 SPI Clock',
            'debug[0]':'Overclock',
            'debug[1]':'DevType',
            'debug[2]':'Divisor',
            'debug[3]':'not used',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'SBUS' : {
            'debug[all]':'SBus Rx',
            'debug[0]':'Frame Flags',
            'debug[1]':'State Flags',
            'debug[2]':'Frame Time',
            'debug[3]':'not used',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'FPORT' : {
            'debug[all]':'FPort Rx',
            'debug[0]':'Frame Interval',
            'debug[1]':'Frame Errors',
            'debug[2]':'Last Error',
            'debug[3]':'Telemetry Interval',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'RANGEFINDER' : {
            'debug[all]':'Rangefinder',
            'debug[0]':'not used',
            'debug[1]':'Raw Altitude',
            'debug[2]':'Calc Altituded',
            'debug[3]':'SNR',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'RANGEFINDER_QUALITY' : {
            'debug[all]':'Rangefinder Quality',
            'debug[0]':'Raw Altitude',
            'debug[1]':'SNR Threshold Reached',
            'debug[2]':'Dyn Distance Threshold',
            'debug[3]':'Is Surface Altitude Valid',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'LIDAR_TF' : {
            'debug[all]':'Lidar TF',
            'debug[0]':'Distance',
            'debug[1]':'Strength',
            'debug[2]':'TF Frame (4)',
            'debug[3]':'TF Frame (5)',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'ADC_INTERNAL' : {
            'debug[all]':'ADC Internal',
            'debug[0]':'Core Temp',
            'debug[1]':'VRef Internal Sample',
            'debug[2]':'Temp Sensor Sample',
            'debug[3]':'Vref mV',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'RUNAWAY_TAKEOFF' : {
            'debug[all]':'Runaway Takeoff',
            'debug[0]':'Enabled',
            'debug[1]':'Activating Delay',
            'debug[2]':'Deactivating Delay',
            'debug[3]':'Deactivating Time',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'CURRENT_SENSOR' : {
            'debug[all]':'Current Sensor',
            'debug[0]':'milliVolts',
            'debug[1]':'centiAmps',
            'debug[2]':'Amps Latest',
            'debug[3]':'mAh Drawn',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'USB' : {
            'debug[all]':'USB',
            'debug[0]':'Cable In',
            'debug[1]':'VCP Connected',
            'debug[2]':'not used',
            'debug[3]':'not used',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'SMART AUDIO' : {
            'debug[all]':'Smart Audio VTx',
            'debug[0]':'Device + Version',
            'debug[1]':'Channel',
            'debug[2]':'Frequency',
            'debug[3]':'Power',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'RTH' : {
            'debug[all]':'RTH',
            'debug[0]':'Rescue Throttle',
            'debug[1]':'Rescue Angle',
            'debug[2]':'Altitude Adjustment',
            'debug[3]':'Rescue State',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'ITERM_RELAX' : {
            'debug[all]':'I-term Relax',
            'debug[0]':'Setpoint HPF [roll]',
            'debug[1]':'I Relax Factor [roll]',
            'debug[2]':'Relaxed I Error [roll]',
            'debug[3]':'Axis Error [roll]',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'ACRO_TRAINER' : {
            'debug[all]':'Acro Trainer (a_t_axis)',
            'debug[0]':'Current Angle * 10 [deg]',
            'debug[1]':'Axis State',
            'debug[2]':'Correction amount',
            'debug[3]':'Projected Angle * 10 [deg]',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'RC_SMOOTHING' : {
            'debug[all]':'Debug RC Smoothing',
            'debug[0]':'Raw RC Command',
            'debug[1]':'Raw RC Derivative',
            'debug[2]':'Smoothed RC Derivative',
            'debug[3]':'RX Refresh Rate',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'RX_SIGNAL_LOSS' : {
            'debug[all]':'Rx Signal Loss',
            'debug[0]':'Signal Received',
            'debug[1]':'Failsafe',
            'debug[2]':'Not used',
            'debug[3]':'Throttle',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'RC_SMOOTHING_RATE' : {
            'debug[all]':'Debug RC Smoothing Rate',
            'debug[0]':'Current RX Refresh Rate',
            'debug[1]':'Training Step Count',
            'debug[2]':'Average RX Refresh Rate',
            'debug[3]':'Sampling State',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'ANTI_GRAVITY' : {
            'debug[all]':'I-term Relax',
            'debug[0]':'Base I gain * 1000',
            'debug[1]':'Final I gain * 1000',
            'debug[2]':'P gain [roll] * 1000',
            'debug[3]':'P gain [pitch] * 1000',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'DYN_LPF' : {
            'debug[all]':'Debug Dyn LPF',
            'debug[0]':'Gyro Scaled [dbg-axis]',
            'debug[1]':'Notch Center [roll]',
            'debug[2]':'Lowpass Cutoff',
            'debug[3]':'Gyro Pre-Dyn [dbg-axis]',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'DSHOT_RPM_TELEMETRY' : {
            'debug[all]':'DShot Telemetry RPM',
            'debug[0]':'Motor 1 - DShot',
            'debug[1]':'Motor 2 - DShot',
            'debug[2]':'Motor 3 - DShot',
            'debug[3]':'Motor 4 - DShot',
            'debug[4]':'Motor 5 - DShot',
            'debug[5]':'Motor 6 - DShot',
            'debug[6]':'Motor 7 - DShot',
            'debug[7]':'Motor 8 - DShot',
        },
        'RPM_FILTER' : {
            'debug[all]':'RPM Filter',
            'debug[0]':'Motor 1 - rpmFilter',
            'debug[1]':'Motor 2 - rpmFilter',
            'debug[2]':'Motor 3 - rpmFilter',
            'debug[3]':'Motor 4 - rpmFilter',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'D_MIN' : {
            'debug[all]':'D_MIN',
            'debug[0]':'Gyro Factor [roll]',
            'debug[1]':'Setpoint Factor [roll]',
            'debug[2]':'Actual D [roll]',
            'debug[3]':'Actual D [pitch]',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'AC_CORRECTION' : {
            'debug[all]':'AC Correction',
            'debug[0]':'AC Correction [roll]',
            'debug[1]':'AC Correction [pitch]',
            'debug[2]':'AC Correction [yaw]',
            'debug[3]':'Not Used',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'AC_ERROR' : {
            'debug[all]':'AC Error',
            'debug[0]':'AC Error [roll]',
            'debug[1]':'AC Error [pitch]',
            'debug[2]':'AC Error [yaw]',
            'debug[3]':'Not Used',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'DUAL_GYRO_SCALED' : {
            'debug[all]':'Dual Gyro Scaled',
            'debug[0]':'Gyro 1 [roll]',
            'debug[1]':'Gyro 1 [pitch]',
            'debug[2]':'Gyro 2 [roll]',
            'debug[3]':'Gyro 2 [pitch]',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'DSHOT_RPM_ERRORS' : {
            'debug[all]':'DSHOT RPM Error',
            'debug[0]':'DSHOT RPM Error [1]',
            'debug[1]':'DSHOT RPM Error [2]',
            'debug[2]':'DSHOT RPM Error [3]',
            'debug[3]':'DSHOT RPM Error [4]',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'CRSF_LINK_STATISTICS_UPLINK' : {
            'debug[all]':'CRSF Stats Uplink',
            'debug[0]':'Uplink RSSI 1',
            'debug[1]':'Uplink RSSI 2',
            'debug[2]':'Uplink Link Quality',
            'debug[3]':'RF Mode',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'CRSF_LINK_STATISTICS_PWR' : {
            'debug[all]':'CRSF Stats Power',
            'debug[0]':'Antenna',
            'debug[1]':'SNR',
            'debug[2]':'TX Power',
            'debug[3]':'Not Used',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'CRSF_LINK_STATISTICS_DOWN' : {
            'debug[all]':'CRSF Stats Downlink',
            'debug[0]':'Downlink RSSI',
            'debug[1]':'Downlink Link Quality',
            'debug[2]':'Downlink SNR',
            'debug[3]':'Not Used',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'BARO' : {
            'debug[all]':'Debug Barometer',
            'debug[0]':'Baro State',
            'debug[1]':'Baro Temperature',
            'debug[2]':'Baro Pressure',
            'debug[3]':'Baro Pressure Sum',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'GPS_RESCUE_THROTTLE_PID' : {
            'debug[all]':'GPS Rescue Throttle PID',
            'debug[0]':'Throttle P',
            'debug[1]':'Throttle I',
            'debug[2]':'Throttle D',
            'debug[3]':'Z Velocity',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'DYN_IDLE' : {
            'debug[all]':'Dyn Idle',
            'debug[0]':'Motor Range Min Inc',
            'debug[1]':'Target RPS Change Rate',
            'debug[2]':'Error',
            'debug[3]':'Min RPM',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'FF_LIMIT' : {
            'debug[all]':'FF Limit',
            'debug[0]':'FF input [roll]',
            'debug[1]':'FF input [pitch]',
            'debug[2]':'FF limited [roll]',
            'debug[3]':'Not Used',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'FF_INTERPOLATED' : {
            'debug[all]':'FF Interpolated [roll]',
            'debug[0]':'Setpoint Delta Impl [roll]',
            'debug[1]':'Boost amount [roll]',
            'debug[2]':'Boost amount, clipped [roll]',
            'debug[3]':'Clip amount [roll]',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'BLACKBOX_OUTPUT' : {
            'debug[all]':'Blackbox Output',
            'debug[0]':'Blackbox Rate',
            'debug[1]':'Blackbox Max Rate',
            'debug[2]':'Dropouts',
            'debug[3]':'Tx Bytes Free',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'GYRO_SAMPLE' : {
            'debug[all]':'Gyro Sample',
            'debug[0]':'Before downsampling',
            'debug[1]':'After downsampling',
            'debug[2]':'After RPM',
            'debug[3]':'After all but Dyn Notch',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'RX_TIMING' : {
            'debug[all]':'Receiver Timing (us)',
            'debug[0]':'Frame Delta',
            'debug[1]':'Frame Age',
            'debug[2]':'not used',
            'debug[3]':'not used',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'D_LPF' : {
            'debug[all]':'D-Term [D_LPF]',
            'debug[0]':'Unfiltered D [roll]',
            'debug[1]':'Unfiltered D [pitch]',
            'debug[2]':'Filtered, with DMax [roll]',
            'debug[3]':'Filtered, with DMax [pitch]',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'VTX_TRAMP' : {
            'debug[all]':'Tramp VTx',
            'debug[0]':'Status',
            'debug[1]':'Reply Code',
            'debug[2]':'Pit Mode',
            'debug[3]':'Retry Count',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'GHST' : {
            'debug[all]':'Ghost Rx',
            'debug[0]':'CRC Error Count',
            'debug[1]':'Unknown Frame Count',
            'debug[2]':'RSSI',
            'debug[3]':'Link Quality',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'GHST_MSP' : {
            'debug[all]':'Ghost MSP',
            'debug[0]':'MSP Frame Count',
            'debug[1]':'MSP Frame Counter',
            'debug[2]':'Not used',
            'debug[3]':'Not used',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'SCHEDULER_DETERMINISM' : {
            'debug[all]':'Scheduler Determinism',
            'debug[0]':'Cycle Start time',
            'debug[1]':'ID of Late Task',
            'debug[2]':'Task Delay Time',
            'debug[3]':'Gyro Clock Skew',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'TIMING_ACCURACY' : {
            'debug[all]':'Timing Accuracy',
            'debug[0]':'CPU Busy',
            'debug[1]':'Late Tasks per second',
            'debug[2]':'Total delay in last second',
            'debug[3]':'Total Tasks per second',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'RX_EXPRESSLRS_SPI' : {
            'debug[all]':'ExpressLRS SPI Rx',
            'debug[0]':'Lost Connection Count',
            'debug[1]':'RSSI',
            'debug[2]':'SNR',
            'debug[3]':'Uplink LQ',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'RX_EXPRESSLRS_PHASELOCK' : {
            'debug[all]':'ExpressLRS SPI Phaselock',
            'debug[0]':'Phase offset',
            'debug[1]':'Filtered phase offset',
            'debug[2]':'Frequency Offset',
            'debug[3]':'Phase Shift',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'RX_STATE_TIME' : {
            'debug[all]':'Rx State Time',
            'debug[0]':'Time 0',
            'debug[1]':'Time 1',
            'debug[2]':'Time 2',
            'debug[3]':'Time 3',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'GPS_RESCUE_VELOCITY' : {
            'debug[all]':'GPS Rescue Velocity',
            'debug[0]':'Velocity P',
            'debug[1]':'Velocity D',
            'debug[2]':'Velocity to Home',
            'debug[3]':'Target Velocity',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'GPS_RESCUE_HEADING' : {
            'debug[all]':'GPS Rescue Heading',
            'debug[0]':'Ground Speed',
            'debug[1]':'GPS Heading',
            'debug[2]':'IMU Attitude',
            'debug[3]':'Angle to home',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'GPS_RESCUE_TRACKING' : {
            'debug[all]':'GPS Rescue Tracking',
            'debug[0]':'Velocity to home',
            'debug[1]':'Target velocity',
            'debug[2]':'Altitude',
            'debug[3]':'Target altitude',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'ATTITUDE' : {
            'debug[all]':'Attitude',
            'debug[0]':'accADC X',
            'debug[1]':'accADC Y',
            'debug[2]':'Setpoint Roll',
            'debug[3]':'Setpoint Pitch',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'VTX_MSP' : {
            'debug[all]': 'VTX MSP',
            'debug[0]': 'packetCounter',
            'debug[1]': 'isCrsfPortConfig',
            'debug[2]': 'isLowPowerDisarmed',
            'debug[3]': 'mspTelemetryDescriptor',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
        'GPS_DOP' : {
            'debug[all]': 'GPS Dilution of Precision',
            'debug[0]': 'Number of Satellites',
            'debug[1]': 'pDOP (positional - 3D)',
            'debug[2]': 'hDOP (horizontal - 2D)',
            'debug[3]': 'vDOP (vertical - 1D)',
            'debug[4]':'Not Used',
            'debug[5]':'Not Used',
            'debug[6]':'Not Used',
            'debug[7]':'Not Used',
        },
    };

    let DEBUG_FRIENDLY_FIELD_NAMES = null;

    FlightLogFieldPresenter.adjustDebugDefsList = function(firmwareType, firmwareVersion) {

        DEBUG_FRIENDLY_FIELD_NAMES = {...DEBUG_FRIENDLY_FIELD_NAMES_INITIAL};

        if (firmwareType === FIRMWARE_TYPE_BETAFLIGHT) {
            if (semver.gte(firmwareVersion, '4.4.0')) {
                DEBUG_FRIENDLY_FIELD_NAMES.BARO = {
                    'debug[all]':'Debug Barometer',
                    'debug[0]':'Baro State',
                    'debug[1]':'Baro Pressure',
                    'debug[2]':'Baro Temperature',
                    'debug[3]':'Baro Altitude',
                    'debug[4]':'Not Used',
                    'debug[5]':'Not Used',
                    'debug[6]':'Not Used',
                    'debug[7]':'Not Used',
                };
                DEBUG_FRIENDLY_FIELD_NAMES.RTH = {
                    'debug[all]':'RTH Rescue codes',
                    'debug[0]':'Pitch angle, deg',
                    'debug[1]':'Rescue Phase',
                    'debug[2]':'Failure code',
                    'debug[3]':'Failure timers',
                    'debug[4]':'Not Used',
                    'debug[5]':'Not Used',
                    'debug[6]':'Not Used',
                    'debug[7]':'Not Used',
                };
                DEBUG_FRIENDLY_FIELD_NAMES.GPS_RESCUE_THROTTLE_PID = {
                    'debug[all]':'GPS Rescue throttle PIDs',
                    'debug[0]':'Throttle P',
                    'debug[1]':'Throttle D',
                    'debug[2]':'Altitude',
                    'debug[3]':'Target altitude',
                    'debug[4]':'Not Used',
                    'debug[5]':'Not Used',
                    'debug[6]':'Not Used',
                    'debug[7]':'Not Used',
                };
            } else if (semver.gte(firmwareVersion, '4.3.0')) {
                DEBUG_FRIENDLY_FIELD_NAMES.FEEDFORWARD = {
                    'debug[all]':'Feedforward [roll]',
                    'debug[0]':'Setpoint, un-smoothed [roll]',
                    'debug[1]':'Delta, smoothed [roll]',
                    'debug[2]':'Boost, smoothed [roll]',
                    'debug[3]':'rcCommand Delta [roll]',
                    'debug[4]':'Not Used',
                    'debug[5]':'Not Used',
                    'debug[6]':'Not Used',
                    'debug[7]':'Not Used',
                };
                DEBUG_FRIENDLY_FIELD_NAMES.FEEDFORWARD_LIMIT = {
                    'debug[all]':'Feedforward Limit [roll]',
                    'debug[0]':'Feedforward input [roll]',
                    'debug[1]':'Feedforward input [pitch]',
                    'debug[2]':'Feedforward limited [roll]',
                    'debug[3]':'Not Used',
                    'debug[4]':'Not Used',
                    'debug[5]':'Not Used',
                    'debug[6]':'Not Used',
                    'debug[7]':'Not Used',
                };
                DEBUG_FRIENDLY_FIELD_NAMES.DYN_IDLE = {
                    'debug[all]':'Dyn Idle',
                    'debug[0]':'Dyn Idle P [roll]',
                    'debug[1]':'Dyn Idle I [roll]',
                    'debug[2]':'Dyn Idle D [roll]',
                    'debug[3]':'Min RPM',
                    'debug[4]':'Not Used',
                    'debug[5]':'Not Used',
                    'debug[6]':'Not Used',
                    'debug[7]':'Not Used',
                };
                DEBUG_FRIENDLY_FIELD_NAMES.FFT = {
                    'debug[all]':'Debug FFT',
                    'debug[0]':'Gyro Pre Dyn Notch [dbg-axis]',
                    'debug[1]':'Gyro Post Dyn Notch [dbg-axis]',
                    'debug[2]':'Gyro Downsampled [dbg-axis]',
                    'debug[3]':'Not used',
                    'debug[4]':'Not Used',
                    'debug[5]':'Not Used',
                    'debug[6]':'Not Used',
                    'debug[7]':'Not Used',
                };
                DEBUG_FRIENDLY_FIELD_NAMES.FFT_TIME = {
                    'debug[all]':'Debug FFT TIME',
                    'debug[0]':'Active calc step',
                    'debug[1]':'Step duration',
                    'debug[2]':'Not used',
                    'debug[3]':'Not used',
                    'debug[4]':'Not Used',
                    'debug[5]':'Not Used',
                    'debug[6]':'Not Used',
                    'debug[7]':'Not Used',
                };
                DEBUG_FRIENDLY_FIELD_NAMES.FFT_FREQ = {
                    'debug[all]':'Debug FFT FREQ',
                    'debug[0]':'Notch 1 Center Freq [dbg-axis]',
                    'debug[1]':'Notch 2 Center Freq [dbg-axis]',
                    'debug[2]':'Notch 3 Center Freq [dbg-axis]',
                    'debug[3]':'Gyro Pre Dyn Notch [dbg-axis]',
                    'debug[4]':'Not Used',
                    'debug[5]':'Not Used',
                    'debug[6]':'Not Used',
                    'debug[7]':'Not Used',
                };
                DEBUG_FRIENDLY_FIELD_NAMES.GPS_RESCUE_THROTTLE_PID = {
                    'debug[all]':'GPS Rescue Altitude',
                    'debug[0]':'Throttle P',
                    'debug[1]':'Throttle D',
                    'debug[2]':'Altitude',
                    'debug[3]':'Target Altitude',
                    'debug[4]':'Not Used',
                    'debug[5]':'Not Used',
                    'debug[6]':'Not Used',
                    'debug[7]':'Not Used',
                };
            } else if (semver.gte(firmwareVersion, '4.2.0')) {
                DEBUG_FRIENDLY_FIELD_NAMES.FF_INTERPOLATED = {
                    'debug[all]':'Feedforward [roll]',
                    'debug[0]':'Setpoint Delta [roll]',
                    'debug[1]':'Acceleration [roll]',
                    'debug[2]':'Acceleration, clipped [roll]',
                    'debug[3]':'Duplicate Counter [roll]',
                    'debug[4]':'Not Used',
                    'debug[5]':'Not Used',
                    'debug[6]':'Not Used',
                    'debug[7]':'Not Used',
                };
            } else if (semver.gte(firmwareVersion, '4.1.0')) {
                DEBUG_FRIENDLY_FIELD_NAMES.FF_INTERPOLATED = {
                    'debug[all]':'Feedforward [roll]',
                    'debug[0]':'Setpoint Delta [roll]',
                    'debug[1]':'Boost [roll]',
                    'debug[2]':'Boost, clipped [roll]',
                    'debug[3]':'Duplicate Counter [roll]',
                    'debug[4]':'Not Used',
                    'debug[5]':'Not Used',
                    'debug[6]':'Not Used',
                    'debug[7]':'Not Used',
                };
                DEBUG_FRIENDLY_FIELD_NAMES.FF_LIMIT = {
                    'debug[all]':'Feedforward Limit [roll]',
                    'debug[0]':'FF limit input [roll]',
                    'debug[1]':'FF limit input [pitch]',
                    'debug[2]':'FF limited [roll]',
                    'debug[3]':'Not Used',
                    'debug[4]':'Not Used',
                    'debug[5]':'Not Used',
                    'debug[6]':'Not Used',
                    'debug[7]':'Not Used',
                };
            }
        }
    };

    FlightLogFieldPresenter.presentFlags = function(flags, flagNames) {
        let
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
    };

    // Only list events that have changed, flag with eirer go ON or OFF.
    FlightLogFieldPresenter.presentChangeEvent = function presentChangeEvent(flags, lastFlags, flagNames) {
        let eventState = '';
        let found = false;

        for (let i = 0; i < flagNames.length; i++) {
           if ((1 << i) & (flags ^ lastFlags)) { // State Changed
               eventState += '|' + flagNames[i] + ' ' + (((1 << i) & flags) ? 'ON' : 'OFF');
               found = true;
           }
        }
        if (!found) { eventState += ' | ACRO'; } // Catch the state when all flags are off, which is ACRO of course
        return eventState;
    };

    FlightLogFieldPresenter.presentEnum = function presentEnum(value, enumNames) {
        if (enumNames[value] === undefined) {
            return value;
        }

        return enumNames[value];
    };

    /**
     * Function to translate altitudes from the default meters
     * to the user selected measurement unit.
     * @param altitude String: Altitude in meters.
     * @param altitudeUnits Integer: 1 for meters, 2 for feet.
     *
     * @returns String: readable meters in selected unit.
     */

    FlightLogFieldPresenter.decodeCorrectAltitude = function(altitude, altitudeUnits) {
        switch (altitudeUnits) {
            case 1: // Keep it in meters.
                return (altitude).toFixed(2) + " m";
            case 2: // Translate it into feet.
                return (altitude * 3.28).toFixed(2) + " ft";
        }
    };

    /**
     * Attempt to decode the given raw logged value into something more human readable, or return an empty string if
     * no better representation is available.
     *
     * @param fieldName Name of the field
     * @param value Value of the field
     */
    FlightLogFieldPresenter.decodeFieldToFriendly = function(flightLog, fieldName, value, currentFlightMode) {
        if (value === undefined) {
            return "";
        }

        const highResolutionScale = (flightLog && flightLog.getSysConfig().blackbox_high_resolution > 0) ? 10 : 1;
        const highResolutionAddPrecision = (flightLog && flightLog.getSysConfig().blackbox_high_resolution > 0) ? 1 : 0;

        switch (fieldName) {
            case 'time':
                return formatTime(value / 1000, true);

            case 'gyroADC[0]':
            case 'gyroADC[1]':
            case 'gyroADC[2]':
                return flightLog.gyroRawToDegreesPerSecond(value / highResolutionScale).toFixed(highResolutionAddPrecision) + " °/s";

            case 'gyroADCs[0]':
            case 'gyroADCs[1]':
            case 'gyroADCs[2]':
                return value.toFixed(0) + " °/s";

            case 'axisError[0]':
            case 'axisError[1]':
            case 'axisError[2]':
                return (value / highResolutionScale).toFixed(highResolutionAddPrecision) + " °/s";

            case 'rcCommand[0]':
            case 'rcCommand[1]':
            case 'rcCommand[2]':
                return (value / highResolutionScale + 1500).toFixed(highResolutionAddPrecision) + " us";
            case 'rcCommand[3]':
                return (value / highResolutionScale).toFixed(highResolutionAddPrecision) + " us";

            case 'motor[0]':
            case 'motor[1]':
            case 'motor[2]':
            case 'motor[3]':
            case 'motor[4]':
            case 'motor[5]':
            case 'motor[6]':
            case 'motor[7]':
                return `${flightLog.rcMotorRawToPctPhysical(value).toFixed(2)} %`;

            case 'rcCommands[0]':
            case 'rcCommands[1]':
            case 'rcCommands[2]':
                return (value / highResolutionScale).toFixed(highResolutionAddPrecision) + " °/s";
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
                return flightLog.getPIDPercentage(value).toFixed(1) + " %";

            case 'accSmooth[0]':
            case 'accSmooth[1]':
            case 'accSmooth[2]':
                return flightLog.accRawToGs(value).toFixed(2 + highResolutionAddPrecision) + " g";

            case 'vbatLatest':
                if (flightLog.getSysConfig().firmwareType === FIRMWARE_TYPE_BETAFLIGHT  && semver.gte(flightLog.getSysConfig().firmwareVersion, '4.0.0')) {
                    return (value / 100).toFixed(2) + "V" + ", " + (value / 100 / flightLog.getNumCellsEstimate()).toFixed(2) + " V/cell";
                } else if ((flightLog.getSysConfig().firmwareType === FIRMWARE_TYPE_BETAFLIGHT  && semver.gte(flightLog.getSysConfig().firmwareVersion, '3.1.0')) ||
                   (flightLog.getSysConfig().firmwareType === FIRMWARE_TYPE_CLEANFLIGHT && semver.gte(flightLog.getSysConfig().firmwareVersion, '2.0.0'))) {
                    return (value / 10).toFixed(2) + "V" + ", " + (value / 10 / flightLog.getNumCellsEstimate()).toFixed(2) + " V/cell";
                } else {
                    return (flightLog.vbatADCToMillivolts(value) / 1000).toFixed(2) + "V" + ", " + (flightLog.vbatADCToMillivolts(value) / 1000 / flightLog.getNumCellsEstimate()).toFixed(2) + " V/cell";
                }

            case 'amperageLatest':
                if ((flightLog.getSysConfig().firmwareType == FIRMWARE_TYPE_BETAFLIGHT  && semver.gte(flightLog.getSysConfig().firmwareVersion, '3.1.7')) ||
                   (flightLog.getSysConfig().firmwareType == FIRMWARE_TYPE_CLEANFLIGHT && semver.gte(flightLog.getSysConfig().firmwareVersion, '2.0.0'))) {
                       return (value / 100).toFixed(2) + "A" + ", " + (value / 100 / flightLog.getNumMotors()).toFixed(2) + " A/motor";
                } else if (flightLog.getSysConfig().firmwareType == FIRMWARE_TYPE_BETAFLIGHT  && semver.gte(flightLog.getSysConfig().firmwareVersion, '3.1.0')) {
                    return (value / 100).toFixed(2) + "A" + ", " + (value / 100 / flightLog.getNumMotors()).toFixed(2) + " A/motor";
                } else {
                    return (flightLog.amperageADCToMillivolts(value) / 1000).toFixed(2) + "A" + ", " + (flightLog.amperageADCToMillivolts(value) / 1000 / flightLog.getNumMotors()).toFixed(2) + " A/motor";
                }

            case 'heading[0]':
            case 'heading[1]':
            case 'heading[2]':
                return (value / Math.PI * 180).toFixed(1) + "°";

            case 'baroAlt':
                return FlightLogFieldPresenter.decodeCorrectAltitude((value/100), userSettings.altitudeUnits);

            case 'flightModeFlags':
                return FlightLogFieldPresenter.presentFlags(value, FLIGHT_LOG_FLIGHT_MODE_NAME);

            case 'stateFlags':
                return FlightLogFieldPresenter.presentFlags(value, FLIGHT_LOG_FLIGHT_STATE_NAME);

            case 'failsafePhase':
                return FlightLogFieldPresenter.presentEnum(value, FLIGHT_LOG_FAILSAFE_PHASE_NAME);

            case 'features':
                return FlightLogFieldPresenter.presentEnum(value, FLIGHT_LOG_FEATURES);

            case 'rssi':
                return (value / 1024 * 100).toFixed(2) + " %";

            //H Field G name:time,GPS_numSat,GPS_coord[0],GPS_coord[1],GPS_altitude,GPS_speed,GPS_ground_course
            case 'GPS_numSat':
                return `${value}`;
            case 'GPS_coord[0]':
            case 'GPS_coord[1]':
                return `${(value/10000000).toFixed(5)}`;
            case 'GPS_altitude':
                return FlightLogFieldPresenter.decodeCorrectAltitude((value/10), userSettings.altitudeUnits);
            case 'GPS_speed':
                switch (userSettings.speedUnits) {
                    case 1:
                        return `${(value/100).toFixed(2)} m/s`;
                    case 2:
                        return `${((value/100) * 3.6).toFixed(2)} kph`;
                    case 3:
                        return `${((value/100) * 2.2369).toFixed(2)} mph`;
                }
            case 'GPS_ground_course':
                return `${(value/10).toFixed(1)} °`;

            case 'debug[0]':
            case 'debug[1]':
            case 'debug[2]':
            case 'debug[3]':
            case 'debug[4]':
            case 'debug[5]':
            case 'debug[6]':
            case 'debug[7]':
                return FlightLogFieldPresenter.decodeDebugFieldToFriendly(flightLog, fieldName, value, currentFlightMode);

            default:
                return "";
        }
    };

    FlightLogFieldPresenter.decodeDebugFieldToFriendly = function(flightLog, fieldName, value) {
        if (flightLog) {
            const debugModeName = DEBUG_MODE[flightLog.getSysConfig().debug_mode]; // convert to recognisable name
            switch (debugModeName) {
                case 'NONE':
                case 'AIRMODE':
                case 'BARO':
                    switch (fieldName) {
                        case 'debug[1]':
                            return `${value.toFixed(0)} hPa`;
                        case 'debug[2]':
                            return `${(value / 100).toFixed(2)} °C`;
                        case 'debug[3]':
                            return `${(value / 100).toFixed(2)} m`;
                        default:
                            return `${value.toFixed(0)}`;
                    }
                case 'VELOCITY':
                case 'DFILTER':
                    return "";
                case 'CYCLETIME':
                    switch (fieldName) {
                        case 'debug[1]':
                            return value.toFixed(0) + " %";
                        default:
                            return value.toFixed(0) + "\u03BCS";
                    }
                case 'BATTERY':
                    switch (fieldName) {
                        case 'debug[0]':
                            return value.toFixed(0);
                        default:
                            return (value / 10).toFixed(1) + " V";
                    }
                case 'ACCELEROMETER':
                    return flightLog.accRawToGs(value).toFixed(2) + " g";
                case 'MIXER':
                    return Math.round(flightLog.rcCommandRawToThrottle(value)) + " %";
                case 'PIDLOOP':
                    return value.toFixed(0) + " \u03BCS";
                case 'RC_INTERPOLATION':
                    switch (fieldName) {
                        case 'debug[1]': // current RX refresh rate
                            return value.toFixed(0) + ' ms';
                        case 'debug[3]': // setpoint [roll]
                            return value.toFixed(0) + " °/s";
                        default:
                            return value.toFixed(0);
                    }
                case 'GYRO':
                case 'GYRO_FILTERED':
                case 'GYRO_SCALED':
                case 'DUAL_GYRO':
                case 'DUAL_GYRO_COMBINED':
                case 'DUAL_GYRO_DIFF':
                case 'DUAL_GYRO_RAW':
                case 'NOTCH':
                    return Math.round(flightLog.gyroRawToDegreesPerSecond(value)) + " °/s";
                case 'ANGLERATE':
                    return value.toFixed(0) + " °/s";
                case 'ESC_SENSOR':
                    switch (fieldName) {
                        case 'debug[3]':
                            return value.toFixed(0) + " \u03BCS";
                        default:
                            return value.toFixed(0);
                    }
                case 'SCHEDULER':
                    return value.toFixed(0) + " \u03BCS";
                case 'STACK':
                    return value.toFixed(0);
                case 'ESC_SENSOR_RPM':
                    return value.toFixed(0) + " rpm";
                case 'ESC_SENSOR_TMP':
                    return value.toFixed(0) + " °C";
                case 'ALTITUDE':
                    switch (fieldName) {
                        case 'debug[0]': // GPS Trust * 100
                            return value.toFixed(0);
                        case 'debug[1]': // GPS Altitude cm
                        case 'debug[2]': // OSD Altitude cm
                        case 'debug[3]': // Control Altitude
                            return (value / 100).toFixed(2) + ' m';
                        default:
                            return value.toFixed(0);
                    }
                case 'FFT':
                    switch (fieldName) {
                        case 'debug[0]': // gyro pre dyn notch [for gyro debug axis]
                        case 'debug[1]': // gyro post dyn notch [for gyro debug axis]
                        case 'debug[2]': // gyro pre dyn notch, downsampled for FFT [for gyro debug axis]
                            return Math.round(flightLog.gyroRawToDegreesPerSecond(value)) + " °/s";
                        // debug 3 = not used
                        default:
                            return value.toFixed(0);
                    }
                case 'FFT_TIME':
                    switch (fieldName) {
                        case 'debug[0]':
                            return FlightLogFieldPresenter.presentEnum(value, FFT_CALC_STEPS);
                        case 'debug[1]':
                            return value.toFixed(0) + " \u03BCs";
                        // debug 2 = not used
                        // debug 3 = not used
                        default:
                            return value.toFixed(0);
                    }
                case 'FFT_FREQ':
                    switch (fieldName) {
                        case 'debug[3]': // gyro pre dyn notch [for gyro debug axis]
                            return Math.round(flightLog.gyroRawToDegreesPerSecond(value)) + " °/s";
                        default:
                            return value.toFixed(0) + " Hz";
                    }
                case 'RTH':
                    switch (fieldName) {
// temporarily, perhaps
//                        case 'debug[0]': // pitch angle +/-4000 means +/- 40 deg
//                            return (value / 100).toFixed(1) + " °";
                        default:
                            return value.toFixed(0);
                    }
                case 'ITERM_RELAX':
                    switch (fieldName) {
                        case 'debug[0]': // roll setpoint high-pass filtered
                            return value.toFixed(0) + " °/s";
                        case 'debug[1]': // roll I-term relax factor
                            return value.toFixed(0) + ' %';
                        case 'debug[3]': // roll absolute control axis error
                            return (value / 10).toFixed(1) + " °";
                        default:
                            return value.toFixed(0);
                    }
                case 'RC_SMOOTHING':
                    switch (fieldName) {
                        case 'debug[0]':
                            return (value + 1500).toFixed(0) + " us";
                        case 'debug[3]': // rx frame rate [us]
                            return (value / 1000).toFixed(1) + ' ms';
                        default:
                            return value.toFixed(0);
                    }
                case 'RC_SMOOTHING_RATE':
                    switch (fieldName) {
                        case 'debug[0]': // current frame rate [us]
                        case 'debug[2]': // average frame rate [us]
                            return (value / 1000).toFixed(2) + ' ms';
                        default:
                            return value.toFixed(0);
                    }
                case 'DSHOT_RPM_TELEMETRY':
                    return (value * 200 / flightLog.getSysConfig()['motor_poles']).toFixed(0) + " rpm / " + (value * 3.333 / flightLog.getSysConfig()['motor_poles']).toFixed(0) + ' hz';
                case 'RPM_FILTER':
                    return (value * 60).toFixed(0) + "rpm / " + value.toFixed(0) + " Hz";
                case 'D_MIN':
                    switch (fieldName) {
                        case 'debug[0]': // roll gyro factor
                        case 'debug[1]': // roll setpoint Factor
                            return value.toFixed(0) + ' %';
                        case 'debug[2]': // roll actual D
                        case 'debug[3]': // pitch actual D
                            return (value / 10).toFixed(1);
                        default:
                            return value.toFixed(0);
                    }
                case 'DYN_LPF':
                    switch (fieldName) {
                        case 'debug[0]': // gyro scaled [for selected axis]
                        case 'debug[3]': // pre-dyn notch gyro [for selected axis]
                            return Math.round(flightLog.gyroRawToDegreesPerSecond(value)) + " °/s";
                        default:
                            return value.toFixed(0) + " Hz";
                    }
                case 'DYN_IDLE':
                    switch (fieldName) {
                        case 'debug[3]': // minRPS
                            return (value * 6) + ' rpm / ' + (value / 10).toFixed(0) +' hz';
                        default:
                            return value.toFixed(0);
                    }
                case 'AC_CORRECTION':
                    return (value / 10).toFixed(1) + " °/s";
                case 'AC_ERROR':
                    return (value / 10).toFixed(1) + " °";
                case 'RX_TIMING':
                    switch (fieldName) {
                        case 'debug[0]': // Frame delta us/10
                        case 'debug[1]': // Frame age us/10
                            return (value / 100).toFixed(2) + ' ms';
                        default:
                            return value.toFixed(0);
                    }
                case 'GHST':
                    switch (fieldName) {
                        // debug 0 is CRC error count 0 to int16_t
                        // debug 1 is unknown frame count 0 to int16_t
                        // debug 2 is RSSI 0 to -128 -> 0 to 128
                        case 'debug[3]': // LQ 0-100
                            return value.toFixed(0) + ' %';
                        default:
                            return value.toFixed(0);
                    }
                case 'GHST_MSP':
                    switch (fieldName) {
                        // debug 0 is msp frame count
                        // debug 1 is msp frame count
                        // debug 2 and 3 not used
                        default:
                            return value.toFixed(0);
                    }
                case 'SCHEDULER_DETERMINISM':
                    switch (fieldName) {
                        case 'debug[0]': // cycle time in us*10
                        case 'debug[2]': // task delay time in us*10
                        case 'debug[3]': // task delay time in us*10
                             return (value / 10).toFixed(1) + ' us';
                        // debug 1 is task ID of late task
                        default:
                            return value.toFixed(0);
                    }
                case 'TIMING_ACCURACY':
                    switch (fieldName) {
                        case 'debug[0]': // CPU Busy %
                            return value.toFixed(1) + ' %';
                        case 'debug[2]': // task delay time in us*10
                            return (value / 10).toFixed(1) + ' us';
                        default:
                            return value.toFixed(0);
                    }
                case 'RX_EXPRESSLRS_SPI':
                    switch (fieldName) {
                        case 'debug[3]': // uplink LQ %
                            return value.toFixed(1) + ' %';
                        // debug 0 = Lost connection count
                        // debug 1 = RSSI
                        // debug 2 = SNR
                        default:
                            return value.toFixed(0);
                    }
                case 'RX_EXPRESSLRS_PHASELOCK':
                    switch (fieldName) {
                        case 'debug[2]': // Frequency offset in ticks
                            return value.toFixed(0) + ' ticks';
                        // debug 0 = Phase offset us
                        // debug 1 = Filtered phase offset us
                        // debug 3 = Pphase shift in us
                        default:
                            return value.toFixed(0) + ' us';
                    }
                case 'GPS_RESCUE_THROTTLE_PID':
                    switch (fieldName) {
                        case 'debug[0]': // Throttle P added uS
                        case 'debug[1]': // Throttle D added * uS
                            return value.toFixed(0) + ' uS';
                        case 'debug[2]': // current altitude in m
                        case 'debug[3]': // TARGET altitude in m
                            return (value / 100).toFixed(1) + ' m';
                        default:
                            return value.toFixed(0);
                    }
                case 'GPS_RESCUE_VELOCITY':
                    switch (fieldName) {
                        case 'debug[0]': // Pitch P degrees * 100
                        case 'debug[1]': // Pitch D degrees * 100
                            return (value / 100).toFixed(1) + " °";
                        case 'debug[2]': // velocity to home cm/s
                        case 'debug[3]': // velocity target cm/s
                            return (value / 100).toFixed(1) + ' m/s';
                        default:
                            return value.toFixed(0);
                    }
                case 'GPS_RESCUE_HEADING':
                    switch (fieldName) {
                        case 'debug[0]': // Ground speed cm/s
                            return (value / 100).toFixed(2) + ' m/s';
                        case 'debug[1]': // GPS Ground course degrees * 10
                        case 'debug[2]': // Attitude in degrees * 10
                        case 'debug[3]': // Angle to home in degrees * 10
                            return (value / 10).toFixed(1) + " °";
                        default:
                            return value.toFixed(0);
                    }
                case 'GPS_RESCUE_TRACKING':
                    switch (fieldName) {
                        case 'debug[0]': // velocity to home cm/s
                        case 'debug[1]': // velocity target cm/s
                            return (value / 100).toFixed(1) + ' m/s';
                        case 'debug[2]': // altitude cm
                        case 'debug[3]': // altitude target cm
                            return (value / 100).toFixed(1) + ' m';
                        default:
                            return value.toFixed(0);
                    }
                case 'ATTITUDE':
                    switch (fieldName) {
                        case 'debug[0]': // accADC X
                        case 'debug[1]': // accADC Y
                        case 'debug[2]': // setpoint Roll
                        case 'debug[3]': // setpoint Pitch
                        default:
                            return value.toFixed(0);
                    }
                case 'VTX_MSP':
                    switch (fieldName) {
                        case 'debug[0]': // packetCounter
                        case 'debug[1]': // isCrsfPortConfig
                        case 'debug[2]': // isLowPowerDisarmed
                        case 'debug[3]': // mspTelemetryDescriptor
                        default:
                            return value.toFixed(0);
                    }
                case 'GPS_DOP':
                    switch (fieldName) {
                        case 'debug[0]': // Number of Satellites
                            return value.toFixed(0);
                        case 'debug[1]': // pDOP (positional - 3D)
                        case 'debug[2]': // hDOP (horizontal - 2D)
                        case 'debug[3]': // vDOP (vertical - 1D)
                        default:
                            return (value / 100).toFixed(2);
                    }
            }
            return value.toFixed(0);
        }
        return "";
    };

    FlightLogFieldPresenter.fieldNameToFriendly = function(fieldName, debugMode) {
        if (debugMode) {
            if (fieldName.includes('debug')) {
                let debugModeName = DEBUG_MODE[debugMode];
                let debugFields;

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

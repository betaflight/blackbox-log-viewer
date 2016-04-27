'use strict';

function HeaderDialog(dialog, onSave) {

	// Private Variables
	var that = this; // generic pointer back to this function
    
    function renderOptions(selected, index, list) {
        var 
            option = $("<option></option>")
                .text(list[index])
                .attr("value", index);
    
        if (index == selected) {
            option.attr("selected", "selected");
        }
        
        return option;
    }
    
    function renderSelect(name, selected, list) {
    	// Populate a select drop-down box
    	var select = $(name);

    	select.children().remove(); // clear list

    	for(var i=0; i<list.length; i++) {
			select.append(renderOptions(selected, i, list));
    	}    	
    }
    
    function setParameter(name, data, decimalPlaces) {
		if(data!=null) $(name).val((data/Math.pow(10,decimalPlaces)).toFixed(decimalPlaces));
	}

	function setCheckbox(name, data) {
		if(data!=null) {
			var state = (data == 1);
			$(name).prop('checked', state);
		}
	}    

	function populatePID(name, data) {
        var i = 0;
        $(name).each(function () {
                switch (i) {
                    case 0:
                    	if(data[i]!=null) $(this).val((data[i]/10.0).toFixed(1));
                    	i++;
                        break;
                    case 1:
                        if(data[i]!=null) $(this).val((data[i]/1000.0).toFixed(3));
                        i++;
                        break;
                    case 2:
                        if(data[i]!=null) $(this).val(data[i].toFixed(0));
                        i++;
                        break;
                    }
                })
	}

	function isFeatureEnabled(name, list, value) {
		for (var i = 0; i < list.length; i++) {
			if (list[i].name == name && (value & 1<<list[i].bit)) {
				return true;
			}
		}
		return false;
	}

	function builtFeaturesList(value) {
        // generate features
        var features = [
            {bit: 0, group: 'rxMode', mode: 'group', name: 'RX_PPM', description: 'PPM Receiver Selected'},
            {bit: 1, group: 'battery', name: 'VBAT', description: 'Battery Monitoring'},
            {bit: 2, group: 'other', name: 'INFLIGHT_ACC_CAL', description: 'In-flight level calibration'},
            {bit: 3, group: 'rxMode', mode: 'group', name: 'RX_SERIAL', description: 'Serial Receiver Selected'},
            {bit: 4, group: 'other', name: 'MOTOR_STOP', description: 'Motor Stop on low throttle'},
            {bit: 5, group: 'other', name: 'SERVO_TILT', description: 'Servo gimbal'},
            {bit: 6, group: 'other', name: 'SOFTSERIAL', description: 'Enable CPU based serial port'},
            {bit: 7, group: 'other', name: 'GPS', description: 'GPS device connected'},
            {bit: 8, group: 'other', name: 'FAILSAFE', description: 'Failsafe mode enabled'},
            {bit: 9, group: 'other', name: 'SONAR', description: 'Sonar'},
            {bit: 10, group: 'other', name: 'TELEMETRY', description: 'Telemetry Output'},
            {bit: 11, group: 'battery', name: 'CURRENT_METER', description: 'Battery current monitoring'},
            {bit: 12, group: 'other', name: '3D', description: '3D mode (for use with reversible ESCs)'},
            {bit: 13, group: 'rxMode', mode: 'group', name: 'RX_PARALLEL_PWM', description: 'PWM receiver selected'},
            {bit: 14, group: 'rxMode', mode: 'group', name: 'RX_MSP', description: 'Controller over MSP'},
            {bit: 15, group: 'other', name: 'RSSI_ADC', description: 'ADC RSSI Monitoring'},
            {bit: 16, group: 'other', name: 'LED_STRIP', description: 'Addressible RGB LED strip support'},
            {bit: 17, group: 'other', name: 'DISPLAY', description: 'OLED Screen Display'},
            {bit: 18, group: 'other', name: 'ONESHOT125', description: 'Oneshot 125 Enabled'},
            {bit: 19, group: 'other', name: 'BLACKBOX', description: 'Blackbox flight data recorder'},
            {bit: 20, group: 'other', name: 'CHANNEL_FORWARDING', description: 'Forward aux channels to servo outputs'},
            {bit: 21, group: 'other', name: 'TRANSPONDER', description: 'Transponder enabled'}
        ];
        
        var radioGroups = [];
        
        var features_e = $('.features');
        features_e.children().remove(); // clear list

        for (var i = 0; i < features.length; i++) {
            var row_e;
            
            var feature_tip_html = '';
            
            if (features[i].mode === 'group') {
                row_e = $('<tr><td style="width: 15px;"><input style="width: 13px;" class="feature" id="feature-'
                        + i
                        + '" value="'
                        + features[i].bit
                        + '" title="'
                        + features[i].name
                        + '" type="radio" name="'
                        + features[i].group
                        + '" /></td><td><label for="feature-'
                        + i
                        + '">'
                        + features[i].name
                        + '</label></td><td><span>' + features[i].description + '</span>' 
                        + feature_tip_html + '</td></tr>');
                radioGroups.push(features[i].group);
            } else {
                row_e = $('<tr><td><input class="feature toggle"'
                        + i
                        + '" name="'
                        + features[i].name
                        + '" title="'
                        + features[i].name
                        + '" type="checkbox"/></td><td><label for="feature-'
                        + i
                        + '">'
                        + features[i].name
                        + '</label></td><td><span>' + features[i].description + '</span>' 
                        + feature_tip_html + '</td></tr>');
                
                var feature_e = row_e.find('input.feature');

                feature_e.prop('checked', (value & 1<<features[i].bit));
                feature_e.data('bit', features[i].bit);
            }

			features_e.each(function () {
				if ($(this).hasClass(features[i].group)) {
					$(this).append(row_e);
				}
			});
		}

  			for (var i = 0; i < radioGroups.length; i++) {
				var group = radioGroups[i];
				var controls_e = $('input[name="' + group + '"].feature');

				controls_e.each(function() {
					var bit = parseInt($(this).attr('value'));
					var state = (value & 1<<bit);
	
					$(this).prop('checked', state);
				});
        	}
	}

    function renderSysConfig(sysConfig) { 
    
    	renderSelect(".controller select", sysConfig.pidController, PID_CONTROLLER_TYPE);

        // Populate the ROLL Pid Faceplate
        populatePID('.pid_tuning .ROLL input',  sysConfig.rollPID);
        populatePID('.pid_tuning .PITCH input', sysConfig.pitchPID);
        populatePID('.pid_tuning .YAW input',   sysConfig.yawPID);

        populatePID('.pid_tuning .ALT input',   sysConfig.altPID);
        populatePID('.pid_tuning .Vario input', sysConfig.velPID);
 
        setParameter('.pid_tuning .MAG input',	sysConfig.magPID, 1); // this is not an array
        
        populatePID('.pid_tuning .Pos input',   sysConfig.posPID);
        populatePID('.pid_tuning .PosR input',  sysConfig.posrPID);
        populatePID('.pid_tuning .NavR input',  sysConfig.navrPID);

        populatePID('.pid_tuning .LEVEL input', sysConfig.levelPID);

        // Fill in data from for the rates object
        setParameter('.parameter input[name="rcRate"]'					,sysConfig.rcRate,2);
        setParameter('.parameter input[name="vbatscale"]'				,sysConfig.vbatscale,0);
        setParameter('.parameter input[name="vbatref"]'					,sysConfig.vbatref,0);
        setParameter('.parameter input[name="vbatmincellvoltage"]'		,sysConfig.vbatmincellvoltage,1);
        setParameter('.parameter input[name="vbatmaxcellvoltage"]'		,sysConfig.vbatmaxcellvoltage,1);
        setParameter('.parameter input[name="vbatwarningcellvoltage"]'	,sysConfig.vbatwarningcellvoltage,1);
        setParameter('.parameter input[name="minthrottle"]'				,sysConfig.minthrottle,0);
        setParameter('.parameter input[name="maxthrottle"]'				,sysConfig.maxthrottle,0);
        setParameter('.parameter input[name="currentMeterOffset"]'		,sysConfig.currentMeterOffset,0);
        setParameter('.parameter input[name="currentMeterScale"]'		,sysConfig.currentMeterScale,0);
        setParameter('.parameter input[name="rcExpo"]'					,sysConfig.rcExpo,2);
        setParameter('.parameter input[name="rcYawExpo"]'				,sysConfig.rcYawExpo,2);
        setParameter('.parameter input[name="thrMid"]'					,sysConfig.thrMid,2);
        setParameter('.parameter input[name="thrExpo"]'					,sysConfig.thrExpo,2);
        setParameter('.parameter input[name="dynThrPID"]'				,sysConfig.dynThrPID,2);
        setParameter('.parameter input[name="tpa-breakpoint"]'			,sysConfig.tpa_breakpoint,0);
        setParameter('.parameter input[name="superExpoFactor"]'			,sysConfig.superExpoFactor,2);
        setParameter('.parameter input[name="rates_0"]'					,sysConfig.rates[0],2);
        setParameter('.parameter input[name="rates_1"]'					,sysConfig.rates[1],2);
        setParameter('.parameter input[name="rates_2"]'					,sysConfig.rates[2],2);
        setParameter('.parameter input[name="loopTime"]'				,sysConfig.loopTime,0);
        setParameter('.parameter input[name="yaw_p_limit"]'				,sysConfig.yaw_p_limit,0);
        setParameter('.parameter input[name="yaw_lpf_hz"]'				,sysConfig.yaw_lpf_hz,2);
        setParameter('.parameter input[name="dterm_average_count"]'		,sysConfig.dterm_average_count,0);
        setParameter('.parameter input[name="dynamic_dterm_threshold"]'	,sysConfig.dynamic_dterm_threshold,2);
        setParameter('.parameter input[name="rollPitchItermResetRate"]'	,sysConfig.rollPitchItermResetRate,0);
        setParameter('.parameter input[name="yawItermResetRate"]'		,sysConfig.yawItermResetRate,0);
        setParameter('.parameter input[name="dterm_lpf_hz"]'			,sysConfig.dterm_lpf_hz,2);
    	renderSelect(".parameter select[name='deltaMethod']"		    ,sysConfig.deltaMethod, PID_DELTA_TYPE);
        setParameter('.parameter input[name="H_sensitivity"]'			,sysConfig.H_sensitivity,2);
        setParameter('.parameter input[name="deadband"]'				,sysConfig.deadband,0);
        setParameter('.parameter input[name="yaw_deadband"]'			,sysConfig.yaw_deadband,0);
    	renderSelect(".parameter select[name='gyro_lpf']"			    ,sysConfig.gyro_lpf, GYRO_LPF);
        setParameter('.parameter input[name="gyro_lowpass_hz"]'			,sysConfig.gyro_lowpass_hz,2);
        setParameter('.parameter input[name="acc_lpf_hz"]'				,sysConfig.acc_lpf_hz,2);
        
/* Packed Flags */

        builtFeaturesList(sysConfig.features);

/* Hardware selections */
        
    	renderSelect(".parameter select[name='acc_hardware']"		    ,sysConfig.acc_hardware, ACC_HARDWARE);
    	renderSelect(".parameter select[name='baro_hardware']"		    ,sysConfig.baro_hardware, BARO_HARDWARE);
    	renderSelect(".parameter select[name='mag_hardware']"		    ,sysConfig.mag_hardware, MAG_HARDWARE);

/* Booleans */
        setCheckbox('.parameter input[name="gyro_cal_on_first_arm"]',	sysConfig.gyro_cal_on_first_arm);
        setCheckbox('.parameter input[name="vbat_pid_compensation"]',	sysConfig.vbat_pid_compensation);
        setCheckbox('.parameter input[name="rc_smoothing"]',			sysConfig.rc_smoothing);
    }
        
    function convertUIToSysConfig() { }

	// Public variables
    
    this.show = function(sysConfig) { 
            dialog.modal('show');
            renderSysConfig(sysConfig);
    }
 
 	// Buttons
 
    $(".header-view-dialog-save").click(function(e) {
        onSave(convertUIToSysConfig());
    });
}

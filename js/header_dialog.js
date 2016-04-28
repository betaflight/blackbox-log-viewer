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
    	var selectElem = $('.parameter select[name="' + name + '"]');
		if(selected!=null) {

			selectElem.children().remove(); // clear list

			for(var i=0; i<list.length; i++) {
				selectElem.append(renderOptions(selected, i, list));
			}
			selectElem.removeClass("missing");
		} else {
			selectElem.addClass("missing");
		}   	

    }
    
    function setParameter(name, data, decimalPlaces) {
		var nameElem = $('.parameter input[name="' + name + '"]');
		if(data!=null) {
			nameElem.val((data/Math.pow(10,decimalPlaces)).toFixed(decimalPlaces));
			nameElem.removeClass("missing");
		} else {
			nameElem.addClass("missing");
		}
	}

	function setCheckbox(name, data) {
		var nameElem = $('.parameter input[name="' + name + '"]');
		if(data!=null) {
			var state = (data == 1);
			nameElem.prop('checked', state);
			nameElem.closest('tr').removeClass("missing");
		} else {
			nameElem.closest('tr').addClass("missing");
		}
	}    

	function populatePID(name, data) {
        var i = 0;
        var nameElem = $('.pid_tuning .' + name + ' input');
        nameElem.each(function () {
                switch (i) {
                    case 0:
                    	if(data[i]!=null) {
								$(this).val((data[i]/10.0).toFixed(1));
								$(this).removeClass("missing");
                    		} else {
								$(this).addClass("missing");
                    		}
                    	i++;
                        break;
                    case 1:
                        if(data[i]!=null) {
								$(this).val((data[i]/1000.0).toFixed(3));
								$(this).removeClass("missing");
                    		} else {
								$(this).addClass("missing");
                    		}
                        i++;
                        break;
                    case 2:
                        if(data[i]!=null) {
								$(this).val(data[i].toFixed(0));
								$(this).removeClass("missing");
                    		} else {
								$(this).addClass("missing");
                    		}
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

		// Finally, if the features value is not part of the log, then invalidate all the check/radio boxes
		(value!=null)?$(".feature").closest('tr').removeClass("missing"):
					  $(".feature").closest('tr').addClass("missing");
        	
	}

    function renderSysConfig(sysConfig) { 
    
    	renderSelect("pidController", sysConfig.pidController, PID_CONTROLLER_TYPE);

        // Populate the ROLL Pid Faceplate
        populatePID('ROLL'						,  sysConfig.rollPID);
        populatePID('PITCH'						, sysConfig.pitchPID);
        populatePID('YAW'						,   sysConfig.yawPID);

        populatePID('ALT'						,   sysConfig.altPID);
        populatePID('Vario'						, sysConfig.velPID);
 
        setParameter('MAG'						,	sysConfig.magPID, 1); // this is not an array
        
        populatePID('Pos'						,   sysConfig.posPID);
        populatePID('PosR'						,  sysConfig.posrPID);
        populatePID('NavR'						,  sysConfig.navrPID);

        populatePID('LEVEL'						, sysConfig.levelPID);

        // Fill in data from for the rates object
        setParameter('rcRate'					,sysConfig.rcRate,2);
        setParameter('vbatscale'				,sysConfig.vbatscale,0);
        setParameter('vbatref'					,sysConfig.vbatref,0);
        setParameter('vbatmincellvoltage'		,sysConfig.vbatmincellvoltage,1);
        setParameter('vbatmaxcellvoltage'		,sysConfig.vbatmaxcellvoltage,1);
        setParameter('vbatwarningcellvoltage'	,sysConfig.vbatwarningcellvoltage,1);
        setParameter('minthrottle'				,sysConfig.minthrottle,0);
        setParameter('maxthrottle'				,sysConfig.maxthrottle,0);
        setParameter('currentMeterOffset'		,sysConfig.currentMeterOffset,0);
        setParameter('currentMeterScale'		,sysConfig.currentMeterScale,0);
        setParameter('rcExpo'					,sysConfig.rcExpo,2);
        setParameter('rcYawExpo'				,sysConfig.rcYawExpo,2);
        setParameter('thrMid'					,sysConfig.thrMid,2);
        setParameter('thrExpo'					,sysConfig.thrExpo,2);
        setParameter('dynThrPID'				,sysConfig.dynThrPID,2);
        setParameter('tpa-breakpoint'			,sysConfig.tpa_breakpoint,0);
        setParameter('superExpoFactor'			,sysConfig.superExpoFactor,2);
        setParameter('rates_0'					,sysConfig.rates[0],2);
        setParameter('rates_1'					,sysConfig.rates[1],2);
        setParameter('rates_2'					,sysConfig.rates[2],2);
        setParameter('loopTime'					,sysConfig.loopTime,0);
        setParameter('yaw_p_limit'				,sysConfig.yaw_p_limit,0);
        setParameter('yaw_lpf_hz'				,sysConfig.yaw_lpf_hz,2);
        setParameter('dterm_average_count'		,sysConfig.dterm_average_count,0);
        setParameter('rollPitchItermResetRate'	,sysConfig.rollPitchItermResetRate,0);
        setParameter('yawItermResetRate'		,sysConfig.yawItermResetRate,0);
        setParameter('dterm_lpf_hz'				,sysConfig.dterm_lpf_hz,2);
    	renderSelect('dterm_differentiator'		,sysConfig.dterm_differentiator, DTERM_DIFFERENTIATOR);
        setParameter('H_sensitivity'			,sysConfig.H_sensitivity,2);
        setParameter('deadband'					,sysConfig.deadband,0);
        setParameter('yaw_deadband'				,sysConfig.yaw_deadband,0);
    	renderSelect('gyro_lpf'			    	,sysConfig.gyro_lpf, GYRO_LPF);
        setParameter('gyro_lowpass_hz'			,sysConfig.gyro_lowpass_hz,2);
        setParameter('acc_lpf_hz'				,sysConfig.acc_lpf_hz,2);
        
/* Packed Flags */

        builtFeaturesList(sysConfig.features);

/* Hardware selections */
        
    	renderSelect('acc_hardware'		    	,sysConfig.acc_hardware, ACC_HARDWARE);
    	renderSelect('baro_hardware'		    ,sysConfig.baro_hardware, BARO_HARDWARE);
    	renderSelect('mag_hardware'		    	,sysConfig.mag_hardware, MAG_HARDWARE);

/* Booleans */
        setCheckbox('gyro_cal_on_first_arm'		,sysConfig.gyro_cal_on_first_arm);
        setCheckbox('vbat_pid_compensation'		,sysConfig.vbat_pid_compensation);
        setCheckbox('rc_smoothing'				,sysConfig.rc_smoothing);
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

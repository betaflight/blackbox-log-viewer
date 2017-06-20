'use strict';

function HeaderDialog(dialog, onSave) {

	// Private Variables


	var that = this; 		// generic pointer back to this function
	var activeSysConfig;	// pointer to the current system configuration

	/** By default, all parameters are shown on the header
		however, specific firmware version parameters can be hidden
		by adding them to this variable
	**/

	var parameterVersion = [
            {name:'dterm_average_count'	    	, type:FIRMWARE_TYPE_BETAFLIGHT,  min:'0.0.0', max:'2.6.9'},
            {name:'rc_smoothing'			    , type:FIRMWARE_TYPE_BETAFLIGHT,  min:'0.0.0', max:'2.8.9'},
			{name:'dynamic_pterm'				, type:FIRMWARE_TYPE_BETAFLIGHT,  min:'2.6.0', max:'2.7.9'},
			{name:'iterm_reset_offset'			, type:FIRMWARE_TYPE_BETAFLIGHT,  min:'2.6.0', max:'2.7.9'},
			{name:'superExpoFactor'				, type:FIRMWARE_TYPE_BETAFLIGHT,  min:'2.6.0', max:'2.7.9'},
			{name:'superExpoFactorYaw'			, type:FIRMWARE_TYPE_BETAFLIGHT,  min:'2.7.0', max:'2.7.9'},
			{name:'superExpoYawMode'		    , type:FIRMWARE_TYPE_BETAFLIGHT,  min:'2.7.0', max:'2.7.9'},
            {name:'rollPitchItermResetRate'		, type:FIRMWARE_TYPE_BETAFLIGHT,  min:'2.7.0', max:'2.7.9'},
            {name:'yawItermResetRate'			, type:FIRMWARE_TYPE_BETAFLIGHT,  min:'2.7.0', max:'2.7.9'},
			{name:'dynamic_pid'					, type:FIRMWARE_TYPE_BETAFLIGHT,  min:'2.8.0', max:'2.9.9'},
			{name:'rcYawRate'					, type:FIRMWARE_TYPE_BETAFLIGHT,  min:'2.8.0', max:'999.9.9'},
			{name:'airmode_activate_throttle'	, type:FIRMWARE_TYPE_BETAFLIGHT,  min:'2.8.0', max:'999.9.9'},
            {name:'rollPitchItermIgnoreRate'	, type:FIRMWARE_TYPE_BETAFLIGHT,  min:'2.8.0', max:'3.0.1'},
            {name:'yawItermIgnoreRate'			, type:FIRMWARE_TYPE_BETAFLIGHT,  min:'2.8.0', max:'3.0.1'},
            {name:'gyro_notch_hz'				, type:FIRMWARE_TYPE_BETAFLIGHT,  min:'3.0.0', max:'999.9.9'},
            {name:'gyro_notch_cutoff'		    , type:FIRMWARE_TYPE_BETAFLIGHT,  min:'3.0.0', max:'999.9.9'},
            {name:'dterm_notch_hz'				, type:FIRMWARE_TYPE_BETAFLIGHT,  min:'3.0.0', max:'999.9.9'},
            {name:'dterm_notch_cutoff'		    , type:FIRMWARE_TYPE_BETAFLIGHT,  min:'3.0.0', max:'999.9.9'},
            {name:'rc_interpolation'   			, type:FIRMWARE_TYPE_BETAFLIGHT,  min:'3.0.0', max:'999.9.9'},
            {name:'rc_interpolation_interval'   , type:FIRMWARE_TYPE_BETAFLIGHT,  min:'3.0.0', max:'999.9.9'},
            {name:'gyro_sync_denom'			    , type:FIRMWARE_TYPE_BETAFLIGHT,  min:'3.0.0', max:'999.9.9'},
            {name:'pid_process_denom'    		, type:FIRMWARE_TYPE_BETAFLIGHT,  min:'3.0.0', max:'999.9.9'},
            {name:'unsynced_fast_pwm'    		, type:FIRMWARE_TYPE_BETAFLIGHT,  min:'3.0.0', max:'999.9.9'},
            {name:'fast_pwm_protocol'    		, type:FIRMWARE_TYPE_BETAFLIGHT,  min:'3.0.0', max:'999.9.9'},
            {name:'motor_pwm_rate'    			, type:FIRMWARE_TYPE_BETAFLIGHT,  min:'3.0.0', max:'999.9.9'},
			{name:'serialrx_provider'			, type:FIRMWARE_TYPE_BETAFLIGHT,  min:'3.0.0', max:'999.9.9'},
            {name:'dterm_filter_type'			, type:FIRMWARE_TYPE_BETAFLIGHT,  min:'3.0.0', max:'999.9.9'},
            {name:'pidAtMinThrottle'			, type:FIRMWARE_TYPE_BETAFLIGHT,  min:'3.0.0', max:'999.9.9'},
            {name:'itermThrottleGain'			, type:FIRMWARE_TYPE_BETAFLIGHT,  min:'3.0.0', max:'3.0.1'},
            {name:'ptermSRateWeight'			, type:FIRMWARE_TYPE_BETAFLIGHT,  min:'3.0.0', max:'3.0.0'},
            {name:'dtermSetpointWeight'			, type:FIRMWARE_TYPE_BETAFLIGHT,  min:'3.0.0', max:'999.9.9'},
            {name:'yawRateAccelLimit'			, type:FIRMWARE_TYPE_BETAFLIGHT,  min:'3.0.0', max:'999.9.9'},
            {name:'rateAccelLimit'				, type:FIRMWARE_TYPE_BETAFLIGHT,  min:'3.0.0', max:'999.9.9'},
            {name:'gyro_soft_type'				, type:FIRMWARE_TYPE_BETAFLIGHT,  min:'3.0.0', max:'999.9.9'},
            {name:'debug_mode'					, type:FIRMWARE_TYPE_BETAFLIGHT,  min:'3.0.0', max:'999.9.9'},
			{name:'gyro_notch_hz_2'				, type:FIRMWARE_TYPE_BETAFLIGHT,  min:'3.0.1', max:'999.9.9'},
			{name:'gyro_notch_cutoff_2'		    , type:FIRMWARE_TYPE_BETAFLIGHT,  min:'3.0.1', max:'999.9.9'},
			{name:'pidController'		    	, type:FIRMWARE_TYPE_BETAFLIGHT,  min:'0.0.0', max:'3.0.1'},
			{name:'motorOutputLow'		        , type:FIRMWARE_TYPE_BETAFLIGHT,  min:'3.1.0', max:'999.9.9'},
			{name:'motorOutputHigh'		        , type:FIRMWARE_TYPE_BETAFLIGHT,  min:'3.1.0', max:'999.9.9'},
			{name:'digitalIdleOffset'	        , type:FIRMWARE_TYPE_BETAFLIGHT,  min:'3.1.0', max:'999.9.9'},
	        {name:'setpointRelaxRatio'			, type:FIRMWARE_TYPE_BETAFLIGHT,  min:'3.1.0', max:'999.9.9'},
            {name:'antiGravityGain'             , type:FIRMWARE_TYPE_BETAFLIGHT,  min:'3.1.0', max:'999.9.9'},
	        {name:'antiGravityThreshold'        , type:FIRMWARE_TYPE_BETAFLIGHT,  min:'3.1.0', max:'999.9.9'},
            {name:'itermWindupPointPercent'     , type:FIRMWARE_TYPE_BETAFLIGHT,  min:'3.1.0', max:'999.9.9'}
	];

	function isParameterValid(name) {

		for(var i=0; i<parameterVersion.length; i++) {
			if (parameterVersion[i].name == name && parameterVersion[i].type == activeSysConfig.firmwareType) {
				return (semver.gte(activeSysConfig.firmwareVersion, parameterVersion[i].min) && semver.lte(activeSysConfig.firmwareVersion, parameterVersion[i].max));
			}
		}
		return true; // default is to show parameter
	}

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
    	var parameterElem = $('.parameter td[name="' + name + '"]');
    	var selectElem = $('select', parameterElem);
			selectElem.children().remove(); // clear list
			for(var i=0; i<list.length; i++) {
				selectElem.append(renderOptions(selected, i, list));
			}
			parameterElem.attr('title', 'set '+name+'='+list[selectElem.val()]);

			parameterElem.css('display', isParameterValid(name)?('table-cell'):('none'));

			if(selected!=null) {
				parameterElem.removeClass('missing');
			} else {
				parameterElem.addClass('missing');
			}

    }

    function setParameter(name, data, decimalPlaces) {
    	var parameterElem = $('.parameter td[name="' + name + '"]');
		var nameElem = $('input', parameterElem);
		if(data!=null) {
			nameElem.val((data/Math.pow(10,decimalPlaces)).toFixed(decimalPlaces));
			nameElem.attr('decPl', decimalPlaces);
			parameterElem.attr('title', 'set '+name+'='+data);
			parameterElem.removeClass('missing');
		} else {
			parameterElem.addClass('missing');
		}
		parameterElem.css('display', isParameterValid(name)?('table-cell'):('none'));

	}

    function setParameterFloat(name, data, decimalPlaces) {
        var parameterElem = $('.parameter td[name="' + name + '"]');
        var nameElem = $('input', parameterElem);
        if(data!=null) {
            nameElem.val(data.toFixed(decimalPlaces));
            nameElem.attr('decPl', decimalPlaces);
            parameterElem.attr('title', 'set '+name+'='+data);
            parameterElem.removeClass('missing');
        } else {
            parameterElem.addClass('missing');
        }
        parameterElem.css('display', isParameterValid(name)?('table-cell'):('none'));

    }


	function setCheckbox(name, data) {
    	var parameterElem = $('.static-features td[name="' + name + '"]');
		var nameElem = $('input', parameterElem);
		if(data!=null) {
			var state = (data == 1);
			nameElem.prop('checked', state);
			parameterElem.attr('title', 'set '+name+'='+data);
			nameElem.closest('tr').removeClass('missing');
		} else {
			nameElem.closest('tr').addClass('missing');
		}
		parameterElem.parent().css('display', isParameterValid(name)?('table-cell'):('none'));
	}

	function populatePID(name, data) {
		var i = 0;
        var nameElem = $('.pid_tuning .' + name + ' input');
        nameElem.each(function () {
			$(this).attr('name', name + '[' + i + ']');
			if(data!=null) {
				$(this).closest('tr').removeClass('missing');
				switch (i) {
					case 0:
						if(data[i]!=null) {
								$(this).val((data[i]).toFixed(0));
								$(this).attr('decPl', 1);
								$(this).removeClass('missing');
							} else {
								$(this).addClass('missing');
							}
						i++;
						break;
					case 1:
						if(data[i]!=null) {
								$(this).val((data[i]).toFixed(0));
								$(this).attr('decPl', 3);
								$(this).removeClass('missing');
							} else {
								$(this).addClass('missing');
							}
						i++;
						break;
					case 2:
						if(data[i]!=null) {
								$(this).val(data[i].toFixed(0));
								$(this).attr('decPl', 0);
								$(this).removeClass('missing');
							} else {
								$(this).addClass('missing');
							}
						i++;
						break;
					}
				} else $(this).closest('tr').addClass('missing');
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

	function builtFeaturesList(sysConfig) {

		var value = sysConfig.features;

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
            {bit: 19, group: 'other', name: 'BLACKBOX', description: 'Blackbox flight data recorder'},
            {bit: 20, group: 'other', name: 'CHANNEL_FORWARDING', description: 'Forward aux channels to servo outputs'},
            {bit: 21, group: 'other', name: 'TRANSPONDER', description: 'Transponder enabled'}
        ];


        // Add specific features for betaflight v2.8 onwards....
		if (semver.gte(sysConfig.firmwareVersion, "2.8.0")) {
			features.push(
				{bit: 22, group: 'other', name: 'AIRMODE', description: 'Airmode always enabled, set off to use modes'}
			);
		}

		if (semver.gte(sysConfig.firmwareVersion, "2.8.0") && !semver.gte(sysConfig.firmwareVersion, "3.0.0")) {
			features.push(
				{bit: 23, group: 'other', name: 'SUPEREXPO_RATES', description: 'Super Expo Mode'}
			);
		}

        if (semver.gte(sysConfig.firmwareVersion, "2.8.0") && !semver.gte(sysConfig.firmwareVersion, "3.0.0")) {
            features.push(
                {bit: 18, group: 'other', name: 'ONESHOT125', description: 'Oneshot 125 Enabled'}
            );
        }

		if (semver.gte(sysConfig.firmwareVersion, "3.0.0")) {
			features.push(
				{bit: 18, group: 'other', name: 'OSD', description: 'On Screen Display'}
			);
		}

		if (semver.gte(sysConfig.firmwareVersion, "3.1.0")) {
			features.push(
				{bit: 27, group: 'other', name: 'ESC_SENSOR', description: 'Use KISS ESC 24A telemetry as sensor'}
			)
		}

        var radioGroups = [];

        var features_e = $('.features');
        features_e.children().remove(); // clear list

        for (var i = 0; i < features.length; i++) {
            var row_e;

            var feature_tip_html = '';

            if (features[i].mode === 'group') {
                row_e = $('<tr><td><input class="feature" id="feature-'
                        + i
                        + '" value="'
                        + features[i].bit
                        + '" title="feature ' + ((value & 1<<features[i].bit)?'':'-')
                        + features[i].name
                        + '" type="radio" name="'
                        + features[i].group
                        + '" bit="' + i + '" /></td><td><label for="feature-'
                        + i
                        + '">'
                        + features[i].name
                        + '</label></td><td><span>' + features[i].description + '</span>'
                        + feature_tip_html + '</td></tr>');
                radioGroups.push(features[i].group);
            } else {
                row_e = $('<tr><td><label class="option"><input class="feature '
                        + i
                        + ' ios-switch" name="'
                        + features[i].name
                        + '" title="feature ' + ((value & 1<<features[i].bit)?'':'-')
                        + features[i].name
                        + '" type="checkbox" bit="'+ i +'" /><div><div></div></div></label></td><td><label for="feature-'
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
		(value!=null)?$(".feature").closest('tr').removeClass('missing'):
					  $(".feature").closest('tr').addClass('missing');

	}

	function renderUnknownHeaders(unknownHeaders) {
		// Build a table of unknown header entries
		try {
			if(unknownHeaders!=0) {
				var table = $('.unknown table');
				var elem = '';
				$("tr:not(:first)", table).remove(); // clear the entries (not the first row which has the title bar)

				for(var i=0; i<unknownHeaders.length; i++) {
					elem += '<tr><td>' + unknownHeaders[i].name + '</td>' +
								'<td>' + unknownHeaders[i].value + '</td></tr>';
				}

				table.append(elem);
				$('.unknown').show();
			} else {
				$('.unknown').hide();
			}
		} catch(e) {
			$('.unknown').hide();
		}
	}

    function renderSysConfig(sysConfig) {

		activeSysConfig = sysConfig; // Store the current system configuration

    	// Update the log header

    	$('h5.modal-title-revision').text( ((sysConfig['Firmware revision']!=null)?(' Rev : '  + sysConfig['Firmware revision']):''));
    	$('h5.modal-title-date').text(     ((sysConfig['Firmware date']!=null)    ?(' Date : ' + sysConfig['Firmware date']    ):''));
    	$('h5.modal-title-craft').text(    ((sysConfig['Craft name']!=null)       ?(' Name : ' + sysConfig['Craft name']    ):''));

		switch(sysConfig.firmwareType) {
			case FIRMWARE_TYPE_BETAFLIGHT:
			case FIRMWARE_TYPE_CLEANFLIGHT:
				$('.header-dialog-toggle').hide(); // selection button is not required
					break;
			case FIRMWARE_TYPE_INAV:
				$('[name="rates[0]"] input').attr("step", "10").attr("min", "10").attr("max", "1800");
				$('.header-dialog-toggle').hide(); // selection button is not required
					break;
			default:
				$('.header-dialog-toggle').text('Cleanflight');

				// Toggle Button
				$('.header-dialog-toggle').show(); // Selection button is required
				$('.header-dialog-toggle').click( function() {
					if($('html').hasClass('isCF')) {
						$('html').addClass('isBF');
						$('html').removeClass('isCF');
						$('.header-dialog-toggle').text('Betaflight');
					} else {
						$('html').removeClass('isBF');
						$('html').addClass('isCF');
						$('.header-dialog-toggle').text('Cleanflight');
					}
				});
		}

		if((sysConfig.firmware >= 3.0 && sysConfig.firmwareType == FIRMWARE_TYPE_BETAFLIGHT) ||
		   (sysConfig.firmware >= 2.0 && sysConfig.firmwareType == FIRMWARE_TYPE_CLEANFLIGHT)) {
		   
			PID_CONTROLLER_TYPE = ([
					'LEGACY',
					'BETAFLIGHT'
				])
		} else {
			PID_CONTROLLER_TYPE = ([
					'UNUSED',
					'MWREWRITE',
					'LUXFLOAT'
				]) 
		}

    	renderSelect("pidController", sysConfig.pidController, PID_CONTROLLER_TYPE);

        // Populate the ROLL Pid Faceplate
        populatePID('rollPID'					, sysConfig.rollPID);
        populatePID('pitchPID'					, sysConfig.pitchPID);
        populatePID('yawPID'					, sysConfig.yawPID);
        populatePID('altPID'					, sysConfig.altPID);
        populatePID('velPID'					, sysConfig.velPID);
        populatePID('magPID'					, sysConfig.magPID); // this is not an array
        populatePID('posPID'					, sysConfig.posPID);
        populatePID('posrPID'					, sysConfig.posrPID);
        populatePID('navrPID'					, sysConfig.navrPID);

        populatePID('levelPID'					, sysConfig.levelPID);

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
        setParameter('rcYawRate'				,sysConfig.rcYawRate,2);
        setParameter('rcYawExpo'				,sysConfig.rcYawExpo,2);
        setParameter('thrMid'					,sysConfig.thrMid,2);
        setParameter('thrExpo'					,sysConfig.thrExpo,2);
        setParameter('dynThrPID'				,sysConfig.dynThrPID,2);
        setParameter('tpa-breakpoint'			,sysConfig.tpa_breakpoint,0);
		setParameter('superExpoFactor'			,sysConfig.superExpoFactor,2);
		setParameter('superExpoFactorYaw'		,sysConfig.superExpoFactorYaw,2);

		if (sysConfig.firmwareType == FIRMWARE_TYPE_INAV) {
			setParameter('rates[0]'				,sysConfig.rates[0] * 10,0);
			setParameter('rates[1]'				,sysConfig.rates[1] * 10,0);
			setParameter('rates[2]'				,sysConfig.rates[2] * 10,0);
		} else {
			setParameter('rates[0]'				,sysConfig.rates[0],2);
	        setParameter('rates[1]'				,sysConfig.rates[1],2);
	        setParameter('rates[2]'				,sysConfig.rates[2],2);
		}

        setParameter('loopTime'					,sysConfig.looptime,0);
        setParameter('gyro_sync_denom'			,sysConfig.gyro_sync_denom,0);
        setParameter('pid_process_denom'		,sysConfig.pid_process_denom,0);
        setParameter('yaw_p_limit'				,sysConfig.yaw_p_limit,0);
        setParameter('dterm_average_count'		,sysConfig.dterm_average_count,0);
    	renderSelect('dynamic_pterm'			,sysConfig.dynamic_pterm, OFF_ON);
        setParameter('rollPitchItermResetRate'	,sysConfig.rollPitchItermResetRate,0);
        setParameter('yawItermResetRate'		,sysConfig.yawItermResetRate,0);
        setParameter('rollPitchItermIgnoreRate'	,sysConfig.rollPitchItermIgnoreRate,0);
        setParameter('yawItermIgnoreRate'		,sysConfig.yawItermIgnoreRate,0);
        setParameter('itermWindupPointPercent'  ,sysConfig.itermWindupPointPercent,0);
        setParameter('dterm_cut_hz'				,sysConfig.dterm_cut_hz,2);
        setParameter('iterm_reset_offset'		,sysConfig.iterm_reset_offset,0);
        setParameter('deadband'					,sysConfig.deadband,0);
        setParameter('yaw_deadband'				,sysConfig.yaw_deadband,0);
    	renderSelect('gyro_lpf'			    	,sysConfig.gyro_lpf, GYRO_LPF);
        setParameter('acc_lpf_hz'				,sysConfig.acc_lpf_hz,2);
        setParameter('acc_cut_hz'				,sysConfig.acc_cut_hz,2);
	    setParameter('airmode_activate_throttle',sysConfig.airmode_activate_throttle, 0);
	    renderSelect('serialrx_provider'		,sysConfig.serialrx_provider, SERIALRX_PROVIDER);
	    renderSelect('superExpoYawMode'		    ,sysConfig.superExpoYawMode, SUPER_EXPO_YAW);
    	renderSelect('dynamic_pid'				,sysConfig.dynamic_pid, OFF_ON);

		if(isParameterValid('gyro_notch_hz_2')) {
			setParameter('gyro_notch_hz'			,sysConfig.gyro_notch_hz[0],0);
			setParameter('gyro_notch_cutoff'		,sysConfig.gyro_notch_cutoff[0],0);
			setParameter('gyro_notch_hz_2'			,sysConfig.gyro_notch_hz[1],0);
			setParameter('gyro_notch_cutoff_2'		,sysConfig.gyro_notch_cutoff[1],0);
		} else {
			setParameter('gyro_notch_hz'			,sysConfig.gyro_notch_hz, 0);
			setParameter('gyro_notch_cutoff'		,sysConfig.gyro_notch_cutoff, 0);
			setParameter('gyro_notch_hz_2'			,0,0); // this parameter does not exist in earlier versions
			setParameter('gyro_notch_cutoff_2'		,0,0); // this parameter does not exist in earlier versions
		}
		setParameter('dterm_notch_hz'			,sysConfig.dterm_notch_hz,0);
		setParameter('dterm_notch_cutoff'		,sysConfig.dterm_notch_cutoff,0);
		setParameter('dterm_lpf_hz'				,sysConfig.dterm_lpf_hz,0);
		setParameter('yaw_lpf_hz'				,sysConfig.yaw_lpf_hz,0);
		setParameter('gyro_lowpass_hz'			,sysConfig.gyro_lowpass_hz,0);

    	renderSelect('rc_interpolation'		    ,sysConfig.rc_interpolation, RC_INTERPOLATION);
        setParameter('rc_interpolation_interval',sysConfig.rc_interpolation_interval,0);
    	renderSelect('unsynced_fast_pwm'		,sysConfig.unsynced_fast_pwm, MOTOR_SYNC);
    	renderSelect('fast_pwm_protocol'		,sysConfig.fast_pwm_protocol, FAST_PROTOCOL);
        setParameter('motor_pwm_rate'		    ,sysConfig.motor_pwm_rate,0);
        renderSelect('dterm_filter_type'		,sysConfig.dterm_filter_type, FILTER_TYPE);
        setParameter('ptermSRateWeight'			,sysConfig.ptermSRateWeight,2);
        setParameter('dtermSetpointWeight'		,sysConfig.dtermSetpointWeight,2);
        if(activeSysConfig.firmwareType == FIRMWARE_TYPE_BETAFLIGHT && semver.gte(activeSysConfig.firmwareVersion, '3.1.0')) {
            setParameterFloat('yawRateAccelLimit', sysConfig.yawRateAccelLimit, 2);
            setParameterFloat('rateAccelLimit'   , sysConfig.rateAccelLimit, 2);
        } else {
            setParameter('yawRateAccelLimit'    , sysConfig.yawRateAccelLimit, 1);
            setParameter('rateAccelLimit'       , sysConfig.rateAccelLimit, 1);
        }
        renderSelect('gyro_soft_type'			,sysConfig.gyro_soft_type, FILTER_TYPE);
        renderSelect('debug_mode'				,sysConfig.debug_mode, DEBUG_MODE);
		setParameter('motorOutputLow'			,sysConfig.motorOutput[0],0);
		setParameter('motorOutputHigh'			,sysConfig.motorOutput[1],0);
		setParameter('digitalIdleOffset'		,sysConfig.digitalIdleOffset,2);
        setParameter('antiGravityGain'          ,sysConfig.anti_gravity_gain,0);
        setParameter('antiGravityThreshold'     ,sysConfig.anti_gravity_threshold,0);
        setParameter('setpointRelaxRatio'		,sysConfig.setpointRelaxRatio,2);

		/* Packed Flags */

        builtFeaturesList(sysConfig);

		/* Hardware selections */

    	renderSelect('acc_hardware'		    	,sysConfig.acc_hardware, ACC_HARDWARE);
    	renderSelect('baro_hardware'		    ,sysConfig.baro_hardware, BARO_HARDWARE);
    	renderSelect('mag_hardware'		    	,sysConfig.mag_hardware, MAG_HARDWARE);

		/* Booleans */
        setCheckbox('gyro_cal_on_first_arm'		,sysConfig.gyro_cal_on_first_arm);
        setCheckbox('vbat_pid_compensation'		,sysConfig.vbat_pid_compensation);
        setCheckbox('rc_smoothing'				,sysConfig.rc_smoothing);
        setCheckbox('pidAtMinThrottle'			,sysConfig.pidAtMinThrottle);

        /* Show Unknown Fields */
        renderUnknownHeaders(sysConfig.unknownHeaders);

        /* Remove some version specific headers */
        if(activeSysConfig.firmwareType == FIRMWARE_TYPE_BETAFLIGHT && semver.gte(activeSysConfig.firmwareVersion, '3.1.0')) {
            $(".BFPIDController").css("display","none");
        } else {
            $(".BFPIDController").css("display","table-header-group");
        }

		/*
		 * In case of INAV, hide irrelevant options
		 */
		 if (sysConfig.firmwareType == FIRMWARE_TYPE_INAV) {
			 $(".no-inav").hide();
			 $(".bf-only").hide();
		 }

    }

    function convertUIToSysConfig() {
    	console.log('Saving....');
    	var newSysConfig = {};

    	// Scan all the parameters
		$(".parameter input").each(function() {
			if($(this).val()!=null) {
				var matches=$(this).attr('name').match(/(.+)\[(\d+)\]/);
				if(matches!=null) { // this is a variable in an array
					if(newSysConfig[matches[1]]==null) { // array doesn't exist, create it
						newSysConfig[matches[1]] = [];
						}
					var newArray = newSysConfig[matches[1]];
					if($(this).attr('decPl')!=null) {
						newArray[matches[2]] = (parseFloat($(this).val()) * Math.pow(10, $(this).attr('decPl')));
					} else {
						newArray[matches[2]] = (($(this).val()=='on')?1:0);
					}
				} else { // this is just a straight field variable
					if($(this).attr('decPl')!=null) {
						newSysConfig[$(this).attr('name')] = (parseFloat($(this).val()) * Math.pow(10, $(this).attr('decPl')));
					} else {
						newSysConfig[$(this).attr('name')] = (($(this).val()=='on')?1:0);
					}
				}
			}
			});

    	// Scan all the drop-down lists
		$(".parameter select").each(function() {
			if($(this).val()!=null) {
					newSysConfig[$(this).attr('name')] = parseInt($(this).val());
			}
			});


		// Scan the pid_tuning table
		$(".pid_tuning input").each(function() {
			if($(this).val()!=null) {
				if($(this).attr('decPl')!=null) {
					var matches=$(this).attr('name').match(/(.+)\[(\d+)\]/);
					if(matches!=null) {
						if(newSysConfig[matches[1]]==null) newSysConfig[matches[1]] = [null, null, null];
						var newArray = newSysConfig[matches[1]];
						newArray[matches[2]] = (parseFloat($(this).val()) * Math.pow(10, $(this).attr('decPl')));
					} else (parseFloat($(this).val()) * Math.pow(10, $(this).attr('decPl')));
				} else {
					newSysConfig[$(this).attr('name')] = $(this).val();
				}
			}
			});

		//Build the features value
		var newFeatureValue = 0;
		$(".features td input").each(function() {
				if ($(this).prop('checked')) {
					newFeatureValue |= (1<<parseInt($(this).attr('bit')));
				}
			});
		newSysConfig['features'] = newFeatureValue;

		return newSysConfig;
    }

	// Public variables

    this.show = function(sysConfig) {
            dialog.modal('show');
            renderSysConfig(sysConfig);

    }

 	// Buttons

    $(".header-dialog-save").click(function(e) {
        onSave(convertUIToSysConfig());
    });
}

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
			selectElem.children().remove(); // clear list
			for(var i=0; i<list.length; i++) {
				selectElem.append(renderOptions(selected, i, list));
			}
			selectElem.attr('title', 'set '+name+'='+list[selectElem.val()]);

			if(selected!=null) {
			selectElem.removeClass('missing');
		} else {
			selectElem.addClass('missing');
		}   	

    }
    
    function setParameter(name, data, decimalPlaces) {
		var nameElem = $('.parameter input[name="' + name + '"]');
		if(data!=null) {
			nameElem.val((data/Math.pow(10,decimalPlaces)).toFixed(decimalPlaces));
			nameElem.attr('decPl', decimalPlaces);
			nameElem.attr('title', 'set '+name+'='+data);
			nameElem.removeClass('missing');
		} else {
			nameElem.addClass('missing');
		}
	}

	function setCheckbox(name, data) {
		var nameElem = $('.parameter input[name="' + name + '"]');
		if(data!=null) {
			var state = (data == 1);
			nameElem.prop('checked', state);
			nameElem.attr('title', 'set '+name+'='+data);
			nameElem.closest('tr').removeClass('missing');
		} else {
			nameElem.closest('tr').addClass('missing');
		}
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
								$(this).val((data[i]/10.0).toFixed(1));
								$(this).attr('decPl', 1);
								$(this).removeClass('missing');
							} else {
								$(this).addClass('missing');
							}
						i++;
						break;
					case 1:
						if(data[i]!=null) {
								$(this).val((data[i]/1000.0).toFixed(3));
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
                row_e = $('<tr><td><input class="feature toggle"'
                        + i
                        + '" name="'
                        + features[i].name
                        + '" title="feature ' + ((value & 1<<features[i].bit)?'':'-')
                        + features[i].name
                        + '" type="checkbox" bit="'+ i +'" /></td><td><label for="feature-'
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
    
    	// Update the log header

    	$('h5.modal-title-revision').text( ((sysConfig['Firmware revision']!=null)?(' Rev : '  + sysConfig['Firmware revision']):''));
    	$('h5.modal-title-date').text(     ((sysConfig['Firmware date']!=null)    ?(' Date : ' + sysConfig['Firmware date']    ):''));
    
		// check if this is betaflight or cleanflight
		if(sysConfig['Firmware revision']!=null) {
			var matches=sysConfig['Firmware revision'].match(/.*(Cleanflight|Betaflight).*/);
			if(matches!=null) { // This is either Cleanflight or Betaflight
				$('.header-dialog-toggle').hide();			
				// The firmware is present is it betaflight ?
				matches=sysConfig['Firmware revision'].match(/.*(Betaflight).*/);
				if(matches!=null) { // Found, its Betaflight
					$('html').addClass('isBF');
					$('html').removeClass('isCF');
				} else { // Assume it really is Cleanflight
					$('html').removeClass('isBF');
					$('html').addClass('isCF');							
				}
			} else { // Firmware type unknown, default to cleanflight
					 // but give the user a button to change it
				$('html').removeClass('isBF');
				$('html').addClass('isCF');							
				$('.header-dialog-toggle').text('Cleanflight');

				// Toggle Button
				$('.header-dialog-toggle').show();
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
        setParameter('rcYawExpo'				,sysConfig.rcYawExpo,2);
        setParameter('thrMid'					,sysConfig.thrMid,2);
        setParameter('thrExpo'					,sysConfig.thrExpo,2);
        setParameter('dynThrPID'				,sysConfig.dynThrPID,2);
        setParameter('tpa-breakpoint'			,sysConfig.tpa_breakpoint,0);
		setParameter('superExpoFactor'			,sysConfig.superExpoFactor,2);
		setParameter('superExpoFactorYaw'		,sysConfig.superExpoFactorYaw,2);
        setParameter('rates[0]'					,sysConfig.rates[0],2);
        setParameter('rates[1]'					,sysConfig.rates[1],2);
        setParameter('rates[2]'					,sysConfig.rates[2],2);
        setParameter('loopTime'					,sysConfig.loopTime,0);
        setParameter('yaw_p_limit'				,sysConfig.yaw_p_limit,0);
        setParameter('yaw_lpf_hz'				,sysConfig.yaw_lpf_hz,2);
        setParameter('dterm_average_count'		,sysConfig.dterm_average_count,0);
        setParameter('rollPitchItermResetRate'	,sysConfig.rollPitchItermResetRate,0);
        setParameter('yawItermResetRate'		,sysConfig.yawItermResetRate,0);
        setParameter('dterm_lpf_hz'				,sysConfig.dterm_lpf_hz,2);
        setParameter('dterm_cut_hz'				,sysConfig.dterm_cut_hz,2);
    	renderSelect('dterm_differentiator'		,sysConfig.dterm_differentiator, DTERM_DIFFERENTIATOR);
    	renderSelect('deltaMethod'				,sysConfig.deltaMethod, PID_DELTA_TYPE);
    	renderSelect('dynamic_pterm'			,sysConfig.dynamic_pterm, OFF_ON);
        setParameter('dynamic_dterm_threshold'	,sysConfig.dynamic_dterm_threshold,2);
        setParameter('H_sensitivity'			,sysConfig.H_sensitivity,2);
        setParameter('deadband'					,sysConfig.deadband,0);
        setParameter('yaw_deadband'				,sysConfig.yaw_deadband,0);
    	renderSelect('gyro_lpf'			    	,sysConfig.gyro_lpf, GYRO_LPF);
        setParameter('gyro_lowpass_hz'			,sysConfig.gyro_lowpass_hz,2);
        setParameter('acc_lpf_hz'				,sysConfig.acc_lpf_hz,2);
        setParameter('acc_cut_hz'				,sysConfig.acc_cut_hz,2);
	    renderSelect('superExpoYawMode'		    ,sysConfig.superExpoYawMode, SUPER_EXPO_YAW);
        
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

        /* Show Unknown Fields */
        renderUnknownHeaders(sysConfig.unknownHeaders);

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

'use strict';

function UserSettingsDialog(dialog, onSave) {

	// Private Variables
    
	// generate mixer (from Cleanflight Configurator) (note that the mixerConfiguration index starts at 1)
	var mixerList = [
	     {name: 'Tricopter',       model: 'tricopter',    image: 'tri',				defaultMotorOrder: [0, 1, 2], 				defaultYawOffset: -Math.PI / 2},
	     {name: 'Quad +',          model: 'quad_x',       image: 'quad_p',			defaultMotorOrder: [1, 3, 2, 0], 			defaultYawOffset: 0},
	     {name: 'Quad X',          model: 'quad_x',       image: 'quad_x',			defaultMotorOrder: [1, 3, 2, 0], 			defaultYawOffset: Math.PI / 4},
	     {name: 'Bicopter',        model: 'custom',       image: 'bicopter',		defaultMotorOrder: [0,1], 					defaultYawOffset: 0},
	     {name: 'Gimbal',          model: 'custom',       image: 'custom',			defaultMotorOrder: [0,1,2], 				defaultYawOffset: 0},
	     {name: 'Y6',              model: 'y6',           image: 'y6',				defaultMotorOrder: [4, 1, 3, 5, 2, 0], 		defaultYawOffset: 0},
	     {name: 'Hex +',           model: 'hex_plus',     image: 'hex_p',			defaultMotorOrder: [4, 1, 3, 5, 2, 0], 		defaultYawOffset: 0},
	     {name: 'Flying Wing',     model: 'custom',       image: 'flying_wing',		defaultMotorOrder: [0], 					defaultYawOffset: 0},
	     {name: 'Y4',              model: 'y4',           image: 'y4',				defaultMotorOrder: [1, 3, 2, 0], 			defaultYawOffset: Math.PI / 4},
	     {name: 'Hex X',           model: 'hex_x',        image: 'hex_x',			defaultMotorOrder: [4, 1, 3, 5, 2, 0], 		defaultYawOffset: Math.PI / 6},
	     {name: 'Octo X8',         model: 'custom',       image: 'octo_x8',			defaultMotorOrder: [5, 1, 4, 0, 7, 3, 6, 2],defaultYawOffset: Math.PI / 8},
	     {name: 'Octo Flat +',     model: 'custom',       image: 'octo_flat_p',		defaultMotorOrder: [5, 1, 4, 0, 7, 3, 6, 2],defaultYawOffset: 0},
	     {name: 'Octo Flat X',     model: 'custom',       image: 'octo_flat_x',		defaultMotorOrder: [5, 1, 4, 0, 7, 3, 6, 2],defaultYawOffset: Math.PI / 8},
	     {name: 'Airplane',        model: 'custom',       image: 'airplane',		defaultMotorOrder: [0], 					defaultYawOffset: 0},
	     {name: 'Heli 120',        model: 'custom',       image: 'custom',			defaultMotorOrder: [0], 					defaultYawOffset: 0},
	     {name: 'Heli 90',         model: 'custom',       image: 'custom',			defaultMotorOrder: [0], 					defaultYawOffset: 0},
	     {name: 'V-tail Quad',     model: 'quad_vtail',   image: 'vtail_quad',		defaultMotorOrder: [1, 3, 2, 0], 			defaultYawOffset: Math.PI / 4},
	     {name: 'Hex H',           model: 'custom',       image: 'custom',			defaultMotorOrder: [4, 1, 3, 5, 2, 0], 		defaultYawOffset: 0},
	     {name: 'PPM to SERVO',    model: 'custom',       image: 'custom',			defaultMotorOrder: [0], 					defaultYawOffset: 0},
	     {name: 'Dualcopter',      model: 'custom',       image: 'custom',			defaultMotorOrder: [0,1], 					defaultYawOffset: 0},
	     {name: 'Singlecopter',    model: 'custom',       image: 'custom',			defaultMotorOrder: [0], 					defaultYawOffset: 0},
	     {name: 'A-tail Quad',     model: 'quad_atail',   image: 'atail_quad',		defaultMotorOrder: [1, 3, 2, 0], 			defaultYawOffset: Math.PI / 4},
	     {name: 'Custom',          model: 'custom',       image: 'custom',			defaultMotorOrder: [0], 					defaultYawOffset: 0},
	     {name: 'Custom Airplane', model: 'custom',       image: 'custom',			defaultMotorOrder: [0], 					defaultYawOffset: 0},
	     {name: 'Custom Tricopter', model: 'custom',      image: 'custom',			defaultMotorOrder: [0, 1, 2], 				defaultYawOffset: -Math.PI / 2}

	];

	// Setup Defaults....

	var currentSettings = {
		mixerConfiguration : 3, 				// Default to Quad-X
		customMix 			: null,				// Default to no mixer configuration
		stickMode 			: 2,				// Default to Mode 2
		gapless				:false,
		drawCraft			:"3D", 
		drawPidTable		:true, 
		drawSticks			:true, 
		drawTime			:true,
		drawAnalyser		:true,              // add an analyser option
		analyserSampleRate	:2000/*Hz*/,  		// the loop time for the log
		eraseBackground		: true           	// Set to false if you want the graph to draw on top of an existing canvas image
	}

    function saveCustomMix() {

		var customMix;

		if($(".custom_mixes").is(":checked")) {
    	
			var motorOrder = new Array(mixerList[currentSettings.mixerConfiguration-1].defaultMotorOrder.length);
			for(var i=0;i<motorOrder.length; i++) {
				var select_e = $('select.motor_'+mixerList[currentSettings.mixerConfiguration-1].defaultMotorOrder[i]+'_');
				motorOrder[i] = select_e.val();
			}
			customMix = {  motorOrder: motorOrder,
							yawOffset: mixerList[currentSettings.mixerConfiguration-1].defaultYawOffset
				  };       
    	} else {
    		customMix = null;
    	}
		return customMix;
    }
    
    function convertUIToSettings() {
    	var settings = $.extend({}, currentSettings, {
    			customMix: saveCustomMix()
    	});
    	return settings;
    }
        
    var availableMotors =[]; // motors that appear in the log file
    function getAvailableMotors(flightLog) {
    	
        var fieldNames = flightLog.getMainFieldNames();
        availableMotors = [];
        
        for (i = 0; i < fieldNames.length; i++) {
            var matches = fieldNames[i].match(/^(motor\[[0-9]+\])/);
            if(matches!=null) availableMotors.push(fieldNames[i]);
        };
    }
    
    function renderFieldOption(i, fieldName, selectedName) {
        var 
            option = $("<option></option>")
                .text(FlightLogFieldPresenter.fieldNameToFriendly(fieldName))
                .attr("value", i);
    
        if (fieldName == selectedName) {
            option.attr("selected", "selected");
        }
        
        return option;
    }

    function buildAvailableMotors(select_e, selectedName) {
    	for(var i=0; i<availableMotors.length; i++) {
    		select_e.append(renderFieldOption(i, availableMotors[i], selectedName));
    	};
    }
    
    function buildMotorList(mixerConfiguration) {
    	var motor_list_e = $('.motorList');
    	$(motor_list_e).empty(); // clear all the motors
    	if(mixerList[mixerConfiguration-1].defaultMotorOrder.length > availableMotors.length) {
    		var motors_e = $('<tr>' +
					'<td colspan="2">' +
						'<p class="error">' +
							'Error, you have selected a craft type that required more motors than are available in the log; ' +
							'There are only a maximum of ' + availableMotors.length + ' motors in the log file; the selection you have chosen requires ' +
							mixerList[mixerConfiguration-1].defaultMotorOrder.length + ' motors.' +
						'</p>' +
					'</td>' +	
				'</tr>');
        	motor_list_e.append(motors_e);
    	} else {
	    	for(var i=0; i<mixerList[mixerConfiguration-1].defaultMotorOrder.length; i++) {
	    		var motors_e = $('<tr>' +
										'<td colspan="2"><label>Motor ' + (i+1) + '</label><select class="motor_' + i + '_"><!-- list generated here --></select></td>' +	
									'</tr>');
	        	var select_e = $('select', motors_e);
	        	if(currentSettings.customMix!=null) {
	        		for(var j=0; j<mixerList[mixerConfiguration-1].defaultMotorOrder.length; j++) {
	        			if(mixerList[mixerConfiguration-1].defaultMotorOrder[j] == i) {
				        	buildAvailableMotors(select_e, 'motor[' + currentSettings.customMix.motorOrder[j] + ']');
				        	break;
	        			}
	        		}
	        	} else {
		        	buildAvailableMotors(select_e, 'motor[' + i + ']');
	        	}
	        	motor_list_e.append(motors_e);
	    	};    	
    	}
    }
    
    // Initialisation Code ...
    
    // Setup the mixer list (pretty much cloned from the configurator...)
    var mixer_list_e = $('select.mixerList');
    for (var i = 0; i < mixerList.length; i++) {
        mixer_list_e.append('<option value="' + (i + 1) + '">' + mixerList[i].name + '</option>');
    }

	function mixerListSelection(val) {

		if(val==null) val=3; // default for invalid values

        currentSettings.mixerConfiguration = val;

		if(val>0 && val <= mixerList.length) {
				$('.mixerPreview img').attr('src', './images/motor_order/' + mixerList[val - 1].image + '.svg');
			}
        
        buildMotorList(val); // rebuild the motor list based upon the current selection
	}

	function stickModeSelection(val) {

		if(val==null) val=2; // default for invalid values

        currentSettings.stickMode = val;

		if(val>0 && val <= 5) {
				$('.modePreview img').attr('src', './images/stick_modes/mode_' + val + '.png');
			}
	}

 	// Buttons and Selectors
    
    $('select.mixerList').change(function () {
		mixerListSelection(parseInt($(this).val()));
    });

    // Handle the mixer custom toggle
    $(".custom_mixes_group").hide();
    $(".custom_mixes").click(function() {
        if($(this).is(":checked")) {
            $(".custom_mixes_group").show(300);
        } else {
            $(".custom_mixes_group").hide(200);
        }
    });

    $(".user-settings-dialog-save").click(function(e) {
    	onSave(convertUIToSettings());
    });

    $('input[type=radio][name=stick-mode]').change(function() {
        stickModeSelection(parseInt($(this).val()));
    });

	// Public variables
    
    this.show = function(flightLog, settings) {

 			currentSettings = $.extend(currentSettings, settings || {});

    		getAvailableMotors(flightLog); // Which motors are in the log file ?
    		
    		if(currentSettings.customMix==null) {
    			// clear the toggle switch
    			$(".custom_mixes").prop('checked', false);
    			$(".custom_mixes_group").hide(200);
    		} else {
    			// set the toggle switch
    			$(".custom_mixes").prop('checked', true);
    			$(".custom_mixes_group").show(300);
    		}

    		mixerListSelection(currentSettings.mixerConfiguration); // select current mixer configuration
    		stickModeSelection(currentSettings.stickMode);

    		// setup the stick mode and dropdowns;
    		$('select.mixerList').val(currentSettings.mixerConfiguration);
    		$('input:radio[name="stick-mode"]').filter('[value="' + currentSettings.stickMode + '"]').attr('checked', true);
    		
            dialog.modal('show');

    };

}

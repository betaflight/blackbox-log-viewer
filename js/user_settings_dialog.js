'use strict';

function UserSettingsDialog(dialog, onLoad, onSave) {

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

	var defaultSettings = {
		mixerConfiguration : 3, 				// Default to Quad-X
		customMix 			: null,				// Default to no mixer configuration
		stickMode 			: 2,				// Default to Mode 2
		stickUnits			: false,			// Show units on stick display?
		stickTrails			: false,			// Show stick trails?
		stickInvertYaw		: false,			// Invert yaw in stick display?
        legendUnits			: true,	            // Show units on legend?
		gapless				: false,
        drawCraft           : "3D", 
        hasCraft            : true,
		drawPidTable		: true, 
        drawSticks          : true, 
		drawTime			: true,
		drawEvents			: true,
		drawAnalyser		: true,             // add an analyser option
		drawWatermark		: false,			// Show Watermark on display?
		drawLapTimer		: false,			// Show Laptimer on display?
		graphSmoothOverride : false, 			// Ability to toggle smoothing off=normal/ on=force 0%
        graphExpoOverride   : false, 			// Ability to toggle Expo off=normal/ on=force 100%
        graphGridOverride   : false, 			// Ability to toggle Expo off=normal/ on=force 100%
		analyserSampleRate	: 2000/*Hz*/,  		// the loop time for the log
		analyserHanning	    : false,  			// use a hanning window on the analyser sample data
		eraseBackground		: true,           	// Set to false if you want the graph to draw on top of an existing canvas image
		craft				: {
									left  : '15%',	// position from left (as a percentage of width)
									top   : '25%',  // position from top (as a percentage of height)
									size  : '40%'   // size (as a percentage of width)
							  },
		sticks				: {
									left  : '75%',	// position from left (as a percentage of width)
									top   : '20%',  // position from top (as a percentage of height)
									size  : '30%'   // size (as a percentage of width)
							  },
		analyser			: {
									left  : '5%',	// position from left (as a percentage of width)
									top   : '60%',  // position from top (as a percentage of height)
									size  : '35%'   // size (as a percentage of width)
							  },
	    watermark			: {
									left  : '3%',	// position from left (as a percentage of width)
									top   : '90%',  // position from top (as a percentage of height)
									size  : '100%',  // size (as a percentage of width)
									transparency : '100%', //transparency of watermark image
									logo		 : null,   // No custom logo
							  },
	    laptimer			: {
									left  : '5%',			// position from left (as a percentage of width)
									top   : '50%',  			// position from top (as a percentage of height)
									transparency : '40%',  // transparency of laptimer
							  },
	};

	var currentSettings = {};
	var currentLogo = null;

    function saveCustomMix() {

		var customMix;

		if($(".custom-mixes").is(":checked")) {
    	
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
    			customMix: saveCustomMix(),
    			sticks:    {top: $('.stick-mode-group input[name="stick-top"]').val() + '%',
    					   left: $('.stick-mode-group input[name="stick-left"]').val() + '%',
    					   size: $('.stick-mode-group input[name="stick-size"]').val() + '%', },
    			craft:     {top: $('.craft-settings input[name="craft-top"]').val() + '%',
    					   left: $('.craft-settings input[name="craft-left"]').val() + '%',
    					   size: $('.craft-settings input[name="craft-size"]').val() + '%', },
    			analyser:  {top: $('.analyser-settings input[name="analyser-top"]').val() + '%',
    					   left: $('.analyser-settings input[name="analyser-left"]').val() + '%',
    					   size: $('.analyser-settings input[name="analyser-size"]').val() + '%', },
    			watermark: {top: $('.watermark-settings input[name="watermark-top"]').val() + '%',
					   	   left: $('.watermark-settings input[name="watermark-left"]').val() + '%',
					   	   size: $('.watermark-settings input[name="watermark-size"]').val() + '%', 
					   	   transparency: $('.watermark-settings input[name="watermark-transparency"]').val() + '%',
					   	   logo: currentLogo, },
				drawWatermark: ($(".watermark").is(":checked")),
    			laptimer: {top: $('.laptimer-settings input[name="laptimer-top"]').val() + '%',
					   	   left: $('.laptimer-settings input[name="laptimer-left"]').val() + '%',
					   	   transparency: $('.laptimer-settings input[name="laptimer-transparency"]').val() + '%', },
				drawLapTimer: ($(".laptimer").is(":checked")),
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
				$('.modePreview img').attr('src', './images/stick_modes/Mode_' + val + '.png');
			}
	}

 	// Buttons and Selectors
    
    $('select.mixerList').change(function () {
		mixerListSelection(parseInt($(this).val()));
    });

    // Handle the mixer custom toggle
    $(".custom-mixes-group").hide();
    $(".custom-mixes").click(function() {
        if($(this).is(":checked")) {
            $(".custom-mixes-group").show(300);
        } else {
            $(".custom-mixes-group").hide(200);
        }
    });

    $(".watermark").click(function() {
        if($(this).is(":checked")) {
            $(".watermark-group").show(300);
        } else {
            $(".watermark-group").hide(200);
        }
    });

    $(".laptimer").click(function() {
        if($(this).is(":checked")) {
            $(".laptimer-group").show(300);
        } else {
            $(".laptimer-group").hide(200);
        }
    });

    $(".user-settings-dialog-save").click(function(e) {
    	onSave(convertUIToSettings());
    });

    $('input[type=radio][name=stick-mode]').change(function() {
        stickModeSelection(parseInt($(this).val()));
    });

    $(".stick-units").click(function() {
    	currentSettings.stickUnits = $(this).is(":checked");
    });

    $(".stick-trails").click(function() {
    	currentSettings.stickTrails = $(this).is(":checked");
    });

	$(".invert-yaw").click(function() {
		currentSettings.stickInvertYaw = $(this).is(":checked");
	});

	$(".analyser-hanning").click(function() {
		currentSettings.analyserHanning = $(this).is(":checked");
	});

    $(".legend-units").click(function() {
        currentSettings.legendUnits = $(this).is(":checked");
    });

    // Load Custom Logo
    function readURL(input) {
        if (input.files && input.files[0]) {
            var reader = new FileReader();
            
            reader.onload = function (e) {
                $('#watermark-logo').attr('src', e.target.result);
                currentLogo = e.target.result;
            }
            
            reader.readAsDataURL(input.files[0]);
        }
    }
    
    $("#watermark-logo-load").change(function(){
        readURL(this);
    });

	// Initialise the userSettings

	onLoad(defaultSettings);

	// Public variables

	this.resetToDefaults = function() {
		currentSettings = $.extend({}, defaultSettings);
		onSave(currentSettings);
	}

    
    this.show = function(flightLog, settings) {

 			currentSettings = $.extend({}, defaultSettings, currentSettings, settings || {});

    		getAvailableMotors(flightLog); // Which motors are in the log file ?
    		
    		if(currentSettings.customMix==null) {
    			// clear the toggle switch
    			$(".custom-mixes").prop('checked', false);
    			$(".custom-mixes-group").hide(200);
    		} else {
    			// set the toggle switch
    			$(".custom-mixes").prop('checked', true);
    			$(".custom-mixes-group").show(300);
    		}

    		if(currentSettings.stickUnits!=null) {
    			// set the toggle switch
    			$(".stick-units").prop('checked', currentSettings.stickUnits);
    		} 

    		if(currentSettings.stickTrails!=null) {
    			// set the toggle switch
    			$(".stick-trails").prop('checked', currentSettings.stickTrails);
    		}

			if(currentSettings.stickInvertYaw!=null) {
				// set the toggle switch
				$(".invert-yaw").prop('checked', currentSettings.stickInvertYaw);
			}

			if(currentSettings.analyserHanning!=null) {
				// set the toggle switch
				$(".analyser-hanning").prop('checked', currentSettings.analyserHanning);
			}

			if(currentSettings.legendUnits!=null) {
				// set the toggle switch
				$(".legend-units").prop('checked', currentSettings.legendUnits);
			}


        mixerListSelection(currentSettings.mixerConfiguration); // select current mixer configuration
    		stickModeSelection(currentSettings.stickMode);

    		// setup the stick mode and dropdowns;
    		$('select.mixerList').val(currentSettings.mixerConfiguration);
    		$('input:radio[name="stick-mode"]').filter('[value="' + currentSettings.stickMode + '"]').attr('checked', true);

    		$('.stick-mode-group input[name="stick-top"]').val(parseInt(currentSettings.sticks.top));
    		$('.stick-mode-group input[name="stick-left"]').val(parseInt(currentSettings.sticks.left));
    		$('.stick-mode-group input[name="stick-size"]').val(parseInt(currentSettings.sticks.size));
    		$('.craft-settings input[name="craft-top"]').val(parseInt(currentSettings.craft.top));
    		$('.craft-settings input[name="craft-left"]').val(parseInt(currentSettings.craft.left));
    		$('.craft-settings input[name="craft-size"]').val(parseInt(currentSettings.craft.size));
    		$('.analyser-settings input[name="analyser-top"]').val(parseInt(currentSettings.analyser.top));
    		$('.analyser-settings input[name="analyser-left"]').val(parseInt(currentSettings.analyser.left));
    		$('.analyser-settings input[name="analyser-size"]').val(parseInt(currentSettings.analyser.size));

    		if(currentSettings.drawWatermark!=null) {
    			// set the toggle switch
    			$(".watermark").prop('checked', currentSettings.drawWatermark);
    			(currentSettings.drawWatermark)?$(".watermark-group").show(200):$(".watermark-group").hide(200);
    		}
 
    		$('.watermark-settings input[name="watermark-top"]').val(parseInt(currentSettings.watermark.top));
    		$('.watermark-settings input[name="watermark-left"]').val(parseInt(currentSettings.watermark.left));
    		$('.watermark-settings input[name="watermark-size"]').val(parseInt(currentSettings.watermark.size));
    		$('.watermark-settings input[name="watermark-transparency"]').val(parseInt(currentSettings.watermark.transparency));
			
			if(currentSettings.watermark.logo!=null) {
				currentLogo = currentSettings.watermark.logo;
				$('#watermark-logo').attr('src', currentLogo);
			} else {
				currentLogo = $('#watermark-logo').attr('src');
			}

    		if(currentSettings.drawLapTimer!=null) {
    			// set the toggle switch
    			$(".laptimer").prop('checked', currentSettings.drawLapTimer);
    			(currentSettings.drawLapTimer)?$(".laptimer-group").show(200):$(".laptimer-group").hide(200);
    		}
 
    		$('.laptimer-settings input[name="laptimer-top"]').val(parseInt(currentSettings.laptimer.top));
    		$('.laptimer-settings input[name="laptimer-left"]').val(parseInt(currentSettings.laptimer.left));
    		$('.laptimer-settings input[name="laptimer-transparency"]').val(parseInt(currentSettings.laptimer.transparency));

            dialog.modal('show');

    };

}

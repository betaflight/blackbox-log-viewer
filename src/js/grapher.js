"use strict";

function FlightLogGrapher(flightLog, canvas) {
	var
		PID_P = 0,
		PID_I = 0,
		PID_D = 0,
		
		WHITE = "white",
		
		lineColors = [
            "#fb8072",
			"#8dd3c7",
			"#ffffb3",
			"#bebada",
			"#80b1d3",
			"#fdb462",
			"#b3de69",
			"#fccde5",
			"#d9d9d9",
			"#bc80bd",
			"#ccebc5",
			"#ffed6f"
		];
	
	var
		windowWidthMicros = 1000000,
		windowStartTime, windowCenterTime, windowEndTime,
		
		canvasContext = canvas.getContext("2d"),
		
		options = {
			gapless:false,
			plotPIDs:true, plotGyros:true, plotMotors:true,
			drawCraft:true, drawPidTable:true, drawSticks:true,  drawTime:true
		},
		
		idents;
	
	function identifyFields() {
		var 
			motorGraphColorIndex = 0,
			fieldIndex,
			fieldNames = flightLog.getMainFieldNames();
		
		idents = {
			rcCommandFields:[],
			motorFields:[],
			motorColors:[],

			axisPIDFields: [[], [], []],  //First dimension is [P, I, D], second dimension is axis
			PIDAxisColors: [[], [], []], //PID, axis
			PIDLineStyle: [], //Indexed by PID_P etc

			gyroFields:[],
			gyroColors:[],

			accFields:[],
			accColors:[],

			servoFields:[],
			servoColors:[],

			vbatField:-1,
			numCells:-1,
			baroField:-1,

			miscFields:[],
			miscColors:[],

			//Synthetic fields:
			roll:-1,
			pitch:-1,
			heading:-1,
			axisPIDSum:[]
		};
		
		for (fieldIndex = 0; fieldIndex < fieldNames.length; fieldIndex++) {
		    var 
		    	fieldName = fieldNames[fieldIndex],
		    	matches;

			if ((matches = fieldName.match(/^motor\[(\d+)]$/))) {
				var motorIndex = matches[1];

				idents.motorFields[motorIndex] = fieldIndex;
				idents.motorColors[motorIndex] = lineColors[(motorGraphColorIndex++) % lineColors.length];
			} else if ((matches = fieldName.match(/^rcCommand\[(\d+)]$/))) {
				var rcCommandIndex = matches[1];

				if (rcCommandIndex >= 0 && rcCommandIndex < 4) {
					idents.rcCommandFields[rcCommandIndex] = fieldIndex;
				}
			} else if ((matches = fieldName.match(/^axisPID\[(\d+)]$/))) {
				var axisIndex = matches[1];

				idents.axisPIDSum[axisIndex] = fieldIndex;
			} else if ((matches = fieldName.match(/^axis(.)\[(\d+)]$/))) {
				var axisIndex = matches[2];
				
				idents.axisPIDFields[matches[1]] = axisIndex;
				idents.hasPIDs = true;

				if (options.plotPids) {
					idents.PIDAxisColors[PID_P][axisIndex] = lineColors[0];
					idents.PIDAxisColors[PID_I][axisIndex] = lineColors[1];
					idents.PIDAxisColors[PID_D][axisIndex] = lineColors[2];
				} else {
					idents.PIDAxisColors[PID_P][axisIndex] = WHITE;
					idents.PIDAxisColors[PID_I][axisIndex] = WHITE;
					idents.PIDAxisColors[PID_D][axisIndex] = WHITE;
				}

				idents.PIDLineStyle[axisIndex] = 0; //TODO
			} else if ((matches = fieldName.match(/^gyroData\[(\d+)]$/))) {
				var axisIndex = matches[1];

				idents.gyroFields[axisIndex] = fieldIndex;

				if (options.plotGyros) {
					if (options.bottomGraphSplitAxes)
						idents.gyroColors[axisIndex] = lineColors[(PID_D + 2) % lineColors.length];
					else
						idents.gyroColors[axisIndex] = lineColors[axisIndex % lineColors.length];
				} else
					idents.gyroColors[axisIndex] = WHITE;
			} else if ((matches = fieldName.match(/^accSmooth\[(\d+)]$/))) {
				var axisIndex = matches[1];

				idents.accFields[axisIndex] = fieldIndex;
				idents.accColors[axisIndex] = lineColors[axisIndex % lineColors.length];
			} else if ((matches = fieldName.match(/^servo\[(\d+)]$/))) {
				var servoIndex = matches[1];

				idents.numServos++;
				idents.servoFields[servoIndex] = fieldIndex;
				idents.servoColors[servoIndex] = lineColors[(motorGraphColorIndex++) % lineColors.length];
			} else {
				switch (fieldName) {
					case "vbatLatest":
						idents.vbatField = fieldIndex;
						idents.numCells = flightLog.estimateNumCells();
					break;
					case "BaroAlt":
						idents.baroField = fieldIndex;
					break;
					case "roll":
						idents.roll = fieldIndex;
					break;
					case "pitch":
						idents.pitch = fieldIndex;
					break;
					case "heading":
						idents.heading = fieldIndex;
					break;
					default:
						idents.miscFields.push(fieldIndex);
						idents.miscColors.push(lineColors[idents.miscColors.length % lineColors.length]);
				}
			}
		}
	}
	
	function drawCommandSticks() {
		
	}
	
	/**
	 * Plot the given field within the specified time period. When the output from the curve applied to a field
	 * value reaches 1.0 it'll be drawn plotHeight pixels away from the origin.
	 */
	function plotField(chunks, startFrameIndex, fieldIndex, curve, plotHeight, color) {
		var
			GAP_WARNING_BOX_RADIUS = 4,
			chunkIndex, frameIndex,
			drawingLine = false,
			lastX, lastY,
			yScale = -plotHeight,
			xScale = canvas.width / windowWidthMicros;

		//Draw points from this line until we leave the window
		
		//We may start partway through the first chunk:
		frameIndex = startFrameIndex;
		
		canvasContext.beginPath();
		
		plottingLoop:
		for (chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
			for (; frameIndex < chunks[chunkIndex].length; frameIndex++) {
				var
					fieldValue = chunks[chunkIndex][frameIndex][fieldIndex],
					frameTime = chunks[chunkIndex][frameIndex][FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME],
					nextX, nextY;
	
				nextY = curve.lookup(fieldValue) * yScale;
				nextX = (frameTime - windowStartTime) * xScale;
	
				if (drawingLine) {
					/*if (!options.gapless && datapointsGetGapStartsAtIndex(points, frameIndex - 1)) {
						//Draw a warning box at the beginning and end of the gap to mark it
						cairo_rectangle(cr, lastX - GAP_WARNING_BOX_RADIUS, lastY - GAP_WARNING_BOX_RADIUS, GAP_WARNING_BOX_RADIUS * 2, GAP_WARNING_BOX_RADIUS * 2);
						cairo_rectangle(cr, nextX - GAP_WARNING_BOX_RADIUS, nextY - GAP_WARNING_BOX_RADIUS, GAP_WARNING_BOX_RADIUS * 2, GAP_WARNING_BOX_RADIUS * 2);
	
						cairo_move_to(cr, nextX, nextY);
					} else {*/
						canvasContext.lineTo(nextX, nextY);
					//}
				} else {
					canvasContext.moveTo(nextX, nextY);
				}
	
				drawingLine = true;
				lastX = nextX;
				lastY = nextY;
	
				if (frameTime >= windowEndTime)
					break plottingLoop;
			}
			
			frameIndex = 0;
		}

		canvasContext.strokeStyle = color;
		canvasContext.stroke();
	}
	/*
	pitchStickCurve = expoCurveCreate(0, 0.700, 500 * (flightLog->rcRate ? flightLog->rcRate : 100) / 100, 1.0, 10);

	gyroCurve = expoCurveCreate(0, 0.2, 9.0e-6 / flightLog->gyroScale, 1.0, 10);
	accCurve = expoCurveCreate(0, 0.7, 5000, 1.0, 10);
	pidCurve = expoCurveCreate(0, 0.7, 500, 1.0, 10);*/

	var
		sysConfig = flightLog.getSysConfig();
	
	var 
		motorCurve = new ExpoCurve(-(sysConfig.maxthrottle + sysConfig.minthrottle) / 2, 1.0,
				(sysConfig.maxthrottle - sysConfig.minthrottle) / 2, 1.0, 0);
	
	this.render = function(windowCenterTimeMicros) {
		windowCenterTime = windowCenterTimeMicros;
		windowStartTime = windowCenterTime - windowWidthMicros / 2;
		windowEndTime = windowStartTime + windowWidthMicros;
		
		canvasContext.clearRect(0, 0, canvas.width, canvas.height);
		
		var 
			chunks = flightLog.getChunksInRange(windowStartTime, windowEndTime),
			startChunkIndex, startFrameIndex;
		
		if (chunks.length) {
			//Find the first sample that lies inside the window
			for (var startFrameIndex = 0; startFrameIndex < chunks[0].length; startFrameIndex++) {
				if (chunks[0][startFrameIndex][FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME] >= windowStartTime) {
					break;
				}
			}
			
			// Pick the sample before that to begin plotting from
			if (startFrameIndex > 0)
				startFrameIndex--;
	
			canvasContext.save();
			
			canvasContext.translate(0, canvas.height / 2);
			
			for (var i = 0; i < idents.motorFields.length; i++) {
				plotField(chunks, startFrameIndex, idents.motorFields[i], motorCurve, canvas.height / 4, idents.motorColors[i]);
			}
			
			canvasContext.restore();
		}
		
		/*var chunks = flightLog.getChunksInRange(flightLog.getMinTime() - 500, flightLog.getMinTime() + 1000000);
    	
    	for (var i = 0; i < chunks.length; i++) {
    		var chunk = chunks[i];
    		
    		for (var j = 0; j < chunk.length; j++) {
    			console.log(chunk[j].join(",") + "\n");
    		}
    	}*/
	};
	
	identifyFields();
}
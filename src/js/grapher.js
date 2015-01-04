"use strict";

function FlightLogGrapher(flightLog, canvas) {
	var
		PID_P = 0,
		PID_I = 1,
		PID_D = 2,
		
		WHITE = "white",
		
		DEFAULT_FONT_FACE = "Verdana, Arial, sans-serif",
		
		FONTSIZE_CURRENT_VALUE_LABEL = 10,
		FONTSIZE_PID_TABLE_LABEL = 34,
		FONTSIZE_AXIS_LABEL = 9,
		FONTSIZE_FRAME_LABEL = 9,
		
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
		],
		
		craftColor = "rgba(76,76,76,1)",
		
		windowWidthMicros = 1000000;
	
	var
		windowStartTime, windowCenterTime, windowEndTime,
		
		canvasContext = canvas.getContext("2d"),
		
		options = {
			gapless:false,
			plotPIDs:true, plotGyros:true, plotMotors:true,
			drawCraft:true, drawPidTable:true, drawSticks:true, drawTime:true
		},
		
		idents,
		
		sysConfig = flightLog.getSysConfig(),

		motorCurve = new ExpoCurve(-(sysConfig.maxthrottle + sysConfig.minthrottle) / 2, 1.0,
			(sysConfig.maxthrottle - sysConfig.minthrottle) / 2, 1.0, 0),
		pitchStickCurve = new ExpoCurve(0, 0.700, 500 * (sysConfig.rcRate ? sysConfig.rcRate : 100) / 100, 1.0, 10),
		gyroCurve = new ExpoCurve(0, 0.25, 9.0e-6 / sysConfig.gyroScale, 1.0, 10),
		accCurve = new ExpoCurve(0, 0.7, 5000, 1.0, 10),
		pidCurve = new ExpoCurve(0, 0.7, 500, 1.0, 10);
	
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
	
	function drawCommandSticks(frame) {
		var
			stickSurroundRadius = canvas.height / 11, 
			stickSpacing = stickSurroundRadius * 3,
			yawStickMax = 500,
			
			stickColor = "rgba(255,102,102,1.0)",
			stickAreaColor = "rgba(76,76,76,0.8)",
			crosshairColor = "rgba(191,191,191,0.5)";
		
		var
			stickIndex,
			rcCommand = [],
			stickPositions = [],
			stickLabel, extent ;

		for (stickIndex = 0; stickIndex < 4; stickIndex++) {
			//Check that stick data is present to be drawn:
			if (idents.rcCommandFields[stickIndex] === undefined)
				return;

			rcCommand[stickIndex] = frame[idents.rcCommandFields[stickIndex]];
		}

		//Compute the position of the sticks in the range [-1..1] (left stick x, left stick y, right stick x, right stick y)
		stickPositions[0] = -rcCommand[2] / yawStickMax; //Yaw
		stickPositions[1] = (1500 - rcCommand[3]) / 500; //Throttle
		stickPositions[2] = pitchStickCurve.lookup(rcCommand[0]); //Roll
		stickPositions[3] = pitchStickCurve.lookup(-rcCommand[1]); //Pitch

		for (stickIndex = 0; stickIndex < 4; stickIndex++) {
			//Clamp to [-1..1]
			stickPositions[stickIndex] = stickPositions[stickIndex] > 1 ? 1 : (stickPositions[stickIndex] < -1 ? -1 : stickPositions[stickIndex]);

			//Scale to our stick size
			stickPositions[stickIndex] *= stickSurroundRadius;
		}

		canvasContext.save();

		// Move origin to center of left stick
		canvasContext.translate(-stickSpacing / 2, 0);

		//For each stick
		for (var i = 0; i < 2; i++) {
			//Fill in background
			canvasContext.beginPath();
			canvasContext.fillStyle = stickAreaColor;
			canvasContext.rect(-stickSurroundRadius, -stickSurroundRadius, stickSurroundRadius * 2, stickSurroundRadius * 2);
			canvasContext.fill();

			//Draw crosshair
			canvasContext.beginPath();
			canvasContext.lineWidth = 1;
			canvasContext.strokeStyle = crosshairColor;
			
			canvasContext.moveTo(-stickSurroundRadius, 0);
			canvasContext.lineTo(stickSurroundRadius, 0);
			
			canvasContext.moveTo(0, -stickSurroundRadius);
			canvasContext.lineTo(0, stickSurroundRadius);
			
			canvasContext.stroke();

			//Draw circle to represent stick position
			canvasContext.beginPath();
			canvasContext.fillStyle = stickColor;
			canvasContext.arc(stickPositions[i * 2 + 0], stickPositions[i * 2 + 1], stickSurroundRadius / 5, 0, 2 * Math.PI);
			canvasContext.fill();

			canvasContext.fillStyle = WHITE;
			canvasContext.font = FONTSIZE_CURRENT_VALUE_LABEL + "pt " + DEFAULT_FONT_FACE;
			
			//Draw horizontal stick label
			stickLabel = frame[idents.rcCommandFields[(1 - i) * 2 + 0]] + "";
			extent = canvasContext.measureText(stickLabel);

			canvasContext.fillText(stickLabel, -extent.width / 2, stickSurroundRadius + FONTSIZE_CURRENT_VALUE_LABEL + 8);

			//Draw vertical stick label
			stickLabel = frame[idents.rcCommandFields[(1 - i) * 2 + 1]] + "";
			extent = canvasContext.measureText(stickLabel);
			
			canvasContext.fillText(stickLabel, -stickSurroundRadius - extent.width - 8, FONTSIZE_CURRENT_VALUE_LABEL / 2);

			//Advance to next stick
			canvasContext.translate(stickSpacing, 0);
		}

		canvasContext.restore();
	}
	
	function drawFrameLabel(frameIndex, timeMsec)
	{
		var 
			extentFrameNumber, extentFrameTime;

		canvasContext.font = FONTSIZE_FRAME_LABEL + "pt " + DEFAULT_FONT_FACE;
		canvasContext.fillStyle = "rgba(255,255,255,0.65)";

		extentFrameNumber = canvasContext.measureText("#0000000");
		canvasContext.fillText("#" + leftPad(frameIndex, "0", 7), canvas.width - extentFrameNumber.width - 8, canvas.height - 8);

		extentFrameTime = canvasContext.measureText("00:00.000");
		canvasContext.fillText(formatTime(timeMsec, true), canvas.width - extentFrameTime.width - 8, canvas.height - 8 - FONTSIZE_FRAME_LABEL - 8);
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
						cairo_rectangle(lastX - GAP_WARNING_BOX_RADIUS, lastY - GAP_WARNING_BOX_RADIUS, GAP_WARNING_BOX_RADIUS * 2, GAP_WARNING_BOX_RADIUS * 2);
						cairo_rectangle(nextX - GAP_WARNING_BOX_RADIUS, nextY - GAP_WARNING_BOX_RADIUS, GAP_WARNING_BOX_RADIUS * 2, GAP_WARNING_BOX_RADIUS * 2);
	
						cairo_moveTo(nextX, nextY);
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
	
	//Draw an origin line for a graph (at the origin and spanning the window)
	function drawAxisLine() {
		canvasContext.strokeStyle = "rgba(255,255,255,0.5)";
		canvasContext.lineWidth = 1;
		
		canvasContext.beginPath();
		canvasContext.moveTo(0, 0);
		canvasContext.lineTo(canvas.width, 0);
		
		canvasContext.stroke();
	}

	function drawAxisLabel(axisLabel) {
		var 
			extent;

		canvasContext.font = FONTSIZE_AXIS_LABEL + "pt " + DEFAULT_FONT_FACE;
		canvasContext.fillStyle = "rgba(255,255,255,0.9)";

		extent = canvasContext.measureText(axisLabel);
		
		canvasContext.fillText(axisLabel, canvas.width - 8 - extent.width, -8);
	}
	
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
	
			// Plot motors
			canvasContext.save();
			{
				canvasContext.translate(0, canvas.height * 0.25);
				
				drawAxisLine();
				
				for (var i = 0; i < idents.motorFields.length; i++) {
					plotField(chunks, startFrameIndex, idents.motorFields[i], motorCurve, canvas.height * 0.20, idents.motorColors[i]);
				}
				
				drawAxisLabel("Motors");
			}
			canvasContext.restore();
			
			// Plot gyros
			canvasContext.save();
			{
				canvasContext.translate(0, canvas.height * 0.70);
				
				drawAxisLine();
				
				for (var i = 0; i < idents.gyroFields.length; i++) {
					plotField(chunks, startFrameIndex, idents.gyroFields[i], gyroCurve, canvas.height * 0.25, idents.gyroColors[i]);
				}
				
				drawAxisLabel("Gyros");
			}
			canvasContext.restore();
			
			// Draw details at the current time
			var
				centerFrame = flightLog.getFrameAtTime(windowCenterTime);
			
			if (centerFrame) {
				if (options.drawSticks) {
					canvasContext.save();
					
					canvasContext.translate(0.75 * canvas.width, 0.20 * canvas.height);
					
					drawCommandSticks(centerFrame);
					
					canvasContext.restore();
				}
				
				if (options.drawTime) {
					drawFrameLabel(centerFrame[FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_ITERATION], Math.round((windowCenterTime - flightLog.getMinTime()) / 1000));
				}
			}
		}
		
		/* //Debugging: 
		var chunks = flightLog.getChunksInRange(flightLog.getMinTime() - 500, flightLog.getMinTime() + 2000000);
    	
    	for (var i = 0; i < chunks.length; i++) {
    		var chunk = chunks[i];
    		
    		for (var j = 0; j < chunk.length; j++) {
    			console.log(chunk[j].join(",") + "\n");
    		}
    	}
    	*/
	};
	
	identifyFields();
}
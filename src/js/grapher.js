"use strict";

function FlightLogGrapher(flightLog, canvas) {
	var
		windowWidthMicros = 1000000,
		windowStartTime, windowCenterTime, windowEndTime,
		
		canvasContext = canvas.getContext("2d"),
		
		options = {
			gapless:false
		};
	
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
			for (var i = FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME + 1; i < flightLog.getMainFieldCount(); i++) {
				if (flightLog.getMainFieldNames()[i].match(/^motor/))
					plotField(chunks, startFrameIndex, i, motorCurve, canvas.height / 4, "#000");
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
}
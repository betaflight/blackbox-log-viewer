function FlightLogGrapher(flightLog, canvas) {
	
	var
		windowWidthMicros = 1000000,
		windowStartTime, windowCenterTime, windowEndTime,
		
		canvasContext = canvas.getContext("2d"),
		
		options = {
			gapless:false
		};
	
	function plotField(chunks, startChunkIndex, startFrameIndex, fieldIndex, plotHeight, color) {
		var
			GAP_WARNING_BOX_RADIUS = 4,
			chunkIndex, frameIndex,
			drawingLine = false,
			lastX, lastY,
			yScale = -plotHeight / 500, //TODO divide by field maximum
			xScale = canvas.width / windowWidthMicros,
			points = 0;

		//Draw points from this line until we leave the window
		
		//We may start partway through the first chunk:
		frameIndex = startFrameIndex;
		
		canvasContext.beginPath();
		
		plottingLoop:
		for (chunkIndex = startChunkIndex; chunkIndex < chunks.length; chunkIndex++) {
			for (; frameIndex < chunks[chunkIndex].length; frameIndex++) {
				var
					fieldValue = chunks[chunkIndex][frameIndex][fieldIndex],
					frameTime = chunks[chunkIndex][frameIndex][FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME],
					nextX, nextY;
	
				nextY = fieldValue  * yScale;
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
				points++;
	
				if (frameTime >= windowEndTime)
					break plottingLoop;
			}
			
			frameIndex = 0;
		}

		canvasContext.strokeStyle = color;
		canvasContext.stroke();
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
			windowStartLoop:
			for (var startChunkIndex = 0; startChunkIndex < chunks.length; startChunkIndex++) {
				for (var startFrameIndex = 0; startFrameIndex < chunks[startChunkIndex].length; startFrameIndex++) {
					if (chunks[startChunkIndex][startFrameIndex][FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME] >= windowStartTime) {
						break windowStartLoop;
					}
				}
			}
			
			// Pick the sample before that to begin plotting from
			startFrameIndex--;
			if (startFrameIndex < 0) {
				if (startChunkIndex == 0) {
					startChunkIndex = 0;
					startFrameIndex = 0;
				} else {
					startChunkIndex--;
					startFrameIndex = chunks[startChunkIndex].length - 1;
				}
			}
	
			canvasContext.save();
			
			canvasContext.translate(0, canvas.height / 2);
			for (var i = FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME + 1; i < flightLog.getMainFieldCount(); i++) {
				plotField(chunks, startChunkIndex, startFrameIndex, i, canvas.height / 2, "#000");
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
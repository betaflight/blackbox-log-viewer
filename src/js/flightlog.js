"use strict";

/**
 * Uses a FlightLogParser to provide on-demand parsing (and caching) a flight data log. An index is computed
 * to allow efficient seeking.
 */
function FlightLog(logData, logIndex) {
	var
		logIndexes = new FlightLogIndex(logData),
		parser = new FlightLogParser(logData),
		
		iframeDirectory = logIndexes.getIntraframeDirectory(logIndex),
		
		chunkCache = new FIFOCache(2);
	
	this.parser = parser;
	
	this.getMainFieldCount = function() {
		return parser.mainFieldCount;
	}
	
	this.getMainFieldNames = function() {
		return parser.mainFieldNames;
	}
	
	this.getMinTime = function() {
		return iframeDirectory.minTime;
	};
	
	this.getMaxTime = function() {
		return iframeDirectory.maxTime;
	};
	
	this.getSysConfig = function() {
		return parser.sysConfig;
	}
	
	this.getFrameAtTime = function(startTime) {
		var
			chunks = this.getChunksInRange(startTime),
			chunk = chunks[0];
		
		if (chunk) {
			for (var i = 0; i < chunk.length; i++) {
				if (chunk[i][FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME] > startTime)
					break;
			}
			
			return chunk[i - 1];
		} else
			return false;
	};
	
	/**
	 * Get an array of chunks which span times from the given start to end time.
	 * Each chunk is an array of log frames.
	 */
	this.getChunksInRange = function(startTime, endTime) {
		var 
			startIndex = binarySearchOrPrevious(iframeDirectory.times, startTime),
			endIndex = binarySearchOrPrevious(iframeDirectory.times, endTime),
			resultChunks = [];
		
		if (startIndex < 0)
			startIndex = 0;
		
		if (endIndex < 0)
			return [];
		
		for (var chunkIndex = startIndex; chunkIndex <= endIndex; chunkIndex++) {
			var 
				chunkStartOffset, chunkEndOffset,
				chunk = chunkCache.get(chunkIndex);
			
			if (!chunk) {
				chunk = [];
				
				chunkStartOffset = iframeDirectory.offsets[chunkIndex];
				
				if (chunkIndex + 1 < iframeDirectory.offsets.length)
					chunkEndOffset = iframeDirectory.offsets[chunkIndex + 1];
				else
					chunkEndOffset = undefined;

				parser.onFrameReady = function(frameValid, frame, frameType, frameOffset, frameSize) {
					if (frameValid) {
						chunk.push(frame.slice(0)); /* Clone the frame data since parser reuses that array */
					}
				};

				console.log("Parse " + chunkStartOffset +" to " + chunkEndOffset);
				parser.parseLogData(false, chunkStartOffset, chunkEndOffset);
				
				chunkCache.add(chunkIndex, chunk);
			}
			
			resultChunks.push(chunk);
		}
		
		//Assume caller asked for about a screen-full. Try to cache about three screens worth.
		if (chunkCache.capacity < resultChunks.length * 3 + 1)
			chunkCache.capacity = resultChunks.length * 3 + 1;
		
		return resultChunks;
	};
		
	parser.onFrameReady = function(frameValid, frame, frameType, frameOffset, frameSize) {
		if (frameValid) {
			var copy = frame.slice(0);
			copy.push(frameType);
			acc.push(copy);
		}
	};
	
	parser.parseHeader(logIndexes.getLogBeginOffset(0));	
}

FlightLog.prototype.vbatToMillivolts = function(vbat) {
    // ADC is 12 bit (i.e. max 0xFFF), voltage reference is 3.3V, vbatscale is premultiplied by 100
    return (vbat * 330 * this.getSysConfig().vbatscale) / 0xFFF;
};

FlightLog.prototype.estimateNumCells = function() {
	var 
		i, refVoltage;

    refVoltage = this.vbatToMillivolts(this.getSysConfig().vbatref) / 100;

    for (i = 1; i < 8; i++) {
        if (refVoltage < i * this.getSysConfig().vbatmaxcellvoltage)
            break;
    }

    return i;
};
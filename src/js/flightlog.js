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
	
	/** TODO remove debug code 
	console.log(logIndexes.saveToJSON());
	console.log("Length " + logIndexes.saveToJSON().length);
	*/
	
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
	
	this.getThrottleActivity = function() {
		return {
			avgThrottle: logIndexes.getIntraframeDirectory(logIndex).avgThrottle,
			times: logIndexes.getIntraframeDirectory(logIndex).times
		};
	},
	
	this.getFrameAtTime = function(startTime) {
		var
			chunks = this.getChunksInRange(startTime, startTime),
			chunk = chunks[0];
		
		if (chunk) {
			for (var i = 0; i < chunk.frames.length; i++) {
				if (chunk.frames[i][FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME] > startTime)
					break;
			}
			
			return chunk.frames[i - 1];
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
				chunkStartOffset = iframeDirectory.offsets[chunkIndex];
				
				if (chunkIndex + 1 < iframeDirectory.offsets.length)
					chunkEndOffset = iframeDirectory.offsets[chunkIndex + 1];
				else // We're at the end so parse till end-of-log
					chunkEndOffset = logIndexes.getLogBeginOffset(logIndex + 1);

				chunk = {
					frames: [],
					gapStartsHere: {}
				};
				
				parser.onFrameReady = function(frameValid, frame, frameType, frameOffset, frameSize) {
					if (frameValid) {
						chunk.frames.push(frame.slice(0)); /* Clone the frame data since parser reuses that array */
					} else {
						chunk.gapStartsHere[chunk.frames.length - 1] = true;
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

FlightLog.prototype.getReferenceVoltageMillivolts = function() {
	return this.vbatToMillivolts(this.getSysConfig().vbatref);
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
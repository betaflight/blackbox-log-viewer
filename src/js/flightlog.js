"use strict";

function FlightLog(logData, logIndex) {
	var
		logIndexes = new FlightLogIndex(logData),
		parser = new FlightLogParser(logData, logIndexes),
		
		iframeDirectory = logIndexes.getIntraframeDirectory(logIndex),
		
		chunkCache = {};
		
	parser.onFrameReady = function(frameValid, frame, frameType, frameOffset, frameSize) {
		if (frameValid) {
			var copy = frame.slice(0);
			copy.push(frameType);
			acc.push(copy);
		}
	};
	
	parser.parseHeader(logIndex);
	
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
				chunkStartOffset, chunkEndOffset;
			
			if (!chunkCache[chunkIndex]) {
				var chunk = [];
				
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
				parser.parseLog(false, chunkStartOffset, chunkEndOffset);
				
				chunkCache[chunkIndex] = chunk;
			}
			
			resultChunks.push(chunkCache[chunkIndex]);
		}
		
		return resultChunks;
	};
}
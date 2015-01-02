"use strict";

function FlightLog(logData, logIndex) {
	var
		index = new FlightLogIndex(logData),
		parser = new FlightLogParser(logData);
	
	console.log(index.saveToJSON());
	
	parser.onFrameReady = function(frameValid, frame, frameType, frameOffset, frameSize) {
		if (frameValid) {
			var copy = frame.slice(0);
			copy.push(frameType);
			acc.push(copy);
		}
	};
	
	parser.parseHeader(0);
	parser.parseLog();

	console.log(parser.stats);	
}
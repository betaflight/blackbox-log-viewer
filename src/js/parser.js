"use strict";

var FlightLogIndex;

var FlightLogParser = function(logData) {
	//Private constants:
	var
		FLIGHT_LOG_MAX_FIELDS = 128,
		FLIGHT_LOG_MAX_FRAME_LENGTH = 256,
		
		FIRMWARE_TYPE_BASEFLIGHT = 0,
		FIRMWARE_TYPE_CLEANFLIGHT = 1,
		
		// Flight log field conditions:
		
	    FLIGHT_LOG_FIELD_CONDITION_ALWAYS = 0,
	    FLIGHT_LOG_FIELD_CONDITION_AT_LEAST_MOTORS_1 = 1,
	    FLIGHT_LOG_FIELD_CONDITION_AT_LEAST_MOTORS_2 = 2,
	    FLIGHT_LOG_FIELD_CONDITION_AT_LEAST_MOTORS_3 = 3,
	    FLIGHT_LOG_FIELD_CONDITION_AT_LEAST_MOTORS_4 = 4,
	    FLIGHT_LOG_FIELD_CONDITION_AT_LEAST_MOTORS_5 = 5,
	    FLIGHT_LOG_FIELD_CONDITION_AT_LEAST_MOTORS_6 = 6,
	    FLIGHT_LOG_FIELD_CONDITION_AT_LEAST_MOTORS_7 = 7,
	    FLIGHT_LOG_FIELD_CONDITION_AT_LEAST_MOTORS_8 = 8,
	    FLIGHT_LOG_FIELD_CONDITION_TRICOPTER,

	    FLIGHT_LOG_FIELD_CONDITION_MAG = 20,
	    FLIGHT_LOG_FIELD_CONDITION_BARO = 21,
	    FLIGHT_LOG_FIELD_CONDITION_VBAT = 22,

	    FLIGHT_LOG_FIELD_CONDITION_NONZERO_PID_P_0 = 40,
	    FLIGHT_LOG_FIELD_CONDITION_NONZERO_PID_P_1 = 41,
	    FLIGHT_LOG_FIELD_CONDITION_NONZERO_PID_P_2 = 42,
	    FLIGHT_LOG_FIELD_CONDITION_NONZERO_PID_I_0 = 43,
	    FLIGHT_LOG_FIELD_CONDITION_NONZERO_PID_I_1 = 44,
	    FLIGHT_LOG_FIELD_CONDITION_NONZERO_PID_I_2 = 45,
	    FLIGHT_LOG_FIELD_CONDITION_NONZERO_PID_D_0 = 46,
	    FLIGHT_LOG_FIELD_CONDITION_NONZERO_PID_D_1 = 47,
	    FLIGHT_LOG_FIELD_CONDITION_NONZERO_PID_D_2 = 48,

	    FLIGHT_LOG_FIELD_CONDITION_NEVER = 255,

	    // Flight log field predictors:
	    
	    //No prediction:
	    FLIGHT_LOG_FIELD_PREDICTOR_0              = 0,

	    //Predict that the field is the same as last frame:
	    FLIGHT_LOG_FIELD_PREDICTOR_PREVIOUS       = 1,

	    //Predict that the slope between this field and the previous item is the same as that between the past two history items:
	    FLIGHT_LOG_FIELD_PREDICTOR_STRAIGHT_LINE  = 2,

	    //Predict that this field is the same as the average of the last two history items:
	    FLIGHT_LOG_FIELD_PREDICTOR_AVERAGE_2      = 3,

	    //Predict that this field is minthrottle
	    FLIGHT_LOG_FIELD_PREDICTOR_MINTHROTTLE    = 4,

	    //Predict that this field is the same as motor 0
	    FLIGHT_LOG_FIELD_PREDICTOR_MOTOR_0        = 5,

	    //This field always increments
	    FLIGHT_LOG_FIELD_PREDICTOR_INC            = 6,

	    //Predict this GPS co-ordinate is the GPS home co-ordinate (or no prediction if that coordinate is not set)
	    FLIGHT_LOG_FIELD_PREDICTOR_HOME_COORD     = 7,

	    //Predict 1500
	    FLIGHT_LOG_FIELD_PREDICTOR_1500           = 8,

	    //Predict vbatref, the reference ADC level stored in the header
	    FLIGHT_LOG_FIELD_PREDICTOR_VBATREF        = 9,

	    FLIGHT_LOG_FIELD_ENCODING_SIGNED_VB       = 0, // Signed variable-byte
	    FLIGHT_LOG_FIELD_ENCODING_UNSIGNED_VB     = 1, // Unsigned variable-byte
	    FLIGHT_LOG_FIELD_ENCODING_NEG_14BIT       = 3, // Unsigned variable-byte but we negate the value before storing, value is 14 bits
	    FLIGHT_LOG_FIELD_ENCODING_TAG8_8SVB       = 6,
	    FLIGHT_LOG_FIELD_ENCODING_TAG2_3S32       = 7,
	    FLIGHT_LOG_FIELD_ENCODING_TAG8_4S16       = 8,
	    FLIGHT_LOG_FIELD_ENCODING_NULL            = 9, // Nothing is written to the file, take value to be zero
		
		EOF = ArrayDataStream.prototype.EOF,
		NEWLINE  = '\n'.charCodeAt(0);
	
	//Private variables:
	var
		that = this,
				
		//Information about fields which we need to decode them properly
		frameDefs = {},
		dataVersion, motor0Index,
		
		defaultSysConfig = {
			frameIntervalI: 32,
			frameIntervalPNum: 1,
			frameIntervalPDenom: 1,
			firmwareType: 0,
			rcRate: 90,
			vbatscale: 110,
			vbatref: 4095,
			vbatmincellvoltage: 33,
			vbatmaxcellvoltage:43,
			vbatwarningcellvoltage: 35,
			gyroScale: 0.0001, // Not even close to the default, but it's hardware specific so we can't do much better
			acc_1G: 4096, // Ditto ^
			minthrottle: 1150,
			maxthrottle: 1850
		},
			
		frameTypes,
		
		//Current decoder state:
		mainStreamIsValid = false,
		
		lastEvent,
		mainHistoryRing,
		mainHistory,
		
		//The actual log data stream we're reading:
		stream;
	
	//Public fields:
	this.mainFieldNames = [];
	this.mainFieldCount = 0;
	
	this.sysConfig = Object.create(defaultSysConfig);
	
	/* 
	 * Event handler of the signature (frameValid, frame, frameType, frameOffset, frameSize)
	 * called when a frame has been decoded.
	 */
	this.onFrameReady = null;
	
	//Private methods:
	function parseHeaderLine() {
		var 
			COLON = ":".charCodeAt(0),
		
			fieldName, fieldValue,
			lineStart, lineEnd, separatorPos = false,
			matches,
			i, c;
			
		if (stream.peekChar() != ' ')
			return;

		//Skip the leading space
		stream.readChar();

		lineStart = stream.pos;
		
		for (; stream.pos < lineStart + 1024 && stream.pos < stream.end; stream.pos++) {
			if (separatorPos === false && stream.data[stream.pos] == COLON)
				separatorPos = stream.pos;
			
			if (stream.data[stream.pos] == NEWLINE || stream.data[stream.pos] == 0)
				break;
		}

		if (stream.data[stream.pos] != NEWLINE || separatorPos === false)
			return;

		lineEnd = stream.pos;

		fieldName = asciiArrayToString(stream.data.subarray(lineStart, separatorPos));
		fieldValue = asciiArrayToString(stream.data.subarray(separatorPos + 1, lineEnd));

		switch (fieldName) {
			case "Field I name":
				that.mainFieldNames = fieldValue.split(",");
				that.mainFieldCount = that.mainFieldNames.length; 
	
				for (i = 0; i < that.mainFieldNames.length; i++) {
					if (that.mainFieldNames[i] == "motor[0]") {
						motor0Index = i;
						break;
					}
				}
			break;
			case "Field I signed":
				that.mainFieldSigned = parseCommaSeparatedIntegers(fieldValue);
			break;
			case "I interval":
				that.sysConfig.frameIntervalI = parseInt(fieldValue, 10);
				if (that.sysConfig.frameIntervalI < 1)
					that.sysConfig.frameIntervalI = 1;
			break;
			case "P interval":
				var matches = fieldValue.match(/(\d+)\/(\d+)/);
				
				if (matches) {
					that.sysConfig.frameIntervalPNum = parseInt(matches[1], 10);
					that.sysConfig.frameIntervalPDenom = parseInt(matches[2], 10);
				}
			break;
			case "Data version":
				dataVersion = parseInt(fieldValue, 10);
			break;
			case "Firmware type":
				switch (fieldValue) {
					case "Cleanflight":
						that.sysConfig.firmwareType = FIRMWARE_TYPE_CLEANFLIGHT;
					break;
					default:
						that.sysConfig.firmwareType = FIRMWARE_TYPE_BASEFLIGHT;
				}
			break;
			case "minthrottle":
				that.sysConfig.minthrottle = parseInt(fieldValue, 10);
			break;
			case "maxthrottle":
				that.sysConfig.maxthrottle = parseInt(fieldValue, 10);
			break;
			case "rcRate":
				that.sysConfig.rcRate = parseInt(fieldValue, 10);
			break;
			case "vbatscale":
				that.sysConfig.vbatscale = parseInt(fieldValue, 10);
			break;
			case "vbatref":
				that.sysConfig.vbatref = parseInt(fieldValue, 10);
			break;
			case "vbatcellvoltage":
				var vbatcellvoltage = fieldValue.split(",");
	
		        that.sysConfig.vbatmincellvoltage = vbatcellvoltage[0];
		        that.sysConfig.vbatwarningcellvoltage = vbatcellvoltage[1];
		        that.sysConfig.vbatmaxcellvoltage = vbatcellvoltage[2];
	        break;
	        case "gyro.scale":
				that.sysConfig.gyroScale = hexToFloat(fieldValue);
		
				/* Baseflight uses a gyroScale that'll give radians per microsecond as output, whereas Cleanflight produces degrees
				 * per second and leaves the conversion to radians per us to the IMU. Let's just convert Cleanflight's scale to
				 * match Baseflight so we can use Baseflight's IMU for both: */
				if (that.firmwareType == FIRMWARE_TYPE_CLEANFLIGHT) {
					that.sysConfig.gyroScale = that.sysConfig.gyroScale * (PI / 180.0) * 0.000001;
				}
			break;
	        case "acc_1G":
				that.sysConfig.acc_1G = parseInt(fieldValue);
			break;
			default:
				if ((matches = fieldName.match(/^Field (.) predictor$/))) {
					if (!frameDefs[matches[1]])
						frameDefs[matches[1]] = {};
					
					frameDefs[matches[1]].predictor = parseCommaSeparatedIntegers(fieldValue);
				} else if ((matches = fieldName.match(/^Field (.) encoding$/))) {
					if (!frameDefs[matches[1]])
						frameDefs[matches[1]] = {};
					
					frameDefs[matches[1]].encoding = parseCommaSeparatedIntegers(fieldValue);
				}
			break;
		}
	}

	function invalidateStream() {
	    mainStreamIsValid = false;
	    mainHistory[1] = null;
	    mainHistory[2] = null;
	}
	
	function updateFieldStatistics(fields) {
		var i;

		for (i = 0; i < that.mainFieldCount; i++) {
			if (!that.stats.field[i]) {
				that.stats.field[i] = {
					max: fields[i],
					min: fields[i]
				};
			} else {
				that.stats.field[i].max = fields[i] > that.stats.field[i].max ? fields[i] : that.stats.field[i].max;
				that.stats.field[i].min = fields[i] < that.stats.field[i].min ? fields[i] : that.stats.field[i].min;
			}
		}
	}

	function completeIntraframe(frameType, frameStart, frameEnd, raw) {
        mainStreamIsValid = true;

        updateFieldStatistics(mainHistory[0]);

	    if (that.onFrameReady)
	        that.onFrameReady(mainStreamIsValid, mainHistory[0], frameType, frameStart, frameEnd - frameStart);

        // Rotate history buffers

        // Both the previous and previous-previous states become the I-frame, because we can't look further into the past than the I-frame
        mainHistory[1] = mainHistory[0];
        mainHistory[2] = mainHistory[0];

        // And advance the current frame into an empty space ready to be filled
        if (mainHistory[0] == mainHistoryRing[0])
        	mainHistory[0] = mainHistoryRing[1];
        else if (mainHistory[0] == mainHistoryRing[1])
        	mainHistory[0] = mainHistoryRing[2];
        else
        	mainHistory[0] = mainHistoryRing[0];
	}
	
	/**
	 * Should a frame with the given index exist in this log (based on the user's selection of sampling rates)?
	 */
	function shouldHaveFrame(frameIndex)
	{
	    return (frameIndex % that.sysConfig.frameIntervalI + that.sysConfig.frameIntervalPNum - 1) 
	    	% that.sysConfig.frameIntervalPDenom < that.sysConfig.frameIntervalPNum;
	}	
	
	function parseIntraframe(raw) {
		var 
			current, previous,
			i;

		current = mainHistory[0];
		previous = mainHistory[1];

		if (previous) {
	        for (var frameIndex = previous[that.FLIGHT_LOG_FIELD_INDEX_ITERATION] + 1; !shouldHaveFrame(frameIndex); frameIndex++) {
	            that.stats.intentionallyAbsentIterations++;
	        }
	    }

		for (i = 0; i < that.mainFieldCount; i++) {
			var value;

			switch (frameDefs["I"].encoding[i]) {
				case FLIGHT_LOG_FIELD_ENCODING_SIGNED_VB:
					value = stream.readSignedVB();
				break;
				case FLIGHT_LOG_FIELD_ENCODING_UNSIGNED_VB:
					value = stream.readUnsignedVB();
				break;
				case FLIGHT_LOG_FIELD_ENCODING_NEG_14BIT:
				    value = -signExtend14Bit(stream.readUnsignedVB());
				break;
				default:
					throw "Unsupported I-field encoding " + frameDefs["I"].encoding[i];
			}

			if (!raw) {
				//Not many predictors can be used in I-frames since they can't depend on any other frame
				switch (frameDefs["I"].predictor[i]) {
					case FLIGHT_LOG_FIELD_PREDICTOR_0:
						//No-op
					break;
					case FLIGHT_LOG_FIELD_PREDICTOR_MINTHROTTLE:
						value += that.sysConfig.minthrottle;
					break;
					case FLIGHT_LOG_FIELD_PREDICTOR_1500:
						value += 1500;
					break;
					case FLIGHT_LOG_FIELD_PREDICTOR_MOTOR_0:
						if (motor0Index < 0) {
							throw "Attempted to base I-field prediction on motor0 before it was read";
						}
						value += current[motor0Index];
					break;
					case FLIGHT_LOG_FIELD_PREDICTOR_VBATREF:
					    value += that.sysConfig.vbatref;
					break;
					default:
						throw "Unsupported I-field predictor " + frameDefs["I"].predictor[i];
				}
			}

			current[i] = value;
		}
	}
	
	function completeInterframe(frameType, frameStart, frameEnd, raw) {
	    if (mainStreamIsValid)
	        updateFieldStatistics(mainHistory[0]);
	    else
	        that.stats.frame["P"].desyncCount++;

	    //Receiving a P frame can't resynchronise the stream so it doesn't set mainStreamIsValid to true

	    if (that.onFrameReady)
	        that.onFrameReady(mainStreamIsValid, mainHistory[0], frameType, frameStart, frameEnd - frameStart);

	    if (mainStreamIsValid) {
	        // Rotate history buffers

	        mainHistory[2] = mainHistory[1];
	        mainHistory[1] = mainHistory[0];

	        // And advance the current frame into an empty space ready to be filled
	        if (mainHistory[0] == mainHistoryRing[0])
	        	mainHistory[0] = mainHistoryRing[1];
	        else if (mainHistory[0] == mainHistoryRing[1])
	        	mainHistory[0] = mainHistoryRing[2];
	        else
	        	mainHistory[0] = mainHistoryRing[0];
	    }
	}
	
	function applyInterPrediction(fieldIndex, predictor, value) {
	    var 
	    	previous = mainHistory[1],
	    	previous2 = mainHistory[2];

	    /*
	     * If we don't have a previous state to refer to (e.g. because previous frame was corrupt) don't apply
	     * a prediction. Instead just show the raw values.
	     */
	    if (!previous)
	        predictor = FLIGHT_LOG_FIELD_PREDICTOR_0;

		switch (predictor) {
			case FLIGHT_LOG_FIELD_PREDICTOR_0:
				// No correction to apply
			break;
			case FLIGHT_LOG_FIELD_PREDICTOR_PREVIOUS:
				value += previous[fieldIndex];
			break;
			case FLIGHT_LOG_FIELD_PREDICTOR_STRAIGHT_LINE:
				value += 2 * previous[fieldIndex] - previous2[fieldIndex];
			break;
			case FLIGHT_LOG_FIELD_PREDICTOR_AVERAGE_2:
				//Round toward zero like C would do for integer division:
				value += ~~((previous[fieldIndex] + previous2[fieldIndex]) / 2);
			break;
			default:
				throw "Unsupported P-field predictor %d\n" + predictor;
		}

		return value;
	}

	function parseInterframe(raw) {
		var 
			i, j, groupCount,

			current = mainHistory[0],
			previous = mainHistory[1],
			
			frameIndex, skippedFrames = 0;

		if (previous) {
	        //Work out how many frames we skipped to get to this one, based on the log sampling rate
	        for (frameIndex = previous[that.FLIGHT_LOG_FIELD_INDEX_ITERATION] + 1; !shouldHaveFrame(frameIndex); frameIndex++)
	            skippedFrames++;
	    }

		that.stats.intentionallyAbsentIterations += skippedFrames;

		i = 0;
		while (i < that.mainFieldCount) {
			var 
				value, 
				values = new Array(8);

			if (frameDefs["P"].predictor[i] == FLIGHT_LOG_FIELD_PREDICTOR_INC) {
			    current[i] = skippedFrames + 1;

			    if (previous)
			        current[i] += previous[i];

		        i++;
			} else {
				switch (frameDefs["P"].encoding[i]) {
					case FLIGHT_LOG_FIELD_ENCODING_SIGNED_VB:
						value = stream.readSignedVB();
					break;
					case FLIGHT_LOG_FIELD_ENCODING_UNSIGNED_VB:
						value = stream.readUnsignedVB();
					break;
					case FLIGHT_LOG_FIELD_ENCODING_TAG8_4S16:
						if (dataVersion < 2)
							stream.readTag8_4S16_v1(values);
						else
							stream.readTag8_4S16_v2(values);

						//Apply the predictors for the fields:
						for (j = 0; j < 4; j++, i++)
						    current[i] = applyInterPrediction(i, raw ? FLIGHT_LOG_FIELD_PREDICTOR_0 : frameDefs["P"].predictor[i], values[j]);

						continue;
					break;
					case FLIGHT_LOG_FIELD_ENCODING_TAG2_3S32:
						stream.readTag2_3S32(values);

						//Apply the predictors for the fields:
						for (j = 0; j < 3; j++, i++)
						    current[i] = applyInterPrediction(i, raw ? FLIGHT_LOG_FIELD_PREDICTOR_0 : frameDefs["P"].predictor[i], values[j]);

						continue;
					break;
					case FLIGHT_LOG_FIELD_ENCODING_TAG8_8SVB:
					    //How many fields are in this encoded group? Check the subsequent field encodings:
					    for (j = i + 1; j < i + 8 && j < that.mainFieldCount; j++)
					        if (frameDefs["P"].encoding[j] != FLIGHT_LOG_FIELD_ENCODING_TAG8_8SVB)
					            break;

					    groupCount = j - i;

					    stream.readTag8_8SVB(values, groupCount);

					    for (j = 0; j < groupCount; j++, i++)
	                        current[i] = applyInterPrediction(i, raw ? FLIGHT_LOG_FIELD_PREDICTOR_0 : frameDefs["P"].predictor[i], values[j]);

	                    continue;
					break;
					case FLIGHT_LOG_FIELD_ENCODING_NULL:
					    //Nothing to read
					    value = 0;
					break;
					default:
						throw "Unsupported P-field encoding %d\n" + frameDefs["P"].encoding[i];
				}

				current[i] = applyInterPrediction(i, raw ? FLIGHT_LOG_FIELD_PREDICTOR_0 : frameDefs["P"].predictor[i], value);
				i++;
			}
		}
	}
	
    function parseGPSFrame(raw) {
    	
    }

    function parseGPSHomeFrame(raw) {
    	
    }

    function completeEventFrame() {
    	
    }
    
    function parseEventFrame(raw) {
    	
    }
    
    function getFrameType(command) {
    	return frameTypes[command];
    }
    
    this.parseHeader = function(startOffset, endOffset) {
		//Reset any parsed information from previous parses
		this.resetStats();
		this.mainFieldCount = 0;
		this.gpsFieldCount = 0;
				
		//Reset system configuration to MW's defaults
		this.sysConfig = Object.create(defaultSysConfig);
		
		motor0Index = -1;

		//Set parsing ranges up
		stream.start = startOffset === undefined ? stream.pos : startOffset;
	    stream.pos = stream.start;
	    stream.end = endOffset === undefined ? stream.end : endOffset;
	    stream.eof = false;

	    mainloop:
		while (true) {
			var command = stream.readChar();

			switch (command) {
				case "H":
					parseHeaderLine();
				break;
				case EOF:
					break mainloop;
				default:
					/* 
					 * If we see something that looks like the beginning of a data frame, assume it
					 * is and terminate the header.
					 */
				    if (getFrameType(command)) {
                        stream.unreadChar(command);

                        break mainloop;
                    } // else skip garbage which apparently precedes the first data frame
                break;
			}
		}
	    
        if (this.mainFieldCount == 0) {
        	throw "Data file is missing field name definitions";
            return false;
        }	    
    };
	
	this.parseLog = function(raw, startOffset, endOffset) {
		var 
			looksLikeFrameCompleted = false,
			prematureEof = false,
			frameStart = 0,
			frameType = null,
			lastFrameType = null;

		mainHistoryRing = [new Array(this.mainFieldCount), new Array(this.mainFieldCount), new Array(this.mainFieldCount)];
		mainHistory = [mainHistoryRing[0], null, null];
		
		invalidateStream();
		
		lastEvent = {
			event: -1	
		};

		//Set parsing ranges up for the log the caller selected
		stream.start = startOffset === undefined ? stream.pos : startOffset;
	    stream.pos = stream.start;
	    stream.end = endOffset === undefined ? stream.end : endOffset;
	    stream.eof = false;

		while (true) {
			var command = stream.readChar();

			if (lastFrameType) {
				var 
					lastFrameSize = stream.pos - frameStart,
					frameTypeStats;

				// Is this the beginning of a new frame?
				looksLikeFrameCompleted = getFrameType(command) || (!prematureEof && command == EOF);

				if (!this.stats.frame[lastFrameType.marker]) {
					this.stats.frame[lastFrameType.marker] = {
						bytes: 0,
						sizeCount: new Int32Array(256), /* int32 arrays are zero-filled, handy! */
						validCount: 0,
						corruptCount: 0
					};
				}
				
				frameTypeStats = this.stats.frame[lastFrameType.marker];
				
				// If we see what looks like the beginning of a new frame, assume that the previous frame was valid:
				if (lastFrameSize <= FLIGHT_LOG_MAX_FRAME_LENGTH && looksLikeFrameCompleted) {
                    //Update statistics for this frame type
                    frameTypeStats.bytes += lastFrameSize;
                    frameTypeStats.sizeCount[lastFrameSize]++;
                    frameTypeStats.validCount++;

                    if (lastFrameType.complete)
                        lastFrameType.complete(lastFrameType.marker, frameStart, stream.pos, raw);

				} else {
					//The previous frame was corrupt

				    //We need to resynchronise before we can deliver another main frame:
                    mainStreamIsValid = false;
                    frameTypeStats.corruptCount++;
                    this.stats.totalCorruptFrames++;

                    //Let the caller know there was a corrupt frame (don't give them a pointer to the frame data because it is totally worthless)
                    if (this.onFrameReady)
                        this.onFrameReady(false, null, lastFrameType.marker, frameStart, lastFrameSize);

                    /*
                     * Start the search for a frame beginning after the first byte of the previous corrupt frame.
                     * This way we can find the start of the next frame after the corrupt frame if the corrupt frame
                     * was truncated.
                     */
                    stream.pos = frameStart + 1;
                    lastFrameType = null;
                    prematureEof = false;
                    stream.eof = false;
                    continue;
                }
			}

            if (command == EOF)
                break;

			frameType = getFrameType(command);
			frameStart = stream.pos - 1;

			if (frameType) {
			    frameType.parse(raw);
			} else {
			    mainStreamIsValid = false;
			}

			//We shouldn't read an EOF during reading a frame (that'd imply the frame was truncated)
			if (stream.eof)
				prematureEof = true;

            lastFrameType = frameType;
		}
	    
		this.stats.totalBytes += stream.end - stream.start;

		return true;
	};
	
	frameTypes = {
	    "I": {marker: "I", parse: parseIntraframe,   complete: completeIntraframe},
	    "P": {marker: "P", parse: parseInterframe,   complete: completeInterframe},
	    "G": {marker: "G", parse: parseGPSFrame,     complete: 0},
	    "H": {marker: "H", parse: parseGPSHomeFrame, complete: 0},
	    "E": {marker: "E", parse: parseEventFrame,   complete: completeEventFrame}
	};
	
	stream = new ArrayDataStream(logData);
};

FlightLogParser.prototype.resetStats = function() {
	this.stats = {
		totalBytes: 0,

		// Number of frames that failed to decode:
		totalCorruptFrames: 0,

		//If our sampling rate is less than 1, we won't log every loop iteration, and that is accounted for here:
		intentionallyAbsentIterations: 0,

		// Statistics for each field (min/max)
		field: new Array(256),
		// Statistics for each frame type ("I", "P" etc) 
		frame: {}
	};
}

FlightLogParser.prototype.FLIGHT_LOG_START_MARKER = asciiStringToByteArray("H Product:Blackbox flight data recorder by Nicholas Sherlock\n");

FlightLogParser.prototype.FLIGHT_LOG_FIELD_UNSIGNED = 0;
FlightLogParser.prototype.FLIGHT_LOG_FIELD_SIGNED   = 1;

FlightLogParser.prototype.FLIGHT_LOG_EVENT_SYNC_BEEP = 0;
FlightLogParser.prototype.FLIGHT_LOG_EVENT_LOG_END = 255;

FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_ITERATION = 0;
FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME = 1;

function FlightLogIndex(logData) {
	//Private:
	var 
		that = this,
		logBeginOffsets = false,
		logCount = false,
		intraframeDirectories = false;
		
	function buildLogOffsetsIndex() {
		var 
			stream = new ArrayDataStream(logData), 
	    	i, logStart;
	    
	    logBeginOffsets = [];
	
	    for (i = 0; ; i++) {
	    	logStart = stream.nextOffsetOf(FlightLogParser.prototype.FLIGHT_LOG_START_MARKER);
	
			if (logStart == -1) {
				//No more logs found in the file
		    	logBeginOffsets.push(stream.end);
				break; 
	    	}
	
	    	logBeginOffsets.push(logStart);
	    	
	    	//Restart the search after this header
	    	stream.pos += FlightLogParser.prototype.FLIGHT_LOG_START_MARKER.length;
		}
	}
	
	function buildIntraframeDirectories() {
		var 
			parser = new FlightLogParser(logData, that);
		
		intraframeDirectories = [];

		for (var i = 0; i < that.getLogCount(); i++) {
			var 
				intraIndex = {
					times: [],
					offsets: [],
					minTime: false,
					maxTime: false
				},
				skipIndex = 0;
			
			parser.parseHeader(logBeginOffsets[i], logBeginOffsets[i + 1]);
			
			parser.onFrameReady = function(frameValid, frame, frameType, frameOffset, frameSize) {
				if (frameValid) {
					var 
						frameTime = frame[FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME];
					
					if (intraIndex.minTime === false) {
						intraIndex.minTime = frameTime;
					}
					
					if (intraIndex.maxTime === false || frameTime > intraIndex.maxTime) {
						intraIndex.maxTime = frameTime;
					}
					
					if (frameType == 'I') {
						if (skipIndex % 4 == 0) {
							intraIndex.times.push(frameTime);
							intraIndex.offsets.push(frameOffset);
						}
						
						skipIndex++;
					}
				}
			};
			
			parser.parseLog(false);
			
			intraframeDirectories.push(intraIndex);
		}
	}
	
	//Public: 
	this.loadFromJSON = function(json) {
		
	};
	
	this.saveToJSON = function() {
		var 
			intraframeDirectories = this.getIntraframeDirectory(),
			i, j, 
			resultIndexes = new Array(intraframeDirectories.length);
		
		for (i = 0; i < intraframeDirectories.length; i++) {
			var 
				lastTime, lastLastTime, 
				lastOffset, lastLastOffset,
				
				sourceIndex = intraframeDirectories[i],
				
				resultIndex = {
					times: new Array(sourceIndex.times.length), 
					offsets: new Array(sourceIndex.offsets.length),
					minTime: sourceIndex.minTime,
					maxTime: sourceIndex.maxTime
				};
			
			if (sourceIndex.times.length > 0) {
				resultIndex.times[0] = sourceIndex.times[0];
				resultIndex.offsets[0] = sourceIndex.offsets[0];
				
				lastLastTime = lastTime = sourceIndex.times[0];
				lastLastOffset = lastOffset = sourceIndex.offsets[0];
				
				for (j = 1; j < sourceIndex.times.length; j++) {
					resultIndex.times[j] = sourceIndex.times[j] - 2 * lastTime + lastLastTime;
					resultIndex.offsets[j] = sourceIndex.offsets[j] - 2 * lastOffset + lastLastOffset;
					
					lastLastTime = lastTime;
					lastTime = sourceIndex.times[j];
	
					lastLastOffset = lastOffset;
					lastOffset = sourceIndex.offsets[j];
				}
			}
			
			resultIndexes[i] = resultIndex;
	}
		
		return JSON.stringify(resultIndexes);
	};	
	
	this.getLogBeginOffset = function(index) {
		if (!logBeginOffsets)
			buildLogOffsetsIndex();
		
		return logBeginOffsets[index];
	}
	
	this.getLogCount = function() {
		if (!logBeginOffsets)
			buildLogOffsetsIndex();

		return logBeginOffsets.length - 1;
	};
	
	this.getintraframeDirectories = function() {
		if (!intraframeDirectories)
			buildIntraframeDirectories();
		
		return intraframeDirectories;
	}	
	
	this.getIntraframeDirectory = function(logIndex) {
		if (!intraframeDirectories)
			buildIntraframeDirectories();
		
		return intraframeDirectories[logIndex];
	}
};
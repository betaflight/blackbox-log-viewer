"use strict";

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
            stream.pos = logStart + FlightLogParser.prototype.FLIGHT_LOG_START_MARKER.length;
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
                    avgThrottle: [],
                    hasEvent: [],
                    minTime: false,
                    maxTime: false
                },
                skipIndex = 0,
                motorFields = [],
                fieldNames,
                matches,
                throttleTotal,
                eventInThisChunk = null;
            
            parser.parseHeader(logBeginOffsets[i], logBeginOffsets[i + 1]);
            
            // Identify motor fields so they can be used to show the activity summary bar
            fieldNames = parser.mainFieldNames;
            
            for (var j = 0; j < fieldNames.length; j++) {
                if ((matches = fieldNames[j].match(/^motor\[\d+]$/))) {
                    motorFields.push(j);
                }
            }
            
            parser.onFrameReady = function(frameValid, frame, frameType, frameOffset, frameSize) {
                if (frameValid) {
                    if (frameType == 'P' || frameType == 'I') {
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
                                
                                if (motorFields.length) {
                                    throttleTotal = 0;
                                    for (var j = 0; j < motorFields.length; j++)
                                        throttleTotal += frame[motorFields[j]];
                                    
                                    intraIndex.avgThrottle.push(Math.round(throttleTotal / motorFields.length));
                                }
                            }
                            
                            skipIndex++;
                        }
                    } else if (frameType == 'E') {
                        // Mark that there was an event inside the current chunk
                        if (intraIndex.times.length > 0) {
                            intraIndex.hasEvent[intraIndex.times.length - 1] = true;
                        }
                    }
                }
            };
            
            parser.parseLogData(false);
        
            intraframeDirectories.push(intraIndex);
        }
        
        console.log(intraframeDirectories);
    }
    
    //Public: 
    this.loadFromJSON = function(json) {
        
    };
    
    this.saveToJSON = function() {
        var 
            intraframeDirectories = this.getIntraframeDirectories(),
            i, j, 
            resultIndexes = new Array(intraframeDirectories.length);
        
        for (i = 0; i < intraframeDirectories.length; i++) {
            var 
                lastTime, lastLastTime, 
                lastOffset, lastLastOffset,
                lastThrottle,
                
                sourceIndex = intraframeDirectories[i],
                
                resultIndex = {
                    times: new Array(sourceIndex.times.length), 
                    offsets: new Array(sourceIndex.offsets.length),
                    minTime: sourceIndex.minTime,
                    maxTime: sourceIndex.maxTime,
                    avgThrottle: new Array(sourceIndex.avgThrottle.length)
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
            
            if (sourceIndex.avgThrottle.length > 0) {
                for (j = 0; j < sourceIndex.avgThrottle.length; j++) {
                    resultIndex.avgThrottle[j] = sourceIndex.avgThrottle[j] - 1000;
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
    };
    
    this.getLogCount = function() {
        if (!logBeginOffsets)
            buildLogOffsetsIndex();

        return logBeginOffsets.length - 1;
    };
    
    this.getIntraframeDirectories = function() {
        if (!intraframeDirectories)
            buildIntraframeDirectories();
        
        return intraframeDirectories;
    };
    
    this.getIntraframeDirectory = function(logIndex) {
        return this.getIntraframeDirectories()[logIndex];
    };
}
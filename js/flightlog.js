"use strict";

/**
 * Uses a FlightLogParser to provide on-demand parsing (and caching) a flight data log. An index is computed
 * to allow efficient seeking.
 */
function FlightLog(logData) {
    var
        that = this,
        logIndex = false,
        logIndexes = new FlightLogIndex(logData),
        parser = new FlightLogParser(logData),
        
        iframeDirectory,
        
        chunkCache = new FIFOCache(2),
        
        fieldSmoothing = [],
        maxSmoothing = 0,
        
        numCells = false,
        
        smoothedCache = new FIFOCache(2);
    
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
            chunks = this.getChunksInTimeRange(startTime, startTime),
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
    
    function estimateNumCells() {
        var 
            i, 
            fieldNames = that.getMainFieldNames(),
            sysConfig = that.getSysConfig(),
            refVoltage = that.vbatToMillivolts(sysConfig.vbatref) / 100,
            found = false;

        //Are we even logging VBAT?
        for (i = 0; i < fieldNames.length; i++) {
            if (fieldNames[i] == 'vbatLatest') {
                found = true;
            }
        }
        
        if (!found) {
            numCells = false;
        } else {
            for (i = 1; i < 8; i++) {
                if (refVoltage < i * sysConfig.vbatmaxcellvoltage)
                    break;
            }
    
            numCells = i;
        }
    };
    
    this.getNumCellsEstimate = function() {
        return numCells;
    };
    
    /**
     * Get the raw chunks in the range [startIndex...endIndex] (inclusive)
     */
    function getChunksInIndexRange(startIndex, endIndex) {
        var resultChunks = [];
        
        if (startIndex < 0)
            startIndex = 0;

        if (endIndex > iframeDirectory.offsets.length - 1)
            endIndex = iframeDirectory.offsets.length - 1;
        
        if (endIndex < startIndex)
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
                    index: chunkIndex,
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

                parser.parseLogData(false, chunkStartOffset, chunkEndOffset);
                
                chunkCache.add(chunkIndex, chunk);
            }
            
            resultChunks.push(chunk);
        }
        
        //Assume caller asked for about a screen-full. Try to cache about three screens worth.
        if (chunkCache.capacity < resultChunks.length * 3 + 1) {
            chunkCache.capacity = resultChunks.length * 3 + 1;
            
            //And while we're here, use the same size for the smoothed cache
            smoothedCache.capacity = chunkCache.capacity;
        }
        
        return resultChunks;
    }
    
    /**
     * Get an array of chunks which span times from the given start to end time.
     * Each chunk is an array of log frames.
     */
    this.getChunksInTimeRange = function(startTime, endTime) {
        var 
            startIndex = binarySearchOrPrevious(iframeDirectory.times, startTime),
            endIndex = binarySearchOrPrevious(iframeDirectory.times, endTime);
        
        return getChunksInIndexRange(startIndex, endIndex);
    };
    
    /* 
     * Smoothing is an array of {field:1, radius:100000} where radius is in us. You only need to specify fields
     * which need to be smoothed.
     */
    this.setFieldSmoothing = function(newSmoothing) {
        smoothedCache.clear();
        fieldSmoothing = newSmoothing;
        
        maxSmoothing = 0;
        
        for (var i = 0; i < newSmoothing.length; i++)
            if (newSmoothing[i].radius > maxSmoothing)
                maxSmoothing = newSmoothing[i].radius;
    }
    
    this.getSmoothedChunksInTimeRange = function(startTime, endTime) {
        var 
            chunks,
            resultChunks, resultChunk,
            chunkAlreadyDone, allDone,
            timeFieldIndex = FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME;
        
        if (maxSmoothing == 0)
            return this.getChunksInTimeRange(startTime, endTime);
        
        var
            /* 
             * Ensure that the range that the caller asked for will be cached in its entirety by
             * expanding the request by 1 chunk on either side (since the chunks on the edge of the
             * query cannot be fully smoothed, they can't be cached).
             */
            startIndex = binarySearchOrPrevious(iframeDirectory.times, startTime - maxSmoothing) - 1,
            endIndex = binarySearchOrPrevious(iframeDirectory.times, endTime + maxSmoothing) + 1,
            
            //Count of chunks at the beginning and end of the range that we will only look at, not smooth
            leadingROChunks, trailingROChunks;
        
        if (startIndex < 0) {
            startIndex = 0;
            leadingROChunks = 0;
        } else {
            leadingROChunks = 1;
        }
        
        if (endIndex > iframeDirectory.offsets.length - 1) {
            endIndex = iframeDirectory.offsets.length - 1;
            trailingROChunks = 0;
        } else {
            trailingROChunks = 1;
        }
        
        chunks = getChunksInIndexRange(startIndex, endIndex);

        //Create an independent copy of the raw frame data to smooth out:
        resultChunks = new Array(chunks.length - leadingROChunks - trailingROChunks);
        chunkAlreadyDone = new Array(chunks.length);
        
        allDone = true;
        
        //Don't smooth the edge chunks since they can't be fully smoothed
        for (var i = leadingROChunks; i < chunks.length - trailingROChunks; i++) {
            var resultChunk = smoothedCache.get(chunks[i].index);
            
            chunkAlreadyDone[i] = !!resultChunk;
            
            //If we haven't already smoothed this chunk
            if (!chunkAlreadyDone[i]) {
                allDone = false;
                
                resultChunk = {
                    index: chunks[i].index,
                    frames: new Array(chunks[i].frames.length),
                    gapStartsHere: chunks[i].gapStartsHere
                };
                
                for (var j = 0; j < resultChunk.frames.length; j++) {
                    resultChunk.frames[j] = chunks[i].frames[j].slice(0);
                }
                
                smoothedCache.add(resultChunk.index, resultChunk);
            }
            
            resultChunks[i - leadingROChunks] = resultChunk;
        }

        if (!allDone) {
            for (var i = 0; i < fieldSmoothing.length; i++) {
                var 
                    radius = fieldSmoothing[i].radius,
                    fieldIndex = fieldSmoothing[i].field,
                    
                    //The position we're currently computing the smoothed value for:
                    centerChunkIndex, centerFrameIndex;
                    
                //The outer two loops are used to begin a new partition to smooth within
                mainLoop:
                
                // Don't bother to smooth the first and last source chunks, since we can't smooth them completely
                for (centerChunkIndex = leadingROChunks; centerChunkIndex < chunks.length - trailingROChunks; centerChunkIndex++) {
                    if (chunkAlreadyDone[centerChunkIndex])
                        continue;
                    
                    for (centerFrameIndex = 0; centerFrameIndex < chunks[centerChunkIndex].frames.length; ) {
                        var
                            //Current beginning & end of the smoothing window:
                            leftChunkIndex = centerChunkIndex,
                            leftFrameIndex = centerFrameIndex,
                        
                            rightChunkIndex, rightFrameIndex,
    
                            /* 
                             * The end of the current data partition,
                             * We'll refine this guess for the end of the partition later if we find discontinuities:
                             */
                            endChunkIndex = chunks.length - leadingROChunks - trailingROChunks,
                            endFrameIndex = chunks[endChunkIndex].frames.length,
        
                            partitionEnded = false,
                            accumulator = 0,
                            valuesInHistory = 0,
                             
                            centerTime = chunks[centerChunkIndex].frames[centerFrameIndex][timeFieldIndex];
        
                        /* 
                         * This may not be the left edge of a partition, we may just have skipped the previous chunk due to
                         * it having already been cached. If so, we can read the values from the previous chunk in order
                         * to prime our history window. Move the left&right indexes to the left so the main loop will read
                         * those earlier values.
                         */
                        while (leftFrameIndex > 0 || leftFrameIndex == 0 && leftChunkIndex > 0) {
                            var
                                oldleftChunkIndex = leftChunkIndex,
                                oldleftFrameIndex = leftFrameIndex;
                            
                            //Try moving it left
                            if (leftFrameIndex == 0) {
                                leftChunkIndex--;
                                leftFrameIndex = chunks[leftChunkIndex].frames.length - 1;
                            } else {
                                leftFrameIndex--;
                            }
                            
                            if (chunks[leftChunkIndex].gapStartsHere[leftFrameIndex] || chunks[leftChunkIndex].frames[leftFrameIndex][timeFieldIndex] < centerTime - radius) {
                                //We moved the left index one step too far, shift it back
                                leftChunkIndex = oldleftChunkIndex;
                                leftFrameIndex = oldleftFrameIndex;
                                
                                break;
                            }
                        }
                        
                        rightChunkIndex = leftChunkIndex;
                        rightFrameIndex = leftFrameIndex;
                        
                        //The main loop, where we march our smoothing window along until we exhaust this partition
                        while (centerChunkIndex < endChunkIndex || centerChunkIndex == endChunkIndex && centerFrameIndex < endFrameIndex) {
                            // Old values fall out of the window
                            while (chunks[leftChunkIndex].frames[leftFrameIndex][timeFieldIndex] < centerTime - radius) {
                                accumulator -= chunks[leftChunkIndex].frames[leftFrameIndex][fieldIndex];
                                valuesInHistory--;
                                
                                leftFrameIndex++;
                                if (leftFrameIndex == chunks[leftChunkIndex].frames.length) {
                                    leftFrameIndex = 0;
                                    leftChunkIndex++;
                                }
                            }
        
                            //New values are added to the window
                            while (!partitionEnded && chunks[rightChunkIndex].frames[rightFrameIndex][timeFieldIndex] <= centerTime + radius) {
                                accumulator += chunks[rightChunkIndex].frames[rightFrameIndex][fieldIndex];
                                valuesInHistory++;
        
                                //If there is a discontinuity after this point, stop trying to add further values
                                if (chunks[rightChunkIndex].gapStartsHere[rightFrameIndex]) {
                                    partitionEnded = true;
                                }
                                    
                                //Advance the right index onward since we read a value
                                rightFrameIndex++;
                                if (rightFrameIndex == chunks[rightChunkIndex].frames.length) {
                                    rightFrameIndex = 0;
                                    rightChunkIndex++;
                                    
                                    if (rightChunkIndex == chunks.length) {
                                        //We reached the end of the region of interest!
                                        partitionEnded = true;
                                    }
                                }
    
                                if (partitionEnded) {
                                    //Let the center-storing loop know not to advance the center to this position: 
                                    endChunkIndex = rightChunkIndex;
                                    endFrameIndex = rightFrameIndex;
                                }
                            }
        
                            // Store the average of the history window into the frame in the center of the window
                            resultChunks[centerChunkIndex - leadingROChunks].frames[centerFrameIndex][fieldIndex] = Math.round(accumulator / valuesInHistory);
                            
                            // Advance the center so we can start computing the next value
                            centerFrameIndex++;
                            if (centerFrameIndex == chunks[centerChunkIndex].frames.length) {
                                centerFrameIndex = 0;
                                centerChunkIndex++;
    
                                //Is the next chunk already cached? Then we have nothing to write into there
                                if (chunkAlreadyDone[centerChunkIndex])
                                    continue mainLoop;
                                
                                //Have we covered the whole ROI?
                                if (centerChunkIndex == chunks.length - trailingROChunks)
                                    break mainLoop;
                            }
                            
                            centerTime = chunks[centerChunkIndex].frames[centerFrameIndex][timeFieldIndex];
                        }
                    }
                }
            }
        }
        
        return resultChunks;
    };
        
    parser.onFrameReady = function(frameValid, frame, frameType, frameOffset, frameSize) {
        if (frameValid) {
            var copy = frame.slice(0);
            copy.push(frameType);
            acc.push(copy);
        }
    };
    
    this.openLog = function(index) {
        logIndex = index;
        
        iframeDirectory = logIndexes.getIntraframeDirectory(logIndex);
        
        parser.parseHeader(logIndexes.getLogBeginOffset(index));
        
        estimateNumCells();
    };
    
    this.openLog(0);
}

FlightLog.prototype.accRawToGs = function(value) {
    return value / this.getSysConfig().acc_1G;
};

FlightLog.prototype.gyroRawToDegreesPerSecond = function(value) {
    return this.getSysConfig().gyroScale * 1000000 / (Math.PI / 180.0) * value;
};

FlightLog.prototype.getReferenceVoltageMillivolts = function() {
    return this.vbatToMillivolts(this.getSysConfig().vbatref);
}

FlightLog.prototype.vbatToMillivolts = function(vbat) {
    // ADC is 12 bit (i.e. max 0xFFF), voltage reference is 3.3V, vbatscale is premultiplied by 100
    return (vbat * 330 * this.getSysConfig().vbatscale) / 0xFFF;
};
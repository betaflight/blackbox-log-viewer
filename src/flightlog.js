import { FlightLogIndex } from "./flightlog_index";
import { FlightLogParser } from "./flightlog_parser";
import { GPS_transform } from "./gps_transform";
import {
  MAX_MOTOR_NUMBER,
  DSHOT_MIN_VALUE,
  DSHOT_RANGE,
  FlightLogEvent,
  AXIS,
  FAST_PROTOCOL,
  SUPER_EXPO_YAW,
} from "./flightlog_fielddefs";
import { IMU } from "./imu";
import { FIFOCache } from "./cache";
import {
  binarySearchOrPrevious,
  binarySearchOrNext,
  constrain,
  validate,
  firmwareGreaterOrEqual,
} from "./tools";

/**
 * Uses a FlightLogParser to provide on-demand parsing (and caching) of the flight data log.
 *
 * An index is computed to allow efficient seeking.
 *
 * Multiple disparate frame types in the original log are aligned and merged together to provide one time series.
 * Additional computed fields are derived from the original data set and added as new fields in the resulting data.
 * Window based smoothing of fields is offered.
 */
export function FlightLog(logData) {
  let ADDITIONAL_COMPUTED_FIELD_COUNT = 19 /** attitude + PID_SUM + PID_ERROR + RCCOMMAND_SCALED + GPS coord**/,
    that = this,
    logIndex = 0,
    logIndexes = new FlightLogIndex(logData),
    parser = new FlightLogParser(logData),
    iframeDirectory,
    // We cache these details so they don't have to be recomputed on every request:
    numCells = false,
    numMotors = false,
    fieldNames = [],
    fieldNameToIndex = {},
    chunkCache = new FIFOCache(2),
    // Map from field indexes to smoothing window size in microseconds
    fieldSmoothing = {},
    maxSmoothing = 0,
    smoothedCache = new FIFOCache(2),
    gpsTransform = null;

  //Public fields:
  this.parser = parser;

  this.getMainFieldCount = function () {
    return fieldNames.length;
  };

  this.getMainFieldNames = function () {
    return fieldNames;
  };

  /**
   * Get the fatal parse error encountered when reading the log with the given index, or false if no error
   * was encountered.
   */
  this.getLogError = function (logIndex) {
    let error = logIndexes.getIntraframeDirectory(logIndex).error;

    if (error) return error;

    return false;
  };

  /**
   * Get the stats for the log of the given index, or leave off the logIndex argument to fetch the stats
   * for the current log.
   */
  function getRawStats(logIndex) {
    if (logIndex === undefined) {
      return iframeDirectory.stats;
    } else {
      return logIndexes.getIntraframeDirectory(logIndex).stats;
    }
  }

  /**
   * Get the stats for the log of the given index, or leave off the logIndex argument to fetch the stats
   * for the current log.
   *
   * Stats are modified to add a global field[] array which contains merged field stats for the different frame types
   * that the flightlog presents as one merged frame.
   */
  this.getStats = function (logIndex) {
    let rawStats = getRawStats(logIndex);

    if (rawStats.field === undefined) {
      rawStats.field = [];
      for (let i = 0; i < rawStats.frame.I.field.length; ++i) {
        rawStats.field[i] = {
          min: Math.min(
            rawStats.frame.I.field[i].min,
            rawStats.frame.P.field[i].min
          ),
          max: Math.max(
            rawStats.frame.I.field[i].max,
            rawStats.frame.P.field[i].max
          ),
        };
      }

      if (rawStats.frame.S) {
        rawStats.field = rawStats.field.concat(rawStats.frame.S.field);
      }
    }
    return rawStats;
  };

  /**
   * Get the earliest time seen in the log of the given index (in microseconds), or leave off the logIndex
   * argument to fetch details for the current log.
   */
  this.getMinTime = function (index) {
    index = index ?? logIndex;
    return logIndexes.getIntraframeDirectory(index).minTime;
  };

  /**
   * Get the latest time seen in the log of the given index (in microseconds), or leave off the logIndex
   * argument to fetch details for the current log.
   */
  this.getMaxTime = function (index) {
    index = index ?? logIndex;
    return logIndexes.getIntraframeDirectory(index).maxTime;
  };

  this.getActualLoggedTime = function (index) {
    index = index ?? logIndex;
    const directory = logIndexes.getIntraframeDirectory(index);
    return directory.maxTime - directory.minTime - directory.unLoggedTime;
  };

  /**
   * Get the flight controller system information that was parsed for the current log file.
   */
  this.getSysConfig = function () {
    return parser.sysConfig;
  };

  this.setSysConfig = function (newSysConfig) {
    $.extend(true, parser.sysConfig, newSysConfig);
  };

  /**
   * Get the index of the currently selected log.
   */
  this.getLogIndex = function () {
    return logIndex;
  };

  this.getLogCount = function () {
    return logIndexes.getLogCount();
  };

  /**
   * Return a coarse summary of throttle position and events across the entire log.
   */
  this.getActivitySummary = function () {
    let directory = logIndexes.getIntraframeDirectory(logIndex);

    return {
      times: directory.times,
      avgThrottle: directory.avgThrottle,
      maxMotorDiff: directory.maxMotorDiff,
      maxRC: directory.maxRC,
      hasEvent: directory.hasEvent,
    };
  };

  /**
   * Get the index of the field with the given name, or undefined if that field doesn't exist in the log.
   */
  this.getMainFieldIndexByName = function (name) {
    return fieldNameToIndex[name];
  };

  this.getMainFieldIndexes = function (name) {
    return fieldNameToIndex;
  };

  this.getFrameAtTime = function (startTime) {
    let chunks = this.getChunksInTimeRange(startTime, startTime),
      chunk = chunks[0];

    if (chunk) {
      for (var i = 0; i < chunk.frames.length; i++) {
        if (
          chunk.frames[i][
            FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME
          ] > startTime
        )
          break;
      }

      return chunk.frames[i - 1];
    } else return false;
  };

  this.getSmoothedFrameAtTime = function (startTime) {
    let chunks = this.getSmoothedChunksInTimeRange(startTime, startTime),
      chunk = chunks[0];

    if (chunk) {
      for (var i = 0; i < chunk.frames.length; i++) {
        if (
          chunk.frames[i][
            FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME
          ] > startTime
        )
          break;
      }

      return chunk.frames[i - 1];
    } else return false;
  };

  this.getCurrentFrameAtTime = function (startTime) {
    let chunks = this.getSmoothedChunksInTimeRange(startTime, startTime),
      chunk = chunks[0];

    if (chunk) {
      for (var i = 0; i < chunk.frames.length; i++) {
        if (
          chunk.frames[i][
            FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME
          ] > startTime
        )
          break;
      }

      return {
        previous: i >= 2 ? chunk.frames[i - 2] : null,
        current: i >= 1 ? chunk.frames[i - 1] : null,
        next: i >= 0 ? chunk.frames[i] : null,
      };
    } else return false;
  };

  function buildFieldNames() {
    // Make an independent copy
    fieldNames = parser.frameDefs.I.name.slice(0);

    // Add names of slow fields which we'll merge into the main stream
    if (parser.frameDefs.S) {
      for (const name of parser.frameDefs.S.name) {
        fieldNames.push(name);
      }
    }
    // Add names of gps fields which we'll merge into the main stream
    if (parser.frameDefs.G) {
      for (const name of parser.frameDefs.G.name) {
        if (name !== "time") {
          // remove duplicate time field
          fieldNames.push(name);
        }
      }
    }

    // Add names for our ADDITIONAL_COMPUTED_FIELDS
    if (!that.isFieldDisabled().GYRO) {
      fieldNames.push("heading[0]", "heading[1]", "heading[2]");
    }
    if (!that.isFieldDisabled().PID) {
      fieldNames.push("axisSum[0]", "axisSum[1]", "axisSum[2]");
    }
    if (!that.isFieldDisabled().SETPOINT) {
      fieldNames.push(
        "rcCommands[0]",
        "rcCommands[1]",
        "rcCommands[2]",
        "rcCommands[3]"
      ); // Custom calculated scaled rccommand
    }
    if (!that.isFieldDisabled().GYRO && !that.isFieldDisabled().SETPOINT) {
      fieldNames.push("axisError[0]", "axisError[1]", "axisError[2]"); // Custom calculated error field
    }
    if (!that.isFieldDisabled().GPS) {
      fieldNames.push("gpsCartesianCoords[0]", "gpsCartesianCoords[1]", "gpsCartesianCoords[2]", "gpsDistance"); // GPS coords in cartesian system
    }

    fieldNameToIndex = {};
    for (let i = 0; i < fieldNames.length; i++) {
      fieldNameToIndex[fieldNames[i]] = i;
    }
  }

  function estimateNumMotors() {
    let count = 0;

    for (let j = 0; j < MAX_MOTOR_NUMBER; j++) {
      if (that.getMainFieldIndexByName(`motor[${j}]`) !== undefined) {
        count++;
      }
    }

    numMotors = count;
  }

  function estimateNumCells() {
    let i,
      fieldNames = that.getMainFieldNames(),
      sysConfig = that.getSysConfig(),
      found = false;

    let refVoltage;
    if (firmwareGreaterOrEqual(sysConfig, "3.1.0", "2.0.0")) {
      refVoltage = sysConfig.vbatref;
    } else {
      refVoltage = that.vbatADCToMillivolts(sysConfig.vbatref) / 100;
    }

    //Are we even logging VBAT?
    if (!fieldNameToIndex.vbatLatest) {
      numCells = false;
    } else {
      for (i = 1; i < 8; i++) {
        if (refVoltage < i * sysConfig.vbatmaxcellvoltage) break;
      }

      numCells = i;
    }
  }

  this.getNumCellsEstimate = function () {
    return numCells;
  };

  this.getNumMotors = function () {
    return numMotors;
  };

  /**
   * Get the raw chunks in the range [startIndex...endIndex] (inclusive)
   *
   * When the cache misses, this will result in parsing the original log file to create chunks.
   */
  function getChunksInIndexRange(startIndex, endIndex) {
    let resultChunks = [],
      eventNeedsTimestamp = [];

    if (startIndex < 0) startIndex = 0;

    if (endIndex > iframeDirectory.offsets.length - 1)
      endIndex = iframeDirectory.offsets.length - 1;

    if (endIndex < startIndex) return [];

    //Assume caller asked for about a screen-full. Try to cache about three screens worth.
    if (chunkCache.capacity < (endIndex - startIndex + 1) * 3 + 1) {
      chunkCache.capacity = (endIndex - startIndex + 1) * 3 + 1;

      //And while we're here, use the same size for the smoothed cache
      smoothedCache.capacity = chunkCache.capacity;
    }

    for (let chunkIndex = startIndex; chunkIndex <= endIndex; chunkIndex++) {
      var chunkStartOffset,
        chunkEndOffset,
        chunk = chunkCache.get(chunkIndex);

      // Did we cache this chunk already?
      if (chunk) {
        // Use the first event in the chunk to fill in event times at the trailing end of the previous one
        let frame = chunk.frames[0];

        for (let i = 0; i < eventNeedsTimestamp.length; i++) {
          eventNeedsTimestamp[i].time =
            frame[FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME];
        }
        eventNeedsTimestamp.length = 0;
      } else {
        // Parse the log file to create this chunk since it wasn't cached
        chunkStartOffset = iframeDirectory.offsets[chunkIndex];

        if (chunkIndex + 1 < iframeDirectory.offsets.length)
          chunkEndOffset = iframeDirectory.offsets[chunkIndex + 1];
        // We're at the end so parse till end-of-log
        else chunkEndOffset = logIndexes.getLogBeginOffset(logIndex + 1);

        chunk = chunkCache.recycle();

        // Were we able to reuse memory from an expired chunk?
        if (chunk) {
          chunk.index = chunkIndex;
          /*
           * getSmoothedChunks would like to share this data, so we can't reuse the old arrays without
           * accidentally changing data that it might still want to reference:
           */
          chunk.gapStartsHere = {};
          chunk.events = [];
          delete chunk.hasAdditionalFields;
          delete chunk.needsEventTimes;

          //But reuse the old chunk's frames array since getSmoothedChunks has an independent copy
        } else {
          chunk = {
            index: chunkIndex,
            frames: [],
            gapStartsHere: {},
            events: [],
          };
        }

        // We need to store this in the chunk so we can refer to it later when we inject computed fields
        chunk.initialIMU = iframeDirectory.initialIMU[chunkIndex];

        var mainFrameIndex = 0,
          slowFrameLength = parser.frameDefs.S ? parser.frameDefs.S.count : 0,
          lastSlow = parser.frameDefs.S
            ? iframeDirectory.initialSlow[chunkIndex].slice(0)
            : [],
          lastGPSLength = parser.frameDefs.G ? parser.frameDefs.G.count - 1 : 0, // -1 since we exclude the time field
          lastGPS = parser.frameDefs.G
            ? iframeDirectory.initialGPS[chunkIndex].slice(0)
            : [];

        parser.onFrameReady = function (
          frameValid,
          frame,
          frameType,
          frameOffset,
          frameSize
        ) {
          let destFrame, destFrame_currentIndex;

          // The G frames need to be processed always. They are "invalid" if not H (Home) has been detected
          // before, but if not processed the viewer shows cuts and gaps. This happens if the quad takes off before
          // fixing enough satellites.
          if (frameValid || (frameType == "G" && frame)) {
            switch (frameType) {
              case "P":
              case "I":
                //The parser re-uses the "frame" array so we must copy that data somewhere else

                var numOutputFields =
                  frame.length +
                  slowFrameLength +
                  lastGPSLength +
                  ADDITIONAL_COMPUTED_FIELD_COUNT;

                //Do we have a recycled chunk to copy on top of?
                if (chunk.frames[mainFrameIndex]) {
                  destFrame = chunk.frames[mainFrameIndex];
                  destFrame.length = numOutputFields;
                } else {
                  // Otherwise allocate a new array
                  destFrame = new Array(numOutputFields);
                  chunk.frames.push(destFrame);
                }

                // Copy the main frame data in
                for (var i = 0; i < frame.length; i++) {
                  destFrame[i] = frame[i];
                }

                destFrame_currentIndex = frame.length; // Keeps track of where to place direct data in the destFrame.
                // Then merge in the last seen slow-frame data
                for (
                  let slowFrameIndex = 0;
                  slowFrameIndex < slowFrameLength;
                  slowFrameIndex++
                ) {
                  destFrame[slowFrameIndex + destFrame_currentIndex] =
                    lastSlow[slowFrameIndex] === undefined
                      ? null
                      : lastSlow[slowFrameIndex];
                }
                destFrame_currentIndex += slowFrameLength;

                // Also merge last seen gps-frame data
                for (
                  let gpsFrameIndex = 0;
                  gpsFrameIndex < lastGPSLength;
                  gpsFrameIndex++
                ) {
                  destFrame[gpsFrameIndex + destFrame_currentIndex] =
                    lastGPS[gpsFrameIndex] === undefined
                      ? null
                      : lastGPS[gpsFrameIndex];
                }
                // destFrame_currentIndex += lastGPSLength; Add this line if you wish to add more fields.

                for (var i = 0; i < eventNeedsTimestamp.length; i++) {
                  eventNeedsTimestamp[i].time =
                    frame[
                      FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME
                    ];
                }
                eventNeedsTimestamp.length = 0;

                mainFrameIndex++;

                break;
              case "E":
                if (frame.event == FlightLogEvent.LOGGING_RESUME) {
                  chunk.gapStartsHere[mainFrameIndex - 1] = true;
                }

                /*
                 * If the event was logged during a loop iteration, it will appear in the log
                 * before that loop iteration does (since the main log stream is logged at the very
                 * end of the loop).
                 *
                 * So we want to use the timestamp of that later frame as the timestamp of the loop
                 * iteration this event was logged in.
                 */
                if (!frame.time) {
                  eventNeedsTimestamp.push(frame);
                }
                chunk.events.push(frame);
                break;
              case "S":
                for (var i = 0; i < frame.length; i++) {
                  lastSlow[i] = frame[i];
                }
                break;
              case "H": {
                const homeAltitude = frame.length > 2 ? frame[2] / 10 : 0; // will work after BF firmware improvement
                gpsTransform = new GPS_transform(frame[0] / 10000000, frame[1] / 10000000, homeAltitude, 0.0);
                break;
              }
              case "G":
                // The frameValid can be false, when no GPS home (the G frames contains GPS position as diff of GPS Home position).
                // But other data from the G frame can be valid (time, num sats)

                //H Field G name:time,GPS_numSat,GPS_coord[0],GPS_coord[1],GPS_altitude,GPS_speed,GPS_ground_course
                frame.shift(); // remove time
                for (let i = 0; i < frame.length; i++) {
                  lastGPS[i] = frame[i];
                }
                break;
            }
          } else {
            chunk.gapStartsHere[mainFrameIndex - 1] = true;
          }
        };

        parser.resetDataState();

        //Prime the parser with the previous state we get from the flightlog index, so it can base deltas off that data
        if (iframeDirectory.initialGPSHome) {
          parser.setGPSHomeHistory(iframeDirectory.initialGPSHome[chunkIndex]);
        }

        parser.parseLogData(false, chunkStartOffset, chunkEndOffset);

        //Truncate the array to fit just in case it was recycled and the new one is shorter
        chunk.frames.length = mainFrameIndex;

        chunkCache.add(chunkIndex, chunk);
      }

      resultChunks.push(chunk);
    }

    /*
     * If there is an event that trailed the all the chunks we were decoding, we can't give it an event time field
     * because we didn't get to see the time of the next frame.
     */
    if (eventNeedsTimestamp.length > 0) {
      resultChunks[resultChunks.length - 1].needsEventTimes = true;
    }

    injectComputedFields(resultChunks, resultChunks);

    return resultChunks;
  }

  /**
   * Get an array of chunks which span times from the given start to end time.
   * Each chunk is an array of log frames.
   */
  this.getChunksInTimeRange = function (startTime, endTime) {
    let startIndex = binarySearchOrPrevious(iframeDirectory.times, startTime),
      endIndex = binarySearchOrPrevious(iframeDirectory.times, endTime);

    return getChunksInIndexRange(startIndex, endIndex);
  };

  /*
   * Smoothing is map from field index to smoothing radius, where radius is in us. You only need to specify fields
   * which need to be smoothed.
   */
  this.setFieldSmoothing = function (newSmoothing) {
    smoothedCache.clear();
    fieldSmoothing = newSmoothing;

    maxSmoothing = 0;

    for (let fieldIndex in newSmoothing) {
      if (newSmoothing[fieldIndex] > maxSmoothing) {
        maxSmoothing = newSmoothing[fieldIndex];
      }
    }
  };

  /**
   * Use the data in sourceChunks to compute additional fields (like IMU attitude) and add those into the
   * resultChunks.
   *
   * sourceChunks and destChunks can be the same array.
   */
  function injectComputedFields(sourceChunks, destChunks) {
    let gyroADC = [
      fieldNameToIndex["gyroADC[0]"],
      fieldNameToIndex["gyroADC[1]"],
      fieldNameToIndex["gyroADC[2]"],
    ];
    let accSmooth = [
      fieldNameToIndex["accSmooth[0]"],
      fieldNameToIndex["accSmooth[1]"],
      fieldNameToIndex["accSmooth[2]"],
    ];
    let magADC = [
      fieldNameToIndex["magADC[0]"],
      fieldNameToIndex["magADC[1]"],
      fieldNameToIndex["magADC[2]"],
    ];
    let rcCommand = [
      fieldNameToIndex["rcCommand[0]"],
      fieldNameToIndex["rcCommand[1]"],
      fieldNameToIndex["rcCommand[2]"],
      fieldNameToIndex["rcCommand[3]"],
    ];
    let setpoint = [
      fieldNameToIndex["setpoint[0]"],
      fieldNameToIndex["setpoint[1]"],
      fieldNameToIndex["setpoint[2]"],
      fieldNameToIndex["setpoint[3]"],
    ];
    let gpsCoord = [
      fieldNameToIndex["GPS_coord[0]"],
      fieldNameToIndex["GPS_coord[1]"],
      fieldNameToIndex["GPS_altitude"],
    ];

    const flightModeFlagsIndex = fieldNameToIndex["flightModeFlags"]; // This points to the flightmode data

    let axisPID = [
      [
        fieldNameToIndex["axisP[0]"],
        fieldNameToIndex["axisI[0]"],
        fieldNameToIndex["axisD[0]"],
        fieldNameToIndex["axisF[0]"],
      ],
      [
        fieldNameToIndex["axisP[1]"],
        fieldNameToIndex["axisI[1]"],
        fieldNameToIndex["axisD[1]"],
        fieldNameToIndex["axisF[1]"],
      ],
      [
        fieldNameToIndex["axisP[2]"],
        fieldNameToIndex["axisI[2]"],
        fieldNameToIndex["axisD[2]"],
        fieldNameToIndex["axisF[2]"],
      ],
    ];

    let sourceChunkIndex;
    let destChunkIndex;
    let attitude;

    const sysConfig = that.getSysConfig();

    if (destChunks.length === 0) {
      return;
    }

    // Do we have mag fields? If not mark that data as absent
    if (!magADC[0]) {
      magADC = false;
    }

    if (!gyroADC[0]) {
      gyroADC = false;
    }

    if (!accSmooth[0]) {
      accSmooth = false;
    }

    if (!rcCommand[0]) {
      rcCommand = false;
    }

    if (!setpoint[0]) {
      setpoint = false;
    }

    if (!axisPID[0]) {
      axisPID = false;
    }

    if (!gpsCoord[0]) {
      gpsCoord = false;
    }


    sourceChunkIndex = 0;
    destChunkIndex = 0;

    // Skip leading source chunks that don't appear in the destination
    while (
      sourceChunks[sourceChunkIndex].index < destChunks[destChunkIndex].index
    ) {
      sourceChunkIndex++;
    }

    for (
      ;
      destChunkIndex < destChunks.length;
      sourceChunkIndex++, destChunkIndex++
    ) {
      let destChunk = destChunks[destChunkIndex],
        sourceChunk = sourceChunks[sourceChunkIndex];

      if (!destChunk.hasAdditionalFields) {
        destChunk.hasAdditionalFields = true;

        let chunkIMU = new IMU(sourceChunks[sourceChunkIndex].initialIMU);

        for (let i = 0; i < sourceChunk.frames.length; i++) {
          let srcFrame = sourceChunk.frames[i],
            destFrame = destChunk.frames[i],
            fieldIndex = destFrame.length - ADDITIONAL_COMPUTED_FIELD_COUNT;

          if (!that.isFieldDisabled().GYRO) {
            //don't calculate attitude if no gyro data
            attitude = chunkIMU.updateEstimatedAttitude(
              [
                srcFrame[gyroADC[0]],
                srcFrame[gyroADC[1]],
                srcFrame[gyroADC[2]],
              ],
              [
                srcFrame[accSmooth[0]],
                srcFrame[accSmooth[1]],
                srcFrame[accSmooth[2]],
              ],
              srcFrame[FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME],
              sysConfig.acc_1G,
              sysConfig.gyroScale,
              magADC
            );

            destFrame[fieldIndex++] = attitude.roll;
            destFrame[fieldIndex++] = attitude.pitch;
            destFrame[fieldIndex++] = attitude.heading;
          }

          // Add the Feedforward PID sum (P+I+D+F)
          if (!that.isFieldDisabled().PID) {
            for (var axis = 0; axis < 3; axis++) {
              let pidSum =
                (axisPID[axis][0] !== undefined
                  ? srcFrame[axisPID[axis][0]]
                  : 0) +
                (axisPID[axis][1] !== undefined
                  ? srcFrame[axisPID[axis][1]]
                  : 0) +
                (axisPID[axis][2] !== undefined
                  ? srcFrame[axisPID[axis][2]]
                  : 0) +
                (axisPID[axis][3] !== undefined
                  ? srcFrame[axisPID[axis][3]]
                  : 0);

              // Limit the PID sum by the limits defined in the header
              let pidLimit =
                axis < AXIS.YAW
                  ? sysConfig.pidSumLimit
                  : sysConfig.pidSumLimitYaw;
              if (pidLimit != null && pidLimit > 0) {
                pidSum = constrain(pidSum, -pidLimit, pidLimit);
              }

              // Assign value
              destFrame[fieldIndex++] = pidSum;
            }
          }

          // Check the current flightmode (we need to know this so that we can correctly calculate the rates)
          let currentFlightMode = srcFrame[flightModeFlagsIndex];

          // Calculate the Scaled rcCommand (setpoint) (in deg/s, % for throttle)
          let fieldIndexRcCommands = fieldIndex;

          if (!that.isFieldDisabled().SETPOINT) {
            // Since version 4.0 is not more a virtual field. Copy the real field to the virtual one to maintain the name, workspaces, etc.
            if (
              sysConfig.firmwareType == FIRMWARE_TYPE_BETAFLIGHT &&
              semver.gte(sysConfig.firmwareVersion, "4.0.0")
            ) {
              // Roll, pitch and yaw
              for (let axis = 0; axis <= AXIS.YAW; axis++) {
                destFrame[fieldIndex++] = srcFrame[setpoint[axis]];
              }
              // Throttle
              destFrame[fieldIndex++] = srcFrame[setpoint[AXIS.YAW + 1]] / 10;

              // Versions earlier to 4.0 we must calculate the expected setpoint
            } else {
              // Roll, pitch and yaw
              for (let axis = 0; axis <= AXIS.YAW; axis++) {
                destFrame[fieldIndex++] =
                  rcCommand[axis] !== undefined
                    ? that.rcCommandRawToDegreesPerSecond(
                        srcFrame[rcCommand[axis]],
                        axis,
                        currentFlightMode
                      )
                    : 0;
              }
              // Throttle
              destFrame[fieldIndex++] =
                rcCommand[AXIS.YAW + 1] !== undefined
                  ? that.rcCommandRawToThrottle(
                      srcFrame[rcCommand[AXIS.YAW + 1]]
                    )
                  : 0;
            }
          }

          // Calculate the PID Error
          if (
            !that.isFieldDisabled().GYRO &&
            !that.isFieldDisabled().SETPOINT
          ) {
            for (var axis = 0; axis < 3; axis++) {
              let gyroADCdegrees =
                gyroADC[axis] !== undefined
                  ? that.gyroRawToDegreesPerSecond(srcFrame[gyroADC[axis]])
                  : 0;
              destFrame[fieldIndex++] =
                destFrame[fieldIndexRcCommands + axis] - gyroADCdegrees;
            }
          }

          // Calculate cartesian coords by GPS
          if (!that.isFieldDisabled().GPS) {
            if (gpsTransform && gpsCoord && srcFrame[gpsCoord[0]]) {
              const gpsCartesianCoords = gpsTransform.WGS_BS(srcFrame[gpsCoord[0]] / 10000000, srcFrame[gpsCoord[1]] / 10000000, srcFrame[gpsCoord[2]] / 10);
              destFrame[fieldIndex++] = gpsCartesianCoords.x;
              destFrame[fieldIndex++] = gpsCartesianCoords.y;
              destFrame[fieldIndex++] = gpsCartesianCoords.z;
              destFrame[fieldIndex++] = Math.sqrt(gpsCartesianCoords.x * gpsCartesianCoords.x + gpsCartesianCoords.z * gpsCartesianCoords.z);
            } else {
              destFrame[fieldIndex++] = 0;
              destFrame[fieldIndex++] = 0;
              destFrame[fieldIndex++] = 0;
              destFrame[fieldIndex++] = 0;
            }
          }

          // Remove empty fields at the end
          destFrame.splice(fieldIndex);
        }
      }
    }
  }

  /**
   * Add timestamps to events that getChunksInRange was unable to compute, because at the time it had trailing
   * events in its chunk array but no next-chunk to take the times from for those events.
   *
   * Set processLastChunk to true if the last chunk of this array is the final chunk in the file.
   */
  function addMissingEventTimes(chunks, processLastChunk) {
    /*
     * If we're at the end of the file then we will compute event times for the last chunk, otherwise we'll
     * wait until we have the next chunk to fill in times for this last chunk.
     */
    let endChunk = processLastChunk ? chunks.length : chunks.length - 1;

    for (let i = 0; i < endChunk; i++) {
      let chunk = chunks[i];

      if (chunk.needsEventTimes) {
        // What is the time of the next frame after the chunk with the trailing events? We'll use that for the event times
        var nextTime;

        if (i + 1 < chunks.length) {
          let nextChunk = chunks[i + 1];

          nextTime =
            nextChunk.frames[0][
              FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME
            ];
        } else {
          //Otherwise we're at the end of the log so assume this event was logged sometime after the final frame
          nextTime =
            chunk.frames[chunk.frames.length - 1][
              FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME
            ];
        }

        for (let j = chunk.events.length - 1; j >= 0; j--) {
          if (chunk.events[j].time === undefined) {
            chunk.events[j].time = nextTime;
          } else {
            // All events with missing timestamps should appear at the end of the chunk, so we're done
            break;
          }
        }

        delete chunk.needsEventTimes;
      }
    }
  }

  /*
   * Double check that the indexes of each chunk in the array are in increasing order (bugcheck).
   */
  function verifyChunkIndexes(chunks) {
    // Uncomment for debugging...
    /*
        for (var i = 0; i < chunks.length - 1; i++) {
            if (chunks[i].index + 1 != chunks[i+1].index) {
                console.log("Bad chunk index, bug in chunk caching");
            }
        }*/
  }

  /**
   * Get an array of chunk data which has been smoothed by the previously-configured smoothing settings. The frames
   * in the chunks will at least span the range given by [startTime...endTime].
   */
  this.getSmoothedChunksInTimeRange = function (startTime, endTime) {
    let sourceChunks,
      resultChunks,
      chunkAlreadyDone,
      allDone,
      timeFieldIndex = FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME;

    //if (maxSmoothing == 0) // TODO We can't bail early because we do things like add fields to the chunks at the end
    //    return this.getChunksInTimeRange(startTime, endTime);

    let /*
       * Ensure that the range that the caller asked for can be fully smoothed by expanding the request
       * for source chunks on either side of the range asked for (to smooth the chunks on the edges, we
       * need to be able to see their neighbors)
       */
      leadingROChunks = 1,
      trailingROChunks = 1,
      startIndex =
        binarySearchOrPrevious(
          iframeDirectory.times,
          startTime - maxSmoothing
        ) - leadingROChunks,
      endIndex =
        binarySearchOrNext(iframeDirectory.times, endTime + maxSmoothing) +
        trailingROChunks;

    /*
     * If our expanded source chunk range exceeds the actual source chunks available, trim down our leadingROChunks
     * and trailingROChunks to match (i.e. we are allowed to smooth the first and last chunks of the file despite
     * there not being a chunk past them to smooth against on one side).
     */
    if (startIndex < 0) {
      leadingROChunks += startIndex;
      startIndex = 0;
    }

    if (endIndex > iframeDirectory.offsets.length - 1) {
      trailingROChunks -= endIndex - (iframeDirectory.offsets.length - 1);
      endIndex = iframeDirectory.offsets.length - 1;
    }

    sourceChunks = getChunksInIndexRange(startIndex, endIndex);

    verifyChunkIndexes(sourceChunks);

    //Create an independent copy of the raw frame data to smooth out:
    resultChunks = new Array(
      sourceChunks.length - leadingROChunks - trailingROChunks
    );
    chunkAlreadyDone = new Array(sourceChunks.length);

    allDone = true;

    //Don't smooth the edge chunks since they can't be fully smoothed
    for (
      let i = leadingROChunks;
      i < sourceChunks.length - trailingROChunks;
      i++
    ) {
      let sourceChunk = sourceChunks[i],
        resultChunk = smoothedCache.get(sourceChunk.index);

      chunkAlreadyDone[i] = resultChunk ? true : false;

      //If we haven't already smoothed this chunk
      if (!chunkAlreadyDone[i]) {
        allDone = false;

        resultChunk = smoothedCache.recycle();

        if (resultChunk) {
          //Reuse the memory from the expired chunk to reduce garbage
          resultChunk.index = sourceChunk.index;
          resultChunk.frames.length = sourceChunk.frames.length;
          resultChunk.gapStartsHere = sourceChunk.gapStartsHere;
          resultChunk.events = sourceChunk.events;

          //Copy frames onto the expired chunk:
          for (var j = 0; j < resultChunk.frames.length; j++) {
            if (resultChunk.frames[j]) {
              //Copy on top of the recycled array:
              resultChunk.frames[j].length = sourceChunk.frames[j].length;

              for (let k = 0; k < sourceChunk.frames[j].length; k++) {
                resultChunk.frames[j][k] = sourceChunk.frames[j][k];
              }
            } else {
              //Allocate a new copy of the raw array:
              resultChunk.frames[j] = sourceChunk.frames[j].slice(0);
            }
          }
        } else {
          //Allocate a new chunk
          resultChunk = {
            index: sourceChunk.index,
            frames: new Array(sourceChunk.frames.length),
            gapStartsHere: sourceChunk.gapStartsHere,
            events: sourceChunk.events,
          };

          for (var j = 0; j < resultChunk.frames.length; j++) {
            resultChunk.frames[j] = sourceChunk.frames[j].slice(0);
          }
        }

        smoothedCache.add(resultChunk.index, resultChunk);
      }

      resultChunks[i - leadingROChunks] = resultChunk;
    }

    if (!allDone) {
      for (let fieldIndex in fieldSmoothing) {
        var radius = fieldSmoothing[fieldIndex],
          //The position we're currently computing the smoothed value for:
          centerChunkIndex,
          centerFrameIndex;

        //The outer two loops are used to begin a new partition to smooth within
        // Don't bother to smooth the first and last source chunks, since we can't smooth them completely
        mainLoop: for (
          centerChunkIndex = leadingROChunks;
          centerChunkIndex < sourceChunks.length - trailingROChunks;
          centerChunkIndex++
        ) {
          if (chunkAlreadyDone[centerChunkIndex]) continue;

          for (
            centerFrameIndex = 0;
            centerFrameIndex < sourceChunks[centerChunkIndex].frames.length;

          ) {
            var //Current beginning & end of the smoothing window:
              leftChunkIndex = centerChunkIndex,
              leftFrameIndex = centerFrameIndex,
              rightChunkIndex,
              rightFrameIndex,
              /*
               * The end of the current partition to be smoothed (exclusive, so the partition doesn't
               * contain the value pointed to by chunks[endChunkIndex][endFrameIndex]).
               *
               * We'll refine this guess for the end of the partition later if we find discontinuities:
               */
              endChunkIndex = sourceChunks.length - 1 - trailingROChunks,
              endFrameIndex = sourceChunks[endChunkIndex].frames.length,
              partitionEnded = false,
              accumulator = 0,
              valuesInHistory = 0,
              centerTime =
                sourceChunks[centerChunkIndex].frames[centerFrameIndex][
                  timeFieldIndex
                ];

            /*
             * This may not be the left edge of a partition, we may just have skipped the previous chunk due to
             * it having already been cached. If so, we can read the values from the previous chunk in order
             * to prime our history window. Move the left&right indexes to the left so the main loop will read
             * those earlier values.
             */
            while (
              leftFrameIndex > 0 ||
              (leftFrameIndex === 0 && leftChunkIndex > 0)
            ) {
              let oldleftChunkIndex = leftChunkIndex,
                oldleftFrameIndex = leftFrameIndex;

              //Try moving it left
              if (leftFrameIndex === 0) {
                leftChunkIndex--;
                leftFrameIndex = sourceChunks[leftChunkIndex].frames.length - 1;
              } else {
                leftFrameIndex--;
              }

              if (
                sourceChunks[leftChunkIndex].gapStartsHere[leftFrameIndex] ||
                sourceChunks[leftChunkIndex].frames[leftFrameIndex][
                  timeFieldIndex
                ] <
                  centerTime - radius
              ) {
                //We moved the left index one step too far, shift it back
                leftChunkIndex = oldleftChunkIndex;
                leftFrameIndex = oldleftFrameIndex;

                break;
              }
            }

            rightChunkIndex = leftChunkIndex;
            rightFrameIndex = leftFrameIndex;

            //The main loop, where we march our smoothing window along until we exhaust this partition
            while (
              centerChunkIndex < endChunkIndex ||
              (centerChunkIndex == endChunkIndex &&
                centerFrameIndex < endFrameIndex)
            ) {
              // Old values fall out of the window
              while (
                sourceChunks[leftChunkIndex].frames[leftFrameIndex][
                  timeFieldIndex
                ] <
                centerTime - radius
              ) {
                accumulator -=
                  sourceChunks[leftChunkIndex].frames[leftFrameIndex][
                    fieldIndex
                  ];
                valuesInHistory--;

                leftFrameIndex++;
                if (
                  leftFrameIndex == sourceChunks[leftChunkIndex].frames.length
                ) {
                  leftFrameIndex = 0;
                  leftChunkIndex++;
                }
              }

              //New values are added to the window
              while (
                !partitionEnded &&
                sourceChunks[rightChunkIndex].frames[rightFrameIndex][
                  timeFieldIndex
                ] <=
                  centerTime + radius
              ) {
                accumulator +=
                  sourceChunks[rightChunkIndex].frames[rightFrameIndex][
                    fieldIndex
                  ];
                valuesInHistory++;

                //If there is a discontinuity after this point, stop trying to add further values
                if (
                  sourceChunks[rightChunkIndex].gapStartsHere[rightFrameIndex]
                ) {
                  partitionEnded = true;
                }

                //Advance the right index onward since we read a value
                rightFrameIndex++;
                if (
                  rightFrameIndex == sourceChunks[rightChunkIndex].frames.length
                ) {
                  rightFrameIndex = 0;
                  rightChunkIndex++;

                  if (rightChunkIndex == sourceChunks.length) {
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
              resultChunks[centerChunkIndex - leadingROChunks].frames[
                centerFrameIndex
              ][fieldIndex] = Math.round(accumulator / valuesInHistory);

              // Advance the center so we can start computing the next value
              centerFrameIndex++;
              if (
                centerFrameIndex == sourceChunks[centerChunkIndex].frames.length
              ) {
                centerFrameIndex = 0;
                centerChunkIndex++;

                //Is the next chunk already cached? Then we have nothing to write into there
                if (chunkAlreadyDone[centerChunkIndex]) continue mainLoop;

                //Have we covered the whole ROI?
                if (centerChunkIndex == sourceChunks.length - trailingROChunks)
                  break mainLoop;
              }

              centerTime =
                sourceChunks[centerChunkIndex].frames[centerFrameIndex][
                  timeFieldIndex
                ];
            }
          }
        }
      }
    }

    addMissingEventTimes(sourceChunks, trailingROChunks === 0);

    verifyChunkIndexes(sourceChunks);
    verifyChunkIndexes(resultChunks);

    return resultChunks;
  };

  /**
   * Attempt to open the log with the given index, returning true on success.
   */
  this.openLog = function (index) {
    if (this.getLogError(index)) {
      return false;
    }

    logIndex = index;

    chunkCache.clear();
    smoothedCache.clear();

    iframeDirectory = logIndexes.getIntraframeDirectory(index);

    parser.parseHeader(
      logIndexes.getLogBeginOffset(index),
      logIndexes.getLogBeginOffset(index + 1)
    );

    // Hide the header button if we are not using betaflight
    switch (this.getSysConfig().firmwareType) {
      case FIRMWARE_TYPE_BETAFLIGHT:
      case FIRMWARE_TYPE_INAV:
        $(".open-header-dialog").show();
        break;

      default:
        $(".open-header-dialog").hide();
        break;
    }

    buildFieldNames();

    estimateNumMotors();
    estimateNumCells();

    return true;
  };

  this.hasGpsData = function () {
    return this.getStats()?.frame?.G ? true : false;
  };

  this.getMinMaxForFieldDuringAllTime = function (field_name) {
    let stats = this.getStats(),
      min = Number.MAX_VALUE,
      max = -Number.MAX_VALUE;

    let fieldIndex = this.getMainFieldIndexByName(field_name),
      fieldStat = fieldIndex !== undefined ? stats.field[fieldIndex] : false;

    if (fieldStat) {
      min = Math.min(min, fieldStat.min);
      max = Math.max(max, fieldStat.max);
    } else {
      const mm = this.getMinMaxForFieldDuringTimeInterval(
        field_name,
        this.getMinTime(),
        this.getMaxTime()
      );
      if (mm !== undefined) {
        min = Math.min(mm.min, min);
        max = Math.max(mm.max, max);
      }
    }

    return { min: min, max: max };
  };

  /**
   * Function to compute of min and max curve values during time interval.
   * @param field_name String: Curve fields name.
   * @param start_time Integer: The interval start time .
   * @end_time start_time Integer: The interval end time .
   * @returns {min: MinValue, max: MaxValue} if success, or {min: Number.MAX_VALUE, max: Number.MAX_VALUE} if error
   */
  this.getMinMaxForFieldDuringTimeInterval = function (
    field_name,
    start_time,
    end_time
  ) {
    let chunks = this.getSmoothedChunksInTimeRange(start_time, end_time);
    let startFrameIndex;
    let minValue = Number.MAX_VALUE,
      maxValue = -Number.MAX_VALUE;

    const fieldIndex = this.getMainFieldIndexByName(field_name);
    if (chunks.length == 0 || fieldIndex == undefined) return undefined;

    //Find the first sample that lies inside the window
    for (
      startFrameIndex = 0;
      startFrameIndex < chunks[0].frames.length;
      startFrameIndex++
    ) {
      if (
        chunks[0].frames[startFrameIndex][
          FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME
        ] >= start_time
      ) {
        break;
      }
    }

    // Pick the sample before that to begin plotting from
    if (startFrameIndex > 0) startFrameIndex--;

    let frameIndex = startFrameIndex;
    findingLoop: for (
      let chunkIndex = 0;
      chunkIndex < chunks.length;
      chunkIndex++
    ) {
      const chunk = chunks[chunkIndex];
      for (; frameIndex < chunk.frames.length; frameIndex++) {
        const fieldValue = chunk.frames[frameIndex][fieldIndex];
        const frameTime =
          chunk.frames[frameIndex][
            FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME
          ];
        minValue = Math.min(minValue, fieldValue);
        maxValue = Math.max(maxValue, fieldValue);
        if (frameTime > end_time) break findingLoop;
      }
      frameIndex = 0;
    }
    return {
      min: minValue,
      max: maxValue,
    };
  };

  this.getCurrentLogRowsCount = function () {
    const stats = this.getStats(this.getLogIndex());
    return stats.frame["I"].validCount + stats.frame["P"].validCount;
  };
}

FlightLog.prototype.accRawToGs = function (value) {
  return value / this.getSysConfig().acc_1G;
};

FlightLog.prototype.gyroRawToDegreesPerSecond = function (value) {
  return (
    ((this.getSysConfig().gyroScale * 1000000) / (Math.PI / 180.0)) * value
  );
};

/***

    The rcCommandToDegreesPerSecond function is betaflight version specific
    due to the coding improvements from v2.8.0 onwards

**/

// Convert rcCommand to degrees per second
FlightLog.prototype.rcCommandRawToDegreesPerSecond = function (
  value,
  axis,
  currentFlightMode
) {
  let sysConfig = this.getSysConfig();

  if (firmwareGreaterOrEqual(sysConfig, "3.0.0", "2.0.0")) {
    const RC_RATE_INCREMENTAL = 14.54;
    const RC_EXPO_POWER = 3;

    let rcInput;
    var that = this;

    let calculateSetpointRate = function (axis, rc) {
      let rcCommandf = rc / 500.0;
      let rcCommandfAbs = Math.abs(rcCommandf);

      if (sysConfig["rc_expo"][axis]) {
        let expof = sysConfig["rc_expo"][axis] / 100;
        rcCommandf =
          rcCommandf * Math.pow(rcCommandfAbs, RC_EXPO_POWER) * expof +
          rcCommandf * (1 - expof);
      }

      let rcRate = sysConfig["rc_rates"][axis] / 100.0;
      if (rcRate > 2.0) {
        rcRate += RC_RATE_INCREMENTAL * (rcRate - 2.0);
      }

      let angleRate = 200.0 * rcRate * rcCommandf;
      if (sysConfig.rates[axis]) {
        let rcSuperfactor =
          1.0 /
          constrain(
            1.0 - rcCommandfAbs * (sysConfig.rates[axis] / 100.0),
            0.01,
            1.0
          );
        angleRate *= rcSuperfactor;
      }

      /*
            if (debugMode == DEBUG_ANGLERATE) {
                debug[axis] = angleRate;
            }
            */

      let limit = sysConfig["rate_limits"][axis];
      if (sysConfig.pidController == 0 || limit == null) {
        /* LEGACY */
        return constrain(angleRate * 4.1, -8190.0, 8190.0) >> 2; // Rate limit protection
      } else {
        return constrain(angleRate, -1.0 * limit, limit); // Rate limit protection (deg/sec)
      }
    };

    return calculateSetpointRate(axis, value);
  } else if (firmwareGreaterOrEqual(sysConfig, "2.8.0")) {
    var that = this;

    let isSuperExpoActive = function () {
      let FEATURE_SUPEREXPO_RATES = 1 << 23;

      return sysConfig.features & FEATURE_SUPEREXPO_RATES;
    };

    let calculateRate = function (value, axis) {
      let angleRate;

      if (isSuperExpoActive()) {
        let rcFactor =
          axis === AXIS.YAW
            ? Math.abs(value) /
              (500.0 * (validate(sysConfig.rc_rates[2], 100) / 100.0))
            : Math.abs(value) /
              (500.0 * (validate(sysConfig.rc_rates[0], 100) / 100.0));
        rcFactor =
          1.0 /
          constrain(
            1.0 - rcFactor * (validate(sysConfig.rates[axis], 100) / 100.0),
            0.01,
            1.0
          );

        angleRate = rcFactor * ((27 * value) / 16.0);
      } else {
        angleRate =
          ((validate(sysConfig.rates[axis], 100) + 27) * value) / 16.0;
      }

      return constrain(angleRate, -8190.0, 8190.0); // Rate limit protection
    };

    return calculateRate(value, axis) >> 2; // the shift by 2 is to counterbalance the divide by 4 that occurs on the gyro to calculate the error
  } else {
    // earlier version of betaflight

    var that = this;

    let calculateExpoPlus = function (value, axis) {
      let propFactor;
      let superExpoFactor;

      if (axis == AXIS.YAW && !that.getSysConfig().superExpoYawMode) {
        propFactor = 1.0;
      } else {
        superExpoFactor =
          axis == AXIS.YAW
            ? that.getSysConfig().superExpoFactorYaw
            : that.getSysConfig().superExpoFactor;
        propFactor =
          1.0 - (superExpoFactor / 100.0) * (Math.abs(value) / 500.0);
      }

      return propFactor;
    };

    let superExpoFactor = 1.0 / calculateExpoPlus(value, axis);

    if (axis === AXIS.YAW /*YAW*/) {
      if (
        sysConfig.superExpoYawMode == SUPER_EXPO_YAW.ON &&
        currentFlightMode == null
      )
        superExpoFactor = 1.0; // If we don't know the flight mode, then reset the super expo mode.
      if (
        sysConfig.superExpoYawMode == SUPER_EXPO_YAW.ALWAYS ||
        (sysConfig.superExpoYawMode == SUPER_EXPO_YAW.ON &&
          this.getFlightMode(currentFlightMode).SuperExpo)
      ) {
        return (
          (superExpoFactor * ((sysConfig.rates[AXIS.YAW] + 47) * value)) >> 7
        );
      } else {
        return ((sysConfig.rates[AXIS.YAW] + 47) * value) >> 7;
      }
    } else {
      /*ROLL or PITCH */
      if (currentFlightMode == null) superExpoFactor = 1.0; // If we don't know the flight mode, then reset the super expo mode.
      return (
        (superExpoFactor *
          (((axis === AXIS.ROLL
            ? sysConfig.rates[AXIS.ROLL]
            : sysConfig.rates[AXIS.PITCH]) +
            27) *
            value)) >>
        6
      );
    }
  }
};

FlightLog.prototype.rcCommandRawToThrottle = function (value) {
  // Throttle displayed as percentage
  return Math.min(
    Math.max(
      ((value - this.getSysConfig().minthrottle) /
        (this.getSysConfig().maxthrottle - this.getSysConfig().minthrottle)) *
        100.0,
      0.0
    ),
    100.0
  );
};

// rcCommandThrottle back transform function
FlightLog.prototype.ThrottleTorcCommandRaw = function (value) {
  // Throttle displayed as percentage
  return (
    (value / 100) *
      (this.getSysConfig().maxthrottle - this.getSysConfig().minthrottle) +
    this.getSysConfig().minthrottle
  );
};

FlightLog.prototype.rcMotorRawToPctPhysical = function (value) {
  // Motor displayed as percentage
  let motorPct;
  if (this.isDigitalProtocol()) {
    motorPct = ((value - DSHOT_MIN_VALUE) / DSHOT_RANGE) * 100;
  } else {
    const MAX_ANALOG_VALUE = this.getSysConfig().maxthrottle;
    const MIN_ANALOG_VALUE = this.getSysConfig().minthrottle;
    const ANALOG_RANGE = MAX_ANALOG_VALUE - MIN_ANALOG_VALUE;
    motorPct = ((value - MIN_ANALOG_VALUE) / ANALOG_RANGE) * 100;
  }
  return Math.min(Math.max(motorPct, 0.0), 100.0);
};
// rcMotorRaw back transform function
FlightLog.prototype.PctPhysicalTorcMotorRaw = function (value) {
  // Motor displayed as percentage
  let motorRaw;
  if (this.isDigitalProtocol()) {
    motorRaw = (value / 100) * DSHOT_RANGE + DSHOT_MIN_VALUE;
  } else {
    const MAX_ANALOG_VALUE = this.getSysConfig().maxthrottle;
    const MIN_ANALOG_VALUE = this.getSysConfig().minthrottle;
    const ANALOG_RANGE = MAX_ANALOG_VALUE - MIN_ANALOG_VALUE;
    motorRaw = (value / 100) * ANALOG_RANGE + MIN_ANALOG_VALUE;
  }
  return motorRaw;
};

FlightLog.prototype.isDigitalProtocol = function () {
  let digitalProtocol;
  switch (FAST_PROTOCOL[this.getSysConfig().fast_pwm_protocol]) {
    case "PWM":
    case "ONESHOT125":
    case "ONESHOT42":
    case "MULTISHOT":
    case "BRUSHED":
      digitalProtocol = false;
      break;
    case "DSHOT150":
    case "DSHOT300":
    case "DSHOT600":
    case "DSHOT1200":
    case "PROSHOT1000":
    default:
      digitalProtocol = true;
      break;
  }
  return digitalProtocol;
};

FlightLog.prototype.getPIDPercentage = function (value) {
  // PID components and outputs are displayed as percentage (raw value is 0-1000)
  return value / 10.0;
};

FlightLog.prototype.getReferenceVoltageMillivolts = function () {
  if (
    this.getSysConfig().firmwareType == FIRMWARE_TYPE_BETAFLIGHT &&
    semver.gte(this.getSysConfig().firmwareVersion, "4.0.0")
  ) {
    return this.getSysConfig().vbatref * 10;
  } else if (
    (this.getSysConfig().firmwareType == FIRMWARE_TYPE_BETAFLIGHT &&
      semver.gte(this.getSysConfig().firmwareVersion, "3.1.0")) ||
    (this.getSysConfig().firmwareType == FIRMWARE_TYPE_CLEANFLIGHT &&
      semver.gte(this.getSysConfig().firmwareVersion, "2.0.0"))
  ) {
    return this.getSysConfig().vbatref * 100;
  } else {
    return this.vbatADCToMillivolts(this.getSysConfig().vbatref);
  }
};

FlightLog.prototype.vbatADCToMillivolts = function (vbatADC) {
  let ADCVREF = 33;

  // ADC is 12 bit (i.e. max 0xFFF), voltage reference is 3.3V, vbatscale is premultiplied by 100
  return (vbatADC * ADCVREF * 10 * this.getSysConfig().vbatscale) / 0xfff;
};

FlightLog.prototype.amperageADCToMillivolts = function (amperageADC) {
  let ADCVREF = 33,
    millivolts = (amperageADC * ADCVREF * 100) / 4095;

  millivolts -= this.getSysConfig().currentMeterOffset;

  return (millivolts * 10000) / this.getSysConfig().currentMeterScale;
};

FlightLog.prototype.getFlightMode = function (currentFlightMode) {
  return {
    Arm: (currentFlightMode & (1 << 0)) != 0,
    Angle: (currentFlightMode & (1 << 1)) != 0,
    Horizon: (currentFlightMode & (1 << 2)) != 0,
    Baro: (currentFlightMode & (1 << 3)) != 0,
    AntiGravity: (currentFlightMode & (1 << 4)) != 0,
    Headfree: (currentFlightMode & (1 << 5)) != 0,
    HeadAdj: (currentFlightMode & (1 << 6)) != 0,
    CamStab: (currentFlightMode & (1 << 7)) != 0,
    CamTrig: (currentFlightMode & (1 << 8)) != 0,
    GPSHome: (currentFlightMode & (1 << 9)) != 0,
    GPSHold: (currentFlightMode & (1 << 10)) != 0,
    Passthrough: (currentFlightMode & (1 << 11)) != 0,
    Beeper: (currentFlightMode & (1 << 12)) != 0,
    LEDMax: (currentFlightMode & (1 << 13)) != 0,
    LEDLow: (currentFlightMode & (1 << 14)) != 0,
    LLights: (currentFlightMode & (1 << 15)) != 0,
    Calib: (currentFlightMode & (1 << 16)) != 0,
    GOV: (currentFlightMode & (1 << 17)) != 0,
    OSD: (currentFlightMode & (1 << 18)) != 0,
    Telemetry: (currentFlightMode & (1 << 19)) != 0,
    GTune: (currentFlightMode & (1 << 20)) != 0,
    Sonar: (currentFlightMode & (1 << 21)) != 0,
    Servo1: (currentFlightMode & (1 << 22)) != 0,
    Servo2: (currentFlightMode & (1 << 23)) != 0,
    Servo3: (currentFlightMode & (1 << 24)) != 0,
    Blackbox: (currentFlightMode & (1 << 25)) != 0,
    Failsafe: (currentFlightMode & (1 << 26)) != 0,
    Airmode: (currentFlightMode & (1 << 27)) != 0,
    SuperExpo: (currentFlightMode & (1 << 28)) != 0,
    _3DDisableSwitch: (currentFlightMode & (1 << 29)) != 0,
    CheckboxItemCount: (currentFlightMode & (1 << 30)) != 0,
  };
};

FlightLog.prototype.getFeatures = function (enabledFeatures) {
  return {
    RX_PPM: (enabledFeatures & (1 << 0)) != 0,
    VBAT: (enabledFeatures & (1 << 1)) != 0,
    INFLIGHT_ACC_CAL: (enabledFeatures & (1 << 2)) != 0,
    RX_SERIAL: (enabledFeatures & (1 << 3)) != 0,
    MOTOR_STOP: (enabledFeatures & (1 << 4)) != 0,
    SERVO_TILT: (enabledFeatures & (1 << 5)) != 0,
    SOFTSERIAL: (enabledFeatures & (1 << 6)) != 0,
    GPS: (enabledFeatures & (1 << 7)) != 0,
    FAILSAFE: (enabledFeatures & (1 << 8)) != 0,
    SONAR: (enabledFeatures & (1 << 9)) != 0,
    TELEMETRY: (enabledFeatures & (1 << 10)) != 0,
    CURRENT_METER: (enabledFeatures & (1 << 11)) != 0,
    _3D: (enabledFeatures & (1 << 12)) != 0,
    RX_PARALLEL_PWM: (enabledFeatures & (1 << 13)) != 0,
    RX_MSP: (enabledFeatures & (1 << 14)) != 0,
    RSSI_ADC: (enabledFeatures & (1 << 15)) != 0,
    LED_STRIP: (enabledFeatures & (1 << 16)) != 0,
    DISPLAY: (enabledFeatures & (1 << 17)) != 0,
    ONESHOT125: (enabledFeatures & (1 << 18)) != 0,
    BLACKBOX: (enabledFeatures & (1 << 19)) != 0,
    CHANNEL_FORWARDING: (enabledFeatures & (1 << 20)) != 0,
    TRANSPONDER: (enabledFeatures & (1 << 21)) != 0,
    AIRMODE: (enabledFeatures & (1 << 22)) != 0,
    SUPEREXPO_RATES: (enabledFeatures & (1 << 23)) != 0,
    ANTI_GRAVITY: (enabledFeatures & (1 << 24)) != 0,
  };
};

FlightLog.prototype.isFieldDisabled = function () {
  const disabledFields = this.getSysConfig().fields_disabled_mask;
  return {
    PID: (disabledFields & (1 << 0)) !== 0,
    RC_COMMANDS: (disabledFields & (1 << 1)) !== 0,
    SETPOINT: (disabledFields & (1 << 2)) !== 0,
    BATTERY: (disabledFields & (1 << 3)) !== 0,
    MAGNETOMETER: (disabledFields & (1 << 4)) !== 0,
    ALTITUDE: (disabledFields & (1 << 5)) !== 0,
    RSSI: (disabledFields & (1 << 6)) !== 0,
    GYRO: (disabledFields & (1 << 7)) !== 0,
    ACC: (disabledFields & (1 << 8)) !== 0,
    DEBUG: (disabledFields & (1 << 9)) !== 0,
    MOTORS: (disabledFields & (1 << 10)) !== 0,
    GPS: (disabledFields & (1 << 11)) !== 0,
    RPM: (disabledFields & (1 << 12)) !== 0,
    GYROUNFILT: (disabledFields & (1 << 13)) !== 0,
  };
};

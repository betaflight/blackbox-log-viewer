import { FlightLogFieldPresenter } from "./flightlog_fields_presenter";

const
  FIELD_THROTTLE_NAME = ['rcCommands[3]'],
  FIELD_RPM_NAMES = [
  "eRPM[0]",
  "eRPM[1]",
  "eRPM[2]",
  "eRPM[3]",
  "eRPM[4]",
  "eRPM[5]",
  "eRPM[6]",
  "eRPM[7]",
  ],
  FREQ_VS_THR_CHUNK_TIME_MS = 300,
  FREQ_VS_THR_WINDOW_DIVISOR = 6,
  MAX_ANALYSER_LENGTH = 300 * 1000 * 1000, // 5min
  NUM_VS_BINS = 100,
  WARNING_RATE_DIFFERENCE = 0.05,
  MAX_RPM_HZ_VALUE = 800,
  MAX_RPM_AXIS_GAP = 1.05,
  MIN_FFT_POINTS = 32; // Minimum points for a meaningful FFT


export const GraphSpectrumCalc = {
  _analyserTimeRange : {
      in: 0,
      out: MAX_ANALYSER_LENGTH,
  },
  _blackBoxRate : 0,
  _dataBuffer : {
      fieldIndex: 0,
      curve: 0,
      fieldName: null,
  },
  _flightLog : null,
  _sysConfig : null,
  _motorPoles : null,

  _getLargestPowerOfTwoLeq: function(n) {
    if (n < 1) return 0;
    let p = 1;
    while ((p * 2) <= n) {
        p *= 2;
    }
    return p;
  },

  _getNextPowerOfTwo: function(n) {
    if (n <= 0) return 1; // Return 1 for non-positive inputs, MIN_FFT_POINTS check will handle later.
    let p = 1;
    while (p < n) {
        p *= 2;
    }
    return p;
  },
};

GraphSpectrumCalc.initialize = function(flightLog, sysConfig) {

  this._flightLog = flightLog;
  this._sysConfig = sysConfig;

  const gyroRate = (1000000 / this._sysConfig['looptime']).toFixed(0);
  this._motorPoles = flightLog.getSysConfig()['motor_poles'];
  this._blackBoxRate = gyroRate * this._sysConfig['frameIntervalPNum'] / this._sysConfig['frameIntervalPDenom'];
  if (this._sysConfig.pid_process_denom != null) {
    this._blackBoxRate = this._blackBoxRate / this._sysConfig.pid_process_denom;
  }
  this._BetaflightRate = this._blackBoxRate;

  const actualLoggedTime = this._flightLog.getActualLoggedTime(),
        length = flightLog.getCurrentLogRowsCount();

  this._actualeRate = 1e6 * length / actualLoggedTime;
  if (Math.abs(this._BetaflightRate - this._actualeRate) / this._actualeRate > WARNING_RATE_DIFFERENCE)
      this._blackBoxRate = Math.round(this._actualeRate);

  if (this._BetaflightRate !== this._blackBoxRate) {
    $('.actual-lograte').text(this._actualeRate.toFixed(0) + "/" + this._BetaflightRate.toFixed(0)+"Hz");
    return {
      actualRate: this._actualeRate,
      betaflightRate: this._BetaflightRate,
    };
  } else {
    $('.actual-lograte').text("");
  }

  return undefined;
};

GraphSpectrumCalc.setInTime = function(time) {
  this._analyserTimeRange.in = time;
  return this._analyserTimeRange.in;
};

GraphSpectrumCalc.setOutTime = function(time) {
  if ((time - this._analyserTimeRange.in) <= MAX_ANALYSER_LENGTH) {
    this._analyserTimeRange.out = time;
  } else {
    this._analyserTimeRange.out = this._analyserTimeRange.in + MAX_ANALYSER_LENGTH;
  }
  return this._analyserTimeRange.out;
};

GraphSpectrumCalc.setDataBuffer = function(dataBuffer) {
  this._dataBuffer = dataBuffer;
  return undefined;
};

GraphSpectrumCalc.dataLoadFrequency = function() {

  const flightSamples = this._getFlightSamplesFreq();

  // Zero-fill to the next power of two
  const targetFftLength = this._getNextPowerOfTwo(flightSamples.count);

  if (targetFftLength < MIN_FFT_POINTS || flightSamples.count === 0) { // Also check flightSamples.count to avoid FFT on 0 samples padded to MIN_FFT_POINTS
    console.warn(`Target FFT length ${targetFftLength} (from ${flightSamples.count} samples) is too small (min ${MIN_FFT_POINTS}). Skipping Frequency analysis.`);
    return {
        fieldIndex: this._dataBuffer.fieldIndex,
        fieldName: this._dataBuffer.fieldName,
        fftLength: 0,
        fftOutput: new Float64Array(0),
        maxNoiseIdx: 0,
        blackBoxRate: this._blackBoxRate,
    };
  }

  const samplesForFft = new Float64Array(targetFftLength);
  // Copy actual samples, the rest of samplesForFft will be zeros
  samplesForFft.set(flightSamples.samples.slice(0, flightSamples.count));


  if (userSettings.analyserHanning) {
    // Apply Hanning window to the entire (potentially zero-padded) block
    this._hanningWindow(samplesForFft, targetFftLength);
  }

  //calculate fft
  const fftOutput = this._fft(samplesForFft); // samplesForFft has targetFftLength

  // Normalize the result
  // Pass targetFftLength as the length of the data that underwent FFT
  const fftData = this._normalizeFft(fftOutput, targetFftLength);

  return fftData;
};

GraphSpectrumCalc.dataLoadPSD = function(analyserZoomY) {
  const flightSamples = this._getFlightSamplesFreq(false);

  let pointsPerSegment = 512;
  const multipiler = Math.floor(1 / analyserZoomY); // 0. ... 10
  if (multipiler == 0) {
    pointsPerSegment = 256;
  } else if (multipiler > 1) {
    pointsPerSegment *= 2 ** Math.floor(multipiler / 2);
  }
  // Ensure pointsPerSegment does not exceed available samples, then adjust to power of 2
  pointsPerSegment = Math.min(pointsPerSegment, flightSamples.count);
  pointsPerSegment = this._getLargestPowerOfTwoLeq(pointsPerSegment);

  if (pointsPerSegment < MIN_FFT_POINTS) {
      console.warn(`PSD pointsPerSegment ${pointsPerSegment} is too small (min ${MIN_FFT_POINTS}). Skipping PSD analysis.`);
      return {
          fieldIndex: this._dataBuffer.fieldIndex,
          fieldName: this._dataBuffer.fieldName,
          psdLength: 0,
          psdOutput: new Float64Array(0),
          blackBoxRate: this._blackBoxRate,
          minimum: 0,
          maximum: 0,
          maxNoiseIdx: 0,
      };
  }

  const overlapCount = Math.floor(pointsPerSegment / 2);
  // Use all available samples up to flightSamples.count for Welch method
  const samplesForPsd = flightSamples.samples.slice(0, flightSamples.count);
  const psd =  this._psd(samplesForPsd, pointsPerSegment, overlapCount);

  const psdData = {
    fieldIndex   : this._dataBuffer.fieldIndex,
    fieldName  : this._dataBuffer.fieldName,
    psdLength  : psd.psdOutput.length,
    psdOutput  : psd.psdOutput,
    blackBoxRate : this._blackBoxRate,
    minimum: psd.min,
    maximum: psd.max,
    maxNoiseIdx: psd.maxNoiseIdx,
  };
  return psdData;
};

GraphSpectrumCalc._dataLoadFrequencyVsX = function(vsFieldNames, minValue = Infinity, maxValue = -Infinity) {

  const flightSamples = this._getFlightSamplesFreqVsX(vsFieldNames, minValue, maxValue);

  // Number of actual samples desired for each FFT chunk, based on time
  const desiredSamplesPerChunk = Math.floor(this._blackBoxRate * FREQ_VS_THR_CHUNK_TIME_MS / 1000);
  // FFT length will be the next power of two from desiredSamplesPerChunk
  const fftChunkLength = this._getNextPowerOfTwo(desiredSamplesPerChunk);


  if (fftChunkLength < MIN_FFT_POINTS || desiredSamplesPerChunk === 0) {
    console.warn(`FFT chunk length ${fftChunkLength} (from ${desiredSamplesPerChunk} desired samples) for FreqVsX is too small (min ${MIN_FFT_POINTS}). Skipping.`);
    return {
        fieldIndex: this._dataBuffer.fieldIndex,
        fieldName: this._dataBuffer.fieldName,
        fftLength: 0,
        fftOutput: new Array(NUM_VS_BINS).fill(null).map(() => new Float64Array(0)),
        maxNoise: 0,
        blackBoxRate: this._blackBoxRate,
        vsRange: flightSamples.vsRange || { min: 0, max: 0 },
    };
  }

  // Window step for moving window, based on the (padded) FFT chunk length
  const fftChunkWindowStep = Math.round(fftChunkLength / FREQ_VS_THR_WINDOW_DIVISOR);

  let maxNoise = 0; // Stores the maximum amplitude of the fft over all chunks
   // Matrix where each row represents a bin of vs values, and the columns are amplitudes at frequencies
   // The length of rows should match the length of the sliced fftOutput (which is fftChunkLength)
  const matrixFftOutputSums = new Array(NUM_VS_BINS).fill(null).map(() => new Float64Array(fftChunkLength));

  const numberSamplesInBin = new Uint32Array(NUM_VS_BINS); // Number of FFT segments contributing to each vs bin

  const fft = new FFT.complex(fftChunkLength, false); // FFT initialized for padded length

  // Loop through flight samples, taking chunks of 'desiredSamplesPerChunk'
  // The loop must ensure there are enough samples for 'desiredSamplesPerChunk'
  for (let fftChunkStartIndex = 0; (fftChunkStartIndex + desiredSamplesPerChunk) <= flightSamples.count; fftChunkStartIndex += fftChunkWindowStep) {

    const actualSamplesInChunk = flightSamples.samples.slice(fftChunkStartIndex, fftChunkStartIndex + desiredSamplesPerChunk);
    const fftInput = new Float64Array(fftChunkLength); // Prepare input array for FFT (zero-padded)
    fftInput.set(actualSamplesInChunk); // Copy actual samples, rest are zeros

    let fftOutputComplex = new Float64Array(fftChunkLength * 2); // For complex output from FFT.js

    // Hanning window applied to the entire (zero-padded) input block
    if (userSettings.analyserHanning) {
      this._hanningWindow(fftInput, fftChunkLength);
    }

    fft.simple(fftOutputComplex, fftInput, 'real');

    // Calculate proper complex magnitudes.
    const bins = fftChunkLength / 2 + 1;
    const fftOutputProcessed = new Float64Array(bins);
    for (let bin = 0; bin < bins; bin++) {
      const re = fftOutputComplex[2 * bin];
      const im = fftOutputComplex[2 * bin + 1];
      const mag = Math.hypot(re, im);
      fftOutputProcessed[bin] = mag;
      maxNoise = Math.max(maxNoise, mag);
    }

    // Calculate a bin index and add the processed fft values to that bin
    for (const vsValueArray of flightSamples.vsValues) {
      // Calculate average of the VS values over the actual data duration in the chunk
      let sumVsValues = 0;
      for (let indexVs = fftChunkStartIndex; indexVs < fftChunkStartIndex + desiredSamplesPerChunk; indexVs++) {
        sumVsValues += vsValueArray[indexVs];
      }
      const avgVsValue = sumVsValues / desiredSamplesPerChunk; // Average over actual samples

      let vsBinIndex = Math.floor(NUM_VS_BINS * (avgVsValue - flightSamples.minValue) / (flightSamples.maxValue - flightSamples.minValue));
      if (vsBinIndex === NUM_VS_BINS) { vsBinIndex = NUM_VS_BINS - 1; }
      if (vsBinIndex < 0) { vsBinIndex = 0;}
      if (vsBinIndex >=0 && vsBinIndex < NUM_VS_BINS) { // Ensure valid index before accessing
          numberSamplesInBin[vsBinIndex]++;
          for (let i = 0; i < fftOutputProcessed.length; i++) {
            matrixFftOutputSums[vsBinIndex][i] += fftOutputProcessed[i];
          }
      }
    }
  }

  const finalMatrixFftOutput = new Array(NUM_VS_BINS).fill(null).map(() => new Float64Array(fftChunkLength));

  // Average the summed FFT outputs for each bin
  for (let i = 0; i < NUM_VS_BINS; i++) {
    if (numberSamplesInBin[i] > 0) { // Check for > 0 to handle division correctly
      for (let j = 0; j < fftChunkLength; j++) {
        finalMatrixFftOutput[i][j] = matrixFftOutputSums[i][j] / numberSamplesInBin[i];
      }
    } else {
      // If no samples in this bin, finalMatrixFftOutput[i] remains an array of zeros (or fill with null/NaN if preferred)
      // Default Float64Array is zero-filled, which is fine.
    }
  }


  const fftData = {
    fieldIndex   : this._dataBuffer.fieldIndex,
    fieldName  : this._dataBuffer.fieldName,
    fftLength  : fftChunkLength, // This is the length of the (padded) data used for matrix rows
    fftOutput  : finalMatrixFftOutput,
    maxNoise   : maxNoise,
    blackBoxRate : this._blackBoxRate,
    vsRange    : { min: flightSamples.minValue, max: flightSamples.maxValue},
  };

  return fftData;

};

GraphSpectrumCalc.dataLoadFrequencyVsThrottle = function() {
  return this._dataLoadFrequencyVsX(FIELD_THROTTLE_NAME, 0, 100);
};

GraphSpectrumCalc.dataLoadFrequencyVsRpm = function() {
  const fftData = this._dataLoadFrequencyVsX(FIELD_RPM_NAMES, 0);
  fftData.vsRange.max *= 3.333 / this._motorPoles;
  fftData.vsRange.min *= 3.333 / this._motorPoles;
  return fftData;
};

GraphSpectrumCalc.dataLoadPidErrorVsSetpoint = function() {

  // Detect the axis
  let axisIndex;
  if (this._dataBuffer.fieldName.indexOf('[roll]') >= 0) {
    axisIndex = 0;
  } else if (this._dataBuffer.fieldName.indexOf('[pitch]') >= 0) {
    axisIndex = 1;
  } else if (this._dataBuffer.fieldName.indexOf('[yaw]') >= 0) {
    axisIndex = 2;
  }

  const flightSamples = this._getFlightSamplesPidErrorVsSetpoint(axisIndex);

  // Add the total error by absolute position
  const errorBySetpoint =  Array.from({length: flightSamples.maxSetpoint + 1});
  const numberOfSamplesBySetpoint = Array.from({length: flightSamples.maxSetpoint + 1});

  // Initialize
  for (let i = 0; i <= flightSamples.maxSetpoint; i++) {
    errorBySetpoint[i] = 0;
    numberOfSamplesBySetpoint[i] = 0;
  }

  // Sum by position
  for (let i = 0; i < flightSamples.count; i++) {

    const pidErrorValue = Math.abs(flightSamples.piderror[i]);
    const setpointValue = Math.abs(flightSamples.setpoint[i]);

    errorBySetpoint[setpointValue] += pidErrorValue;
    numberOfSamplesBySetpoint[setpointValue]++;
  }

  // Calculate the media and max values
  let maxErrorBySetpoint = 0;
  for (let i = 0; i <= flightSamples.maxSetpoint; i++) {
    if (numberOfSamplesBySetpoint[i] > 0) {
      errorBySetpoint[i] = errorBySetpoint[i] / numberOfSamplesBySetpoint[i];
      if (errorBySetpoint[i] > maxErrorBySetpoint) {
        maxErrorBySetpoint = errorBySetpoint[i];
      }
    } else {
      errorBySetpoint[i] = null;
    }
  }

  return {
    fieldIndex   : this._dataBuffer.fieldIndex,
    fieldName  : this._dataBuffer.fieldName,
    axisName   : FlightLogFieldPresenter.fieldNameToFriendly(`axisError[${axisIndex}]`),
    fftOutput  : errorBySetpoint,
    fftMaxOutput : maxErrorBySetpoint,
  };

};

GraphSpectrumCalc._getFlightChunks = function() {

  let logStart = 0;
  if (this._analyserTimeRange.in) {
    logStart = this._analyserTimeRange.in;
  } else {
    logStart = this._flightLog.getMinTime();
  }

  let logEnd = 0;
  if (this._analyserTimeRange.out) {
    logEnd = this._analyserTimeRange.out;
  } else {
    logEnd = this._flightLog.getMaxTime();
  }

  // Limit size
  logEnd = (logEnd - logStart <= MAX_ANALYSER_LENGTH)? logEnd : logStart + MAX_ANALYSER_LENGTH;

  const allChunks = this._flightLog.getChunksInTimeRange(logStart, logEnd);

  return allChunks;
};

GraphSpectrumCalc._getFlightSamplesFreq = function() {

  const allChunks = this._getFlightChunks();

  const samples = new Float64Array(MAX_ANALYSER_LENGTH / (1000 * 1000) * this._blackBoxRate);

  // Loop through all the samples in the chunks and assign them to a sample array ready to pass to the FFT.
  let samplesCount = 0;
  for (const chunk of allChunks) {
    for (const frame of chunk.frames) {
      samples[samplesCount] = (this._dataBuffer.curve.lookupRaw(frame[this._dataBuffer.fieldIndex]));
      samplesCount++;
    }
  }

  return {
    samples : samples, // Note: This array is oversized, only 'count' elements are valid.
                      // Slicing (e.g., samples.slice(0, samplesCount)) is done by callers.
    count : samplesCount,
  };
};

GraphSpectrumCalc._getVsIndexes = function(vsFieldNames) {
  const fieldIndexes = [];
  for (const fieldName of vsFieldNames) {
    if (Object.hasOwn(this._flightLog.getMainFieldIndexes(), fieldName)) {
      fieldIndexes.push(this._flightLog.getMainFieldIndexByName(fieldName));
    }
  }
  return fieldIndexes;
};

GraphSpectrumCalc._getFlightSamplesFreqVsX = function(vsFieldNames, minValue = Infinity, maxValue = -Infinity) {

  const allChunks = this._getFlightChunks();
  const vsIndexes = this._getVsIndexes(vsFieldNames);

  const samples = new Float64Array(MAX_ANALYSER_LENGTH / (1000 * 1000) * this._blackBoxRate);
  const vsValues = new Array(vsIndexes.length).fill(null).map(() => new Float64Array(MAX_ANALYSER_LENGTH / (1000 * 1000) * this._blackBoxRate));

  let samplesCount = 0;
  for (const chunk of allChunks) {
    for (let frameIndex = 0; frameIndex < chunk.frames.length; frameIndex++) {
      samples[samplesCount] = (this._dataBuffer.curve.lookupRaw(chunk.frames[frameIndex][this._dataBuffer.fieldIndex]));
      for (let i = 0; i < vsIndexes.length; i++) {
        let vsFieldIx = vsIndexes[i];
        let value = chunk.frames[frameIndex][vsFieldIx];
        if (vsFieldNames == FIELD_RPM_NAMES) {
          const maxRPM = MAX_RPM_HZ_VALUE * this._motorPoles / 3.333;
          if (value > maxRPM) {
            value = maxRPM;
          }
          else if (value < 0) {
            value = 0;
          }
        }
        vsValues[i][samplesCount] = value;
      }
      samplesCount++;
    }
  }

  // Calculate min/max for VS values based on actual chunk duration, respecting MIN_FFT_POINTS as a minimum window.
  let samplesPerSegmentForVsAvg = Math.floor(this._blackBoxRate * FREQ_VS_THR_CHUNK_TIME_MS / 1000);
  // Ensure the segment for averaging is not smaller than MIN_FFT_POINTS, if MIN_FFT_POINTS is meaningful.
  if (MIN_FFT_POINTS > 0) {
      samplesPerSegmentForVsAvg = Math.max(samplesPerSegmentForVsAvg, MIN_FFT_POINTS);
  }


  const windowStepForVsAvg = Math.round(samplesPerSegmentForVsAvg / FREQ_VS_THR_WINDOW_DIVISOR);

  if (samplesPerSegmentForVsAvg > 0 && windowStepForVsAvg > 0 && samplesCount >= samplesPerSegmentForVsAvg) {
      for (let segmentStartIndex = 0; segmentStartIndex + samplesPerSegmentForVsAvg <= samplesCount; segmentStartIndex += windowStepForVsAvg) {
        for (const vsValueArray of vsValues) {
          let sumVsValues = 0;
          for (let indexVs = segmentStartIndex; indexVs < segmentStartIndex + samplesPerSegmentForVsAvg; indexVs++) {
            sumVsValues += vsValueArray[indexVs];
          }
          const avgVsValue = sumVsValues / samplesPerSegmentForVsAvg;
          maxValue = Math.max(maxValue, avgVsValue);
          minValue = Math.min(minValue, avgVsValue);
        }
      }
  }


  maxValue *= MAX_RPM_AXIS_GAP;

  if (minValue > maxValue || minValue === Infinity || maxValue === -Infinity || samplesCount === 0) {
    // Fallback if range is invalid or no samples
    minValue = 0;
    if (vsFieldNames === FIELD_THROTTLE_NAME) {
        maxValue = 100;
    } else if (vsFieldNames === FIELD_RPM_NAMES) {
        maxValue = MAX_RPM_HZ_VALUE * this._motorPoles / 3.333 * MAX_RPM_AXIS_GAP;
    } else {
        maxValue = 100; // Default generic max
    }
     if (minValue > maxValue) minValue = 0; // Ensure min <= max
    console.warn("Adjusted FreqVsX range due to invalid calculation or no samples: min=%f, max=%f", minValue, maxValue);
  }

  return {
    samples  : samples, // Note: This array is oversized. Callers should use .slice(0, count)
    vsValues : vsValues, // Note: This array is oversized.
    count  : samplesCount,
    minValue : minValue,
    maxValue : maxValue,
    vsRange: {min: minValue, max: maxValue},
  };
};

GraphSpectrumCalc._getFlightSamplesPidErrorVsSetpoint = function(axisIndex) {

  const allChunks = this._getFlightChunks();

  // Get the PID Error field
  const FIELD_PIDERROR_INDEX = this._flightLog.getMainFieldIndexByName(`axisError[${axisIndex}]`);
  const FIELD_SETPOINT_INDEX = this._flightLog.getMainFieldIndexByName(`setpoint[${axisIndex}]`);

  const piderror = new Int16Array(MAX_ANALYSER_LENGTH / (1000 * 1000) * this._blackBoxRate);
  const setpoint = new Int16Array(MAX_ANALYSER_LENGTH / (1000 * 1000) * this._blackBoxRate);

  // Loop through all the samples in the chunks and assign them to a sample array.
  let samplesCount = 0;
  let maxSetpoint = 0;
  for (const chunk of allChunks) {
    for (const frame of chunk.frames) {
      piderror[samplesCount] = frame[FIELD_PIDERROR_INDEX];
      setpoint[samplesCount] = frame[FIELD_SETPOINT_INDEX];
      if (setpoint[samplesCount] > maxSetpoint) {
        maxSetpoint = setpoint[samplesCount];
      }
      samplesCount++;
    }
  }

  return {
    piderror, // Note: oversized
    setpoint, // Note: oversized
    maxSetpoint,
    count: samplesCount,
  };
};

GraphSpectrumCalc._hanningWindow = function(samples, size) {
  // Expects 'samples' to be an array of at least 'size' length.
  // Modifies 'samples' in-place for the first 'size' elements.
  if (!size) {
    size = samples.length;
  }

  for(let i=0; i < size; i++) {
    samples[i] *= 0.5 * (1-Math.cos((2*Math.PI*i)/(size - 1)));
  }
};

GraphSpectrumCalc._fft  = function(samples, type) {
  // 'samples' is expected to be a Float64Array of power-of-2 length.
  if (!type) {
    type = 'real';
  }

  const fftLength = samples.length;
  // FFT.js complex (Nayuki) for N real inputs produces N/2+1 complex outputs.
  // The output buffer needs to be large enough for this: (fftLength/2 + 1) * 2 floats.
  // A buffer of size fftLength*2 is more than enough.
  const fftOutput = new Float64Array(fftLength * 2);
  const fft = new FFT.complex(fftLength, false);

  fft.simple(fftOutput, samples, type);

  return fftOutput; // Contains (fftLength/2 + 1) complex values, i.e., (fftLength/2 + 1)*2 floats.
};


/**
 * Makes all the values absolute and returns the index of maxFrequency found
 */
GraphSpectrumCalc._normalizeFft = function(fftOutput, fftLength) {
  // fftLength is the length of the original (potentially zero-padded) time-domain signal.
  // fftOutput contains complex FFT results: [Re0, Im0, Re1, Im1, ...].
  // For a real input of fftLength, there are (fftLength/2 + 1) unique complex values.
  const bins = Math.floor(fftLength / 2) + 1;
  const magnitudes = new Float64Array(bins);

  // Calculate magnitudes from complex values
  for (let bin = 0; bin < bins; bin++) {
    const re = fftOutput[2 * bin];
    const im = fftOutput[2 * bin + 1];
    magnitudes[bin] = Math.hypot(re, im);
  }

  // Find max noise after low-end cutoff
  const maxFrequency = (this._blackBoxRate / 2.0);
  // Avoid division by zero if maxFrequency is 0 (e.g. blackBoxRate is 0)
  const noiseLowEndIdx = (maxFrequency > 0) ? Math.floor(100 / maxFrequency * bins) : 0;

  let maxNoiseIdx = 0;
  let maxNoise = 0;

  for (let bin = 0; bin < bins; bin++) {
    // Original logic was > noiseLowEndIdx. If noiseLowEndIdx can be 0, this means all bins are checked.
    // If we want to exclude DC (bin 0) and very low frequencies, the condition should be robust.
    // Assuming noiseLowEndIdx is a valid start index for noise search.
    if (bin > noiseLowEndIdx && magnitudes[bin] > maxNoise) {
      maxNoise = magnitudes[bin];
      maxNoiseIdx = bin;
    }
  }

  // Scale bin index to frequency
  // Avoid division by zero if bins is 1 (e.g. fftLength is 0 or 1)
  const maxNoiseFreq = (bins > 1) ? (maxNoiseIdx / (bins -1) * maxFrequency) : 0;
  // Note: A common scaling is maxNoiseIdx * (blackBoxRate / fftLength).
  // bins-1 corresponds to Nyquist. maxFrequency = blackBoxRate / 2.
  // maxNoiseIdx / (bins-1) * (blackBoxRate/2) = maxNoiseIdx * blackBoxRate / (2*(bins-1))
  // If bins = fftLength/2+1, then 2*(bins-1) = 2*(fftLength/2) = fftLength. So this is consistent.


  return {
    fieldIndex: this._dataBuffer.fieldIndex,
    fieldName: this._dataBuffer.fieldName,
    fftLength: bins,  // Return number of frequency bins (magnitudes)
    fftOutput: magnitudes,  // Return the magnitude spectrum
    maxNoiseIdx: maxNoiseFreq, // This is now a frequency in Hz
    blackBoxRate: this._blackBoxRate,
  };
};

/**
 * Compute PSD for data samples by Welch method follow Python code
 */
GraphSpectrumCalc._psd  = function(samples, pointsPerSegment, overlapCount, scaling = 'density') {
// Compute FFT for samples segments
  const fftOutputSegments = this._fft_segmented(samples, pointsPerSegment, overlapCount);

  if (fftOutputSegments.length === 0 || fftOutputSegments[0].length === 0) {
    return { psdOutput: new Float64Array(0), min: 0, max: 0, maxNoiseIdx: 0 };
  }

  const dataCount = fftOutputSegments[0].length; // Number of magnitude points per segment (N/2+1 typically)
  const segmentsCount = fftOutputSegments.length;
  const psdOutput = new Float64Array(dataCount);

// Compute power scale coef
  let scale = 1;
  if (userSettings.analyserHanning) {
    const window = Array(pointsPerSegment).fill(1); // Create a dummy window array
    this._hanningWindow(window, pointsPerSegment); // Apply Hanning values to it
    if (scaling == 'density') {
      let skSum = 0;
      for (const value of window) {
        skSum += value ** 2;
      }
      scale = (this._blackBoxRate * skSum > 0) ? (1 / (this._blackBoxRate * skSum)) : 1;
    } else if (scaling == 'spectrum') {
      let sum = 0;
      for (const value of window) {
        sum += value;
      }
      scale = (sum ** 2 > 0) ? (1 / sum ** 2) : 1;
    }
  } else { // No Hanning window
      if (scaling == 'density') {
        scale = (this._blackBoxRate * pointsPerSegment > 0) ? (1 / (this._blackBoxRate * pointsPerSegment)) : 1;
      } else if (scaling == 'spectrum') {
        scale = (pointsPerSegment ** 2 > 0) ? (1 / pointsPerSegment ** 2) : 1;
      }
  }


// Compute average for scaled power
  let min = 1e6,
      max = -1e6;

  const maxFrequency = (this._blackBoxRate / 2.0);
  // Avoid division by zero for index calculations
  const noise50HzIdx = (maxFrequency > 0) ? Math.floor(50 / maxFrequency * dataCount) : 0;
  const noise3HzIdx = (maxFrequency > 0) ? Math.floor(3 / maxFrequency * dataCount) : 0;

  let maxNoiseIdxBin = 0;
  let maxNoise = -100; // dB
  for (let i = 0; i < dataCount; i++) {
    psdOutput[i] = 0.0;
    for (let j = 0; j < segmentsCount; j++) {
      let p_scalar = fftOutputSegments[j][i]; // This is already magnitude from _fft_segmented
      let p = scale * p_scalar ** 2;

      // One-sided PSD needs doubling for non-DC/Nyquist frequencies.
      // dataCount here is N/2+1 (number of magnitudes from _fft_segmented).
      // DC is at index 0. Nyquist is at index dataCount-1.
      if (i !== 0 && i !== dataCount - 1) {
         p *= 2;
      }
      psdOutput[i] += p;
    }

    const min_avg = 1e-10;
    let avg = (segmentsCount > 0) ? (psdOutput[i] / segmentsCount) : 0;
    avg = Math.max(avg, min_avg);
    psdOutput[i] = 10 * Math.log10(avg);

    if (i > noise3HzIdx) {
      min = Math.min(psdOutput[i], min);
      max = Math.max(psdOutput[i], max);
    }
    if (i > noise50HzIdx && psdOutput[i] > maxNoise) {
      maxNoise = psdOutput[i];
      maxNoiseIdxBin = i;
    }
  }
  // Scale bin to freq. (dataCount-1) corresponds to Nyquist frequency.
  const maxNoiseFrequency = (dataCount > 1) ? (maxNoiseIdxBin / (dataCount -1) * maxFrequency) : 0;

  return {
      psdOutput: psdOutput,
      min: min,
      max: max,
      maxNoiseIdx: maxNoiseFrequency, // This is a frequency in Hz
    };
};


/**
 * Compute FFT for samples segments by lenghts as pointsPerSegment with overlapCount overlap points count
 */
GraphSpectrumCalc._fft_segmented  = function(samples, pointsPerSegment, overlapCount) {
  const samplesCount = samples.length;
  let output = []; // Array of magnitude arrays
  if (pointsPerSegment === 0 || samplesCount < pointsPerSegment || pointsPerSegment < MIN_FFT_POINTS) {
    return output;
  }
  // Ensure pointsPerSegment is a power of two for FFT (if not already guaranteed by caller)
  // This function's caller (dataLoadPSD) already ensures pointsPerSegment is a power of two.

  const step = pointsPerSegment - overlapCount;
  if (step <= 0) { // Avoid infinite loop if overlap is too large
      console.warn("PSD segment step is non-positive, review pointsPerSegment and overlapCount.");
      return output;
  }

  for (let i = 0; (i + pointsPerSegment) <= samplesCount; i += step) {
    // Take a copy for windowing and FFT, as _hanningWindow modifies in place
    const fftInputSegment = samples.slice(i, i + pointsPerSegment);

    if (userSettings.analyserHanning) {
      this._hanningWindow(fftInputSegment, pointsPerSegment); // Modifies fftInputSegment
    }

    const fftComplex = this._fft(fftInputSegment); // Returns complex array [re,im,re,im...]
                                                 // It will have (pointsPerSegment/2 + 1)*2 float values.

    const numMagnitudes = pointsPerSegment / 2 + 1;
    const magnitudes = new Float64Array(numMagnitudes);
    for (let k = 0; k < numMagnitudes; k++) {
      const re = fftComplex[2 * k];
      const im = fftComplex[2 * k + 1];
      magnitudes[k] = Math.hypot(re, im);
    }
    output.push(magnitudes);
  }

  return output;
};

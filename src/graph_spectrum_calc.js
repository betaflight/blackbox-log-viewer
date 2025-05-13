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
    this._analyserTimeRange.out = analyserTimeRange.in + MAX_ANALYSER_LENGTH;
  }
  return this._analyserTimeRange.out;
};

GraphSpectrumCalc.setDataBuffer = function(dataBuffer) {
  this._dataBuffer = dataBuffer;
  return undefined;
};

GraphSpectrumCalc.dataLoadFrequency = function() {

  const flightSamples = this._getFlightSamplesFreq();

  let effectiveSampleCount = this._getLargestPowerOfTwoLeq(flightSamples.count);

  if (effectiveSampleCount < MIN_FFT_POINTS) {
    console.warn(`Effective sample count ${effectiveSampleCount} for FFT is too small (min ${MIN_FFT_POINTS}). Skipping Frequency analysis.`);
    return {
        fieldIndex: this._dataBuffer.fieldIndex,
        fieldName: this._dataBuffer.fieldName,
        fftLength: 0,
        fftOutput: new Float64Array(0),
        maxNoiseIdx: 0,
        blackBoxRate: this._blackBoxRate,
    };
  }

  const samplesForFft = flightSamples.samples.slice(0, effectiveSampleCount);

  if (userSettings.analyserHanning) {
    this._hanningWindow(samplesForFft, effectiveSampleCount);
  }

  //calculate fft
  const fftOutput = this._fft(samplesForFft);

  // Normalize the result
  const fftData = this._normalizeFft(fftOutput, effectiveSampleCount);

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

  // We divide it into FREQ_VS_THR_CHUNK_TIME_MS FFT chunks, we calculate the average throttle
  // for each chunk. We use a moving window to get more chunks available.
  let fftChunkLength = Math.floor(this._blackBoxRate * FREQ_VS_THR_CHUNK_TIME_MS / 1000);
  fftChunkLength = this._getLargestPowerOfTwoLeq(fftChunkLength);

  if (fftChunkLength < MIN_FFT_POINTS) {
    console.warn(`FFT chunk length ${fftChunkLength} for FreqVsX is too small (min ${MIN_FFT_POINTS}). Skipping.`);
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

  const fftChunkWindow = Math.round(fftChunkLength / FREQ_VS_THR_WINDOW_DIVISOR);

  let maxNoise = 0; // Stores the maximum amplitude of the fft over all chunks
   // Matrix where each row represents a bin of vs values, and the columns are amplitudes at frequencies
  const matrixFftOutput = new Array(NUM_VS_BINS).fill(null).map(() => new Float64Array(fftChunkLength * 2));

  const numberSamples = new Uint32Array(NUM_VS_BINS); // Number of samples in each vs value, used to average them later.

  const fft = new FFT.complex(fftChunkLength, false);
  for (let fftChunkIndex = 0; fftChunkIndex + fftChunkLength < flightSamples.count; fftChunkIndex += fftChunkWindow) {

    const fftInput = flightSamples.samples.slice(fftChunkIndex, fftChunkIndex + fftChunkLength);
    let fftOutput = new Float64Array(fftChunkLength * 2); // This is for complex output

    // Hanning window applied to input data
    if (userSettings.analyserHanning) {
      this._hanningWindow(fftInput, fftChunkLength);
    }

    fft.simple(fftOutput, fftInput, 'real');

    // The original code sliced fftOutput (complex) to its first fftChunkLength float values.
    // This behavior is preserved with the new power-of-2 fftChunkLength.
    fftOutput = fftOutput.slice(0, fftChunkLength);


    // Use only abs values
    for (let i = 0; i < fftChunkLength; i++) { // This loop iterates over the sliced (potentially mixed Re/Im) values
      fftOutput[i] = Math.abs(fftOutput[i]);
      maxNoise = Math.max(fftOutput[i], maxNoise);
    }

    // calculate a bin index and put the fft value in that bin for each field (e.g. eRPM[0], eRPM[1]..) sepparately
    for (const vsValueArray of flightSamples.vsValues) {
      // Calculate average of the VS values in the chunk
      let sumVsValues = 0;
      for (let indexVs = fftChunkIndex; indexVs < fftChunkIndex + fftChunkLength; indexVs++) {
        sumVsValues += vsValueArray[indexVs];
      }
      // Translate the average vs value to a bin index
      const avgVsValue = sumVsValues / fftChunkLength;
      let vsBinIndex = Math.floor(NUM_VS_BINS * (avgVsValue - flightSamples.minValue) / (flightSamples.maxValue - flightSamples.minValue));
      // ensure that avgVsValue == flightSamples.maxValue does not result in an out of bounds access
      if (vsBinIndex === NUM_VS_BINS) { vsBinIndex = NUM_VS_BINS - 1; }
      if (vsBinIndex < 0) { vsBinIndex = 0;} // Ensure valid index

      numberSamples[vsBinIndex]++;

      // add the output from the fft to the row given by the vs value bin index
      // The matrixFftOutput columns correspond to the elements from the sliced fftOutput
      for (let i = 0; i < fftOutput.length; i++) {
         // Ensure matrixFftOutput[vsBinIndex] is initialized if it wasn't (though map should handle it)
        if (!matrixFftOutput[vsBinIndex]) matrixFftOutput[vsBinIndex] = new Float64Array(fftChunkLength); // Safety, matching slice
        matrixFftOutput[vsBinIndex][i] += fftOutput[i];
      }
    }
  }
  // Adjust matrixFftOutput dimensions to match the sliced fftOutput length if different from initialization
  // This should not be necessary if matrixFftOutput was initialized with fftChunkLength (length of the sliced data).
  // Let's ensure matrixFftOutput has the correct number of columns based on the sliced fftOutput.
  // The initialization `new Float64Array(fftChunkLength * 2)` for matrixFftOutput rows
  // should actually be `new Float64Array(fftChunkLength)` because `fftOutput` is sliced to that length.
  const finalMatrixFftOutput = new Array(NUM_VS_BINS).fill(null).map(() => new Float64Array(fftChunkLength));


  // Divide the values from the fft in each row (vs value bin) by the number of samples in the bin
  for (let i = 0; i < NUM_VS_BINS; i++) {
    if (numberSamples[i] > 1) {
      for (let j = 0; j < fftChunkLength; j++) { // Iterate up to the length of the sliced fftOutput
        finalMatrixFftOutput[i][j] = matrixFftOutput[i][j] / numberSamples[i];
      }
    } else if (numberSamples[i] === 1) {
         for (let j = 0; j < fftChunkLength; j++) {
            finalMatrixFftOutput[i][j] = matrixFftOutput[i][j];
        }
    }
  }


  const fftData = {
    fieldIndex   : this._dataBuffer.fieldIndex,
    fieldName  : this._dataBuffer.fieldName,
    fftLength  : fftChunkLength, // This is the length of the (sliced) data used for matrix rows
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

GraphSpectrumCalc._getFlightSamplesFreq = function(scaled = true) {

  const allChunks = this._getFlightChunks();

  const samples = new Float64Array(MAX_ANALYSER_LENGTH / (1000 * 1000) * this._blackBoxRate);

  // Loop through all the samples in the chunks and assign them to a sample array ready to pass to the FFT.
  let samplesCount = 0;
  for (const chunk of allChunks) {
    for (const frame of chunk.frames) {
      if (scaled) {
        samples[samplesCount] = this._dataBuffer.curve.lookupRaw(frame[this._dataBuffer.fieldIndex]);
      } else {
        samples[samplesCount] = frame[this._dataBuffer.fieldIndex];
      }
      samplesCount++;
    }
  }

  return {
    samples : samples,
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

  // Calculate min max average of the VS values in the chunk what will used by spectrum data definition
  let tempfftChunkLength = Math.floor(this._blackBoxRate * FREQ_VS_THR_CHUNK_TIME_MS / 1000); // temp for calc, actual fftChunkLength may change
  tempfftChunkLength = this._getLargestPowerOfTwoLeq(tempfftChunkLength);
  if (tempfftChunkLength < MIN_FFT_POINTS) tempfftChunkLength = MIN_FFT_POINTS; // Use min for range calc if too small

  const fftChunkWindow = Math.round(tempfftChunkLength / FREQ_VS_THR_WINDOW_DIVISOR);

  if (tempfftChunkLength > 0 && fftChunkWindow > 0) { // Proceed only if chunking is possible
      for (let fftChunkIndex = 0; fftChunkIndex + tempfftChunkLength < samplesCount; fftChunkIndex += fftChunkWindow) {
        for (const vsValueArray of vsValues) {
          // Calculate average of the VS values in the chunk
          let sumVsValues = 0;
          for (let indexVs = fftChunkIndex; indexVs < fftChunkIndex + tempfftChunkLength; indexVs++) {
            sumVsValues += vsValueArray[indexVs];
          }
          // Find min max average of the VS values in the chunk
          const avgVsValue = sumVsValues / tempfftChunkLength;
          maxValue = Math.max(maxValue, avgVsValue);
          minValue = Math.min(minValue, avgVsValue);
        }
      }
  }


  maxValue *= MAX_RPM_AXIS_GAP;

  if (minValue > maxValue || minValue === Infinity || maxValue === -Infinity) {
    // Fallback if range is invalid
    minValue = 0;
    if (vsFieldNames === FIELD_THROTTLE_NAME) {
        maxValue = 100;
    } else if (vsFieldNames === FIELD_RPM_NAMES) {
        maxValue = MAX_RPM_HZ_VALUE * this._motorPoles / 3.333 * MAX_RPM_AXIS_GAP;
    } else {
        maxValue = 100; // Default generic max
    }
     if (minValue > maxValue) minValue = 0; // Ensure min <= max
    console.log("Adjusted FreqVsX range due to invalid calculation: min=%f, max=%f", minValue, maxValue);
  }

  return {
    samples  : samples,
    vsValues : vsValues,
    count  : samplesCount,
    minValue : minValue,
    maxValue : maxValue,
    vsRange: {min: minValue, max: maxValue}, // ensure vsRange is present
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
    piderror,
    setpoint,
    maxSetpoint,
    count: samplesCount,
  };
};

GraphSpectrumCalc._hanningWindow = function(samples, size) {

  if (!size) {
    size = samples.length;
  }

  for(let i=0; i < size; i++) {
    samples[i] *= 0.5 * (1-Math.cos((2*Math.PI*i)/(size - 1)));
  }
};

GraphSpectrumCalc._fft  = function(samples, type) {

  if (!type) {
    type = 'real';
  }

  const fftLength = samples.length;
  const fftOutput = new Float64Array(fftLength * 2); // Expects N complex outputs for N real inputs by some conventions
                                                    // or N/2+1 complex outputs. FFT.js simple 'real' typically N/2+1.
                                                    // The library may internally handle sizing of fftOutput for simple().
  const fft = new FFT.complex(fftLength, false);

  fft.simple(fftOutput, samples, type);

  return fftOutput;
};


/**
 * Makes all the values absolute and returns the index of maxFrequency found
 */
GraphSpectrumCalc._normalizeFft = function(fftOutput, fftLength) {
  // Number of usable frequency bins (0 to Nyquist)
  const bins = Math.floor(fftLength / 2) + 1;  // +1 to include Nyquist bin
  const magnitudes = new Float64Array(bins);

  // Calculate magnitudes from complex values
  for (let bin = 0; bin < bins; bin++) {
    const re = fftOutput[2 * bin];
    const im = fftOutput[2 * bin + 1];
    magnitudes[bin] = Math.hypot(re, im);
  }

  // Find max noise after low-end cutoff
  const maxFrequency = (this._blackBoxRate / 2.0);
  const noiseLowEndIdx = Math.floor(100 / maxFrequency * bins);
  let maxNoiseIdx = 0;
  let maxNoise = 0;

  for (let bin = 0; bin < bins; bin++) {
    if (bin > noiseLowEndIdx && magnitudes[bin] > maxNoise) {
      maxNoise = magnitudes[bin];
      maxNoiseIdx = bin;
    }
  }

  // Scale bin index to frequency
  const maxNoiseFreq = maxNoiseIdx / bins * maxFrequency;

  return {
    fieldIndex: this._dataBuffer.fieldIndex,
    fieldName: this._dataBuffer.fieldName,
    fftLength: bins,  // Return number of frequency bins
    fftOutput: magnitudes,  // Return the magnitude spectrum
    maxNoiseIdx: maxNoiseFreq,
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

  const dataCount = fftOutputSegments[0].length; // Number of magnitude points per segment (N/2 or N/2+1)
  const segmentsCount = fftOutputSegments.length;
  const psdOutput = new Float64Array(dataCount);

// Compute power scale coef
  let scale = 1;
  if (userSettings.analyserHanning) {
    const window = Array(pointsPerSegment).fill(1);
    this._hanningWindow(window, pointsPerSegment);
    if (scaling == 'density') {
      let skSum = 0;
      for (const value of window) {
        skSum += value ** 2;
      }
      scale = 1 / (this._blackBoxRate * skSum);
    } else if (scaling == 'spectrum') {
      let sum = 0;
      for (const value of window) {
        sum += value;
      }
      scale = 1 / sum ** 2;
    }
  } else { // No Hanning window
      if (scaling == 'density') {
        scale = 1 / (this._blackBoxRate * pointsPerSegment); // Corrected scale for non-windowed
      } else if (scaling == 'spectrum') {
        scale = 1 / pointsPerSegment ** 2;
      }
  }


// Compute average for scaled power
  let min = 1e6,
      max = -1e6;

  const maxFrequency = (this._blackBoxRate / 2.0);
  const noise50HzIdx = Math.floor(50 / maxFrequency * dataCount);
  const noise3HzIdx = Math.floor(3 / maxFrequency * dataCount);
  let maxNoiseIdxBin = 0;
  let maxNoise = -100; // dB
  for (let i = 0; i < dataCount; i++) {
    psdOutput[i] = 0.0;
    for (let j = 0; j < segmentsCount; j++) {
      let p_scalar = fftOutputSegments[j][i]; // This is already magnitude from _fft_segmented
      let p = scale * p_scalar ** 2;
      // For real signals, one-sided PSD needs doubling for non-DC/Nyquist frequencies
      // Assuming fftOutputSegments[j][i] are magnitudes from a one-sided spectrum (0 to Nyquist)
      // DC (i=0) and Nyquist (i=dataCount-1, if dataCount = N/2+1) are not doubled.
      if (i !== 0 && (dataCount % 2 === 1 ? i !== dataCount -1 : true) ) { // crude Nyquist check for N/2+1 length
         // A common rule: double all bins except DC and Nyquist.
         // If dataCount is N/2, all are doubled except DC.
         // If dataCount is N/2+1, Nyquist is at dataCount-1.
         // Let's assume dataCount from _fft_segmented is N/2+1.
         if (i < dataCount -1) { // Don't double Nyquist if it's the last bin
            p *= 2;
         }
      }
      psdOutput[i] += p;
    }

    const min_avg = 1e-10; // limit min value for -100db (increased range)
    let avg = psdOutput[i] / segmentsCount;
    avg = Math.max(avg, min_avg);
    psdOutput[i] = 10 * Math.log10(avg);
    if (i > noise3HzIdx) {    // Miss big zero freq magnitude
      min = Math.min(psdOutput[i], min);
      max = Math.max(psdOutput[i], max);
    }
    if (i > noise50HzIdx && psdOutput[i] > maxNoise) {
      maxNoise = psdOutput[i];
      maxNoiseIdxBin = i;
    }
  }

  const maxNoiseFrequency = maxNoiseIdxBin / (dataCount -1) * maxFrequency; // Scale bin to freq

  return {
      psdOutput: psdOutput,
      min: min,
      max: max,
      maxNoiseIdx: maxNoiseFrequency,
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
  for (let i = 0; i <= samplesCount - pointsPerSegment; i += pointsPerSegment - overlapCount) {
    const fftInput = samples.slice(i, i + pointsPerSegment);

    if (userSettings.analyserHanning) {
      this._hanningWindow(fftInput, pointsPerSegment);
    }

    const fftComplex = this._fft(fftInput); // Returns complex array [re,im,re,im...]
    // For N real inputs, FFT.js simple('real') returns N/2+1 complex values.
    // So, fftComplex has (pointsPerSegment/2 + 1) * 2 float values.
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

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
  WARNING_RATE_DIFFERENCE = 0.05,
  MAX_RPM_HZ_VALUE = 800,
  RPM_AXIS_TOP_MARGIN_PERCENT = 2,
  MIN_SPECTRUM_SAMPLES_COUNT = 2048;
export const NUM_VS_BINS = 100;

export const GraphSpectrumCalc = {
  _analyserTimeRange : {
      in: 0,
      out: MAX_ANALYSER_LENGTH,
  },
  _blackBoxRate : 0,
  _dataBuffer : {
      fieldIndex: 0,
      curve: null,
      fieldName: null,
  },
  _flightLog : null,
  _sysConfig : null,
  _motorPoles : null,
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

GraphSpectrumCalc.setDataBuffer = function(fieldIndex, curve, fieldName) {
  this._dataBuffer.curve = curve;
  this._dataBuffer.fieldName = fieldName;
  this._dataBuffer.fieldIndex = fieldIndex;
  return undefined;
};

GraphSpectrumCalc.getNearPower2Value = function(size) {
  return Math.pow(2, Math.ceil(Math.log2(size)));
};

GraphSpectrumCalc.dataLoadFrequency = function() {

  const flightSamples = this._getFlightSamplesFreq();

  if (userSettings.analyserHanning) {
    this._hanningWindow(flightSamples.samples, flightSamples.count); // Apply Hann function to actual flightSamples.count values only
  }

  //calculate fft for the all samples
  const fftOutput = this._fft(flightSamples.samples);

  // Normalize the result
  const fftData = this._normalizeFft(fftOutput);

  return fftData;
};

GraphSpectrumCalc.dataLoadPSD = function(analyserZoomY) {
  const flightSamples = this._getFlightSamplesFreq(false);
  const multiplier = Math.floor(1 / analyserZoomY); // 0. ... 10
  let pointsPerSegment = 2 ** (8 + multiplier); //256, 512, 1024 ...

  let overlapCount;
  if (pointsPerSegment > flightSamples.samples.length) {
      pointsPerSegment = flightSamples.samples.length;  // Use actual sample length. It will transform to power at 2 value inside the _psd() - fft_segmented
      overlapCount = 0;
  } else {
    overlapCount = pointsPerSegment / 2;
  }

  const psd =  this._psd(flightSamples.samples, pointsPerSegment, overlapCount);

  const psdData = {
    fieldIndex   : this._dataBuffer.fieldIndex,
    fieldName  : this._dataBuffer.fieldName,
    psdLength  : psd.psdOutput.length,
    psdOutput  : psd.psdOutput,
    blackBoxRate : this._blackBoxRate,
    minimum: psd.min,
    maximum: psd.max,
    maxNoiseFrequency: psd.maxNoiseFrequency,
  };
  return psdData;
};

GraphSpectrumCalc._dataLoadFrequencyVsX = function(vsFieldNames, minValue = Infinity, maxValue = -Infinity) {

  const flightSamples = this._getFlightSamplesFreqVsX(vsFieldNames, minValue, maxValue);
  // We divide it into FREQ_VS_THR_CHUNK_TIME_MS FFT chunks, we calculate the average throttle
  // for each chunk. We use a moving window to get more chunks available.
  const fftChunkLength = Math.round(this._blackBoxRate * FREQ_VS_THR_CHUNK_TIME_MS / 1000);
  const fftChunkWindow = Math.round(fftChunkLength / FREQ_VS_THR_WINDOW_DIVISOR);
  const fftBufferSize = this.getNearPower2Value(fftChunkLength);
  const magnitudeLength = Math.floor(fftBufferSize / 2);
  let maxNoise = 0; // Stores the maximum amplitude of the fft over all chunks
   // Matrix where each row represents a bin of vs values, and the columns are amplitudes at frequencies
  const matrixFftOutput = new Array(NUM_VS_BINS).fill(null).map(() => new Float64Array(fftBufferSize * 2));
  const numberSamples = new Uint32Array(NUM_VS_BINS); // Number of samples in each vs value, used to average them later.
  const fft = new FFT.complex(fftBufferSize, false);
  const fftInput = new Float64Array(fftBufferSize);
  const fftOutput = new Float64Array(fftBufferSize * 2);

  for (let fftChunkIndex = 0; fftChunkIndex + fftChunkLength < flightSamples.samples.length; fftChunkIndex += fftChunkWindow) {

    const samples = flightSamples.samples.slice(fftChunkIndex, fftChunkIndex + fftChunkLength);
    fftInput.set(samples);

    // Hanning window applied to input data, without padding zeros
    if (userSettings.analyserHanning) {
      this._hanningWindow(fftInput, fftChunkLength);
    }

    fft.simple(fftOutput, fftInput, 'real');

//  Compute magnitude
//  The fftOutput contains two side spectrum, we use the first part only to get one side
    const magnitudes = new Float64Array(magnitudeLength);
    for (let i = 0; i < magnitudeLength; i++) {
      const re = fftOutput[2 * i],
            im = fftOutput[2 * i + 1];
      magnitudes[i] = Math.hypot(re, im);
      maxNoise = Math.max(magnitudes[i], maxNoise);
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
      const vsBinIndex = Math.round((NUM_VS_BINS - 1) * (avgVsValue - flightSamples.minValue) / (flightSamples.maxValue - flightSamples.minValue));
      numberSamples[vsBinIndex]++;

      // add the output from the fft to the row given by the vs value bin index
      for (let i = 0; i < magnitudeLength; i++) {
        matrixFftOutput[vsBinIndex][i] += magnitudes[i];
      }
    }
  }

  // Divide the values from the fft in each row (vs value bin) by the number of samples in the bin
  for (let i = 0; i < NUM_VS_BINS; i++) {
    if (numberSamples[i] > 1) {
      for (let j = 0; j < matrixFftOutput[i].length; j++) {
        matrixFftOutput[i][j] /= numberSamples[i];
      }
    }
  }

  // The output data needs to be smoothed, the sampling is not perfect
  // but after some tests we let the data as is, an we prefer to apply a
  // blur algorithm to the heat map image

  const fftData = {
    fieldIndex   : this._dataBuffer.fieldIndex,
    fieldName  : this._dataBuffer.fieldName,
    fftLength  : magnitudeLength,
    fftOutput  : matrixFftOutput,
    maxNoise   : maxNoise,
    blackBoxRate : this._blackBoxRate,
    vsRange    : { min: flightSamples.minValue, max: flightSamples.maxValue},
  };

  return fftData;

};

GraphSpectrumCalc._dataLoadPowerSpectralDensityVsX = function(vsFieldNames, minValue = Infinity, maxValue = -Infinity) {
  const flightSamples = this._getFlightSamplesFreqVsX(vsFieldNames, minValue, maxValue, false);

  // We divide it into FREQ_VS_THR_CHUNK_TIME_MS FFT chunks, we calculate the average throttle
  // for each chunk. We use a moving window to get more chunks available.
  const fftChunkLength = Math.round(this._blackBoxRate * FREQ_VS_THR_CHUNK_TIME_MS / 1000);
  const fftChunkWindow = Math.round(fftChunkLength / FREQ_VS_THR_WINDOW_DIVISOR);

  let maxNoise = 0; // Stores the maximum amplitude of the fft over all chunks
  let psdLength = 0;
   // Matrix where each row represents a bin of vs values, and the columns are amplitudes at frequencies
  const BACKGROUND_PSD_VALUE = -200;
  let matrixPsdOutput;

  const numberSamples = new Uint32Array(NUM_VS_BINS); // Number of samples in each vs value, used to average them later.

  for (let fftChunkIndex = 0; fftChunkIndex + fftChunkLength < flightSamples.samples.length; fftChunkIndex += fftChunkWindow) {

    const fftInput = flightSamples.samples.slice(fftChunkIndex, fftChunkIndex + fftChunkLength);
    const psd = this._psd(fftInput, fftChunkLength, 0, 'density'); // Using the one segment with all chunks fftChunkLength size, it will extended at power at 2 size inside _psd() - _fft_segmented()
    maxNoise = Math.max(psd.max, maxNoise);
    // The _psd() can extend fft data size. Set psdLength and create matrix by first using
    if (matrixPsdOutput == undefined) {
      psdLength = psd.psdOutput.length;
      matrixPsdOutput = new Array(NUM_VS_BINS)
        .fill(null)
        .map(() => (new Float64Array(psdLength)).fill(BACKGROUND_PSD_VALUE));
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
      const vsBinIndex = Math.round((NUM_VS_BINS - 1) * (avgVsValue - flightSamples.minValue) / (flightSamples.maxValue - flightSamples.minValue));
      numberSamples[vsBinIndex]++;

      // add the output from the fft to the row given by the vs value bin index
      for (let i = 0; i < psdLength; i++) {
        matrixPsdOutput[vsBinIndex][i] += psd.psdOutput[i];
      }
    }
  }

  // Divide the values from the fft in each row (vs value bin) by the number of samples in the bin
  for (let i = 0; i < NUM_VS_BINS; i++) {
    if (numberSamples[i] > 1) {
      for (let j = 0; j < psdLength; j++) {
        matrixPsdOutput[i][j] /= numberSamples[i];
      }
    }
  }

  // The output data needs to be smoothed, the sampling is not perfect
  // but after some tests we let the data as is, an we prefer to apply a
  // blur algorithm to the heat map image

  const psdData = {
    fieldIndex   : this._dataBuffer.fieldIndex,
    fieldName  : this._dataBuffer.fieldName,
    fftLength  : psdLength,
    fftOutput  : matrixPsdOutput,
    maxNoise   : maxNoise,
    blackBoxRate : this._blackBoxRate,
    vsRange    : { min: flightSamples.minValue, max: flightSamples.maxValue},
  };

  return psdData;
};

GraphSpectrumCalc.dataLoadFrequencyVsThrottle = function() {
  return this._dataLoadFrequencyVsX(FIELD_THROTTLE_NAME, 0, 100);
};

GraphSpectrumCalc.dataLoadPowerSpectralDensityVsThrottle = function() {
  return this._dataLoadPowerSpectralDensityVsX(FIELD_THROTTLE_NAME, 0, 100);
};

GraphSpectrumCalc.dataLoadFrequencyVsRpm = function() {
  const fftData = this._dataLoadFrequencyVsX(FIELD_RPM_NAMES, 0);
  fftData.vsRange.max *= 3.333 / this._motorPoles;
  fftData.vsRange.min *= 3.333 / this._motorPoles;
  return fftData;
};

GraphSpectrumCalc.dataLoadPowerSpectralDensityVsRpm = function() {
  const fftData = this._dataLoadPowerSpectralDensityVsX(FIELD_RPM_NAMES, 0);
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

  // The FFT input size is power 2 to get maximal performance
  // Limit fft input count for simple spectrum chart to get normal charts plot quality
  let fftBufferSize;
  if (scaled && samplesCount < MIN_SPECTRUM_SAMPLES_COUNT) {
      fftBufferSize = MIN_SPECTRUM_SAMPLES_COUNT;
  } else {
    fftBufferSize = this.getNearPower2Value(samplesCount);
  }

  return {
    samples : samples.slice(0, fftBufferSize),
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

GraphSpectrumCalc._getFlightSamplesFreqVsX = function(vsFieldNames, minValue = Infinity, maxValue = -Infinity, scaled = true) {

  const allChunks = this._getFlightChunks();
  const vsIndexes = this._getVsIndexes(vsFieldNames);

  const samples = new Float64Array(MAX_ANALYSER_LENGTH / (1000 * 1000) * this._blackBoxRate);
  const vsValues = new Array(vsIndexes.length).fill(null).map(() => new Float64Array(MAX_ANALYSER_LENGTH / (1000 * 1000) * this._blackBoxRate));

  let samplesCount = 0;
  for (const chunk of allChunks) {
    for (let frameIndex = 0; frameIndex < chunk.frames.length; frameIndex++) {
      if (scaled) {
        samples[samplesCount] = (this._dataBuffer.curve.lookupRaw(chunk.frames[frameIndex][this._dataBuffer.fieldIndex]));
      } else {
        samples[samplesCount] = chunk.frames[frameIndex][this._dataBuffer.fieldIndex];
      }
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
  const fftChunkLength = Math.round(this._blackBoxRate * FREQ_VS_THR_CHUNK_TIME_MS / 1000);
  const fftChunkWindow = Math.round(fftChunkLength / FREQ_VS_THR_WINDOW_DIVISOR);
  for (let fftChunkIndex = 0; fftChunkIndex + fftChunkLength < samplesCount; fftChunkIndex += fftChunkWindow) {
    for (const vsValueArray of vsValues) {
      // Calculate average of the VS values in the chunk
      let sumVsValues = 0;
      for (let indexVs = fftChunkIndex; indexVs < fftChunkIndex + fftChunkLength; indexVs++) {
        sumVsValues += vsValueArray[indexVs];
      }
      // Find min max average of the VS values in the chunk
      const avgVsValue = sumVsValues / fftChunkLength;
      maxValue = Math.max(maxValue, avgVsValue);
      minValue = Math.min(minValue, avgVsValue);
    }
  }

// Use small top margin for RPM axis only. Because it has bad axis view for throttle
  if (vsFieldNames == FIELD_RPM_NAMES) {
    maxValue += (maxValue - minValue) * RPM_AXIS_TOP_MARGIN_PERCENT / 100;
  }

  if (minValue > maxValue) {
    if (minValue == Infinity) {  // this should never happen
      minValue = 0;
      maxValue = 100;
      console.warn("Invalid minimum value");
    } else {
      console.warn("Maximum value %f smaller than minimum value %d", maxValue, minValue);
      minValue = 0;
      maxValue = 100;
    }
  }

  const slicedVsValues = [];
  for (const vsValueArray of vsValues) {
    slicedVsValues.push(vsValueArray.slice(0, samplesCount));
  }

  return {
    samples  : samples.slice(0, samplesCount),
    vsValues : slicedVsValues,
    count  : samplesCount,
    minValue : minValue,
    maxValue : maxValue,
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
    piderror: piderror.slice(0, samplesCount),
    setpoint: setpoint.slice(0, samplesCount),
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
  const fftOutput = new Float64Array(fftLength * 2);
  const fft = new FFT.complex(fftLength, false);

  fft.simple(fftOutput, samples, type);

  return fftOutput;
};


/**
 * Makes all the values absolute and returns the index of maxFrequency found
 */
GraphSpectrumCalc._normalizeFft = function(fftOutput) {
  // The fft output contains two side spectrum, we use the first part only to get one side
  const  fftLength = fftOutput.length / 2;

  // The fft output contains complex values (re, im pairs) of two-side spectrum
  // Compute magnitudes for one spectrum side
  const magnitudeLength = Math.floor(fftLength / 2);
  const maxFrequency = (this._blackBoxRate / 2.0);
  const noiseLowEndIdx = 100 / maxFrequency * magnitudeLength;
  const magnitudes = new Float64Array(magnitudeLength);
  let maxNoiseIdx = 0;
  let maxNoise = 0;

  for (let i = 0; i < magnitudeLength; i++) {
    const re = fftOutput[2 * i],
          im = fftOutput[2 * i + 1];
    magnitudes[i] = Math.hypot(re, im);
    if (i > noiseLowEndIdx && magnitudes[i] > maxNoise) {
      maxNoise = magnitudes[i];
      maxNoiseIdx = i;
    }
  }

  const maxNoiseFrequency = maxNoiseIdx / magnitudeLength * maxFrequency;

  const fftData = {
    fieldIndex   : this._dataBuffer.fieldIndex,
    fieldName  : this._dataBuffer.fieldName,
    fftLength  : magnitudeLength,
    fftOutput  : magnitudes,
    maxNoiseFrequency  : maxNoiseFrequency,
    blackBoxRate : this._blackBoxRate,
  };

  return fftData;
};

/**
 * Compute PSD for data samples by Welch method follow Python code
 * It is good to use power at 2 values for pointsPerSegment.
 * For short data length, set pointsPerSegment same samples.length to extend samples count for power at 2 value inside _fft_segmented
 */
GraphSpectrumCalc._psd  = function(samples, pointsPerSegment, overlapCount, scaling = 'density') {
// Compute FFT for samples segments
  const fftOutput = this._fft_segmented(samples, pointsPerSegment, overlapCount);

  const dataCount = fftOutput[0].length;
  const segmentsCount = fftOutput.length;
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
  } else if (scaling == 'density') {
    scale = 1 / pointsPerSegment;
  } else if (scaling == 'spectrum') {
    scale = 1 / pointsPerSegment ** 2;
  }

// Compute average for scaled power
  let min = 1e6,
      max = -1e6;
      // Early exit if no segments were processed
  if (segmentsCount === 0) {
    return {
      psdOutput: new Float64Array(0),
      min: 0,
      max: 0,
      maxNoiseFrequency: 0,
    };
  }
  const maxFrequency = (this._blackBoxRate / 2.0);
  const noise50HzIdx = 50 / maxFrequency * dataCount;
  const noise3HzIdx = 3 / maxFrequency * dataCount;
  let maxNoiseIdx = 0;
  let maxNoise = -100;
  for (let i = 0; i < dataCount; i++) {
    psdOutput[i] = 0.0;
    for (let j = 0; j < segmentsCount; j++) {
      let p = scale * fftOutput[j][i] ** 2;
      if (i != 0) {
        const even = dataCount % 2 == 0;
        if (!even || even && i != dataCount - 1) {
          p *= 2;
        }
      }
      psdOutput[i] += p;
    }

    const min_avg = 1e-7; // limit min value for -70db
    let avg = psdOutput[i] / segmentsCount;
    avg = Math.max(avg, min_avg);
    psdOutput[i] = 10 * Math.log10(avg);
    if (i > noise3HzIdx) {    // Miss big zero freq magnitude
      min = Math.min(psdOutput[i], min);
      max = Math.max(psdOutput[i], max);
    }
    if (i > noise50HzIdx && psdOutput[i] > maxNoise) {
      maxNoise = psdOutput[i];
      maxNoiseIdx = i;
    }
  }

  const maxNoiseFrequency = maxNoiseIdx / dataCount * maxFrequency;

  return {
      psdOutput: psdOutput,
      min: min,
      max: max,
      maxNoiseFrequency: maxNoiseFrequency,
    };
};

/**
 * Compute FFT for samples segments by lenghts as pointsPerSegment with overlapCount overlap points count
 * It is good to use power at 2 values for pointsPerSegment.
 * For short data length, set pointsPerSegment same samples.length to extend samples count for power at 2 value inside _fft_segmented
 */
GraphSpectrumCalc._fft_segmented  = function(samples, pointsPerSegment, overlapCount) {
  const samplesCount = samples.length;
  const output = [];

  for (let i = 0; i <= samplesCount - pointsPerSegment; i += pointsPerSegment - overlapCount) {
    let fftInput = samples.slice(i, i + pointsPerSegment);

    if (userSettings.analyserHanning) {
      this._hanningWindow(fftInput, pointsPerSegment);
    }

    let fftLength;
    if (pointsPerSegment != samplesCount) {
      fftLength = Math.floor(pointsPerSegment / 2);
    } else {  // Extend the one segment input on power at 2 size
      const fftSize = this.getNearPower2Value(pointsPerSegment);
      const power2Input = new Float64Array(fftSize);
      power2Input.set(fftInput);
      fftInput = power2Input;
      fftLength = fftSize / 2;
    }

    const fftComplex = this._fft(fftInput);
    const magnitudes = new Float64Array(fftLength);
    for (let i = 0; i < fftLength; i++) {
      const re = fftComplex[2 * i];
      const im = fftComplex[2 * i + 1];
      magnitudes[i] = Math.hypot(re, im);
    }
    output.push(magnitudes);
  }

  return output;
};

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
  MAX_RPM_AXIS_GAP = 1.05;


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
    this._analyserTimeRange.out = analyserTimeRange.in + MAX_ANALYSER_LENGTH;
  }
  return this._analyserTimeRange.out;
};

GraphSpectrumCalc.setDataBuffer = function(fieldIndex, curve, fieldName) {
  this._dataBuffer.curve = curve;
  this._dataBuffer.fieldName = fieldName;
  this._dataBuffer.fieldIndex = fieldIndex;
  return undefined;
};

GraphSpectrumCalc.dataLoadFrequency = function() {

  const flightSamples = this._getFlightSamplesFreq();

  if (userSettings.analyserHanning) {
    this._hanningWindow(flightSamples.samples, flightSamples.count);
  }

  //calculate fft
  const fftOutput = this._fft(flightSamples.samples);

  // Normalize the result
  const fftData = this._normalizeFft(fftOutput, flightSamples.samples.length);

  return fftData;
};


GraphSpectrumCalc._dataLoadFrequencyVsX = function(vsFieldNames, minValue = Infinity, maxValue = -Infinity) {

  const flightSamples = this._getFlightSamplesFreqVsX(vsFieldNames, minValue, maxValue);

  // We divide it into FREQ_VS_THR_CHUNK_TIME_MS FFT chunks, we calculate the average throttle
  // for each chunk. We use a moving window to get more chunks available.
  const fftChunkLength = this._blackBoxRate * FREQ_VS_THR_CHUNK_TIME_MS / 1000;
  const fftChunkWindow = Math.round(fftChunkLength / FREQ_VS_THR_WINDOW_DIVISOR);

  let maxNoise = 0; // Stores the maximum amplitude of the fft over all chunks
   // Matrix where each row represents a bin of vs values, and the columns are amplitudes at frequencies
  const matrixFftOutput = new Array(NUM_VS_BINS).fill(null).map(() => new Float64Array(fftChunkLength * 2));

  const numberSamples = new Uint32Array(NUM_VS_BINS); // Number of samples in each vs value, used to average them later.

  const fft = new FFT.complex(fftChunkLength, false);
  for (let fftChunkIndex = 0; fftChunkIndex + fftChunkLength < flightSamples.samples.length; fftChunkIndex += fftChunkWindow) {

    const fftInput = flightSamples.samples.slice(fftChunkIndex, fftChunkIndex + fftChunkLength);
    let fftOutput = new Float64Array(fftChunkLength * 2);

    // Hanning window applied to input data
    if (userSettings.analyserHanning) {
      this._hanningWindow(fftInput, fftChunkLength);
    }

    fft.simple(fftOutput, fftInput, 'real');

    fftOutput = fftOutput.slice(0, fftChunkLength);

    // Use only abs values
    for (let i = 0; i < fftChunkLength; i++) {
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
      numberSamples[vsBinIndex]++;

      // add the output from the fft to the row given by the vs value bin index
      for (let i = 0; i < fftOutput.length; i++) {
        matrixFftOutput[vsBinIndex][i] += fftOutput[i];
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
      fftLength  : fftChunkLength,
      fftOutput  : matrixFftOutput,
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
  const fftChunkLength = this._blackBoxRate * FREQ_VS_THR_CHUNK_TIME_MS / 1000;
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

  maxValue *= MAX_RPM_AXIS_GAP;

  if (minValue > maxValue) {
    if (minValue == Infinity) {  // this should never happen
      minValue = 0;
      maxValue = 100;
      console.log("Invalid minimum value");
    } else {
      console.log("Maximum value %f smaller than minimum value %d", maxValue, minValue);
      minValue = 0;
      maxValue = 100;
    }
  }

  let slicedVsValues = [];
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
  const fftOutput = new Float64Array(fftLength * 2);
  const fft = new FFT.complex(fftLength, false);

  fft.simple(fftOutput, samples, type);

  return fftOutput;
};


/**
 * Makes all the values absolute and returns the index of maxFrequency found
 */
GraphSpectrumCalc._normalizeFft = function(fftOutput, fftLength) {

  if (!fftLength) {
    fftLength = fftOutput.length;
  }

  // Make all the values absolute, and calculate some useful values (max noise, etc.)
  const maxFrequency = (this._blackBoxRate / 2.0);
  const noiseLowEndIdx = 100 / maxFrequency * fftLength;
  let maxNoiseIdx = 0;
  let maxNoise = 0;

  for (let i = 0; i < fftLength; i++) {
    fftOutput[i] = Math.abs(fftOutput[i]);
    if (i > noiseLowEndIdx && fftOutput[i] > maxNoise) {
      maxNoise = fftOutput[i];
      maxNoiseIdx = i;
    }
  }

  maxNoiseIdx = maxNoiseIdx / fftLength * maxFrequency;

  const fftData = {
    fieldIndex   : this._dataBuffer.fieldIndex,
    fieldName  : this._dataBuffer.fieldName,
    fftLength  : fftLength,
    fftOutput  : fftOutput,
    maxNoiseIdx  : maxNoiseIdx,
    blackBoxRate : this._blackBoxRate,
  };

  return fftData;
};

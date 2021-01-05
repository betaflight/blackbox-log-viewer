"use strict";

const
    FIELD_THROTTLE_NAME = 'rcCommands[3]',
    FREQ_VS_THR_CHUNK_TIME_MS = 300,
    FREQ_VS_THR_WINDOW_DIVISOR = 6,
    MAX_ANALYSER_LENGTH = 300 * 1000 * 1000, // 5min
    THROTTLE_VALUES = 100;

var GraphSpectrumCalc = GraphSpectrumCalc || {
    _analyserTimeRange : { 
            in: 0,
            out: MAX_ANALYSER_LENGTH
    },
    _blackBoxRate : 0,
    _dataBuffer : {
            fieldIndex: 0,
            curve: 0,
            fieldName: null
    },
    _flightLog : null,
    _sysConfig : null,
};

GraphSpectrumCalc.initialize = function(flightLog, sysConfig) {

    this._flightLog = flightLog; 
    this._sysConfig = sysConfig;

    var gyroRate = (1000000 / this._sysConfig['looptime']).toFixed(0);
    this._blackBoxRate = gyroRate * this._sysConfig['frameIntervalPNum'] / this._sysConfig['frameIntervalPDenom'];
    if (this._sysConfig.pid_process_denom != null) {
        this._blackBoxRate = this._blackBoxRate / this._sysConfig.pid_process_denom;
    }
};

GraphSpectrumCalc.setInTime = function(time) {
    this._analyserTimeRange.in = time;
    return this._analyserTimeRange.in;
};

GraphSpectrumCalc.setOutTime = function(time) {
    if((time - this._analyserTimeRange.in) <= MAX_ANALYSER_LENGTH) {
        this._analyserTimeRange.out = time;
    } else {
        this._analyserTimeRange.out = analyserTimeRange.in + MAX_ANALYSER_LENGTH;
    }
    return this._analyserTimeRange.out;
};

GraphSpectrumCalc.setDataBuffer = function(dataBuffer) {
    this._dataBuffer = dataBuffer;
};

GraphSpectrumCalc.dataLoadFrequency = function() {

    var flightSamples = this._getFlightSamplesFreq();

    if(userSettings.analyserHanning) {
        this._hanningWindow(flightSamples.samples, flightSamples.count);
    }

    //calculate fft
    var fftOutput = this._fft(flightSamples.samples);

    // Normalize the result
    var fftData = this._normalizeFft(fftOutput, flightSamples.samples.length);

    return fftData;
};

GraphSpectrumCalc.dataLoadFrequencyVsThrottle = function() {

    var flightSamples = this._getFlightSamplesFreqVsThrottle();

    // We divide it into FREQ_VS_THR_CHUNK_TIME_MS FFT chunks, we calculate the average throttle 
    // for each chunk. We use a moving window to get more chunks available. 
    var fftChunkLength = this._blackBoxRate * FREQ_VS_THR_CHUNK_TIME_MS / 1000;
    var fftChunkWindow = Math.round(fftChunkLength / FREQ_VS_THR_WINDOW_DIVISOR);

    var maxNoiseThrottle = 0; // Stores the max noise produced
    var matrixFftOutput = new Array(THROTTLE_VALUES);  // One for each throttle value, without decimal part
    var numberSamplesThrottle = new Uint32Array(THROTTLE_VALUES); // Number of samples in each throttle value, used to average them later.

    var fft = new FFT.complex(fftChunkLength, false);
    for (var fftChunkIndex = 0; fftChunkIndex + fftChunkLength < flightSamples.samples.length; fftChunkIndex += fftChunkWindow) {
        
        var fftInput = flightSamples.samples.slice(fftChunkIndex, fftChunkIndex + fftChunkLength);
        var fftOutput = new Float64Array(fftChunkLength * 2);
        
        // Hanning window applied to input data
        if(userSettings.analyserHanning) {
            this._hanningWindow(fftInput, fftChunkLength);
        }

        fft.simple(fftOutput, fftInput, 'real');

        fftOutput = fftOutput.slice(0, fftChunkLength);

        // Use only abs values
        for (var i = 0; i < fftChunkLength; i++) {
            fftOutput[i] = Math.abs(fftOutput[i]);
            if (fftOutput[i] > maxNoiseThrottle) {
                maxNoiseThrottle = fftOutput[i];
            }
        }

        // Calculate average throttle
        var avgThrottle = 0; 
        for (var indexThrottle = fftChunkIndex; indexThrottle < fftChunkIndex + fftChunkLength; indexThrottle++) {
            avgThrottle += flightSamples.throttle[indexThrottle];
        } 
        // Average throttle, removing the decimal part
        avgThrottle = Math.round(avgThrottle / 10 / fftChunkLength);

        numberSamplesThrottle[avgThrottle]++;
        if (!matrixFftOutput[avgThrottle]) {
            matrixFftOutput[avgThrottle] = fftOutput;
        } else {
            matrixFftOutput[avgThrottle] = matrixFftOutput[avgThrottle].map(function (num, idx) {
                return num + fftOutput[idx];
            });
        }
    }

    // Divide by the number of samples
    for (var i = 0; i < THROTTLE_VALUES; i++) {
        if (numberSamplesThrottle[i] > 1) {
            for (var j = 0; j < matrixFftOutput[i].length; j++) {
                matrixFftOutput[i][j] /= numberSamplesThrottle[i]; 
            }
        } else if (numberSamplesThrottle[i] == 0) {
            matrixFftOutput[i] = new Float64Array(fftChunkLength * 2);
        }
    }

    // The output data needs to be smoothed, the sampling is not perfect 
    // but after some tests we let the data as is, an we prefer to apply a 
    // blur algorithm to the heat map image

    var fftData = {
            fieldIndex   : this._dataBuffer.fieldIndex,
            fieldName    : this._dataBuffer.fieldName,
            fftLength    : fftChunkLength,
            fftOutput    : matrixFftOutput,
            maxNoise     : maxNoiseThrottle,
            blackBoxRate : this._blackBoxRate,
    };

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
        fieldName    : this._dataBuffer.fieldName,
        axisName     : FlightLogFieldPresenter.fieldNameToFriendly(`axisError[${axisIndex}]`),
        fftOutput    : errorBySetpoint,
        fftMaxOutput : maxErrorBySetpoint,
    };

};

GraphSpectrumCalc._getFlightChunks = function() {

    var logStart = 0;
    if(this._analyserTimeRange.in) {
        logStart = this._analyserTimeRange.in;
    } else {
        logStart = this._flightLog.getMinTime();
    } 

    var logEnd = 0; 
    if(this._analyserTimeRange.out) {
        logEnd = this._analyserTimeRange.out;
    } else {
        logEnd = this._flightLog.getMaxTime(); 
    }

    // Limit size
    logEnd = (logEnd - logStart <= MAX_ANALYSER_LENGTH)? logEnd : logStart + MAX_ANALYSER_LENGTH;

    var allChunks = this._flightLog.getChunksInTimeRange(logStart, logEnd);

    return allChunks;
}

GraphSpectrumCalc._getFlightSamplesFreq = function() {

    var allChunks = this._getFlightChunks();

    var samples = new Float64Array(MAX_ANALYSER_LENGTH / (1000 * 1000) * this._blackBoxRate);

    // Loop through all the samples in the chunks and assign them to a sample array ready to pass to the FFT.
    var samplesCount = 0;
    for (var chunkIndex = 0; chunkIndex < allChunks.length; chunkIndex++) {
        var chunk = allChunks[chunkIndex];
        for (var frameIndex = 0; frameIndex < chunk.frames.length; frameIndex++) {
            samples[samplesCount] = (this._dataBuffer.curve.lookupRaw(chunk.frames[frameIndex][this._dataBuffer.fieldIndex]));
            samplesCount++;
        }
    }

    return {
        samples : samples,
        count : samplesCount
    };
};

GraphSpectrumCalc._getFlightSamplesFreqVsThrottle = function() {

    var allChunks = this._getFlightChunks();

    var samples = new Float64Array(MAX_ANALYSER_LENGTH / (1000 * 1000) * this._blackBoxRate);
    var throttle = new Uint16Array(MAX_ANALYSER_LENGTH / (1000 * 1000) * this._blackBoxRate);

    const FIELD_THROTTLE_INDEX = this._flightLog.getMainFieldIndexByName(FIELD_THROTTLE_NAME);

    // Loop through all the samples in the chunks and assign them to a sample array ready to pass to the FFT.
    var samplesCount = 0;
    for (var chunkIndex = 0; chunkIndex < allChunks.length; chunkIndex++) {
        var chunk = allChunks[chunkIndex];
        for (var frameIndex = 0; frameIndex < chunk.frames.length; frameIndex++) {
            samples[samplesCount] = (this._dataBuffer.curve.lookupRaw(chunk.frames[frameIndex][this._dataBuffer.fieldIndex]));
            throttle[samplesCount] = chunk.frames[frameIndex][FIELD_THROTTLE_INDEX]*10;
            samplesCount++;
        }
    }

    return {
            samples  : samples,
            throttle : throttle,
            count    : samplesCount
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
    for (let chunkIndex = 0; chunkIndex < allChunks.length; chunkIndex++) {
        const chunk = allChunks[chunkIndex];
        for (let frameIndex = 0; frameIndex < chunk.frames.length; frameIndex++) {
            piderror[samplesCount] = chunk.frames[frameIndex][FIELD_PIDERROR_INDEX];
            setpoint[samplesCount] = chunk.frames[frameIndex][FIELD_SETPOINT_INDEX];
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

    for(var i=0; i < size; i++) {
        samples[i] *= 0.5 * (1-Math.cos((2*Math.PI*i)/(size - 1)));
    }
};

GraphSpectrumCalc._fft  = function(samples, type) {

    if (!type) {
        type = 'real';
    }

    var fftLength = samples.length;
    var fftOutput = new Float64Array(fftLength * 2);
    var fft = new FFT.complex(fftLength, false);

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
    var maxFrequency = (this._blackBoxRate / 2.0);
    var noiseLowEndIdx = 100 / maxFrequency * fftLength;
    var maxNoiseIdx = 0;
    var maxNoise = 0;
    
    for (var i = 0; i < fftLength; i++) {
        fftOutput[i] = Math.abs(fftOutput[i]);
        if (i > noiseLowEndIdx && fftOutput[i] > maxNoise) {
            maxNoise = fftOutput[i];
            maxNoiseIdx = i;
        }
    }

    maxNoiseIdx = maxNoiseIdx / fftLength * maxFrequency;

    var fftData = {
        fieldIndex   : this._dataBuffer.fieldIndex,
        fieldName    : this._dataBuffer.fieldName,
        fftLength    : fftLength,
        fftOutput    : fftOutput,
        maxNoiseIdx  : maxNoiseIdx,
        blackBoxRate : this._blackBoxRate,
    };

    return fftData;
};

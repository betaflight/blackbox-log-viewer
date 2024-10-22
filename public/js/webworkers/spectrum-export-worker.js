importScripts("/js/lodash.min.js");

onmessage = function(event) {
  const columnDelimiter = event.data.opts.columnDelimiter;
  const fftOutput = event.data.fftOutput;
  const spectrumDataLength = fftOutput.length / 2;
  const frequencyStep = 0.5 * event.data.blackBoxRate / spectrumDataLength;

  let outText = "freq" + columnDelimiter + "value" + "\n"
  for (let index = 0; index < spectrumDataLength; index += 10) {
    const frequency = frequencyStep * index;
    outText += frequency.toString() + columnDelimiter + fftOutput[index].toString() + "\n";
  }

  postMessage(outText);
};

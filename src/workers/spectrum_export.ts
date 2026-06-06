export interface SpectrumExportPayload {
  opts: { columnDelimiter: string };
  fftOutput: ArrayLike<number>;
  blackBoxRate: number;
}

// Pure spectrum CSV serialization (no worker globals), unit/golden-testable.
export function buildSpectrumCsv(data: SpectrumExportPayload): string {
  const columnDelimiter = data.opts.columnDelimiter;
  const fftOutput = data.fftOutput;
  const spectrumDataLength = fftOutput.length;
  const frequencyStep = (0.5 * data.blackBoxRate) / spectrumDataLength;

  let outText = `x${columnDelimiter}y\n`;
  for (let index = 0; index < spectrumDataLength; index++) {
    const frequency = frequencyStep * index;
    outText += `${frequency.toString()}${columnDelimiter}${fftOutput[index].toString()}\n`;
  }

  return outText;
}

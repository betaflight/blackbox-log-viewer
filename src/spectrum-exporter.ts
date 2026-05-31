interface SpectrumExportOptions {
  columnDelimiter: string;
  quoteStrings: boolean;
}

interface SpectrumFftData {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fftOutput: any;
  blackBoxRate: number;
}

export function SpectrumExporter(
  fftData: SpectrumFftData,
  opts: Partial<SpectrumExportOptions> = {},
) {
  const options: SpectrumExportOptions = {
    columnDelimiter: ",",
    quoteStrings: true,
    ...opts,
  };

  function dump(success: (data: unknown) => void) {
    const worker = new Worker("/js/webworkers/spectrum-export-worker.js");

    worker.onmessage = (event) => {
      success(event.data);
      worker.terminate();
    };

    worker.postMessage({
      fftOutput: fftData.fftOutput,
      blackBoxRate: fftData.blackBoxRate,
      opts: options,
    });
  }

  // exposed functions
  return {
    dump: dump,
  };
}

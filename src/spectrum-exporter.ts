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
    const worker = new Worker(
      new URL("./workers/spectrum-export-worker.ts", import.meta.url),
      { type: "module" },
    );

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

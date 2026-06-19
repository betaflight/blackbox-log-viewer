export function loadMagCharacterizationModel(model: Record<string, unknown>): {
  valid: boolean;
  error?: string;
  model?: {
    fusion?: {
      earthFieldNedGauss?: { n: number; e: number; d: number };
      qualityBounds?: {
        bounds_ok?: boolean;
        field_strength_mg?: number;
      };
      magNoiseGauss?: {
        sigma_xy?: number;
        sigma_z?: number;
        sigma?: number;
      };
      gaussPerCorrectedUnit?: number;
      frame?: string;
    };
    version?: string | number;
    [key: string]: unknown;
  };
};

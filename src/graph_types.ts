// Shared model for the user-editable graph configuration (the "stored"/edit
// shape). A field's `curve` is this `{ power, MinMax, ... }` descriptor while
// stored and while edited in GraphConfigDialog; the grapher replaces it with an
// ExpoCurve instance at render time (those runtime-adapted graphs stay loose).

export interface MinMax {
  min: number;
  max: number;
}

export interface Curve {
  power?: number;
  MinMax?: MinMax;
  steps?: number;
  highPrecise?: boolean;
  // Present on the default curve produced for some debug fields (e.g. EZLANDING),
  // and on the ExpoCurve source params.
  offset?: number;
  inputRange?: number;
  outputRange?: number;
}

export interface GraphField {
  name: string;
  curve?: Curve;
  smoothing?: number;
  // Hex string for stored/edited fields; -1 in example configs (auto-assign).
  color?: string | number;
  lineWidth?: number;
  // Added when fields are expanded/adapted against a flight log.
  friendlyName?: string;
  index?: number;
}

export interface GraphConfigEntry {
  label: string;
  height?: number;
  fields: GraphField[];
  // Computed by the grapher during vertical layout.
  y?: number;
}

export type GraphConfigList = GraphConfigEntry[];

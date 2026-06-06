import { constrain } from "./tools.js";

// The runtime-adapted graph/field shape the pen adjustments mutate: by the time
// these run the graphs have been expanded against a log, so `curve.power`,
// `curve.MinMax` and `smoothing` are present (the stored model types them
// optional). `default` is a legacy array that also carries `.smoothing`/`.power`
// — kept as an array so it serializes exactly as before.
interface PenDefault extends Array<number> {
  smoothing?: number;
  power?: number;
}
interface PenCurve {
  power: number;
  MinMax: { min: number; max: number };
}
interface PenField {
  smoothing: number;
  curve: PenCurve;
  friendlyName: string;
  default?: PenDefault;
}
export interface PenGraph {
  fields: PenField[];
}

export function savePenDefaults(
  graphs: PenGraph[],
  group: string | null,
  field: string | null,
): string | null {
  if (group == null && field == null) {
    return null;
  }

  if (group != null && field == null) {
    const gi = Number.parseInt(group, 10);
    for (const configField of graphs[gi].fields) {
      if (configField.default == null) {
        configField.default = [];
        configField.default.smoothing = configField.smoothing;
        configField.default.power = configField.curve.power;
      }
    }
    return "<h4>Stored defaults for all pens</h4>";
  }
  if (group != null && field != null) {
    const gi = Number.parseInt(group, 10);
    const fi = Number.parseInt(field, 10);
    if (graphs[gi].fields[fi].default == null) {
      graphs[gi].fields[fi].default = [];
      graphs[gi].fields[fi].default.smoothing = graphs[gi].fields[fi].smoothing;
      graphs[gi].fields[fi].default.power = graphs[gi].fields[fi].curve.power;
      return "<h4>Stored defaults for single pen</h4>";
    }
  }
  return null;
}

export function restorePenDefaults(
  graphs: PenGraph[],
  group: string | null,
  field: string | null,
): string | null {
  if (group == null && field == null) {
    return null;
  }

  if (group != null && field == null) {
    const gi = Number.parseInt(group, 10);
    for (const configField of graphs[gi].fields) {
      if (configField.default == null) {
        return null;
      }
      configField.smoothing = configField.default.smoothing!;
      configField.curve.power = configField.default.power!;
    }
    return "<h4>Restored defaults for all pens</h4>";
  }
  if (group != null && field != null) {
    const gi = Number.parseInt(group, 10);
    const fi = Number.parseInt(field, 10);
    if (graphs[gi].fields[fi].default == null) {
      return null;
    }
    graphs[gi].fields[fi].smoothing = graphs[gi].fields[fi].default.smoothing!;
    graphs[gi].fields[fi].curve.power = graphs[gi].fields[fi].default.power!;
    return "<h4>Restored defaults for single pen</h4>";
  }
  return null;
}

export function changePenSmoothing(
  graphs: PenGraph[],
  group: string | null,
  field: string | null,
  delta: boolean,
): string | null {
  const range = { min: 0, max: 10000 };
  const scroll = 1000;

  if (group == null && field == null) {
    return null;
  }

  savePenDefaults(graphs, group, field);

  let changedValue = "<h4>Smoothing</h4>";
  if (group != null && field == null) {
    const gi = Number.parseInt(group, 10);
    for (const configField of graphs[gi].fields) {
      configField.smoothing += delta ? -scroll : +scroll;
      configField.smoothing = constrain(configField.smoothing, range.min, range.max);
      changedValue += `${configField.friendlyName} ${(configField.smoothing / 100).toFixed(2)}%\n`;
    }
    return changedValue;
  }
  if (group != null && field != null) {
    const gi = Number.parseInt(group, 10);
    const fi = Number.parseInt(field, 10);
    graphs[gi].fields[fi].smoothing += delta ? -scroll : +scroll;
    graphs[gi].fields[fi].smoothing = constrain(graphs[gi].fields[fi].smoothing, range.min, range.max);
    return `${changedValue + graphs[gi].fields[fi].friendlyName} ${(graphs[gi].fields[fi].smoothing / 100).toFixed(2)}%\n`;
  }
  return null;
}

export function changePenZoom(
  graphs: PenGraph[],
  group: string | null,
  field: string | null,
  delta: boolean,
): string | null {
  if (group == null && field == null) {
    return null;
  }

  savePenDefaults(graphs, group, field);
  const zoomScaleOut = 1.05;
  const scale = delta ? zoomScaleOut : 1 / zoomScaleOut;
  const direction = delta ? "Zoom out:\n" : "Zoom in:\n";

  if (group != null && field == null) {
    const gi = Number.parseInt(group, 10);
    let changedValue = `<h4></h4>${direction}`;
    for (const configField of graphs[gi].fields) {
      configField.curve.MinMax.min *= scale;
      configField.curve.MinMax.max *= scale;
      changedValue += `${configField.friendlyName}\n`;
    }
    return changedValue;
  }
  if (group != null && field != null) {
    const gi = Number.parseInt(group, 10);
    const fi = Number.parseInt(field, 10);
    graphs[gi].fields[fi].curve.MinMax.min *= scale;
    graphs[gi].fields[fi].curve.MinMax.max *= scale;
    return `<h4></h4>${direction}${graphs[gi].fields[fi].friendlyName}\n`;
  }
  return null;
}

export function changePenExpo(
  graphs: PenGraph[],
  group: string | null,
  field: string | null,
  delta: boolean,
): string | null {
  const range = { min: 0.05, max: 1 };
  const scroll = 0.05;

  if (group == null && field == null) {
    return null;
  }

  savePenDefaults(graphs, group, field);

  let changedValue = "<h4>Expo</h4>";
  if (group != null && field == null) {
    const gi = Number.parseInt(group, 10);
    for (const configField of graphs[gi].fields) {
      configField.curve.power += delta ? -scroll : +scroll;
      configField.curve.power = constrain(configField.curve.power, range.min, range.max);
      changedValue += `${configField.friendlyName} ${(configField.curve.power * 100).toFixed(2)}%\n`;
    }
    return changedValue;
  }
  if (group != null && field != null) {
    const gi = Number.parseInt(group, 10);
    const fi = Number.parseInt(field, 10);
    graphs[gi].fields[fi].curve.power += delta ? -scroll : +scroll;
    graphs[gi].fields[fi].curve.power = constrain(graphs[gi].fields[fi].curve.power, range.min, range.max);
    return `${changedValue + graphs[gi].fields[fi].friendlyName} ${(graphs[gi].fields[fi].curve.power * 100).toFixed(2)}%\n`;
  }
  return null;
}

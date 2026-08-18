export const DEFAULT_RUBRIC_KEY = "1960";

export const RUBRIC_DEFINITIONS = Object.freeze({
  1954: Object.freeze({
    key: "1954",
    label: "Pre-1955",
    version: "Divino Afflatu - 1954",
    missal: "Roman Missal · Divino Afflatu 1954",
    dataPath: "pre-1955",
  }),
  1960: Object.freeze({
    key: "1960",
    label: "1960",
    version: "Rubrics 1960 - 1960",
    missal: "1962 Roman Missal",
    dataPath: "",
  }),
});

export const RUBRIC_KEYS = Object.freeze(Object.keys(RUBRIC_DEFINITIONS));

const RUBRIC_ALIASES = new Map([
  ["1954", "1954"],
  ["pre-1955", "1954"],
  ["pre1955", "1954"],
  ["divino-afflatu", "1954"],
  ["divino afflatu", "1954"],
  ["1960", "1960"],
  ["1962", "1960"],
  ["rubrics-1960", "1960"],
]);

export function rubricKey(value, { fallback = DEFAULT_RUBRIC_KEY } = {}) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  return RUBRIC_ALIASES.get(String(value).trim().toLowerCase()) ?? null;
}

export function rubricDefinition(value, options) {
  const key = rubricKey(value, options);
  return key ? RUBRIC_DEFINITIONS[key] : null;
}

export function rubricAssetPath(key, date) {
  const rubric = rubricDefinition(key, { fallback: null });
  if (!rubric) throw new Error(`Unsupported rubric key: ${key}`);
  const prefix = rubric.dataPath ? `${rubric.dataPath}/` : "";
  return `/data/mass/${prefix}${date.slice(0, 4)}/${date}.json`;
}

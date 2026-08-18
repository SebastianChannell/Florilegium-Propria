import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { RUBRIC_DEFINITIONS, RUBRIC_KEYS } from "./lib/rubrics.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicDirectory = join(root, "public");
const outputDirectory = join(root, "dist");
const massDirectory = join(publicDirectory, "data", "mass");

if (!existsSync(join(publicDirectory, "index.html"))) {
  throw new Error("public/index.html is missing");
}

if (!existsSync(massDirectory)) {
  throw new Error("No generated Mass data exists in public/data/mass/");
}

function editionDirectory(rubric) {
  return rubric.dataPath ? join(massDirectory, rubric.dataPath) : massDirectory;
}

function yearsFor(rubric) {
  const directory = editionDirectory(rubric);
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{4}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

const available = JSON.parse(readFileSync(join(massDirectory, "available.json"), "utf8"));
if (available.schemaVersion !== 2 || available.defaultRubric !== "1960") {
  throw new Error("public/data/mass/available.json does not describe both rubric editions");
}

let dayCount = 0;
let editionYearCount = 0;
let expectedYears = null;

for (const key of RUBRIC_KEYS) {
  const rubric = RUBRIC_DEFINITIONS[key];
  const years = yearsFor(rubric);
  if (years.length === 0) throw new Error(`Generate at least one ${rubric.label} calendar year before building`);
  if (expectedYears && JSON.stringify(years) !== JSON.stringify(expectedYears)) {
    throw new Error(`${rubric.label}: generated years do not match the other rubric edition`);
  }
  expectedYears = years;

  const advertisedYears = (available.rubrics?.[key]?.years ?? []).map(String);
  if (JSON.stringify(years) !== JSON.stringify(advertisedYears)) {
    throw new Error(`${rubric.label}: available-year manifest is out of date`);
  }

  for (const year of years) {
    const directory = join(editionDirectory(rubric), year);
    const filenames = readdirSync(directory).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name));
    const expected = new Date(Date.UTC(Number(year), 1, 29)).getUTCMonth() === 1 ? 366 : 365;
    if (filenames.length !== expected) {
      throw new Error(`${rubric.label} ${year}: expected ${expected} daily Mass files, found ${filenames.length}`);
    }

    const manifest = JSON.parse(readFileSync(join(directory, "index.json"), "utf8"));
    if ((manifest.rubricKey && manifest.rubricKey !== key) || manifest.rubrics !== rubric.version) {
      throw new Error(`${rubric.label} ${year}: year manifest identifies the wrong rubrics`);
    }
    if (Object.keys(manifest.days ?? {}).length !== expected) {
      throw new Error(`${rubric.label} ${year}: year manifest is incomplete`);
    }

    const sample = JSON.parse(readFileSync(join(directory, filenames[0]), "utf8"));
    if (
      (sample.rubricKey && sample.rubricKey !== key)
      || sample.rubrics !== rubric.version
      || sample.sections?.length === 0
    ) {
      throw new Error(`${rubric.label} ${year}: daily Mass data is invalid`);
    }
    dayCount += filenames.length;
    editionYearCount += 1;
  }
}

const comparisonPath = join(massDirectory, "rubrics-comparison.json");
if (!existsSync(comparisonPath)) throw new Error("Run npm run compare:rubrics before building");
const comparison = JSON.parse(readFileSync(comparisonPath, "utf8"));
if ((comparison.totals?.readingDaysDifferent ?? 0) === 0) {
  throw new Error("Rubric comparison report does not contain reading differences");
}

rmSync(outputDirectory, { recursive: true, force: true });
mkdirSync(outputDirectory, { recursive: true });
cpSync(publicDirectory, outputDirectory, { recursive: true });

console.log(
  `Built ${dayCount} daily Masses across ${editionYearCount} rubric-year calendars in dist/`,
);

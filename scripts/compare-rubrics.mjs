import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { plainText } from "./lib/divinum-parser.mjs";
import { RUBRIC_DEFINITIONS } from "./lib/rubrics.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const massDirectory = join(root, "public", "data", "mass");

function argumentsFor(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) continue;
    const [name, inline] = argument.slice(2).split("=", 2);
    const value = inline ?? argv[index + 1];
    if (inline === undefined) index += 1;
    values.set(name, value);
  }
  return values;
}

function editionDirectory(key) {
  const dataPath = RUBRIC_DEFINITIONS[key].dataPath;
  return dataPath ? join(massDirectory, dataPath) : massDirectory;
}

async function yearsFor(key) {
  const entries = await readdir(editionDirectory(key), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && /^\d{4}$/.test(entry.name))
    .map((entry) => Number(entry.name))
    .sort((left, right) => left - right);
}

function normalizedText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.:;])/g, "$1")
    .trim();
}

function comparablePlainText(value) {
  const normalizedInitials = String(value ?? "").replace(
    /<span class="rubric">\s*<strong>\s*<em>(\p{L})<\/em>\s*<\/strong>\s*<\/span>/gu,
    "$1",
  );
  return normalizedText(plainText(normalizedInitials));
}

function normalizedLatin(value) {
  return normalizedText(value).replace(/J/g, "I").replace(/j/g, "i");
}

function calendarSummary(mass) {
  return {
    title: normalizedLatin(mass.title),
    rank: normalizedText(mass.rank),
    note: normalizedText(mass.note),
  };
}

function observanceSummary(mass) {
  return {
    title: normalizedLatin(mass.title),
    note: normalizedText(mass.note),
  };
}

function scriptureReference(section) {
  const matches = [...String(section.latin?.html ?? "").matchAll(
    /<span class="rubric">\s*<em>([\s\S]*?)<\/em>\s*<\/span>/gi,
  )];
  const reference = matches
    .map((match) => normalizedText(plainText(match[1])))
    .find((value) => /\d/.test(value));
  return normalizedLatin(reference ?? "");
}

function appointedReadings(mass) {
  return mass.sections
    .filter((section) => new Set(["lesson", "gospel"]).has(section.kind))
    .map((section) => ({ kind: section.kind, reference: scriptureReference(section) }));
}

function allPropers(mass) {
  return mass.sections.map((section) => ({
    kind: section.kind,
    label: normalizedText(section.english?.label),
    text: comparablePlainText(section.english?.html),
  }));
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function massFor(key, year, date) {
  return readJson(join(editionDirectory(key), String(year), `${date}.json`));
}

function sampleFor(date, oldMass, newMass, differences) {
  return {
    date,
    differences,
    "1954": {
      ...calendarSummary(oldMass),
      readings: appointedReadings(oldMass),
    },
    "1960": {
      ...calendarSummary(newMass),
      readings: appointedReadings(newMass),
    },
  };
}

const options = argumentsFor(process.argv.slice(2));
const requestedYear = options.has("year") ? Number.parseInt(options.get("year"), 10) : null;
if (requestedYear !== null && (!Number.isInteger(requestedYear) || requestedYear < 1900 || requestedYear > 2100)) {
  throw new Error("Provide --year with a value from 1900 through 2100");
}

const [years1954, years1960] = await Promise.all([yearsFor("1954"), yearsFor("1960")]);
const sharedYears = years1954.filter((year) => years1960.includes(year));
const years = requestedYear === null ? sharedYears : sharedYears.filter((year) => year === requestedYear);
if (years.length === 0) throw new Error("No matching 1954 and 1960 calendar years are available to compare");

const report = {
  schemaVersion: 1,
  description: "Substantive Divinum Officium Mass differences between Divino Afflatu 1954 and the 1960 rubrics.",
  editions: {
    "1954": RUBRIC_DEFINITIONS[1954],
    "1960": RUBRIC_DEFINITIONS[1960],
  },
  totals: {
    daysCompared: 0,
    calendarDaysDifferent: 0,
    observanceDaysDifferent: 0,
    readingDaysDifferent: 0,
    properDaysDifferent: 0,
  },
  years: {},
};

for (const year of years) {
  const [manifest1954, manifest1960] = await Promise.all([
    readJson(join(editionDirectory("1954"), String(year), "index.json")),
    readJson(join(editionDirectory("1960"), String(year), "index.json")),
  ]);
  if (manifest1954.source?.commit !== manifest1960.source?.commit) {
    throw new Error(`${year}: editions were generated from different Divinum Officium commits`);
  }

  const dates = Object.keys(manifest1960.days ?? {}).filter((date) => manifest1954.days?.[date]).sort();
  const changedDates = { calendar: [], observance: [], readings: [], propers: [] };
  const samples = [];

  for (const date of dates) {
    const [mass1954, mass1960] = await Promise.all([
      massFor("1954", year, date),
      massFor("1960", year, date),
    ]);
    const differences = {
      calendar: !same(calendarSummary(mass1954), calendarSummary(mass1960)),
      observance: !same(observanceSummary(mass1954), observanceSummary(mass1960)),
      readings: !same(appointedReadings(mass1954), appointedReadings(mass1960)),
      propers: !same(allPropers(mass1954), allPropers(mass1960)),
    };

    for (const [kind, different] of Object.entries(differences)) {
      if (different) changedDates[kind].push(date);
    }
    if (samples.length < 20 && differences.readings) {
      samples.push(sampleFor(date, mass1954, mass1960, differences));
    }
  }

  const summary = {
    daysCompared: dates.length,
    calendarDaysDifferent: changedDates.calendar.length,
    observanceDaysDifferent: changedDates.observance.length,
    readingDaysDifferent: changedDates.readings.length,
    properDaysDifferent: changedDates.propers.length,
    source: manifest1960.source,
    changedDates,
    samples,
  };
  report.years[year] = summary;
  for (const key of Object.keys(report.totals)) report.totals[key] += summary[key];
}

if (report.totals.readingDaysDifferent === 0 || report.totals.properDaysDifferent === 0) {
  throw new Error("The generated calendars did not contain the expected rubric-dependent Mass differences");
}

const output = resolve(options.get("output") ?? join(massDirectory, "rubrics-comparison.json"));
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);

process.stdout.write(
  `Compared ${report.totals.daysCompared} days: ${report.totals.observanceDaysDifferent} observance, `
  + `${report.totals.readingDaysDifferent} appointed-reading, and `
  + `${report.totals.properDaysDifferent} complete-proper differences\n`,
);

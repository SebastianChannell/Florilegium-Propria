import { execFile } from "node:child_process";
import { cpus } from "node:os";
import {
  mkdir,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { parseDivinumMass } from "./lib/divinum-parser.mjs";
import {
  DEFAULT_RUBRIC_KEY,
  RUBRIC_DEFINITIONS,
  RUBRIC_KEYS,
  rubricAssetPath,
  rubricKey,
} from "./lib/rubrics.mjs";

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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

function datesInYear(year) {
  const dates = [];
  const cursor = new Date(Date.UTC(year, 0, 1));
  while (cursor.getUTCFullYear() === year) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function divinumDate(date) {
  const [year, month, day] = date.split("-");
  return `${month}-${day}-${year}`;
}

async function sourceMetadata(sourceDirectory) {
  const { stdout: commit } = await run("git", ["rev-parse", "HEAD"], { cwd: sourceDirectory });
  const { stdout: commitDate } = await run("git", ["show", "-s", "--format=%cI", "HEAD"], {
    cwd: sourceDirectory,
  });
  return {
    repository: "https://github.com/DivinumOfficium/divinum-officium",
    commit: commit.trim(),
    commitDate: commitDate.trim(),
  };
}

async function generateDay({ date, rubric, sourceDirectory, source }) {
  const script = join(sourceDirectory, "web", "cgi-bin", "missa", "missa.pl");
  const { stdout, stderr } = await run(
    process.env.PERL ?? "perl",
    [
      script,
      `version=${rubric.version}`,
      "command=praySanctaMissa",
      `date=${divinumDate(date)}`,
      "lang1=Latin",
      "lang2=English",
      "Propers=1",
      "nofancychars=0",
    ],
    {
      cwd: sourceDirectory,
      env: process.env,
      maxBuffer: 4 * 1024 * 1024,
      timeout: 90_000,
    },
  );

  if (stderr.trim()) {
    throw new Error(`${date} (${rubric.label}): Divinum Officium wrote to stderr: ${stderr.trim()}`);
  }

  return parseDivinumMass(stdout, { date, rubricKey: rubric.key, source });
}

async function inParallel(items, concurrency, label, task) {
  const results = new Array(items.length);
  let cursor = 0;
  let complete = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await task(items[index], index);
      complete += 1;
      if (complete % 25 === 0 || complete === items.length) {
        process.stdout.write(`${label}: resolved ${complete}/${items.length} days\n`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

function editionDirectory(outputDirectory, rubric) {
  return rubric.dataPath ? join(outputDirectory, rubric.dataPath) : outputDirectory;
}

async function availableYears(outputDirectory, rubric) {
  const directory = editionDirectory(outputDirectory, rubric);
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries
      .filter((entry) => (
        entry.isDirectory()
        && /^\d{4}$/.test(entry.name)
      ))
      .map((entry) => Number(entry.name))
      .sort((left, right) => left - right);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function generateEditionYear({
  concurrency,
  dates,
  outputDirectory,
  rubric,
  source,
  sourceDirectory,
  year,
}) {
  const masses = await inParallel(dates, concurrency, rubric.label, (date) => generateDay({
    date,
    rubric,
    sourceDirectory,
    source,
  }));

  const yearDirectory = join(editionDirectory(outputDirectory, rubric), String(year));
  await rm(yearDirectory, { recursive: true, force: true });
  await mkdir(yearDirectory, { recursive: true });

  for (const mass of masses) {
    await writeFile(join(yearDirectory, `${mass.date}.json`), `${JSON.stringify(mass, null, 2)}\n`);
  }

  const days = Object.fromEntries(masses.map((mass) => [mass.date, {
    title: mass.title,
    rank: mass.rank,
    note: mass.note,
    sectionCount: mass.sections.length,
    path: rubricAssetPath(rubric.key, mass.date),
  }]));

  const manifest = {
    schemaVersion: 2,
    year,
    rubricKey: rubric.key,
    label: rubric.label,
    rubrics: rubric.version,
    missal: rubric.missal,
    source,
    days,
  };
  await writeFile(join(yearDirectory, "index.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  process.stdout.write(
    `Generated ${masses.length} ${rubric.label} Masses for ${year} from ${source.commit.slice(0, 12)}\n`,
  );
}

async function writeAvailableManifest(outputDirectory, source) {
  const rubrics = {};
  for (const key of RUBRIC_KEYS) {
    const rubric = RUBRIC_DEFINITIONS[key];
    rubrics[key] = {
      label: rubric.label,
      version: rubric.version,
      missal: rubric.missal,
      years: await availableYears(outputDirectory, rubric),
    };
  }

  await writeFile(join(outputDirectory, "available.json"), `${JSON.stringify({
    schemaVersion: 2,
    defaultRubric: DEFAULT_RUBRIC_KEY,
    rubrics,
    source,
  }, null, 2)}\n`);
}

const options = argumentsFor(process.argv.slice(2));
const year = Number.parseInt(options.get("year") ?? "", 10);
const sourceOption = options.get("source") ?? process.env.DIVINUM_OFFICIUM_SOURCE;
const sourceDirectory = resolve(sourceOption ?? ".");
const outputDirectory = resolve(options.get("output") ?? join(root, "public", "data", "mass"));
const concurrency = Number.parseInt(
  options.get("concurrency") ?? String(Math.min(8, Math.max(2, cpus().length))),
  10,
);
const requestedRubrics = String(options.get("rubrics") ?? "all").trim().toLowerCase();
const requestedRubricKey = requestedRubrics === "all"
  ? null
  : rubricKey(requestedRubrics, { fallback: null });

if (!Number.isInteger(year) || year < 1900 || year > 2100) {
  throw new Error("Provide --year with a value from 1900 through 2100");
}

if (!sourceOption) {
  throw new Error("Provide --source or set DIVINUM_OFFICIUM_SOURCE");
}

if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 64) {
  throw new Error("Provide --concurrency with a value from 1 through 64");
}

if (requestedRubrics !== "all" && !requestedRubricKey) {
  throw new Error("Provide --rubrics with one of: all, 1954, pre-1955, 1960");
}

const source = await sourceMetadata(sourceDirectory);
const dates = datesInYear(year);
const keys = requestedRubrics === "all" ? RUBRIC_KEYS : [requestedRubricKey];

for (const key of keys) {
  await generateEditionYear({
    concurrency,
    dates,
    outputDirectory,
    rubric: RUBRIC_DEFINITIONS[key],
    source,
    sourceDirectory,
    year,
  });
}

await writeAvailableManifest(outputDirectory, source);

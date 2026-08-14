import { execFile } from "node:child_process";
import { cpus } from "node:os";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { parseDivinumMass } from "./lib/divinum-parser.mjs";

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

async function generateDay({ date, sourceDirectory, source }) {
  const script = join(sourceDirectory, "web", "cgi-bin", "missa", "missa.pl");
  const { stdout, stderr } = await run(
    process.env.PERL ?? "perl",
    [
      script,
      "version=Rubrics 1960 - 1960",
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
    throw new Error(`${date}: Divinum Officium wrote to stderr: ${stderr.trim()}`);
  }

  return parseDivinumMass(stdout, { date, source });
}

async function inParallel(items, concurrency, task) {
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
        process.stdout.write(`Resolved ${complete}/${items.length} days\n`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

async function availableYears(outputDirectory) {
  try {
    const entries = await readdir(outputDirectory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && /^\d{4}$/.test(entry.name))
      .map((entry) => Number(entry.name))
      .sort((left, right) => left - right);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

const options = argumentsFor(process.argv.slice(2));
const year = Number.parseInt(options.get("year") ?? "", 10);
const sourceDirectory = resolve(options.get("source") ?? process.env.DIVINUM_OFFICIUM_SOURCE ?? "");
const outputDirectory = resolve(options.get("output") ?? join(root, "public", "data", "mass"));
const concurrency = Number.parseInt(
  options.get("concurrency") ?? String(Math.min(8, Math.max(2, cpus().length))),
  10,
);

if (!Number.isInteger(year) || year < 1900 || year > 2100) {
  throw new Error("Provide --year with a value from 1900 through 2100");
}

if (!options.get("source") && !process.env.DIVINUM_OFFICIUM_SOURCE) {
  throw new Error("Provide --source or set DIVINUM_OFFICIUM_SOURCE");
}

const source = await sourceMetadata(sourceDirectory);
const dates = datesInYear(year);
const masses = await inParallel(dates, concurrency, (date) => generateDay({
  date,
  sourceDirectory,
  source,
}));

const yearDirectory = join(outputDirectory, String(year));
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
  path: `/data/mass/${year}/${mass.date}.json`,
}]));

const manifest = {
  schemaVersion: 1,
  year,
  rubrics: "Rubrics 1960 - 1960",
  missal: "1962 Roman Missal",
  source,
  days,
};
await writeFile(join(yearDirectory, "index.json"), `${JSON.stringify(manifest, null, 2)}\n`);

const years = await availableYears(outputDirectory);
await writeFile(join(outputDirectory, "available.json"), `${JSON.stringify({
  schemaVersion: 1,
  years,
  source,
}, null, 2)}\n`);

process.stdout.write(`Generated ${masses.length} Masses for ${year} from ${source.commit.slice(0, 12)}\n`);

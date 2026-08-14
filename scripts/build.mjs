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

const years = readdirSync(massDirectory, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^\d{4}$/.test(entry.name))
  .map((entry) => entry.name)
  .sort();

if (years.length === 0) throw new Error("Generate at least one calendar year before building");

let dayCount = 0;
for (const year of years) {
  const directory = join(massDirectory, year);
  const filenames = readdirSync(directory).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name));
  const expected = new Date(Date.UTC(Number(year), 1, 29)).getUTCMonth() === 1 ? 366 : 365;
  if (filenames.length !== expected) {
    throw new Error(`${year}: expected ${expected} daily Mass files, found ${filenames.length}`);
  }

  const manifest = JSON.parse(readFileSync(join(directory, "index.json"), "utf8"));
  if (Object.keys(manifest.days ?? {}).length !== expected) {
    throw new Error(`${year}: year manifest is incomplete`);
  }
  dayCount += filenames.length;
}

rmSync(outputDirectory, { recursive: true, force: true });
mkdirSync(outputDirectory, { recursive: true });
cpSync(publicDirectory, outputDirectory, { recursive: true });

console.log(`Built ${dayCount} daily Masses across ${years.length} year${years.length === 1 ? "" : "s"} in dist/`);

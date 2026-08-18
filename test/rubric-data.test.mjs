import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../public/data/mass/", import.meta.url);

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, root), "utf8"));
}

function references(mass) {
  return mass.sections
    .filter((section) => new Set(["lesson", "gospel"]).has(section.kind))
    .map((section) => {
      const match = section.latin.html.match(
        /<span class="rubric">\s*<em>([^<]*\d[^<]*)<\/em>\s*<\/span>/i,
      );
      return [section.kind, match?.[1] ?? ""];
    });
}

test("both rubric calendars advertise the current and next year", async () => {
  const available = await readJson("available.json");
  assert.equal(available.defaultRubric, "1960");
  assert.deepEqual(available.rubrics[1954].years, [2026, 2027]);
  assert.deepEqual(available.rubrics[1960].years, [2026, 2027]);
});

test("a known day resolves to different observances and appointed readings", async () => {
  const [mass1954, mass1960] = await Promise.all([
    readJson("pre-1955/2026/2026-08-18.json"),
    readJson("2026/2026-08-18.json"),
  ]);

  assert.equal(mass1954.rubricKey, "1954");
  assert.equal(mass1954.title, "Quarta die infra Octavam S. Assumptionis");
  assert.equal(mass1960.title, "Feria Tertia infra Hebdomadam XII post Octavam Pentecostes III. Augusti");
  assert.deepEqual(references(mass1954), [
    ["lesson", "Judith 13, 22-25; 15:10"],
    ["gospel", "Luc 1:41-50"],
  ]);
  assert.deepEqual(references(mass1960), [
    ["lesson", "2 Cor 3:4-9"],
    ["gospel", "Luc 10:23-37"],
  ]);

  for (const mass of [mass1954, mass1960]) {
    assert.ok(mass.sections.every((section) => section.latin?.html && section.english?.html));
  }
});

test("the generated full-calendar comparison records substantive differences", async () => {
  const report = await readJson("rubrics-comparison.json");
  assert.equal(report.totals.daysCompared, 730);
  assert.ok(report.totals.observanceDaysDifferent > 0);
  assert.ok(report.totals.readingDaysDifferent > 0);
  assert.ok(report.totals.properDaysDifferent > 0);
  assert.ok(report.years[2026].changedDates.readings.includes("2026-08-18"));
});

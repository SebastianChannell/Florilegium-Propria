import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet as getMass } from "../functions/api/mass/[date].js";
import { onRequestGet as getRubricMass } from "../functions/api/mass/[rubrics]/[date].js";
import { onRequestGet as getToday } from "../functions/api/mass/today.js";

test("daily API redirects valid dates to immutable data", async () => {
  const response = await getMass({
    params: { date: "2026-08-14" },
    request: new Request("https://propria.example/api/mass/2026-08-14"),
  });
  assert.equal(response.status, 307);
  assert.equal(
    response.headers.get("location"),
    "https://propria.example/data/mass/2026/2026-08-14.json",
  );
});

test("daily API selects the pre-1955 data without breaking the default URL", async () => {
  const response = await getMass({
    params: { date: "2026-08-18" },
    request: new Request("https://propria.example/api/mass/2026-08-18?rubrics=1954"),
  });
  assert.equal(response.status, 307);
  assert.equal(
    response.headers.get("location"),
    "https://propria.example/data/mass/pre-1955/2026/2026-08-18.json",
  );
});

test("edition-specific API route accepts the public rubric names", async () => {
  const response = await getRubricMass({
    params: { rubrics: "pre-1955", date: "2026-08-18" },
    request: new Request("https://propria.example/api/mass/pre-1955/2026-08-18"),
  });
  assert.equal(response.status, 307);
  assert.equal(
    response.headers.get("location"),
    "https://propria.example/data/mass/pre-1955/2026/2026-08-18.json",
  );
});

test("daily API rejects unknown rubrics", async () => {
  const response = await getMass({
    params: { date: "2026-08-18" },
    request: new Request("https://propria.example/api/mass/2026-08-18?rubrics=1570"),
  });
  assert.equal(response.status, 400);
});

test("today API preserves the selected rubrics", async () => {
  const response = await getToday({
    request: new Request("https://propria.example/api/mass/today?rubrics=1954&timezone=UTC"),
  });
  assert.equal(response.status, 307);
  assert.match(response.headers.get("location"), /\/data\/mass\/pre-1955\/\d{4}\/\d{4}-\d{2}-\d{2}\.json$/);
});

test("daily API rejects impossible dates", async () => {
  const response = await getMass({
    params: { date: "2026-02-31" },
    request: new Request("https://propria.example/api/mass/2026-02-31"),
  });
  assert.equal(response.status, 400);
});

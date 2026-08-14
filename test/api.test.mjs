import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet as getMass } from "../functions/api/mass/[date].js";

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

test("daily API rejects impossible dates", async () => {
  const response = await getMass({
    params: { date: "2026-02-31" },
    request: new Request("https://propria.example/api/mass/2026-02-31"),
  });
  assert.equal(response.status, 400);
});

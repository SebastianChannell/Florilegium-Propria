const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const RUBRIC_ALIASES = new Map([
  ["1954", "1954"],
  ["pre-1955", "1954"],
  ["pre1955", "1954"],
  ["divino-afflatu", "1954"],
  ["1960", "1960"],
  ["1962", "1960"],
]);

export function isDateKey(value) {
  if (!DATE_PATTERN.test(value ?? "")) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function normalizeRubric(value, { fallback = "1960" } = {}) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  return RUBRIC_ALIASES.get(String(value).trim().toLowerCase()) ?? null;
}

export function massAssetPath(rubric, date) {
  const prefix = rubric === "1954" ? "pre-1955/" : "";
  return `/data/mass/${prefix}${date.slice(0, 4)}/${date}.json`;
}

export function invalidRubricResponse() {
  return Response.json(
    { error: "Use rubrics=1954 (pre-1955) or rubrics=1960." },
    { status: 400, headers: { "Cache-Control": "no-store" } },
  );
}

export function massRedirect(request, rubric, date, maxAge) {
  const target = new URL(massAssetPath(rubric, date), request.url);
  return new Response(null, {
    status: 307,
    headers: {
      Location: target.toString(),
      "Cache-Control": `public, max-age=${maxAge}`,
    },
  });
}

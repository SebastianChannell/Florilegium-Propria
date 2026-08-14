const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isDateKey(value) {
  if (!DATE_PATTERN.test(value ?? "")) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export const onRequestGet = async ({ params, request }) => {
  const date = String(params.date ?? "");
  if (!isDateKey(date)) {
    return Response.json(
      { error: "Use a valid Gregorian date in YYYY-MM-DD format." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const target = new URL(`/data/mass/${date.slice(0, 4)}/${date}.json`, request.url);
  return new Response(null, {
    status: 307,
    headers: {
      Location: target.toString(),
      "Cache-Control": "public, max-age=300",
    },
  });
};

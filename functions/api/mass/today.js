import {
  invalidRubricResponse,
  massRedirect,
  normalizeRubric,
} from "../../lib/mass-routing.js";

function dateInTimezone(timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export const onRequestGet = async ({ request }) => {
  const url = new URL(request.url);
  const requestedTimezone = url.searchParams.get("timezone") ?? "America/New_York";
  const rubric = normalizeRubric(url.searchParams.get("rubrics"));
  if (!rubric) return invalidRubricResponse();

  let date;
  try {
    date = dateInTimezone(requestedTimezone);
  } catch {
    return Response.json(
      { error: "The supplied timezone is not a recognized IANA timezone." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  return massRedirect(request, rubric, date, 60);
};

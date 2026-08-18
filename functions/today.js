import { normalizeRubric } from "./lib/mass-routing.js";

function easternDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export const onRequestGet = async ({ request }) => {
  const requestUrl = new URL(request.url);
  const target = new URL("/", request.url);
  target.searchParams.set("date", easternDate());
  const rubric = normalizeRubric(requestUrl.searchParams.get("rubrics"));
  if (rubric === "1954") target.searchParams.set("rubrics", rubric);
  return Response.redirect(target.toString(), 302);
};

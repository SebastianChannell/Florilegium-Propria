import {
  invalidRubricResponse,
  isDateKey,
  massRedirect,
  normalizeRubric,
} from "../../../lib/mass-routing.js";

export const onRequestGet = async ({ params, request }) => {
  const rubric = normalizeRubric(params.rubrics, { fallback: null });
  if (!rubric) return invalidRubricResponse();

  const date = String(params.date ?? "");
  if (!isDateKey(date)) {
    return Response.json(
      { error: "Use a valid Gregorian date in YYYY-MM-DD format." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  return massRedirect(request, rubric, date, 300);
};

import {
  invalidRubricResponse,
  isDateKey,
  massRedirect,
  normalizeRubric,
} from "../../lib/mass-routing.js";

export const onRequestGet = async ({ params, request }) => {
  const date = String(params.date ?? "");
  if (!isDateKey(date)) {
    return Response.json(
      { error: "Use a valid Gregorian date in YYYY-MM-DD format." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const rubric = normalizeRubric(new URL(request.url).searchParams.get("rubrics"));
  if (!rubric) return invalidRubricResponse();
  return massRedirect(request, rubric, date, 300);
};

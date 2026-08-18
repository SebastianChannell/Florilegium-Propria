const elements = {
  article: document.querySelector("#mass-content"),
  date: document.querySelector("#mass-date"),
  dateInput: document.querySelector("#date-input"),
  edition: document.querySelector("#mass-edition"),
  languageRow: document.querySelector("#language-row"),
  nextDay: document.querySelector("#next-day"),
  note: document.querySelector("#mass-note"),
  previousDay: document.querySelector("#previous-day"),
  propers: document.querySelector("#propers"),
  rank: document.querySelector("#mass-rank"),
  rubricButtons: [...document.querySelectorAll("[data-rubrics]")],
  status: document.querySelector("#status-message"),
  subtitle: document.querySelector("#site-subtitle"),
  title: document.querySelector("#mass-title"),
  viewLabel: document.querySelector("#view-label"),
  viewToggle: document.querySelector("#view-toggle"),
};

const READINGS = new Set(["lesson", "gospel"]);
const RUBRICS = Object.freeze({
  1954: Object.freeze({
    edition: "Divino Afflatu · 1954",
    errorLabel: "Divino Afflatu 1954",
    subtitle: "Missa diéi · Divino Afflatu MCMLIV",
  }),
  1960: Object.freeze({
    edition: "Missale Romanum · 1962",
    errorLabel: "1960/1962",
    subtitle: "Missa diéi · Rubricæ MCMLX",
  }),
});
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DECORATIVE_INITIAL_PATTERN = /<span class="rubric">\s*<strong>\s*<em>(\p{L})<\/em>\s*<\/strong>\s*<\/span>/gu;
const REPEATED_BREAK_PATTERN = /(?:<br>\s*){2,}/gi;

const state = {
  date: localDateKey(new Date()),
  mass: null,
  request: 0,
  rubrics: "1960",
  view: "readings",
};

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isDateKey(value) {
  if (!DATE_PATTERN.test(value ?? "")) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function shiftDate(dateKey, amount) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + amount));
  return shifted.toISOString().slice(0, 10);
}

function displayDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function pageUrl() {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("date", state.date);
  if (state.rubrics === "1954") url.searchParams.set("rubrics", "1954");
  if (state.view === "all") url.searchParams.set("view", "all");
  return `${url.pathname}${url.search}`;
}

function setText(element, value) {
  const text = String(value ?? "").trim();
  element.textContent = text;
  element.hidden = !text;
}

function normalizeProperHtml(value) {
  return String(value ?? "")
    .replace(DECORATIVE_INITIAL_PATTERN, "$1")
    .replace(REPEATED_BREAK_PATTERN, "<br>");
}

function renderRubricContext(mass = null) {
  const rubric = RUBRICS[state.rubrics];
  elements.edition.textContent = rubric.edition;
  elements.edition.title = mass?.rubrics ?? "";
  elements.subtitle.textContent = rubric.subtitle;
  for (const button of elements.rubricButtons) {
    const selected = button.dataset.rubrics === state.rubrics;
    button.setAttribute("aria-pressed", String(selected));
  }
}

function makeSection(section) {
  const wrapper = document.createElement("section");
  wrapper.className = "proper-section";
  wrapper.dataset.kind = section.kind;
  wrapper.id = `proper-${section.id}`;

  const heading = document.createElement("h2");
  heading.className = "proper-heading";

  const latinHeading = document.createElement("span");
  latinHeading.lang = "la";
  latinHeading.textContent = section.latin.label;

  const englishHeading = document.createElement("span");
  englishHeading.lang = "en";
  englishHeading.textContent = section.english.label;

  const text = document.createElement("div");
  text.className = "proper-text";

  const latin = document.createElement("div");
  latin.className = "proper-column";
  latin.lang = "la";
  latin.innerHTML = normalizeProperHtml(section.latin.html);

  const english = document.createElement("div");
  english.className = "proper-column";
  english.lang = "en";
  english.innerHTML = normalizeProperHtml(section.english.html);

  heading.append(latinHeading, englishHeading);
  text.append(latin, english);
  wrapper.append(heading, text);
  return wrapper;
}

function renderMass() {
  const mass = state.mass;
  if (!mass) return;

  renderRubricContext(mass);
  elements.date.dateTime = state.date;
  elements.date.textContent = displayDate(state.date);
  elements.title.textContent = mass.title || "Feria";
  elements.title.hidden = false;
  setText(elements.rank, mass.rank);
  setText(elements.note, mass.note);

  const sections = state.view === "all"
    ? mass.sections
    : mass.sections.filter((section) => READINGS.has(section.kind));

  elements.propers.replaceChildren(...sections.map(makeSection));
  elements.languageRow.hidden = sections.length === 0;
  elements.status.hidden = sections.length !== 0;
  if (sections.length === 0) {
    elements.status.classList.add("is-error");
    elements.status.textContent = "No Lectio or Evangelium was identified for this liturgical day.";
  }

  const all = state.view === "all";
  elements.viewLabel.textContent = all ? "All propers" : "Lectio · Evangelium";
  elements.viewToggle.textContent = all ? "Show readings only" : "Show all propers";
  elements.viewToggle.setAttribute("aria-pressed", String(all));
  elements.article.setAttribute("aria-busy", "false");
  document.title = `${mass.title || "Daily Mass"} — Propria`;
}

function showLoading() {
  renderRubricContext();
  elements.article.setAttribute("aria-busy", "true");
  elements.date.dateTime = state.date;
  elements.date.textContent = displayDate(state.date);
  elements.title.hidden = false;
  elements.title.textContent = "Resolving the Mass…";
  elements.rank.hidden = true;
  elements.note.hidden = true;
  elements.languageRow.hidden = true;
  elements.propers.replaceChildren();
  elements.status.hidden = false;
  elements.status.classList.remove("is-error");
  elements.status.textContent = "Loading the Latin and English propers…";
}

function showError() {
  elements.article.setAttribute("aria-busy", "false");
  elements.title.hidden = false;
  elements.title.textContent = "Mass unavailable";
  elements.rank.hidden = true;
  elements.note.hidden = true;
  elements.languageRow.hidden = true;
  elements.propers.replaceChildren();
  elements.status.hidden = false;
  elements.status.classList.add("is-error");
  elements.status.textContent = `The generated ${RUBRICS[state.rubrics].errorLabel} propers for ${displayDate(state.date)} are not available yet.`;
  document.title = "Mass unavailable — Propria";
}

async function fetchMass(dateKey, rubricKey) {
  const year = dateKey.slice(0, 4);
  const paths = rubricKey === "1954"
    ? [
        `/api/mass/1954/${dateKey}`,
        `/api/mass/${dateKey}?rubrics=1954`,
        `/data/mass/pre-1955/${year}/${dateKey}.json`,
      ]
    : [
        `/api/mass/${dateKey}`,
        `/data/mass/${year}/${dateKey}.json`,
      ];

  for (const path of paths) {
    const response = await fetch(path, { headers: { Accept: "application/json" } });
    if (response.ok) return response.json();
    if (response.status !== 404) throw new Error(`Mass request failed with ${response.status}`);
  }

  throw new Error("Mass data not found");
}

async function loadDate(dateKey, { historyMode = "push", focus = false } = {}) {
  if (!isDateKey(dateKey)) return;
  state.date = dateKey;
  state.mass = null;
  elements.dateInput.value = dateKey;

  if (historyMode === "push") history.pushState({}, "", pageUrl());
  if (historyMode === "replace") history.replaceState({}, "", pageUrl());

  const request = ++state.request;
  const rubric = state.rubrics;
  showLoading();

  try {
    const mass = await fetchMass(dateKey, rubric);
    if (request !== state.request) return;
    if (mass.rubricKey && mass.rubricKey !== rubric) {
      throw new Error(`Expected ${rubric} Mass data, received ${mass.rubricKey}`);
    }
    state.mass = mass;
    renderMass();
  } catch (error) {
    if (request !== state.request) return;
    console.error(error);
    showError();
  }

  if (focus) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    elements.title.focus({ preventScroll: true });
  }
}

function setView(view, { updateHistory = true } = {}) {
  state.view = view === "all" ? "all" : "readings";
  if (state.mass) renderMass();
  if (updateHistory) history.replaceState({}, "", pageUrl());
}

function setRubrics(value, { load = true, updateHistory = true } = {}) {
  const rubrics = Object.hasOwn(RUBRICS, value) ? value : "1960";
  const changed = rubrics !== state.rubrics;
  state.rubrics = rubrics;
  renderRubricContext();
  if (!changed) return;
  if (updateHistory) history.pushState({}, "", pageUrl());
  if (load) loadDate(state.date, { historyMode: "none" });
}

elements.previousDay.addEventListener("click", () => {
  loadDate(shiftDate(state.date, -1), { focus: true });
});

elements.nextDay.addEventListener("click", () => {
  loadDate(shiftDate(state.date, 1), { focus: true });
});

elements.dateInput.addEventListener("change", () => {
  if (isDateKey(elements.dateInput.value)) {
    loadDate(elements.dateInput.value, { focus: true });
  }
});

elements.viewToggle.addEventListener("click", () => {
  setView(state.view === "all" ? "readings" : "all");
});

for (const button of elements.rubricButtons) {
  button.addEventListener("click", () => setRubrics(button.dataset.rubrics));
}

window.addEventListener("popstate", () => {
  const params = new URLSearchParams(window.location.search);
  setView(params.get("view"), { updateHistory: false });
  setRubrics(params.get("rubrics"), { load: false, updateHistory: false });
  const date = params.get("date");
  loadDate(isDateKey(date) ? date : localDateKey(new Date()), { historyMode: "none" });
});

const params = new URLSearchParams(window.location.search);
const initialDate = isDateKey(params.get("date")) ? params.get("date") : state.date;
setView(params.get("view"), { updateHistory: false });
setRubrics(params.get("rubrics"), { load: false, updateHistory: false });
loadDate(initialDate, { historyMode: "replace" });

const elements = {
  article: document.querySelector("#mass-content"),
  date: document.querySelector("#mass-date"),
  dateInput: document.querySelector("#date-input"),
  languageRow: document.querySelector("#language-row"),
  nextDay: document.querySelector("#next-day"),
  note: document.querySelector("#mass-note"),
  previousDay: document.querySelector("#previous-day"),
  propers: document.querySelector("#propers"),
  rank: document.querySelector("#mass-rank"),
  status: document.querySelector("#status-message"),
  title: document.querySelector("#mass-title"),
  viewLabel: document.querySelector("#view-label"),
  viewToggle: document.querySelector("#view-toggle"),
};

const READINGS = new Set(["lesson", "gospel"]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const state = {
  date: localDateKey(new Date()),
  mass: null,
  request: 0,
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
  if (state.view === "all") url.searchParams.set("view", "all");
  return `${url.pathname}${url.search}`;
}

function setText(element, value) {
  const text = String(value ?? "").trim();
  element.textContent = text;
  element.hidden = !text;
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
  latin.innerHTML = section.latin.html;

  const english = document.createElement("div");
  english.className = "proper-column";
  english.lang = "en";
  english.innerHTML = section.english.html;

  heading.append(latinHeading, englishHeading);
  text.append(latin, english);
  wrapper.append(heading, text);
  return wrapper;
}

function renderMass() {
  const mass = state.mass;
  if (!mass) return;

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
  elements.status.textContent = `The generated 1960/1962 propers for ${displayDate(state.date)} are not available yet.`;
  document.title = "Mass unavailable — Propria";
}

async function fetchMass(dateKey) {
  const year = dateKey.slice(0, 4);
  const paths = [
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
  showLoading();

  try {
    const mass = await fetchMass(dateKey);
    if (request !== state.request) return;
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

window.addEventListener("popstate", () => {
  const params = new URLSearchParams(window.location.search);
  setView(params.get("view"), { updateHistory: false });
  const date = params.get("date");
  loadDate(isDateKey(date) ? date : localDateKey(new Date()), { historyMode: "none" });
});

const params = new URLSearchParams(window.location.search);
const initialDate = isDateKey(params.get("date")) ? params.get("date") : state.date;
setView(params.get("view"), { updateHistory: false });
loadDate(initialDate, { historyMode: "replace" });

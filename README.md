# Florilegium Propria

A quiet, mobile-first reader for the daily Roman Mass propers under either the
**Divino Afflatu 1954 (pre-1955)** or **1960/1962** rubrics. The first view
contains only the **Lectio** and **Evangelium**; one control reveals the
complete set of propers. Every section keeps the Latin and English texts side
by side.

## How the daily Mass is resolved

Propria does not try to recreate either Roman calendar with a small list of
feast dates. Its data job runs the actual Divinum Officium Mass engine twice
for every Gregorian date, using exactly these DO versions:

- `Divino Afflatu - 1954` for the pre-1955 selector; and
- `Rubrics 1960 - 1960` for the 1960 selector used with the 1962 Missal.

For each version, that engine:

1. resolves temporal and sanctoral occurrence under the selected rubrics;
2. selects the winning Mass and any permitted commemorations;
3. inherits missing sections from the appointed Common; and
4. expands the resolved Latin and English Mass into normalized JSON.

The website itself remains static. The backwards-compatible 1960 calendar
lives in `public/data/mass/<year>/`; the pre-1955 calendar lives in
`public/data/mass/pre-1955/<year>/`. Each directory has a compact `index.json`
manifest. The lightweight Pages Functions under `functions/api/mass/` validate
a date and redirect to the selected immutable JSON asset.

- `/today` opens the reader on the present Eastern-calendar date.
- `/api/mass/today` returns that day's JSON asset (optional `timezone` and
  `rubrics=1954` query parameters are supported).
- `/api/mass/YYYY-MM-DD` returns the 1960 Mass by default and accepts
  `?rubrics=1954` for the pre-1955 Mass.
- `/api/mass/1954/YYYY-MM-DD` and `/api/mass/1960/YYYY-MM-DD` are explicit
  edition-specific aliases.

## Local use

The checked-in generated year is enough to run the reader:

```sh
npm run dev
```

Then open `http://localhost:4173`.

Run all build and parser checks with:

```sh
npm run check
```

## Refresh a year from Divinum Officium

Clone Divinum Officium and install the Perl modules used by its CGI generator.
On Debian or Ubuntu:

```sh
sudo apt-get install libcgi-pm-perl liburi-perl libhtml-parser-perl
git clone --depth 1 https://github.com/DivinumOfficium/divinum-officium.git /tmp/divinum-officium
npm run sync:year -- --year 2026 --source /tmp/divinum-officium
```

That command regenerates both rubric editions by default. Pass
`--rubrics 1954` or `--rubrics 1960` only when deliberately refreshing a
single edition. To compare the resolved calendars and verify that their
appointed readings and complete propers differ, run:

```sh
npm run compare:rubrics
```

The resulting `public/data/mass/rubrics-comparison.json` records the changed
dates and summary counts for every available year.

The included GitHub Action generates and compares both editions for the present
and next calendar years on a schedule, and can also be run manually for a
selected year.

## Cloudflare Pages

Connect the repository to Cloudflare Pages with:

- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `/`

No database, secret, or storage binding is required.

## Data provenance

The interface code is MIT-licensed. The generated Mass data comes from the
MIT-licensed Divinum Officium project; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

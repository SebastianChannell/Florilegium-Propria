# Florilegium Propria

A quiet, mobile-first reader for the daily Mass propers of the 1962 Roman
Missal. The first view contains only the **Lectio** and **Evangelium**; one
control reveals the complete set of propers. Every section keeps the Latin and
English texts side by side.

## How the daily Mass is resolved

Propria does not try to recreate the Roman calendar with a small list of feast
dates. Its data job runs the actual Divinum Officium Mass engine with
`Rubrics 1960 - 1960` for every Gregorian date. That engine:

1. resolves temporal and sanctoral occurrence under the 1960 rubrics used by
   the 1962 Missal;
2. selects the winning Mass and any permitted commemorations;
3. inherits missing sections from the appointed Common; and
4. expands the resolved Latin and English Mass into normalized JSON.

The website itself remains static. Generated days live in
`public/data/mass/<year>/`, while `index.json` is the compact year manifest.
The lightweight Pages Functions under `functions/api/mass/` validate a date and
redirect to its immutable JSON asset.

- `/today` opens the reader on the present Eastern-calendar date.
- `/api/mass/today` returns that day's JSON asset (an optional `timezone` query
  accepts another IANA timezone).
- `/api/mass/YYYY-MM-DD` returns the generated Mass for a selected date.

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

The included GitHub Action performs the same process for the present and next
calendar years on a schedule, and can also be run manually for a selected
year.

## Cloudflare Pages

Connect the repository to Cloudflare Pages with:

- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `/`

No database, secret, or storage binding is required.

## Data provenance

The interface code is MIT-licensed. The generated Mass data comes from the
MIT-licensed Divinum Officium project; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

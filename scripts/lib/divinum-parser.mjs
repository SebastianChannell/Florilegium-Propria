const ROW_PATTERN = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
const CELL_PATTERN = /<td\b([^>]*)>([\s\S]*?)<\/td>/gi;
const FONT_PATTERN = /<font\b([^>]*)>\s*<b>\s*<i>([\s\S]*?)<\/i>\s*<\/b>\s*<\/font>/gi;

const NAMED_ENTITIES = new Map([
  ["amp", "&"],
  ["apos", "'"],
  ["gt", ">"],
  ["hellip", "…"],
  ["laquo", "«"],
  ["ldquo", "“"],
  ["lsquo", "‘"],
  ["lt", "<"],
  ["mdash", "—"],
  ["nbsp", " "],
  ["ndash", "–"],
  ["quot", "\""],
  ["raquo", "»"],
  ["rdquo", "”"],
  ["rsquo", "’"],
  ["ensp", " "],
  ["emsp", " "],
]);

export function decodeEntities(value = "") {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi, (entity, key) => {
    if (key.startsWith("#x")) return String.fromCodePoint(Number.parseInt(key.slice(2), 16));
    if (key.startsWith("#")) return String.fromCodePoint(Number.parseInt(key.slice(1), 10));
    return NAMED_ENTITIES.get(key.toLowerCase()) ?? entity;
  });
}

export function plainText(value = "") {
  return decodeEntities(
    value
      .replace(/<br\s*\/?\s*>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function removeUnbalancedTags(html, tagName) {
  const pattern = new RegExp(`<${tagName}\\b[^>]*>|</${tagName}>`, "gi");
  const stack = [];
  const removals = [];

  for (const match of html.matchAll(pattern)) {
    if (match[0].startsWith("</")) {
      const opening = stack.pop();
      if (!opening) removals.push({ index: match.index, length: match[0].length });
    } else {
      stack.push({ index: match.index, length: match[0].length });
    }
  }

  removals.push(...stack);
  return removals
    .sort((left, right) => right.index - left.index)
    .reduce(
      (value, removal) => `${value.slice(0, removal.index)}${value.slice(removal.index + removal.length)}`,
      html,
    );
}

function headingMatch(cell) {
  FONT_PATTERN.lastIndex = 0;
  for (const match of cell.matchAll(FONT_PATTERN)) {
    const attributes = match[1];
    const isHeading = /\bsize\s*=\s*["']?\+1["']?/i.test(attributes)
      && /\bcolor\s*=\s*["']?red["']?/i.test(attributes);
    if (isHeading) return match;
  }
  return null;
}

function sanitizeCell(cell, heading) {
  let html = cell;

  if (heading) {
    html = `${html.slice(0, heading.index)}${html.slice((heading.index ?? 0) + heading[0].length)}`;
  }
  html = html.replace(/<div\b[^>]*\balign\s*=\s*["']?right["']?[^>]*>[\s\S]*?<\/div>/gi, "");

  html = html.replace(/<!--[\s\S]*?-->/g, "");
  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  html = html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  html = html.replace(/<input\b[^>]*>/gi, "");
  html = html.replace(/<a\b[^>]*>/gi, "").replace(/<\/a>/gi, "");
  html = html.replace(/<div\b[^>]*>/gi, "").replace(/<\/div>/gi, "");

  html = html.replace(
    /<font\b(?=[^>]*\bcolor\s*=\s*["']?red["']?)[^>]*>\s*<i>\s*(℣\.|℟\.|V\.|R\.)\s*<\/i>\s*<\/font>/gi,
    '<span class="marker"><em>$1</em></span>',
  );

  html = html.replace(/<font\b([^>]*)>/gi, (_, attributes) => (
    /\bcolor\s*=\s*["']?(?:red|maroon|purple)["']?/i.test(attributes)
      ? '<span class="rubric">'
      : "<span>"
  ));
  html = html.replace(/<\/font>/gi, "</span>");

  html = html.replace(/<span\b([^>]*)>/gi, (_, attributes) => {
    const classMatch = attributes.match(/\bclass\s*=\s*["']([^"']+)["']/i);
    const allowedClass = classMatch?.[1]
      .split(/\s+/)
      .find((name) => new Set(["marker", "rubric", "rubric-symbol"]).has(name));
    if (allowedClass) return `<span class="${allowedClass}">`;
    if (/\bstyle\s*=\s*["'][^"']*\bcolor\s*:\s*red/i.test(attributes)) {
      return '<span class="rubric-symbol">';
    }
    return "<span>";
  });

  html = html
    .replace(/<b>/gi, "<strong>")
    .replace(/<\/b>/gi, "</strong>")
    .replace(/<i>/gi, "<em>")
    .replace(/<\/i>/gi, "</em>")
    .replace(/<br\s*\/?\s*>/gi, "<br>");

  html = html.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (tag, name) => (
    new Set(["span", "em", "strong", "br"]).has(name.toLowerCase()) ? tag : ""
  ));
  html = html.replace(/<(span|em|strong)\b[^>]*>/gi, (tag, name) => {
    if (name.toLowerCase() !== "span") return `<${name.toLowerCase()}>`;
    const classMatch = tag.match(/\bclass\s*=\s*["'](marker|rubric|rubric-symbol)["']/i);
    return classMatch ? `<span class="${classMatch[1].toLowerCase()}">` : "<span>";
  });

  html = html
    .replace(/^(?:\s|<br>)+/i, "")
    .replace(/(?:\s|<br>)+$/i, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .trim();

  for (const tagName of ["span", "em", "strong"]) {
    html = removeUnbalancedTags(html, tagName);
  }

  return html;
}

function kindFor(latin, english) {
  const label = `${latin} ${english}`.toLowerCase();
  if (/\b(lectio|lectiones|lesson|readings?|epistle|prophetia|prophecies|prophecy)\b/.test(label)) return "lesson";
  if (/\b(evangelium|gospel|passio|passion)\b/.test(label)) return "gospel";
  if (/\bintroit/.test(label)) return "introit";
  if (/\bgloria\b/.test(label)) return "gloria";
  if (/\b(oratio|collect)\b/.test(label)) return "collect";
  if (/\b(graduale|gradual)\b/.test(label)) return "gradual";
  if (/\b(tractus|tract)\b/.test(label)) return "tract";
  if (/\b(alleluia)\b/.test(label)) return "alleluia";
  if (/\b(sequentia|sequence)\b/.test(label)) return "sequence";
  if (/\bcredo\b/.test(label)) return "creed";
  if (/\boffertor/.test(label)) return "offertory";
  if (/\bsecreta\b|\bsecret\b/.test(label)) return "secret";
  if (/\bprefatio\b|\bpreface\b/.test(label)) return "preface";
  if (/\bcommunio\b|\bcommunion\b/.test(label)) return "communion";
  if (/\bpostcommunio\b|\bpostcommunion\b/.test(label)) return "postcommunion";
  return "proper";
}

function slug(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "proper";
}

function headline(html) {
  const body = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
  const paragraphMatch = body.match(/<p\b(?=[^>]*\balign\s*=\s*["']?center["']?)[^>]*>([\s\S]*?)<\/p>/i);
  const paragraph = paragraphMatch?.[1] ?? "";
  const titleMatch = paragraph.match(/<font\b[^>]*>([\s\S]*?)<\/font>/i);
  const rawTitle = plainText(titleMatch?.[1] ?? "");
  const [title, ...rankParts] = rawTitle.split(/\s*~\s*/);

  const note = titleMatch ? plainText(paragraph.replace(titleMatch[0], "")) : "";

  return {
    title: title.trim() || "Feria",
    rank: rankParts.join(" ~ ").trim(),
    note,
  };
}

export function parseDivinumMass(html, { date, source } = {}) {
  if (!html || !/<table\b/i.test(html)) {
    throw new Error(`${date ?? "Mass"}: Divinum Officium output did not contain a Mass table`);
  }

  const sections = [];
  const ids = new Map();

  ROW_PATTERN.lastIndex = 0;
  for (const row of html.matchAll(ROW_PATTERN)) {
    const cells = [...row[1].matchAll(CELL_PATTERN)];
    if (cells.length !== 2) continue;
    if (/\bcolspan\b/i.test(cells[0][1]) || /\bcolspan\b/i.test(cells[1][1])) continue;

    const latinHeading = headingMatch(cells[0][2]);
    const englishHeading = headingMatch(cells[1][2]);
    if (!latinHeading || !englishHeading) continue;

    const latinLabel = plainText(latinHeading[2]);
    const englishLabel = plainText(englishHeading[2]);
    if (!latinLabel || !englishLabel) continue;

    const kind = kindFor(latinLabel, englishLabel);
    const baseId = slug(kind === "proper" ? latinLabel : kind);
    const count = (ids.get(baseId) ?? 0) + 1;
    ids.set(baseId, count);
    let latinHtml = sanitizeCell(cells[0][2], latinHeading);
    let englishHtml = sanitizeCell(cells[1][2], englishHeading);

    // In Divinum Officium's propers-only output, an empty Gloria or Credo row
    // means that the Ordinary text is said; an omitted one explicitly says
    // "omit." Preserve that useful distinction in the normalized data.
    if (!latinHtml && !englishHtml && new Set(["gloria", "creed"]).has(kind)) {
      latinHtml = '<span class="rubric"><em>Dicitur.</em></span>';
      englishHtml = '<span class="rubric"><em>Said.</em></span>';
    }

    sections.push({
      id: count === 1 ? baseId : `${baseId}-${count}`,
      kind,
      latin: {
        label: latinLabel,
        html: latinHtml,
      },
      english: {
        label: englishLabel,
        html: englishHtml,
      },
    });
  }

  if (sections.length === 0) {
    throw new Error(`${date ?? "Mass"}: no paired proper sections were found`);
  }

  if (!sections.some((section) => section.kind === "lesson")) {
    throw new Error(`${date ?? "Mass"}: no Lectio was found`);
  }

  if (!sections.some((section) => section.kind === "gospel")) {
    throw new Error(`${date ?? "Mass"}: no Evangelium was found`);
  }

  return {
    schemaVersion: 1,
    date,
    rubrics: "Rubrics 1960 - 1960",
    missal: "1962 Roman Missal",
    ...headline(html),
    sections,
    source,
  };
}

import test from "node:test";
import assert from "node:assert/strict";
import { parseDivinumMass } from "../scripts/lib/divinum-parser.mjs";

const source = {
  repository: "https://github.com/DivinumOfficium/divinum-officium",
  commit: "abc123",
  commitDate: "2026-08-14T00:00:00Z",
};

const page = `
<html><body>
<P ALIGN="CENTER"><FONT COLOR="purple">Dominica X post Pentecosten ~ II. classis</FONT><br/>
<I><SPAN STYLE="font-size:82%;"><SPAN STYLE="color:maroon;">Commemoratio:</SPAN> S. Laurentii</SPAN></I></P>
<table>
  <TR>
    <TD WIDTH="50%"><DIV ALIGN="right">Next</DIV><FONT SIZE='+1' COLOR="red"><B><I>Lectio</I></B></FONT><br/>
      Léctio Epístolæ <FONT COLOR="red"><I>1 Cor 12:2-11</I></FONT><br/>
      <FONT COLOR="red"><I>℟.</I></FONT> Deo grátias.
    </TD>
    <TD WIDTH="50%"><DIV ALIGN="right">1</DIV><FONT SIZE='+1' COLOR="red"><B><I>Lesson</I></B></FONT><br/>
      Lesson from the Epistle <FONT COLOR="red"><I>1 Cor 12:2-11</I></FONT><br/>
      <FONT COLOR="red"><I>℟.</I></FONT> Thanks be to God.
    </TD>
  </TR>
  <TR>
    <TD WIDTH="50%"><FONT SIZE='+1' COLOR="red"><B><I>Evangelium</I></B></FONT><br/>
      Sequéntia <span style='color:red; font-size:1.25em'>+</span> sancti Evangélii.<br/>
      <FONT COLOR="red"><I>Luc 18:9-14</I></FONT>
    </TD>
    <TD WIDTH="50%"><FONT SIZE='+1' COLOR="red"><B><I>Gospel</I></B></FONT><br/>
      Continuation <span style='color:red; font-size:1.25em'>✠</span> of the Holy Gospel.<br/>
      <FONT COLOR="red"><I>Luke 18:9-14</I></FONT>
    </TD>
  </TR>
</table>
</body></html>`;

test("parses the bilingual readings and feast metadata", () => {
  const mass = parseDivinumMass(page, { date: "2026-08-09", source });
  assert.equal(mass.title, "Dominica X post Pentecosten");
  assert.equal(mass.rank, "II. classis");
  assert.equal(mass.note, "Commemoratio: S. Laurentii");
  assert.deepEqual(mass.sections.map((section) => section.kind), ["lesson", "gospel"]);
  assert.equal(mass.sections[0].latin.label, "Lectio");
  assert.equal(mass.sections[0].english.label, "Lesson");
  assert.match(mass.sections[0].latin.html, /class="marker"/);
  assert.match(mass.sections[1].english.html, /class="rubric-symbol"/);
  assert.doesNotMatch(mass.sections[0].latin.html, /DIV|FONT|STYLE/i);
});

test("rejects output without a Gospel", () => {
  const incomplete = page.replace(/<TR>\s*<TD WIDTH="50%"><FONT SIZE='\+1' COLOR="red"><B><I>Evangelium[\s\S]*?<\/TR>/, "");
  assert.throws(
    () => parseDivinumMass(incomplete, { date: "2026-08-09", source }),
    /no Evangelium/,
  );
});

test("removes an unmatched upstream formatting tag without dropping its text", () => {
  const malformed = page.replace(
    "Continuation <span style='color:red; font-size:1.25em'>✠</span>",
    "<FONT COLOR=\"red\"><br/>Continuation ✠",
  );
  const mass = parseDivinumMass(malformed, { date: "2026-08-09", source });
  const gospel = mass.sections.find((section) => section.kind === "gospel");
  assert.match(gospel.english.html, /Continuation ✠/);
  assert.equal(
    (gospel.english.html.match(/<span\b/g) ?? []).length,
    (gospel.english.html.match(/<\/span>/g) ?? []).length,
  );
});

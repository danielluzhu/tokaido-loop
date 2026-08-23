import type { Day, Leg, Note } from "./db";

const esc = (s: string) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

/**
 * A deliberately tiny markup so fields stay editable as plain text:
 *   **bold**   *italic*   `mono`
 *   "> " line  -> aside      "+ " line -> sub-note
 * Everything else is escaped, so a stray < or & in a hotel name is safe.
 */
function inline(s: string) {
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, '<span class="mono">$1</span>');
}

function blocks(s: string) {
  return String(s ?? "")
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((line) => {
      if (line.startsWith("> ")) return `<span class="alt">${inline(line.slice(2))}</span>`;
      if (line.startsWith("+ ")) return `<span class="sub">${inline(line.slice(2))}</span>`;
      return inline(line);
    })
    .join("");
}

function paras(s: string) {
  return String(s ?? "")
    .split(/\n\s*\n/)
    .filter((p) => p.trim() !== "")
    .map((p) => `<p>${inline(p.trim())}</p>`)
    .join("");
}

type Mode = { edit: boolean };

/** In edit mode a field becomes a contenteditable holding its RAW source. */
function f(mode: Mode, path: string, raw: string, rendered: string, tag = "span", cls = "") {
  const c = cls ? ` ${cls}` : "";
  if (!mode.edit) return cls ? `<${tag} class="${cls}">${rendered}</${tag}>` : rendered;
  return `<${tag} class="ed${c}" contenteditable="plaintext-only" data-path="${esc(path)}" spellcheck="false">${esc(raw)}</${tag}>`;
}

/* --------------------------------------------------------------- parts --- */

function entryControls(id: number, kind: string) {
  return `<div class="ctl" data-id="${id}">
    <button type="button" data-act="up"    title="Move up">↑</button>
    <button type="button" data-act="down"  title="Move down">↓</button>
    <button type="button" data-act="addday"  title="Add a day below">+ Day</button>
    <button type="button" data-act="addleg"  title="Add a travel leg below">+ Leg</button>
    <button type="button" data-act="del" class="danger" title="Delete this ${kind}">Delete</button>
  </div>`;
}

function renderDay(id: number, d: Day, mode: Mode) {
  const p = `entry:${id}`;
  const slots = d.slots
    .map(
      (s, i) => `<div class="slot">
        <div class="slot-label">${f(mode, `${p}:slots:${i}:label`, s.label, esc(s.label))}</div>
        <p class="slot-body">${f(mode, `${p}:slots:${i}:body`, s.body, blocks(s.body), "span", "block")}${
          mode.edit ? `<button type="button" class="slot-del" data-id="${id}" data-slot="${i}" title="Remove this row">×</button>` : ""
        }</p>
      </div>`,
    )
    .join("");

  const chipClass = d.chip?.kind ?? "stay";
  const chip = d.chip?.label
    ? `<span class="chip ${chipClass}">${f(mode, `${p}:chip:label`, d.chip.label, esc(d.chip.label))}</span>`
    : mode.edit
      ? `<span class="chip stay">${f(mode, `${p}:chip:label`, "", "")}</span>`
      : "";

  const note = d.fromNote
    ? `<span class="from-note">${f(mode, `${p}:fromNote`, d.fromNote, esc(d.fromNote))}</span>`
    : mode.edit
      ? `<span class="from-note">${f(mode, `${p}:fromNote`, "", "")}</span>`
      : "";

  return `<div class="entry" data-entry="${id}">
    <div class="marker"><div class="dot ${d.dot === "plain" ? "" : d.dot}"></div></div>
    <div>
      <div class="day">
        ${mode.edit ? entryControls(id, "day") : ""}
        <div class="day-head">
          <span class="daynum">${f(mode, `${p}:daynum`, d.daynum, esc(d.daynum))}</span>
          <h3 class="city">${f(mode, `${p}:city`, d.city, esc(d.city))}</h3>
          ${chip}
          ${note}
        </div>
        <div class="slots">${slots}</div>
        ${mode.edit ? `<button type="button" class="slot-add" data-id="${id}">+ Add row</button>` : ""}
      </div>
    </div>
  </div>`;
}

function renderLeg(id: number, l: Leg, mode: Mode) {
  const p = `entry:${id}`;
  return `<div class="entry" data-entry="${id}">
    <div class="marker leg-mark"><div class="glyph">${esc(l.glyph || "▮")}</div></div>
    <div>
      <div class="leg">
        ${mode.edit ? entryControls(id, "leg") : ""}
        <span class="leg-title">${f(mode, `${p}:title`, l.title, esc(l.title))}</span>
        <span class="leg-meta">${f(mode, `${p}:meta`, l.meta, esc(l.meta))}</span>
        <p class="leg-note">${f(mode, `${p}:note`, l.note, inline(l.note), "span", "block")}</p>
      </div>
    </div>
  </div>`;
}

function renderNote(id: number, n: Note, mode: Mode) {
  const p = `note:${id}`;
  let table = "";
  if (n.table) {
    const rows = n.table.rows
      .map(
        (r, i) =>
          `<tr><td>${f(mode, `${p}:table:rows:${i}:0`, r[0], esc(r[0]))}</td><td class="num">${f(mode, `${p}:table:rows:${i}:1`, r[1], esc(r[1]))}</td></tr>`,
      )
      .join("");
    table = `<div class="table-scroll"><table class="fares">
      <thead><tr><th>${f(mode, `${p}:table:head:0`, n.table.head[0], esc(n.table.head[0]))}</th><th>${f(mode, `${p}:table:head:1`, n.table.head[1], esc(n.table.head[1]))}</th></tr></thead>
      <tbody>${rows}
        <tr class="total"><td>${f(mode, `${p}:table:total:0`, n.table.total[0], esc(n.table.total[0]))}</td><td class="num">${f(mode, `${p}:table:total:1`, n.table.total[1], esc(n.table.total[1]))}</td></tr>
      </tbody></table></div>`;
  }
  const after = n.after
    ? `<p style="margin-top:9px">${f(mode, `${p}:after`, n.after, inline(n.after), "span", "block")}</p>`
    : "";

  return `<div class="note" data-note="${id}">
    ${mode.edit ? `<div class="ctl note-ctl" data-note-id="${id}"><button type="button" data-act="noteup">↑</button><button type="button" data-act="notedown">↓</button><button type="button" data-act="notedel" class="danger">Delete</button></div>` : ""}
    <h3>${f(mode, `${p}:heading`, n.heading, esc(n.heading))}</h3>
    ${f(mode, `${p}:body`, n.body, paras(n.body), "div", "block")}
    ${table}
    ${after}
  </div>`;
}

/* ---------------------------------------------------------------- page --- */
const TOOLBAR = `<div class="toolbar">
  <span class="status" id="status">Ready</span>
  <span class="spacer"></span>
  <button type="button" class="btn" id="undo">Undo</button>
  <button type="button" class="btn" id="export">Export</button>
  <a class="btn primary" href="/">Done</a>
</div>
<div class="legend">
  <span><b>**bold**</b></span>
  <span><b>*italic*</b></span>
  <span><b>\`mono\`</b></span>
  <span><b>&gt;</b> line = aside</span>
  <span><b>+</b> line = small note</span>
  <span>Changes save when you click away.</span>
</div>`;



export function renderBody(
  doc: { settings: Record<string, any>; entries: any[]; notes: any[] },
  mode: Mode,
) {
  const s = doc.settings;

  const route = (s.route ?? [])
    .map(
      (r: any, i: number) =>
        `<span class="stop${r.back ? " back" : ""}">${f(mode, `setting:route:${i}:name`, r.name, esc(r.name))}</span>` +
        (i < s.route.length - 1 ? `<span class="arrow">▸</span>` : ""),
    )
    .join("");

  const stats = (s.stats ?? [])
    .map(
      (t: any, i: number) =>
        `<div class="stat"><dt>${f(mode, `setting:stats:${i}:label`, t.label, esc(t.label))}</dt><dd>${f(mode, `setting:stats:${i}:value`, t.value, esc(t.value))}</dd></div>`,
    )
    .join("");

  const timeline = doc.entries
    .map((e) => (e.kind === "day" ? renderDay(e.id, e.data, mode) : renderLeg(e.id, e.data, mode)))
    .join("\n");

  const notes = doc.notes.map((n) => renderNote(n.id, n.data, mode)).join("\n");

  return `<div class="wrap${mode.edit ? " editing" : ""}">
${mode.edit ? TOOLBAR : ""}

  <header class="masthead">
    <p class="eyebrow">${f(mode, "setting:eyebrow", s.eyebrow, esc(s.eyebrow))}</p>
    <h1>${f(mode, "setting:title", s.title, esc(s.title))}</h1>
    <p class="standfirst">${f(mode, "setting:standfirst", s.standfirst, inline(s.standfirst), "span", "block")}</p>
  </header>

  <nav class="route" aria-label="Route">${route}</nav>

  <dl class="stats">${stats}</dl>

  <div class="timeline">
${timeline}
  </div>

  <section class="notes">
    <h2>${f(mode, "setting:notesHeading", s.notesHeading, esc(s.notesHeading))}</h2>
    <div class="note-grid">
${notes}
    </div>
    ${mode.edit ? `<button type="button" class="slot-add" id="add-note">+ Add note card</button>` : ""}

    <div class="caveat">
      <p>${f(mode, "setting:caveat", s.caveat, inline(s.caveat), "span", "block")}</p>
    </div>
  </section>

</div>`;
}

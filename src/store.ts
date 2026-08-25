/**
 * Every mutation of the itinerary goes through here, so the HTTP API and the
 * chat bot's tools share one code path (and one undo stack).
 */
import { db, exportDoc, getEntries, restorePhotoState } from "./db";

export function snapshot() {
  db.prepare("INSERT INTO snapshots (taken, payload) VALUES (?, ?)").run(
    new Date().toISOString(),
    JSON.stringify(exportDoc()),
  );
  // Keep the last 50; this is an undo stack, not an archive.
  db.exec(
    "DELETE FROM snapshots WHERE id NOT IN (SELECT id FROM snapshots ORDER BY id DESC LIMIT 50)",
  );
}

export function restore(doc: any) {
  db.transaction(() => {
    db.exec("DELETE FROM entries; DELETE FROM notes; DELETE FROM settings");
    const ps = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
    for (const [k, v] of Object.entries(doc.settings ?? {})) ps.run(k, JSON.stringify(v));
    const pe = db.prepare("INSERT INTO entries (id, position, kind, data) VALUES (?, ?, ?, ?)");
    (doc.entries ?? []).forEach((e: any, i: number) =>
      pe.run(e.id, (i + 1) * 100, e.kind, JSON.stringify(e.data)),
    );
    const pn = db.prepare("INSERT INTO notes (id, position, data) VALUES (?, ?, ?)");
    (doc.notes ?? []).forEach((n: any, i: number) =>
      pn.run(n.id, (i + 1) * 100, JSON.stringify(n.data)),
    );
    restorePhotoState(doc.photos ?? []);
  })();
}

export function undo() {
  const snap = db
    .query<{ id: number; payload: string }, []>(
      "SELECT id, payload FROM snapshots ORDER BY id DESC LIMIT 1",
    )
    .get();
  if (!snap) return false;
  restore(JSON.parse(snap.payload));
  db.prepare("DELETE FROM snapshots WHERE id = ?").run(snap.id);
  return true;
}

function setIn(obj: any, path: string[], value: string) {
  let cur = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const k: any = /^\d+$/.test(path[i]) ? Number(path[i]) : path[i];
    if (cur[k] === undefined || cur[k] === null) cur[k] = /^\d+$/.test(path[i + 1]) ? [] : {};
    cur = cur[k];
  }
  const last: any = /^\d+$/.test(path[path.length - 1])
    ? Number(path[path.length - 1])
    : path[path.length - 1];
  cur[last] = value;
}

export function applyField(path: string, value: string) {
  const parts = path.split(":");
  const [root] = parts;

  if (root === "setting") {
    const key = parts[1];
    const row = db
      .query<{ value: string }, [string]>("SELECT value FROM settings WHERE key = ?")
      .get(key);
    if (parts.length === 2) {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(
        key,
        JSON.stringify(value),
      );
      return;
    }
    const parsed = row ? JSON.parse(row.value) : {};
    setIn(parsed, parts.slice(2), value);
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(
      key,
      JSON.stringify(parsed),
    );
    return;
  }

  if (root === "photo") {
    const col = parts[2];
    if (!["alt", "credit", "license"].includes(col)) throw new Error("bad photo field: " + col);
    db.prepare(`UPDATE photos SET ${col} = ? WHERE id = ?`).run(value, Number(parts[1]));
    return;
  }

  const table = root === "entry" ? "entries" : root === "note" ? "notes" : null;
  if (!table) throw new Error("unknown field path: " + path);

  const id = Number(parts[1]);
  const row = db.query<{ data: string }, [number]>(`SELECT data FROM ${table} WHERE id = ?`).get(id);
  if (!row) throw new Error("no such " + root + ": " + id);

  const data = JSON.parse(row.data);
  setIn(data, parts.slice(2), value);
  db.prepare(`UPDATE ${table} SET data = ? WHERE id = ?`).run(JSON.stringify(data), id);
}

export function shift(table: "entries" | "notes", id: number, dir: "up" | "down") {
  const rows = db
    .query<{ id: number; position: number }, []>(`SELECT id, position FROM ${table} ORDER BY position`)
    .all();
  const i = rows.findIndex((r) => r.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= rows.length) return false;
  db.prepare(`UPDATE ${table} SET position = ? WHERE id = ?`).run(rows[j].position, rows[i].id);
  db.prepare(`UPDATE ${table} SET position = ? WHERE id = ?`).run(rows[i].position, rows[j].id);
  return true;
}

export function addEntry(kind: "day" | "leg", after?: string | number | null) {
  const rows = getEntries();
  const positions = db
    .query<{ position: number }, []>("SELECT position FROM entries ORDER BY position")
    .all();
  const idx = rows.findIndex((r) => String(r.id) === String(after));
  const cur = idx >= 0 ? positions[idx].position : 0;
  const next = idx >= 0 && positions[idx + 1] ? positions[idx + 1].position : cur + 200;

  const data =
    kind === "day"
      ? {
          daynum: "Day 00 · Day",
          city: "New stop",
          chip: { kind: "stay", label: "Same hotel" },
          dot: "plain",
          fromNote: "",
          slots: [
            { label: "Arrive", body: "How you get there." },
            { label: "Do", body: "What to do." },
            { label: "Stay", body: "Where to sleep." },
          ],
        }
      : { glyph: "▮", title: "A → B", meta: "Train · 0h00 · ¥0", note: "How this leg works." };

  const info = db
    .prepare("INSERT INTO entries (position, kind, data) VALUES (?, ?, ?)")
    .run((cur + next) / 2, kind, JSON.stringify(data));
  return Number(info.lastInsertRowid);
}

export function deleteEntry(id: number) {
  // Hide the entry's photos rather than dropping them, so undo can bring the
  // whole card back intact.
  db.prepare("UPDATE photos SET deleted = 1 WHERE entry_id = ?").run(id);
  db.prepare("DELETE FROM entries WHERE id = ?").run(id);
}

export function addNote(heading = "New note", body = "Something worth remembering.") {
  const max = db.query<{ m: number }, []>("SELECT COALESCE(MAX(position),0) AS m FROM notes").get()!.m;
  const info = db
    .prepare("INSERT INTO notes (position, data) VALUES (?, ?)")
    .run(max + 100, JSON.stringify({ heading, body }));
  return Number(info.lastInsertRowid);
}

export function deleteNote(id: number) {
  db.prepare("DELETE FROM notes WHERE id = ?").run(id);
}

export function addSlot(entryId: number, label = "Note", body = "…") {
  const row = db
    .query<{ data: string }, [number]>("SELECT data FROM entries WHERE id = ?")
    .get(entryId);
  if (!row) throw new Error("no such entry: " + entryId);
  const data = JSON.parse(row.data);
  (data.slots ??= []).push({ label, body });
  db.prepare("UPDATE entries SET data = ? WHERE id = ?").run(JSON.stringify(data), entryId);
}

export function deleteSlot(entryId: number, index: number) {
  const row = db
    .query<{ data: string }, [number]>("SELECT data FROM entries WHERE id = ?")
    .get(entryId);
  if (!row) throw new Error("no such entry: " + entryId);
  const data = JSON.parse(row.data);
  data.slots.splice(index, 1);
  db.prepare("UPDATE entries SET data = ? WHERE id = ?").run(JSON.stringify(data), entryId);
}

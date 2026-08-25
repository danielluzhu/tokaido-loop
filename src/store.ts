/**
 * Every mutation of the itinerary goes through here, so the HTTP API and the
 * chat bot's tools share one code path (and one undo stack).
 */
import { db, exportDoc, getEntries, restorePhotoState } from "./db";

export function snapshot(trip: number) {
  db.prepare("INSERT INTO snapshots (trip_id, taken, payload) VALUES (?, ?, ?)").run(
    trip,
    new Date().toISOString(),
    JSON.stringify(exportDoc(trip)),
  );
  // Keep the last 50 per trip; this is an undo stack, not an archive.
  db.prepare(
    `DELETE FROM snapshots WHERE trip_id = ?1 AND id NOT IN
       (SELECT id FROM snapshots WHERE trip_id = ?1 ORDER BY id DESC LIMIT 50)`,
  ).run(trip);
}

/**
 * Snapshot, then run the mutation -- and drop the snapshot again if it throws.
 * Without this a rejected edit still pushes an undo entry, so the next undo
 * silently restores the state you are already in and appears to do nothing.
 */
export function withSnapshot<T>(trip: number, fn: () => T): T {
  snapshot(trip);
  const id = db
    .query<{ id: number }, []>("SELECT id FROM snapshots ORDER BY id DESC LIMIT 1")
    .get()!.id;
  try {
    return fn();
  } catch (err) {
    db.prepare("DELETE FROM snapshots WHERE id = ?").run(id);
    throw err;
  }
}

export function restore(trip: number, doc: any) {
  db.transaction(() => {
    for (const t of ["entries", "notes", "settings"])
      db.prepare(`DELETE FROM ${t} WHERE trip_id = ?`).run(trip);

    const ps = db.prepare("INSERT INTO settings (trip_id, key, value) VALUES (?, ?, ?)");
    for (const [k, v] of Object.entries(doc.settings ?? {})) ps.run(trip, k, JSON.stringify(v));
    const pe = db.prepare(
      "INSERT INTO entries (id, trip_id, position, kind, data) VALUES (?, ?, ?, ?, ?)",
    );
    (doc.entries ?? []).forEach((e: any, i: number) =>
      pe.run(e.id, trip, (i + 1) * 100, e.kind, JSON.stringify(e.data)),
    );
    const pn = db.prepare("INSERT INTO notes (id, trip_id, position, data) VALUES (?, ?, ?, ?)");
    (doc.notes ?? []).forEach((n: any, i: number) =>
      pn.run(n.id, trip, (i + 1) * 100, JSON.stringify(n.data)),
    );
    restorePhotoState(doc.photos ?? []);

    // trips.title mirrors settings.title; undo has to move both or the index
    // keeps showing the name the heading no longer has.
    const title = (doc.settings ?? {}).title;
    if (typeof title === "string" && title.trim())
      db.prepare("UPDATE trips SET title = ? WHERE id = ?").run(title.trim(), trip);
  })();
}

export function undo(trip: number) {
  const snap = db
    .query<{ id: number; payload: string }, [number]>(
      "SELECT id, payload FROM snapshots WHERE trip_id = ? ORDER BY id DESC LIMIT 1",
    )
    .get(trip);
  if (!snap) return false;
  restore(trip, JSON.parse(snap.payload));
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

export function applyField(trip: number, path: string, value: string) {
  const parts = path.split(":");
  const [root] = parts;

  if (root === "setting") {
    const key = parts[1];
    const row = db
      .query<{ value: string }, [number, string]>(
        "SELECT value FROM settings WHERE trip_id = ? AND key = ?",
      )
      .get(trip, key);
    const put = db.prepare("INSERT OR REPLACE INTO settings (trip_id, key, value) VALUES (?, ?, ?)");
    if (parts.length === 2) {
      put.run(trip, key, JSON.stringify(value));
      // The index lists trips by trips.title; keep it in step with the heading.
      if (key === "title" && value.trim())
        db.prepare("UPDATE trips SET title = ? WHERE id = ?").run(value.trim(), trip);
      return;
    }
    const parsed = row ? JSON.parse(row.value) : {};
    setIn(parsed, parts.slice(2), value);
    put.run(trip, key, JSON.stringify(parsed));
    return;
  }

  if (root === "photo") {
    const col = parts[2];
    if (!["alt", "credit", "license"].includes(col)) throw new Error("bad photo field: " + col);
    db.prepare(`UPDATE photos SET ${col} = ? WHERE id = ? AND trip_id = ?`).run(
      value, Number(parts[1]), trip,
    );
    return;
  }

  const table = root === "entry" ? "entries" : root === "note" ? "notes" : null;
  if (!table) throw new Error("unknown field path: " + path);

  const id = Number(parts[1]);
  const row = db
    .query<{ data: string }, [number, number]>(
      `SELECT data FROM ${table} WHERE id = ? AND trip_id = ?`,
    )
    .get(id, trip);
  if (!row) throw new Error("no such " + root + ": " + id);

  const data = JSON.parse(row.data);
  setIn(data, parts.slice(2), value);
  db.prepare(`UPDATE ${table} SET data = ? WHERE id = ? AND trip_id = ?`).run(
    JSON.stringify(data), id, trip,
  );
}

export function shift(trip: number, table: "entries" | "notes", id: number, dir: "up" | "down") {
  const rows = db
    .query<{ id: number; position: number }, [number]>(
      `SELECT id, position FROM ${table} WHERE trip_id = ? ORDER BY position`,
    )
    .all(trip);
  const i = rows.findIndex((r) => r.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= rows.length) return false;
  db.prepare(`UPDATE ${table} SET position = ? WHERE id = ?`).run(rows[j].position, rows[i].id);
  db.prepare(`UPDATE ${table} SET position = ? WHERE id = ?`).run(rows[i].position, rows[j].id);
  return true;
}

export function addEntry(trip: number, kind: "day" | "leg", after?: string | number | null) {
  const rows = getEntries(trip);
  const positions = db
    .query<{ position: number }, [number]>(
      "SELECT position FROM entries WHERE trip_id = ? ORDER BY position",
    )
    .all(trip);
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
    .prepare("INSERT INTO entries (trip_id, position, kind, data) VALUES (?, ?, ?, ?)")
    .run(trip, (cur + next) / 2, kind, JSON.stringify(data));
  return Number(info.lastInsertRowid);
}

export function deleteEntry(trip: number, id: number) {
  // Hide the entry's photos rather than dropping them, so undo can bring the
  // whole card back intact.
  db.prepare("UPDATE photos SET deleted = 1 WHERE entry_id = ? AND trip_id = ?").run(id, trip);
  db.prepare("DELETE FROM entries WHERE id = ? AND trip_id = ?").run(id, trip);
}

export function addNote(trip: number, heading = "New note", body = "Something worth remembering.") {
  const max = db
    .query<{ m: number }, [number]>(
      "SELECT COALESCE(MAX(position),0) AS m FROM notes WHERE trip_id = ?",
    )
    .get(trip)!.m;
  const info = db
    .prepare("INSERT INTO notes (trip_id, position, data) VALUES (?, ?, ?)")
    .run(trip, max + 100, JSON.stringify({ heading, body }));
  return Number(info.lastInsertRowid);
}

export function deleteNote(trip: number, id: number) {
  db.prepare("DELETE FROM notes WHERE id = ? AND trip_id = ?").run(id, trip);
}

export function addSlot(trip: number, entryId: number, label = "Note", body = "…") {
  const row = db
    .query<{ data: string }, [number, number]>(
      "SELECT data FROM entries WHERE id = ? AND trip_id = ?",
    )
    .get(entryId, trip);
  if (!row) throw new Error("no such entry: " + entryId);
  const data = JSON.parse(row.data);
  (data.slots ??= []).push({ label, body });
  db.prepare("UPDATE entries SET data = ? WHERE id = ? AND trip_id = ?").run(JSON.stringify(data), entryId, trip);
}

export function deleteSlot(trip: number, entryId: number, index: number) {
  const row = db
    .query<{ data: string }, [number, number]>(
      "SELECT data FROM entries WHERE id = ? AND trip_id = ?",
    )
    .get(entryId, trip);
  if (!row) throw new Error("no such entry: " + entryId);
  const data = JSON.parse(row.data);
  data.slots.splice(index, 1);
  db.prepare("UPDATE entries SET data = ? WHERE id = ? AND trip_id = ?").run(JSON.stringify(data), entryId, trip);
}

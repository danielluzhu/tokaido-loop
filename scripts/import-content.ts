/** Rebuild itinerary.db from data/. The inverse of export-content.ts. */
import { db } from "../src/db";
import { restore } from "../src/store";
import { readFileSync } from "node:fs";

const ROOT = "/workspace/data";
const trips = JSON.parse(readFileSync(`${ROOT}/trips.json`, "utf8"));

const insPhoto = db.prepare(
  "INSERT INTO photos (id, trip_id, entry_id, position, mime, bytes, alt, credit, license, source, deleted) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
);

for (const t of trips) {
  const doc = JSON.parse(readFileSync(`${ROOT}/${t.slug}/itinerary.json`, "utf8"));

  let row = db.query<{ id: number }, [string]>("SELECT id FROM trips WHERE slug = ?").get(t.slug);
  if (!row) {
    const info = db
      .prepare("INSERT INTO trips (slug, title, created, position) VALUES (?, ?, ?, ?)")
      .run(t.slug, t.title, t.created, trips.indexOf(t) * 100);
    row = { id: Number(info.lastInsertRowid) };
  }
  const id = row.id;

  db.prepare("DELETE FROM photos WHERE trip_id = ?").run(id);
  for (const p of doc.photos ?? []) {
    const bytes = readFileSync(`${ROOT}/${t.slug}/${p.file}`);
    insPhoto.run(p.id, id, p.entry_id, p.position, p.mime, bytes, p.alt, p.credit, p.license, p.source, p.deleted ?? 0);
  }
  restore(id, doc);
  console.log(`imported ${t.slug}: ${doc.entries.length} entries, ${(doc.photos ?? []).length} photos`);
}

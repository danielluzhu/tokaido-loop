/** Rebuild itinerary.db from data/. The inverse of export-content.ts. */
import { db } from "../src/db";
import { restore } from "../src/store";
import { readFileSync } from "node:fs";

const ROOT = "/workspace/data";
const doc = JSON.parse(readFileSync(`${ROOT}/itinerary.json`, "utf8"));

db.exec("DELETE FROM photos");
const ins = db.prepare(
  "INSERT INTO photos (id, entry_id, position, mime, bytes, alt, credit, license, source, deleted) VALUES (?,?,?,?,?,?,?,?,?,?)",
);
for (const p of doc.photos ?? []) {
  const bytes = readFileSync(`${ROOT}/${p.file}`);
  ins.run(p.id, p.entry_id, p.position, p.mime, bytes, p.alt, p.credit, p.license, p.source, p.deleted ?? 0);
}
restore(doc);

console.log(`imported ${doc.entries.length} entries, ${doc.notes.length} notes, ${(doc.photos ?? []).length} photos`);

/**
 * Write the itinerary out to files git can diff: content as JSON, photo blobs
 * as real image files. Deterministic -- unchanged content produces byte-identical
 * output, so the sync timer only commits when something actually changed.
 */
import { db, exportDoc } from "../src/db";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";

const ROOT = "/workspace/data";
const PHOTOS = `${ROOT}/photos`;
mkdirSync(PHOTOS, { recursive: true });

const doc = exportDoc();
const ext = (mime: string) =>
  ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" })[mime] ?? "bin";

const rows = db
  .query<{ id: number; mime: string; bytes: Uint8Array }, []>(
    "SELECT id, mime, bytes FROM photos ORDER BY id",
  )
  .all();

const written = new Set<string>();
for (const r of rows) {
  const name = `${String(r.id).padStart(3, "0")}.${ext(r.mime)}`;
  written.add(name);
  writeFileSync(`${PHOTOS}/${name}`, r.bytes);
}
// Drop files for photos that no longer exist at all.
for (const f of readdirSync(PHOTOS)) if (!written.has(f)) rmSync(`${PHOTOS}/${f}`);

// Photo rows carry their file name so import can find the bytes again.
const photos = (doc.photos as any[]).map((p) => {
  const row = rows.find((r) => r.id === p.id);
  return { ...p, mime: row?.mime ?? "image/jpeg", file: `photos/${String(p.id).padStart(3, "0")}.${ext(row?.mime ?? "")}` };
});

// Stable key order so the JSON does not churn between runs.
writeFileSync(
  `${ROOT}/itinerary.json`,
  JSON.stringify({ settings: doc.settings, entries: doc.entries, notes: doc.notes, photos }, null, 2) + "\n",
);

console.log(`exported ${doc.entries.length} entries, ${doc.notes.length} notes, ${rows.length} photos`);

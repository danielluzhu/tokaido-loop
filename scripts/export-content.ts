/**
 * Write every trip out to files git can diff: content as JSON, photo blobs as
 * real image files, one directory per trip. Deterministic -- unchanged content
 * produces byte-identical output, so the sync timer only commits real changes.
 */
import { db, exportDoc, listTrips } from "../src/db";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";

const ROOT = "/workspace/data";
mkdirSync(ROOT, { recursive: true });

const ext = (mime: string) =>
  ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" })[mime] ?? "bin";

const trips = listTrips();
const keep = new Set(["trips.json"]);

for (const trip of trips) {
  keep.add(trip.slug);
  const dir = `${ROOT}/${trip.slug}`;
  const photoDir = `${dir}/photos`;
  mkdirSync(photoDir, { recursive: true });

  const doc = exportDoc(trip.id);
  const rows = db
    .query<{ id: number; mime: string; bytes: Uint8Array }, [number]>(
      "SELECT id, mime, bytes FROM photos WHERE trip_id = ? ORDER BY id",
    )
    .all(trip.id);

  const written = new Set<string>();
  for (const r of rows) {
    const name = `${String(r.id).padStart(3, "0")}.${ext(r.mime)}`;
    written.add(name);
    writeFileSync(`${photoDir}/${name}`, r.bytes);
  }
  for (const f of readdirSync(photoDir)) if (!written.has(f)) rmSync(`${photoDir}/${f}`);

  const photos = (doc.photos as any[]).map((p) => {
    const row = rows.find((r) => r.id === p.id);
    const mime = row?.mime ?? "image/jpeg";
    return { ...p, mime, file: `photos/${String(p.id).padStart(3, "0")}.${ext(mime)}` };
  });

  // Sort the setting keys. SQLite returns rows in physical order, and
  // INSERT OR REPLACE moves an edited key to the end of the table -- without
  // this, changing one value reshuffles the whole object and buries the real
  // change in diff noise.
  const settings: Record<string, unknown> = {};
  for (const k of Object.keys(doc.settings).sort()) settings[k] = doc.settings[k];

  writeFileSync(
    `${dir}/itinerary.json`,
    JSON.stringify({ settings, entries: doc.entries, notes: doc.notes, photos }, null, 2) + "\n",
  );
}

writeFileSync(
  `${ROOT}/trips.json`,
  JSON.stringify(
    trips.map((t) => ({ slug: t.slug, title: t.title, created: t.created })),
    null,
    2,
  ) + "\n",
);

// A deleted trip should disappear from the repo too.
for (const f of readdirSync(ROOT)) if (!keep.has(f)) rmSync(`${ROOT}/${f}`, { recursive: true });

console.log(`exported ${trips.length} trip${trips.length === 1 ? "" : "s"}: ${trips.map((t) => t.slug).join(", ")}`);

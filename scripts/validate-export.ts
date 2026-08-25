/**
 * Sanity-check data/ before anything commits it.
 *
 * The sync timer runs every 5 minutes regardless of what else is happening. It
 * once fired while the database was torn down for a migration and committed an
 * empty export over good content. Exit non-zero rather than let that through.
 */
import { existsSync, readFileSync, statSync } from "node:fs";

const ROOT = "/workspace/data";
const fail = (msg: string) => {
  console.error(`export looks wrong: ${msg}`);
  process.exit(1);
};

if (!existsSync(`${ROOT}/trips.json`)) fail("no trips.json");
const trips = JSON.parse(readFileSync(`${ROOT}/trips.json`, "utf8"));
if (!Array.isArray(trips) || trips.length === 0) fail("no trips listed");

for (const t of trips) {
  const file = `${ROOT}/${t.slug}/itinerary.json`;
  if (!existsSync(file)) fail(`${t.slug} has no itinerary.json`);

  const doc = JSON.parse(readFileSync(file, "utf8"));
  if (!doc.entries?.length) fail(`${t.slug} has no entries`);
  if (!doc.settings?.title) fail(`${t.slug} has no title`);

  for (const p of doc.photos ?? []) {
    const img = `${ROOT}/${t.slug}/${p.file}`;
    if (!existsSync(img)) fail(`${t.slug} references a missing photo: ${p.file}`);
    if (statSync(img).size < 512) fail(`${t.slug} photo ${p.file} is suspiciously small`);
  }
}

console.log(`ok: ${trips.length} trip(s), ${trips.map((t: any) => t.slug).join(", ")}`);

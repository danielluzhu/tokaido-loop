/**
 * Pull openly-licensed photos from Wikimedia Commons into the photos table.
 *   bun run scripts/fetch-photos.ts [--force]
 * Commons rate-limits, so requests are paced and retried.
 */
import { db, getEntries } from "../src/db";

const UA = "TokaidoLoop/1.0 (personal itinerary; contact via anothercomputer.co)";
const WIDTH = 1000;
const force = process.argv.includes("--force");

// One picture per stop. Search terms are tuned to land on the real place --
// "Kuromon Ichiba", for instance, mostly returns a mall replica, so Osaka
// uses Dotonbori instead.
const WANTED: { city: string; term: string; alt: string; file?: string }[] = [
  {
    city: "Shinagawa",
    term: "maxell Aqua park shinagawa",
    // Search ranks the exterior signage first; the tank is the point.
    file: "File:Mobula alfredi in maxell Aqua park shinagawa, Tokyo.png",
    alt: "Manta rays gliding through the main tank at Maxell Aqua Park Shinagawa",
  },
  { city: "Tokyo — west side", term: "Torii of Meiji Shrine", alt: "The great torii at the entrance to Meiji Jingu" },
  { city: "Tokyo — east side", term: "Senso-ji Kaminarimon", alt: "Kaminarimon and its red lantern at the entrance to Sensoji" },
  { city: "Kamakura", term: "Great Buddha Kotoku-in Kamakura 2019", alt: "The Great Buddha of Kotoku-in at Kamakura" },
  { city: "Fukuoka", term: "owl cafe owls perched", alt: "Owls perched on a rail at an owl cafe" },
  { city: "Osaka", term: "Dotonbori at night neon", alt: "Neon signs reflected in the canal at Dotonbori after dark" },
  { city: "Shizuoka", term: "tea field Shizuoka Mount Fuji plantation", alt: "Green tea terraces above Shizuoka" },
  { city: "Tokyo — out", term: "N700 series Shinkansen Tokaido", alt: "An N700 series Shinkansen on the Tokaido line" },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api(params: Record<string, string>, tries = 4): Promise<any> {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": UA } });
      if (res.ok) return await res.json();
    } catch {}
    await sleep(1500 * (i + 1));
  }
  throw new Error("commons api failed: " + params.gsrsearch);
}

const stripHtml = (s: string) =>
  String(s ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

async function byTitle(title: string) {
  const data = await api({
    action: "query", format: "json", titles: title,
    prop: "imageinfo", iiprop: "url|extmetadata|size|mime",
    iiurlwidth: String(title.toLowerCase().endsWith(".png") ? 760 : WIDTH),
  });
  const page = Object.values(data?.query?.pages ?? {})[0] as any;
  const ii = page?.imageinfo?.[0];
  if (!ii) return null;
  const em = ii.extmetadata ?? {};
  return {
    title: page.title as string,
    thumb: ii.thumburl as string,
    mime: ii.mime as string,
    credit: stripHtml(em.Artist?.value ?? "") || "Wikimedia Commons",
    license: stripHtml(em.LicenseShortName?.value ?? ""),
    source: ii.descriptionurl as string,
  };
}

async function findImage(term: string) {
  const data = await api({
    action: "query",
    format: "json",
    generator: "search",
    gsrnamespace: "6",
    gsrlimit: "8",
    gsrsearch: term,
    prop: "imageinfo",
    iiprop: "url|extmetadata|size|mime",
    iiurlwidth: String(WIDTH),
  });
  const pages = Object.values(data?.query?.pages ?? {}) as any[];
  // Rank by search relevance, but prefer JPEG: Commons renders PNG thumbs as
  // PNG, and a 1000px PNG is several times the weight of the same JPEG.
  pages.sort(
    (a, b) =>
      (a.imageinfo?.[0]?.mime === "image/jpeg" ? 0 : 1) -
        (b.imageinfo?.[0]?.mime === "image/jpeg" ? 0 : 1) ||
      (a.index ?? 99) - (b.index ?? 99),
  );

  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii) continue;
    if (!/^image\/(jpeg|png)$/.test(ii.mime ?? "")) continue;
    if ((ii.width ?? 0) < 800) continue;
    const em = ii.extmetadata ?? {};
    const license = stripHtml(em.LicenseShortName?.value ?? "");
    // Only genuinely reusable licences.
    if (!/^(CC0|CC BY|Public domain)/i.test(license)) continue;
    if (/montage|collage/i.test(p.title)) continue;
    return {
      title: p.title as string,
      thumb: ii.thumburl as string,
      mime: ii.mime as string,
      credit: stripHtml(em.Artist?.value ?? "") || "Wikimedia Commons",
      license,
      source: ii.descriptionurl as string,
    };
  }
  return null;
}

const entries = getEntries();
const insert = db.prepare(
  "INSERT INTO photos (entry_id, position, mime, bytes, alt, credit, license, source) VALUES (?,?,?,?,?,?,?,?)",
);

for (const want of WANTED) {
  const entry = entries.find((e) => e.kind === "day" && e.data.city === want.city);
  if (!entry) {
    console.log(`skip  ${want.city} — no such day`);
    continue;
  }
  const has = db
    .query<{ c: number }, [number]>("SELECT COUNT(*) AS c FROM photos WHERE entry_id = ?")
    .get(entry.id)!.c;
  if (has && !force) {
    console.log(`have  ${want.city}`);
    continue;
  }

  try {
    const hit = want.file ? await byTitle(want.file) : await findImage(want.term);
    if (!hit) {
      console.log(`MISS  ${want.city} — nothing openly licensed for "${want.term}"`);
      continue;
    }
    // Bun's fetch gets 429'd by the upload CDN where curl sails through, so
    // shell out for the binary download.
    const tmp = `/tmp/photo-${entry.id}.bin`;
    const proc = Bun.spawnSync([
      "curl", "-sSL", "--max-time", "60", "-A", UA, "-o", tmp, hit.thumb,
    ]);
    if (proc.exitCode !== 0) {
      console.log(`FAIL  ${want.city} — curl exit ${proc.exitCode}`);
      continue;
    }
    const file = Bun.file(tmp);
    if ((await file.size) < 1024) {
      console.log(`FAIL  ${want.city} — empty download`);
      continue;
    }
    const buf = new Uint8Array(await file.arrayBuffer());

    if (force) db.prepare("DELETE FROM photos WHERE entry_id = ?").run(entry.id);
    insert.run(entry.id, 0, hit.mime, buf, want.alt, hit.credit, hit.license, hit.source);
    console.log(
      `ok    ${want.city.padEnd(18)} ${(buf.length / 1024).toFixed(0).padStart(4)}KB  ${hit.license.padEnd(12)} ${hit.title.replace("File:", "").slice(0, 44)}`,
    );
  } catch (err: any) {
    console.log(`ERR   ${want.city} — ${err.message}`);
  }
  await sleep(1500);
}

const total = db.query<{ c: number; b: number }, []>(
  "SELECT COUNT(*) AS c, COALESCE(SUM(LENGTH(bytes)),0) AS b FROM photos",
).get()!;
console.log(`\n${total.c} photos, ${(total.b / 1024 / 1024).toFixed(2)} MB total`);

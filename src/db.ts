import { Database } from "bun:sqlite";

export const db = new Database(process.env.DB_PATH ?? "/workspace/itinerary.db");
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS entries (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    position REAL NOT NULL,
    kind     TEXT NOT NULL CHECK (kind IN ('day','leg')),
    data     TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS notes (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    position REAL NOT NULL,
    data     TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS snapshots (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    taken   TEXT NOT NULL,
    payload TEXT NOT NULL
  );
`);

export type Day = {
  daynum: string;
  city: string;
  chip: { kind: "arrive" | "stay" | "out"; label: string };
  dot: "arrive" | "plain" | "end";
  fromNote: string;
  slots: { label: string; body: string }[];
};
export type Leg = { glyph: string; title: string; meta: string; note: string };
export type Note = {
  heading: string;
  body: string;
  table?: { head: [string, string]; rows: [string, string][]; total: [string, string] };
  after?: string;
};

/* ---------------------------------------------------------------- seed --- */

const SEED_SETTINGS: Record<string, unknown> = {
  eyebrow: "Eight days · Four cities · One loop west",
  title: "Tokaido Loop",
  standfirst:
    "Tokyo out to Fukuoka, back east through Osaka and Shizuoka. Built from your Notes table — the weekdays you'd written line up exactly, and *Osaka lands on the empty Sunday* between them.",
  route: [
    { name: "Shinagawa", back: false },
    { name: "Fukuoka", back: false },
    { name: "Osaka", back: false },
    { name: "Shizuoka", back: false },
    { name: "Tokyo", back: true },
  ],
  stats: [
    { label: "Nights", value: "7" },
    { label: "Hotels", value: "4" },
    { label: "Rail + air", value: "≈ ¥46k" },
    { label: "Longest leg", value: "2h30" },
  ],
  notesHeading: "Before you book",
  caveat:
    "**Two things to verify yourself.** Fares and opening hours here are approximate and change — treat them as planning figures, not bookings. And confirm the owl cafe directly before you build Saturday around it: small animal cafes open, move, and close often, and I can't check its current status from here.",
};

const SEED_ENTRIES: { kind: "day" | "leg"; data: Day | Leg }[] = [
  {
    kind: "day",
    data: {
      daynum: "Day 01 · Tue",
      city: "Shinagawa",
      chip: { kind: "arrive", label: "Arrive" },
      dot: "arrive",
      fromNote: "From your note",
      slots: [
        {
          label: "Arrive",
          body:
            "**Haneda (HND)** — Keikyu line runs direct to Shinagawa Station, `13 min · ¥300`. Easily the best airport for this trip.\n> Landing at Narita instead: Narita Express to Shinagawa, `~80 min · ¥3,250`.",
        },
        {
          label: "Do",
          body:
            "**Maxell Aqua Park Shinagawa** — the aquarium from your list. It sits inside the Shinagawa Prince complex, two minutes from the Takanawa exit, and stays open into the evening. Dark, cool, and low-effort: the right call on a jet-lagged first day.\n+ Roughly ¥2,500. Dolphin show runs several times daily — check the board on the way in.",
        },
        {
          label: "Stay",
          body:
            "**Shinagawa Prince Hotel** — attached to the station, and the aquarium is downstairs. Four nights here, no repacking.\n> Cheaper nearby: Sotetsu Fresa Inn Tokyo-Shinagawa.",
        },
      ],
    },
  },
  {
    kind: "day",
    data: {
      daynum: "Day 02 · Wed",
      city: "Tokyo — west side",
      chip: { kind: "stay", label: "Same hotel" },
      dot: "plain",
      fromNote: "",
      slots: [
        {
          label: "Do",
          body:
            "**Meiji Jingu** in the morning while the forest path is still quiet, then walk out through **Harajuku** and down Omotesando. Finish in **Shibuya** after dark — the crossing only works at night.\n+ Shinagawa to Shibuya is 12 minutes on the Yamanote line.",
        },
        { label: "Stay", body: "Shinagawa `— night 2 of 4`" },
      ],
    },
  },
  {
    kind: "day",
    data: {
      daynum: "Day 03 · Thu",
      city: "Tokyo — east side",
      chip: { kind: "stay", label: "Same hotel" },
      dot: "plain",
      fromNote: "",
      slots: [
        {
          label: "Do",
          body:
            "**Sensoji** in Asakusa first thing, then Nakamise street for snacks. Afternoon splits by taste: **Ueno** for the museum cluster and the park, or **Akihabara** two stops down.\n> If teamLab is on your list, book it now — tickets sell out days ahead and it's the one thing here you can't walk up to.",
        },
        { label: "Stay", body: "Shinagawa `— night 3 of 4`" },
      ],
    },
  },
  {
    kind: "day",
    data: {
      daynum: "Day 04 · Fri",
      city: "Kamakura",
      chip: { kind: "stay", label: "Same hotel" },
      dot: "plain",
      fromNote: "",
      slots: [
        {
          label: "Do",
          body:
            "**Day trip to Kamakura** — the Great Buddha, Hasedera's hillside gardens, and a coastline you won't see anywhere else on this route. Direct from Shinagawa on the Yokosuka line, `~50 min`.\n> Rather stay in the city? Shimokitazawa for secondhand shops, or Nakameguro along the canal.",
        },
        { label: "Stay", body: "Shinagawa `— night 4 of 4`. Repack tonight; tomorrow starts early." },
      ],
    },
  },
  {
    kind: "leg",
    data: {
      glyph: "✈",
      title: "Tokyo → Fukuoka",
      meta: "HND–FUK · 1h50 · ¥12–25k",
      note:
        "Fly this one. **The Shinkansen takes 4h50 and costs about ¥23,000** — no faster, no cheaper, and it eats your Owl Cafe morning. Haneda is 13 minutes from your hotel on the Keikyu line, which makes an early departure painless. ANA, JAL, Skymark and Peach all run the route.",
    },
  },
  {
    kind: "day",
    data: {
      daynum: "Day 05 · Sat",
      city: "Fukuoka",
      chip: { kind: "arrive", label: "Arrive" },
      dot: "arrive",
      fromNote: "From your note",
      slots: [
        {
          label: "Arrive",
          body:
            "Fukuoka Airport is unusually central — **subway to Hakata Station in 5 minutes**, Tenjin in 11. Drop bags, start the day.",
        },
        {
          label: "Do",
          body:
            "**Owl cafe** — the one from your list. Fukuoka's cluster around Tenjin and Daimyo; reserve ahead, since most run timed sessions and cap the room. Afternoon at **Ohori Park** and the Fukuoka Castle ruins next door.\n+ Evening is the real reason to come: **yatai**, the open-air food stalls along the Nakasu riverfront. Tonkotsu ramen at a stall, standing up, is the city's signature.",
        },
        {
          label: "Stay",
          body:
            "**Dormy Inn Premium Hakata Canal City Mae** — walkable to the yatai, and it has a rooftop bath, which you'll want after a travel day.\n> Alternative: Mitsui Garden Hotel Fukuoka Nakasu, same area.",
        },
      ],
    },
  },
  {
    kind: "leg",
    data: {
      glyph: "▮",
      title: "Hakata → Shin-Osaka",
      meta: "Nozomi · 2h30 · ≈¥15,600",
      note:
        "Sanyo Shinkansen, straight shot. Take a morning train so Osaka gets a full afternoon — one night here is tight by design.",
    },
  },
  {
    kind: "day",
    data: {
      daynum: "Day 06 · Sun",
      city: "Osaka",
      chip: { kind: "arrive", label: "Arrive" },
      dot: "arrive",
      fromNote: "Your blank row",
      slots: [
        {
          label: "Arrive",
          body: "Shin-Osaka, then **Midosuji line south to Namba**, `~15 min`. Stay on that end so the evening is on foot.",
        },
        {
          label: "Do",
          body:
            "One night, so pick density over coverage. **Kuromon Ichiba Market** in the afternoon for grilled scallops and uni, then **Dotonbori** once the signs come on — the Glico runner, takoyaki from a window, okonomiyaki sitting down.\n> Osaka Castle is the trade-off you're making. It needs half a day and it's on the wrong side of town.",
        },
        {
          label: "Stay",
          body:
            "**Cross Hotel Osaka** — right at the edge of Dotonbori, so the night ends at the door.\n> Staying near Shin-Osaka instead buys you 15 minutes tomorrow morning and costs you the whole evening. Not worth it.",
        },
      ],
    },
  },
  {
    kind: "leg",
    data: {
      glyph: "▮",
      title: "Shin-Osaka → Shizuoka",
      meta: "Hikari · ~2h10 · ≈¥10,900",
      note:
        "**Nozomi does not stop at Shizuoka.** You need a Hikari — and not every Hikari stops either, so check the specific train before you board. Kodama always stops but takes closer to three hours.",
    },
  },
  {
    kind: "day",
    data: {
      daynum: "Day 07 · Mon",
      city: "Shizuoka",
      chip: { kind: "arrive", label: "Arrive" },
      dot: "arrive",
      fromNote: "From your note",
      slots: [
        {
          label: "Arrive",
          body:
            "Shizuoka Station. Sit on the **left side heading east** — this stretch is the classic Mt. Fuji view from the Shinkansen, weather permitting.",
        },
        {
          label: "Do",
          body:
            "**Museum and cafe**, as you wrote it. The **Shizuoka Prefectural Museum of Art** is the draw — its Rodin Wing holds a full cast of *The Gates of Hell*, and it's a genuinely strange thing to find out here.\n+ Then the cafe half: this is Japan's green tea heartland, so make it a proper tea house rather than a coffee shop. Ask for a local sencha flight.\n> Short on time? The Shizuoka City Museum of Art is smaller and sits right in town by the station.",
        },
        {
          label: "Stay",
          body:
            "**Hotel Associa Shizuoka** — connected directly to the station, which matters with one night and an early train out.",
        },
      ],
    },
  },
  {
    kind: "leg",
    data: {
      glyph: "▮",
      title: "Shizuoka → Shinagawa",
      meta: "Hikari · ~1h · ≈¥6,400",
      note:
        "Hikari again — same Nozomi problem in reverse. Shinagawa puts you 13 minutes from Haneda on the Keikyu line.",
    },
  },
  {
    kind: "day",
    data: {
      daynum: "Day 08 · Tue",
      city: "Tokyo — out",
      chip: { kind: "out", label: "Depart" },
      dot: "end",
      fromNote: "",
      slots: [
        {
          label: "Do",
          body:
            "Depends entirely on your flight. **Evening departure** leaves room for one last stop — Tsukiji outer market for breakfast, or whatever you ran out of time for on Days 2–3. **Morning departure** means straight to the airport.\n+ Coin lockers at Shinagawa hold your bags either way.",
        },
        {
          label: "Stay",
          body:
            "Nothing booked — the loop ends here.\n> Flying out Wednesday instead? Add one more Shinagawa night and you get a full extra Tokyo day.",
        },
      ],
    },
  },
];

const SEED_NOTES: Note[] = [
  {
    heading: "Skip the JR Pass",
    body:
      "It doesn't pay off on this route. The seven-day pass runs **¥50,000** and excludes Nozomi and Mizuho without a surcharge — which is exactly what you'd want for the Hakata legs.",
    table: {
      head: ["Leg", "Fare"],
      rows: [
        ["Hakata → Shin-Osaka", "¥15,600"],
        ["Shin-Osaka → Shizuoka", "¥10,900"],
        ["Shizuoka → Shinagawa", "¥6,400"],
      ],
      total: ["Point-to-point", "≈¥32,900"],
    },
    after: "Add a budget flight to Fukuoka and you're still well under the pass. Buy individual tickets.",
  },
  {
    heading: "Reserve seats in advance",
    body:
      "Use the **smartEX** app for Tokaido and Sanyo Shinkansen — it takes a foreign card and lets you change trains without a counter queue.\n\nYour Sunday Hakata → Osaka leg is the one to lock early. Weekend westbound trains fill, and standing for 2h30 with luggage is miserable.",
  },
  {
    heading: "The Shizuoka trap",
    body:
      "Worth repeating because it catches people: **Nozomi — the fastest and most frequent Shinkansen — does not stop at Shizuoka.**\n\nBoth of your Shizuoka legs need a Hikari, and some Hikari services skip it too. Confirm the individual train, not just the type.",
  },
  {
    heading: "Hotel budget",
    body:
      "Everything above is mid-range business class, roughly **¥12,000–20,000** a night for a small, clean room near a station.\n\nRates swing hard by season and fill fast around Japanese holidays. Book the Fukuoka Saturday first — it's your least flexible night.",
  },
];

export function seedIfEmpty() {
  const n = db.query<{ c: number }, []>("SELECT COUNT(*) AS c FROM entries").get()!.c;
  if (n > 0) return;

  const putSetting = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
  const putEntry = db.prepare("INSERT INTO entries (position, kind, data) VALUES (?, ?, ?)");
  const putNote = db.prepare("INSERT INTO notes (position, data) VALUES (?, ?)");

  db.transaction(() => {
    for (const [k, v] of Object.entries(SEED_SETTINGS)) putSetting.run(k, JSON.stringify(v));
    SEED_ENTRIES.forEach((e, i) => putEntry.run((i + 1) * 100, e.kind, JSON.stringify(e.data)));
    SEED_NOTES.forEach((nt, i) => putNote.run((i + 1) * 100, JSON.stringify(nt)));
  })();
}

/* ---------------------------------------------------------------- read --- */

export function getSettings(): Record<string, any> {
  const rows = db.query<{ key: string; value: string }, []>("SELECT key, value FROM settings").all();
  const out: Record<string, any> = {};
  for (const r of rows) out[r.key] = JSON.parse(r.value);
  return out;
}

export function getEntries() {
  return db
    .query<{ id: number; kind: string; data: string }, []>(
      "SELECT id, kind, data FROM entries ORDER BY position",
    )
    .all()
    .map((r) => ({ id: r.id, kind: r.kind as "day" | "leg", data: JSON.parse(r.data) }));
}

export function getNotes() {
  return db
    .query<{ id: number; data: string }, []>("SELECT id, data FROM notes ORDER BY position")
    .all()
    .map((r) => ({ id: r.id, data: JSON.parse(r.data) as Note }));
}

export function exportDoc() {
  return { settings: getSettings(), entries: getEntries(), notes: getNotes() };
}

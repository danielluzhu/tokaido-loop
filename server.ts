import { db, seedIfEmpty, exportDoc, getEntries, getNotes } from "./src/db";
import { renderBody } from "./src/render";
import { CSS } from "./src/styles";

seedIfEmpty();

const PORT = Number(process.env.PORT ?? 4321);
const FAVICON =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
  `<text y="26" font-size="26">🚅</text></svg>`;

/* ------------------------------------------------------------- history --- */

function snapshot() {
  db.prepare("INSERT INTO snapshots (taken, payload) VALUES (?, ?)").run(
    new Date().toISOString(),
    JSON.stringify(exportDoc()),
  );
  // Keep the last 50; this is an undo stack, not an archive.
  db.exec(
    "DELETE FROM snapshots WHERE id NOT IN (SELECT id FROM snapshots ORDER BY id DESC LIMIT 50)",
  );
}

function restore(doc: any) {
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
  })();
}

/* --------------------------------------------------------------- paths --- */

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

function applyField(path: string, value: string) {
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

  const table = root === "entry" ? "entries" : root === "note" ? "notes" : null;
  if (!table) throw new Error("unknown field path: " + path);

  const id = Number(parts[1]);
  const row = db
    .query<{ data: string }, [number]>(`SELECT data FROM ${table} WHERE id = ?`)
    .get(id);
  if (!row) throw new Error("no such " + root + ": " + id);

  const data = JSON.parse(row.data);
  setIn(data, parts.slice(2), value);
  db.prepare(`UPDATE ${table} SET data = ? WHERE id = ?`).run(JSON.stringify(data), id);
}

/* --------------------------------------------------------------- pages --- */

function page(edit: boolean) {
  const doc = exportDoc();
  const body = renderBody(doc, { edit });
  const title = doc.settings.title ?? "Itinerary";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(FAVICON)}">
<title>${title}${edit ? " — editing" : ""}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700;900&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<style>${CSS}
  .corner{position:fixed;top:16px;right:16px;z-index:10;display:flex;gap:8px}
  .corner button,.corner a{
    width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;
    background:var(--surface);color:var(--ink-soft);border:1px solid var(--hairline);
    box-shadow:var(--shadow);cursor:pointer;font-size:15px;line-height:1;text-decoration:none;
  }
  .corner button:hover,.corner a:hover{color:var(--accent);border-color:var(--accent)}
  .corner :focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  @media print{.corner{display:none}}
</style>
</head>
<body>
${
  edit
    ? ""
    : `<div class="corner">
  <a href="/edit" title="Edit this itinerary" aria-label="Edit this itinerary">✎</a>
  <button class="theme-toggle" type="button" aria-label="Switch between light and dark theme"><span aria-hidden="true">◐</span></button>
</div>`
}
${body}
<script>
  (function () {
    var root = document.documentElement, saved = null;
    try { saved = localStorage.getItem("theme"); } catch (e) {}
    if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved);
    var t = document.querySelector(".theme-toggle");
    if (t) t.addEventListener("click", function () {
      var dark = root.getAttribute("data-theme")
        ? root.getAttribute("data-theme") === "dark"
        : matchMedia("(prefers-color-scheme: dark)").matches;
      var next = dark ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) {}
    });
  })();
</script>
${edit ? '<script src="/editor.js"></script>' : ""}
</body>
</html>`;
}

/** The artifact fragment: no <html>/<head>/<body>, styles inline. */
function artifactFragment() {
  const doc = exportDoc();
  return `<title>${doc.settings.title ?? "Itinerary"}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700;900&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap">

<style>${CSS}</style>

${renderBody(doc, { edit: false })}`;
}

/* -------------------------------------------------------------- routing --- */

const html = (s: string) =>
  new Response(s, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" },
  });

const shift = (table: "entries" | "notes", id: number, dir: string) => {
  const rows = db
    .query<{ id: number; position: number }, []>(`SELECT id, position FROM ${table} ORDER BY position`)
    .all();
  const i = rows.findIndex((r) => r.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= rows.length) return;
  db.prepare(`UPDATE ${table} SET position = ? WHERE id = ?`).run(rows[j].position, rows[i].id);
  db.prepare(`UPDATE ${table} SET position = ? WHERE id = ?`).run(rows[i].position, rows[j].id);
};

const server = Bun.serve({
  port: PORT,
  hostname: "0.0.0.0",
  async fetch(req) {
    const url = new URL(req.url);
    const p = url.pathname;
    const m = req.method;

    if (p === "/healthz") return Response.json({ ok: true, port: PORT });
    if (p === "/") return html(page(false));
    if (p === "/edit") return html(page(true));
    if (p === "/editor.js") return new Response(Bun.file("/workspace/public/editor.js"));

    if (p === "/export/data.json")
      return new Response(JSON.stringify(exportDoc(), null, 2), {
        headers: {
          "content-type": "application/json",
          "content-disposition": 'attachment; filename="itinerary.json"',
        },
      });
    if (p === "/export/page.html")
      return new Response(page(false), {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "content-disposition": 'attachment; filename="itinerary-page.html"',
        },
      });
    if (p === "/export/artifact.html")
      return new Response(artifactFragment(), {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "content-disposition": 'attachment; filename="itinerary.html"',
        },
      });

    try {
      if (m === "PUT" && p === "/api/field") {
        const { path, value } = (await req.json()) as { path: string; value: string };
        snapshot();
        applyField(path, value);
        return Response.json({ ok: true });
      }

      if (m === "POST") {
        const seg = p.split("/").filter(Boolean); // api / entry / :id / action ...

        if (p === "/api/undo") {
          const snap = db
            .query<{ id: number; payload: string }, []>(
              "SELECT id, payload FROM snapshots ORDER BY id DESC LIMIT 1",
            )
            .get();
          if (!snap) return Response.json({ ok: false, reason: "nothing to undo" }, { status: 400 });
          restore(JSON.parse(snap.payload));
          db.prepare("DELETE FROM snapshots WHERE id = ?").run(snap.id);
          return Response.json({ ok: true });
        }

        if (p === "/api/entry") {
          const { kind, after } = (await req.json()) as { kind: "day" | "leg"; after?: string };
          snapshot();
          const rows = getEntries();
          const idx = rows.findIndex((r) => String(r.id) === String(after));
          const posRow = db
            .query<{ position: number }, []>("SELECT position FROM entries ORDER BY position")
            .all();
          const cur = idx >= 0 ? posRow[idx].position : 0;
          const next = idx >= 0 && posRow[idx + 1] ? posRow[idx + 1].position : cur + 200;
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
          db.prepare("INSERT INTO entries (position, kind, data) VALUES (?, ?, ?)").run(
            (cur + next) / 2,
            kind,
            JSON.stringify(data),
          );
          return Response.json({ ok: true });
        }

        if (p === "/api/note") {
          snapshot();
          const max =
            db.query<{ m: number }, []>("SELECT COALESCE(MAX(position),0) AS m FROM notes").get()!.m;
          db.prepare("INSERT INTO notes (position, data) VALUES (?, ?)").run(
            max + 100,
            JSON.stringify({ heading: "New note", body: "Something worth remembering." }),
          );
          return Response.json({ ok: true });
        }

        // /api/entry/:id/...  and  /api/note/:id/...
        if (seg[0] === "api" && (seg[1] === "entry" || seg[1] === "note")) {
          const table = seg[1] === "entry" ? "entries" : "notes";
          const id = Number(seg[2]);
          const action = seg[3];
          snapshot();

          if (action === "move") {
            const { dir } = (await req.json()) as { dir: string };
            shift(table as any, id, dir === "up" ? "up" : "down");
            return Response.json({ ok: true });
          }
          if (action === "delete") {
            db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
            return Response.json({ ok: true });
          }
          if (action === "slot") {
            const row = db
              .query<{ data: string }, [number]>("SELECT data FROM entries WHERE id = ?")
              .get(id);
            if (!row) return new Response("no such entry", { status: 404 });
            const data = JSON.parse(row.data);
            if (seg[4] !== undefined && seg[5] === "delete") {
              data.slots.splice(Number(seg[4]), 1);
            } else {
              (data.slots ??= []).push({ label: "Note", body: "…" });
            }
            db.prepare("UPDATE entries SET data = ? WHERE id = ?").run(JSON.stringify(data), id);
            return Response.json({ ok: true });
          }
        }

        if (p === "/api/import") {
          snapshot();
          restore(await req.json());
          return Response.json({ ok: true });
        }
      }
    } catch (err: any) {
      return new Response(err?.message ?? "error", { status: 400 });
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`Tokaido Loop serving on http://localhost:${server.port}  (edit at /edit)`);

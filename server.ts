import { db, seedIfEmpty, exportDoc, photoBytes } from "./src/db";
import { renderBody } from "./src/render";
import { CSS } from "./src/styles";
import {
  addEntry, addNote, addSlot, applyField, deleteEntry, deleteNote, deleteSlot,
  restore, shift, snapshot, undo,
} from "./src/store";
import { chat, hasCredentials } from "./src/chat";

seedIfEmpty();

const PORT = Number(process.env.PORT ?? 4321);
const FAVICON =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
  `<text y="26" font-size="26">🚅</text></svg>`;

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
<script src="/chat.js"></script>
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

${inlinePhotos(renderBody(doc, { edit: false }))}`;
}

/**
 * Artifacts run under a CSP that blocks every external host, so a published
 * page cannot fetch /photo/N. Inline each one as a data URI instead.
 */
function inlinePhotos(html: string) {
  return html.replace(/src="\/photo\/(\d+)"/g, (whole, id) => {
    const row = photoBytes(Number(id));
    if (!row) return whole;
    return `src="data:${row.mime};base64,${Buffer.from(row.bytes).toString("base64")}"`;
  });
}

/* -------------------------------------------------------------- routing --- */

const html = (s: string) =>
  new Response(s, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" },
  });

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
    if (p === "/chat.js") return new Response(Bun.file("/workspace/public/chat.js"));
    if (p === "/api/chat/status") return Response.json({ ready: hasCredentials() });

    if (p.startsWith("/photo/")) {
      const row = photoBytes(Number(p.slice(7)));
      if (!row) return new Response("Not found", { status: 404 });
      return new Response(row.bytes, {
        headers: { "content-type": row.mime, "cache-control": "public, max-age=86400" },
      });
    }

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

    if (m === "POST" && p === "/api/chat") {
      if (!hasCredentials())
        return Response.json(
          { error: "No API key configured. See deploy/README.md." },
          { status: 503 },
        );

      const { messages } = (await req.json()) as { messages: any[] };
      if (!Array.isArray(messages) || !messages.length)
        return new Response("no messages", { status: 400 });

      // Server-sent events, so the reply streams in as it is written.
      const encoder = new TextEncoder();
      const body = new ReadableStream({
        async start(controller) {
          const send = (e: unknown) =>
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
          try {
            for await (const event of chat(messages)) send(event);
          } catch (err: any) {
            send({ type: "error", message: err?.message ?? "stream failed" });
          } finally {
            controller.close();
          }
        },
      });
      return new Response(body, {
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
        },
      });
    }

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
          if (!undo()) return Response.json({ ok: false, reason: "nothing to undo" }, { status: 400 });
          return Response.json({ ok: true });
        }

        if (p === "/api/entry") {
          const { kind, after } = (await req.json()) as { kind: "day" | "leg"; after?: string };
          snapshot();
          return Response.json({ ok: true, id: addEntry(kind, after) });
        }

        if (seg[0] === "api" && seg[1] === "entry" && seg[3] === "photo") {
          const entryId = Number(seg[2]);
          const bytes = new Uint8Array(await req.arrayBuffer());
          const mime = req.headers.get("content-type") ?? "image/jpeg";
          if (!/^image\/(jpeg|png|webp|gif)$/.test(mime)) return new Response("not an image", { status: 415 });
          if (bytes.length > 6_000_000) return new Response("image too large", { status: 413 });
          snapshot();
          const max = db
            .query<{ m: number }, [number]>("SELECT COALESCE(MAX(position),0) AS m FROM photos WHERE entry_id = ?")
            .get(entryId)!.m;
          db.prepare(
            "INSERT INTO photos (entry_id, position, mime, bytes, alt, credit, license, source) VALUES (?,?,?,?,?,?,?,?)",
          ).run(entryId, max + 1, mime, bytes, "", "Your photo", "", "");
          return Response.json({ ok: true });
        }

        if (seg[0] === "api" && seg[1] === "photo" && seg[3] === "delete") {
          snapshot();
          db.prepare("UPDATE photos SET deleted = 1 WHERE id = ?").run(Number(seg[2]));
          return Response.json({ ok: true });
        }

        if (p === "/api/note") {
          snapshot();
          return Response.json({ ok: true, id: addNote() });
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
            if (table === "entries") deleteEntry(id);
            else deleteNote(id);
            return Response.json({ ok: true });
          }
          if (action === "slot") {
            if (seg[4] !== undefined && seg[5] === "delete") deleteSlot(id, Number(seg[4]));
            else addSlot(id);
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

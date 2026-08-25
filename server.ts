import {
  createTrip, db, deleteTrip, exportDoc, listTrips, photoBytes, renameTrip,
  seedIfEmpty, tripBySlug, tripCounts,
} from "./src/db";
import { renderBody, renderIndex } from "./src/render";
import { CSS } from "./src/styles";
import {
  addEntry, addNote, addSlot, applyField, deleteEntry, deleteNote, deleteSlot,
  restore, shift, snapshot, undo, withSnapshot,
} from "./src/store";
import { chat, hasCredentials } from "./src/chat";

seedIfEmpty();

const PORT = Number(process.env.PORT ?? 4321);
const FAVICON =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
  `<text y="26" font-size="26">🚅</text></svg>`;

/* --------------------------------------------------------------- pages --- */

/** One HTML skeleton for both the index and a trip page. */
function shell(title: string, body: string, trip: { slug: string } | null, edit = false) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(FAVICON)}">
<title>${title}</title>
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
<div class="corner">
  ${trip && !edit ? `<a href="/t/${trip.slug}/edit" title="Edit this itinerary" aria-label="Edit this itinerary">✎</a>` : ""}
  <button class="theme-toggle" type="button" aria-label="Switch between light and dark theme"><span aria-hidden="true">◐</span></button>
</div>
${body}
<script>window.TRIP = ${JSON.stringify(trip?.slug ?? null)};</script>
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
${trip ? '<script src="/chat.js"></script>' : ""}
</body>
</html>`;
}

function page(trip: { id: number; slug: string }, edit: boolean) {
  const doc = exportDoc(trip.id);
  const title = (doc.settings.title ?? "Itinerary") + (edit ? " — editing" : "");
  const back = `<a class="trip-back" href="/">← All trips</a>`;
  return shell(title, back + renderBody(doc, { edit }), trip, edit);
}

/** The artifact fragment: no <html>/<head>/<body>, styles inline. */
function artifactFragment(tripId: number) {
  const doc = exportDoc(tripId);
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
    if (p === "/editor.js") return new Response(Bun.file("/workspace/public/editor.js"));
    if (p === "/chat.js") return new Response(Bun.file("/workspace/public/chat.js"));
    if (p === "/api/chat/status") return Response.json({ ready: hasCredentials() });

    if (p === "/") {
      const trips = listTrips().map((t) => ({ ...t, ...tripCounts(t.id) }));
      return html(shell("Trips", renderIndex(trips), null));
    }

    // Create a trip. Posted from the index form, so redirect into it.
    if (m === "POST" && p === "/api/trip") {
      const form = await req.formData();
      const title = String(form.get("title") ?? "").trim();
      if (!title) return new Response("a trip needs a name", { status: 400 });
      const trip = createTrip(title, String(form.get("where") ?? "").trim());
      return Response.redirect(`/t/${trip.slug}/edit`, 303);
    }

    // Everything below is scoped to one trip: /t/<slug>/...
    if (p.startsWith("/t/")) {
      const rest = p.slice(3).split("/");
      const trip = tripBySlug(decodeURIComponent(rest[0] ?? ""));
      if (!trip) return new Response("No such trip", { status: 404 });
      const sub = "/" + rest.slice(1).join("/");

      if (sub === "/") return html(page(trip, false));
      if (sub === "/edit") return html(page(trip, true));

      if (sub === "/export/data.json")
        return new Response(JSON.stringify(exportDoc(trip.id), null, 2), {
          headers: {
            "content-type": "application/json",
            "content-disposition": `attachment; filename="${trip.slug}.json"`,
          },
        });
      if (sub === "/export/page.html")
        return new Response(page(trip, false), {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "content-disposition": `attachment; filename="${trip.slug}-page.html"`,
          },
        });
      if (sub === "/export/artifact.html")
        return new Response(artifactFragment(trip.id), {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "content-disposition": `attachment; filename="${trip.slug}.html"`,
          },
        });

      if (m === "POST" && sub === "/rename") {
        const title = String((await req.formData()).get("title") ?? "").trim();
        if (title) renameTrip(trip.id, title);
        return Response.redirect(`/t/${trip.slug}/edit`, 303);
      }
      if (m === "POST" && sub === "/delete") {
        deleteTrip(trip.id);
        return Response.redirect("/", 303);
      }

      if (sub.startsWith("/api/")) return api(req, trip.id, sub.slice(4), m);
      return new Response("Not found", { status: 404 });
    }

    if (p.startsWith("/photo/")) {
      const row = photoBytes(Number(p.slice(7)));
      if (!row) return new Response("Not found", { status: 404 });
      return new Response(row.bytes, {
        headers: { "content-type": row.mime, "cache-control": "public, max-age=86400" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`Tokaido Loop serving on http://localhost:${server.port}`);

/* ----------------------------------------------------------------- api --- */

async function api(req: Request, trip: number, path: string, m: string): Promise<Response> {
  // path arrives without the "/api" prefix, e.g. "/field" or "/entry/7/move"
  const seg = path.split("/").filter(Boolean);

  if (m === "POST" && path === "/chat") {
    if (!hasCredentials())
      return Response.json({ error: "No API key configured. See deploy/README.md." }, { status: 503 });

    const { messages } = (await req.json()) as { messages: any[] };
    if (!Array.isArray(messages) || !messages.length)
      return new Response("no messages", { status: 400 });

    const encoder = new TextEncoder();
    const body = new ReadableStream({
      async start(controller) {
        const send = (e: unknown) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        try {
          for await (const event of chat(trip, messages)) send(event);
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
    if (m === "PUT" && path === "/field") {
      const { path: field, value } = (await req.json()) as { path: string; value: string };
      withSnapshot(trip, () => applyField(trip, field, value));
      return Response.json({ ok: true });
    }

    if (m !== "POST") return new Response("Not found", { status: 404 });

    if (path === "/undo") {
      if (!undo(trip)) return Response.json({ ok: false, reason: "nothing to undo" }, { status: 400 });
      return Response.json({ ok: true });
    }

    if (path === "/entry") {
      const { kind, after } = (await req.json()) as { kind: "day" | "leg"; after?: string };
      return Response.json({ ok: true, id: withSnapshot(trip, () => addEntry(trip, kind, after)) });
    }

    if (path === "/note") {
      return Response.json({ ok: true, id: withSnapshot(trip, () => addNote(trip)) });
    }

    if (path === "/import") {
      snapshot(trip);
      restore(trip, await req.json());
      return Response.json({ ok: true });
    }

    if (seg[0] === "entry" && seg[2] === "photo") {
      const entryId = Number(seg[1]);
      const bytes = new Uint8Array(await req.arrayBuffer());
      const mime = req.headers.get("content-type") ?? "image/jpeg";
      if (!/^image\/(jpeg|png|webp|gif)$/.test(mime))
        return new Response("not an image", { status: 415 });
      if (bytes.length > 6_000_000) return new Response("image too large", { status: 413 });
      // Only accept a photo for an entry that belongs to this trip.
      const owned = db
        .query("SELECT 1 FROM entries WHERE id = ? AND trip_id = ?")
        .get(entryId, trip);
      if (!owned) return new Response("no such entry", { status: 404 });
      snapshot(trip);
      const max = db
        .query<{ m: number }, [number, number]>(
          "SELECT COALESCE(MAX(position),0) AS m FROM photos WHERE entry_id = ? AND trip_id = ?",
        )
        .get(entryId, trip)!.m;
      db.prepare(
        "INSERT INTO photos (trip_id, entry_id, position, mime, bytes, alt, credit, license, source) VALUES (?,?,?,?,?,?,?,?,?)",
      ).run(trip, entryId, max + 1, mime, bytes, "", "Your photo", "", "");
      return Response.json({ ok: true });
    }

    if (seg[0] === "photo" && seg[2] === "delete") {
      snapshot(trip);
      db.prepare("UPDATE photos SET deleted = 1 WHERE id = ? AND trip_id = ?").run(
        Number(seg[1]), trip,
      );
      return Response.json({ ok: true });
    }

    if (seg[0] === "entry" || seg[0] === "note") {
      const table = seg[0] === "entry" ? "entries" : "notes";
      const id = Number(seg[1]);
      const action = seg[2];

      if (action === "move") {
        const { dir } = (await req.json()) as { dir: string };
        withSnapshot(trip, () => shift(trip, table as any, id, dir === "up" ? "up" : "down"));
        return Response.json({ ok: true });
      }
      if (action === "delete") {
        withSnapshot(trip, () => (table === "entries" ? deleteEntry(trip, id) : deleteNote(trip, id)));
        return Response.json({ ok: true });
      }
      if (action === "slot") {
        withSnapshot(trip, () =>
          seg[3] !== undefined && seg[4] === "delete"
            ? deleteSlot(trip, id, Number(seg[3]))
            : addSlot(trip, id),
        );
        return Response.json({ ok: true });
      }
    }
  } catch (err: any) {
    return new Response(err?.message ?? "error", { status: 400 });
  }

  return new Response("Not found", { status: 404 });
}

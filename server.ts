const SRC = new URL("./itinerary.html", import.meta.url).pathname;
const PORT = Number(process.env.PORT ?? 4321);

const FAVICON =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
  `<text y="26" font-size="26">🚅</text></svg>`;

// itinerary.html is an artifact fragment: <title>, <link> and <style> live at the
// top with no document around them. Lift those into a real <head> so the same file
// serves standalone here and as an artifact, with no second copy to keep in sync.
function render(raw: string) {
  const head: string[] = [];
  const title = raw.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "Itinerary";

  const body = raw
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<link\b[^>]*>/gi, (m) => (head.push(m), ""))
    .replace(/<style>[\s\S]*?<\/style>/gi, (m) => (head.push(m), ""))
    .trim();

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="An eight-day Japan rail itinerary: Tokyo out to Fukuoka, back east through Osaka and Shizuoka.">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(FAVICON)}">
<title>${title}</title>
${head.join("\n")}
<style>
  .theme-toggle{
    position:fixed;top:16px;right:16px;z-index:10;
    width:38px;height:38px;border-radius:50%;
    display:flex;align-items:center;justify-content:center;
    background:var(--surface);color:var(--ink-soft);
    border:1px solid var(--hairline);box-shadow:var(--shadow);
    cursor:pointer;font-size:15px;line-height:1;
    transition:color .15s,border-color .15s;
  }
  .theme-toggle:hover{color:var(--accent);border-color:var(--accent)}
  .theme-toggle:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  @media (prefers-reduced-motion:reduce){.theme-toggle{transition:none}}
  @media print{.theme-toggle{display:none}}
</style>
</head>
<body>
<button class="theme-toggle" type="button" aria-label="Switch between light and dark theme">
  <span aria-hidden="true">◐</span>
</button>
${body}
<script>
  // The artifact host stamps data-theme for us; standalone we own it.
  (function () {
    var root = document.documentElement;
    var saved = null;
    try { saved = localStorage.getItem("theme"); } catch (e) {}
    if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved);

    document.querySelector(".theme-toggle").addEventListener("click", function () {
      var dark = root.getAttribute("data-theme")
        ? root.getAttribute("data-theme") === "dark"
        : matchMedia("(prefers-color-scheme: dark)").matches;
      var next = dark ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) {}
    });
  })();
</script>
</body>
</html>`;
}

const server = Bun.serve({
  port: PORT,
  hostname: "0.0.0.0",
  async fetch(req) {
    const { pathname } = new URL(req.url);

    if (pathname === "/healthz") {
      return Response.json({ ok: true, port: PORT });
    }

    if (pathname === "/" || pathname === "/index.html") {
      // Re-read per request so editing itinerary.html shows up without a restart.
      const raw = await Bun.file(SRC).text();
      return new Response(render(raw), {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-cache",
        },
      });
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`Tokaido Loop serving on http://localhost:${server.port}`);

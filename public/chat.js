(function () {
  var dock, log, form, input, sendBtn, statusLine;
  var history = [];   // Anthropic MessageParam[] — what the server replays
  var busy = false;
  var changed = false;

  /* ------------------------------------------------------------ markup --- */

  function build() {
    var launcher = document.createElement("button");
    launcher.className = "chat-launch";
    launcher.type = "button";
    launcher.setAttribute("aria-label", "Ask about this itinerary");
    launcher.innerHTML = '<span aria-hidden="true">✦</span>';
    document.body.appendChild(launcher);

    dock = document.createElement("aside");
    dock.className = "chat-dock";
    dock.setAttribute("aria-label", "Itinerary assistant");
    dock.hidden = true;
    dock.innerHTML =
      '<header class="chat-head">' +
      '<span class="chat-title">Ask about the trip</span>' +
      '<button type="button" class="chat-close" aria-label="Close">×</button>' +
      "</header>" +
      '<div class="chat-log" role="log" aria-live="polite"></div>' +
      '<div class="chat-status"></div>' +
      '<form class="chat-form">' +
      '<textarea rows="1" placeholder="Move Osaka before Fukuoka…" aria-label="Message"></textarea>' +
      '<button type="submit" class="chat-send">Send</button>' +
      "</form>";
    document.body.appendChild(dock);

    log = dock.querySelector(".chat-log");
    form = dock.querySelector(".chat-form");
    input = dock.querySelector("textarea");
    sendBtn = dock.querySelector(".chat-send");
    statusLine = dock.querySelector(".chat-status");

    launcher.addEventListener("click", function () {
      dock.hidden = !dock.hidden;
      document.body.classList.toggle("chat-open", !dock.hidden);
      if (!dock.hidden) {
        input.focus();
        if (!log.children.length) greet();
      }
    });
    dock.querySelector(".chat-close").addEventListener("click", close);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !dock.hidden) close();
    });

    form.addEventListener("submit", onSubmit);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        form.requestSubmit();
      }
    });
    input.addEventListener("input", function () {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 140) + "px";
    });
  }

  function close() {
    dock.hidden = true;
    document.body.classList.remove("chat-open");
    // Changes are rendered server-side, so reload once the conversation ends.
    if (changed) location.reload();
  }

  async function greet() {
    var res = await fetch("/api/chat/status").then((r) => r.json()).catch(() => ({ ready: false }));
    if (!res.ready) {
      bubble("note", "No API key is configured yet, so I can't answer. See deploy/README.md for how to add one.");
      input.disabled = sendBtn.disabled = true;
      return;
    }
    bubble(
      "note",
      "Ask me to change anything here — rewrite a day, add a stop, fix a fare, reorder the trip. I'll edit the itinerary directly.",
    );
  }

  /* ------------------------------------------------------------ bubbles -- */

  function bubble(kind, text) {
    var el = document.createElement("div");
    el.className = "bubble " + kind;
    el.textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  function toolLine(summary) {
    var el = document.createElement("div");
    el.className = "tool-line";
    el.textContent = summary;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }

  /* ------------------------------------------------------------- send ---- */

  async function onSubmit(e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text || busy) return;

    input.value = "";
    input.style.height = "auto";
    bubble("me", text);
    history.push({ role: "user", content: text });

    busy = true;
    sendBtn.disabled = true;
    statusLine.textContent = "Thinking…";

    var reply = null;
    var acc = "";

    try {
      var res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);

      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buf = "";

      while (true) {
        var chunk = await reader.read();
        if (chunk.done) break;
        buf += decoder.decode(chunk.value, { stream: true });

        var parts = buf.split("\n\n");
        buf = parts.pop();
        for (var i = 0; i < parts.length; i++) {
          var line = parts[i].replace(/^data: /, "");
          if (!line) continue;
          var ev = JSON.parse(line);

          if (ev.type === "text") {
            statusLine.textContent = "";
            if (!reply) reply = bubble("bot", "");
            acc += ev.text;
            reply.textContent = acc;
            log.scrollTop = log.scrollHeight;
          } else if (ev.type === "tool") {
            statusLine.textContent = "";
            toolLine(ev.summary);
            reply = null;      // any further prose starts a new bubble
            acc = "";
          } else if (ev.type === "done") {
            if (ev.changed) changed = true;
            statusLine.textContent = ev.changed ? "Itinerary updated — reload to see it" : "";
          } else if (ev.type === "error") {
            bubble("note", ev.message);
          }
        }
      }

      if (acc) history.push({ role: "assistant", content: acc });
    } catch (err) {
      bubble("note", "Could not reach the assistant. " + err.message);
    } finally {
      busy = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", build);
  else build();
})();

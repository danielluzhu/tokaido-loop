(function () {
  var statusEl = document.getElementById("status");
  var timer;

  function status(text, cls) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.className = "status" + (cls ? " " + cls : "");
    if (cls === "saved") {
      clearTimeout(timer);
      timer = setTimeout(function () {
        statusEl.textContent = "Ready";
        statusEl.className = "status";
      }, 1600);
    }
  }

  async function call(url, opts) {
    status("Saving…", "saving");
    try {
      var res = await fetch(url, opts);
      if (!res.ok) throw new Error(await res.text());
      status("Saved", "saved");
      return res;
    } catch (err) {
      status("Not saved", "error");
      alert("Could not save that change.\n\n" + err.message);
      throw err;
    }
  }

  /* --- field edits: save whatever changed when focus leaves --------------- */

  document.addEventListener(
    "focusin",
    function (e) {
      var el = e.target.closest && e.target.closest(".ed");
      if (el) el.dataset.before = el.textContent;
    },
    true,
  );

  document.addEventListener(
    "focusout",
    async function (e) {
      var el = e.target.closest && e.target.closest(".ed");
      if (!el) return;
      var value = el.textContent;
      if (value === el.dataset.before) return;
      await call("/api/field", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: el.dataset.path, value: value }),
      });
      el.dataset.before = value;
    },
    true,
  );

  // Enter commits a single-line field instead of inserting a newline.
  document.addEventListener("keydown", function (e) {
    var el = e.target.closest && e.target.closest(".ed");
    if (el && e.key === "Enter" && !el.classList.contains("block")) {
      e.preventDefault();
      el.blur();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    }
  });

  /* --- structural edits: mutate, then reload so ordering stays honest ----- */

  async function mutate(url, body) {
    await call(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    location.reload();
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("button");
    if (!btn) return;

    var ctl = btn.closest(".ctl");
    if (ctl && ctl.dataset.id) {
      var id = ctl.dataset.id;
      var act = btn.dataset.act;
      if (act === "up" || act === "down") return mutate("/api/entry/" + id + "/move", { dir: act });
      if (act === "addday") return mutate("/api/entry", { kind: "day", after: id });
      if (act === "addleg") return mutate("/api/entry", { kind: "leg", after: id });
      if (act === "del") {
        if (!confirm("Delete this entry? Undo will bring it back.")) return;
        return mutate("/api/entry/" + id + "/delete");
      }
    }

    if (ctl && ctl.dataset.noteId) {
      var nid = ctl.dataset.noteId;
      var a = btn.dataset.act;
      if (a === "noteup" || a === "notedown")
        return mutate("/api/note/" + nid + "/move", { dir: a === "noteup" ? "up" : "down" });
      if (a === "notedel") {
        if (!confirm("Delete this note card? Undo will bring it back.")) return;
        return mutate("/api/note/" + nid + "/delete");
      }
    }

    if (btn.classList.contains("shot-del")) {
      if (!confirm("Remove this photo? Undo will bring it back.")) return;
      return mutate("/api/photo/" + btn.dataset.photo + "/delete");
    }

    if (btn.classList.contains("shot-add")) {
      pickPhoto(btn.dataset.id);
      return;
    }

    if (btn.classList.contains("slot-add")) {
      if (btn.id === "add-note") return mutate("/api/note");
      return mutate("/api/entry/" + btn.dataset.id + "/slot");
    }
    if (btn.classList.contains("slot-del")) {
      if (!confirm("Remove this row?")) return;
      return mutate("/api/entry/" + btn.dataset.id + "/slot/" + btn.dataset.slot + "/delete");
    }

    if (btn.id === "undo") return mutate("/api/undo");

    if (btn.id === "export") {
      var choice = prompt(
        "Export as:\n  1  JSON backup\n  2  Standalone HTML page\n  3  Artifact fragment (to re-publish)",
        "1",
      );
      if (choice === "1") location.href = "/export/data.json";
      else if (choice === "2") location.href = "/export/page.html";
      else if (choice === "3") location.href = "/export/artifact.html";
    }
  });

  /* --- photo upload: resize in the browser, since the box has no image lib -- */

  var MAX_EDGE = 1400;

  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(url);
        var scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
        // Already small and already a JPEG? Send it untouched.
        if (scale === 1 && file.type === "image/jpeg" && file.size < 1200000) {
          return resolve({ blob: file, type: file.type });
        }
        var canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          function (blob) {
            blob ? resolve({ blob: blob, type: "image/jpeg" }) : reject(new Error("could not read that image"));
          },
          "image/jpeg",
          0.82,
        );
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("that file is not an image the browser can read"));
      };
      img.src = url;
    });
  }

  function pickPhoto(entryId) {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.addEventListener("change", async function () {
      var file = input.files && input.files[0];
      if (!file) return;
      try {
        status("Resizing…", "saving");
        var out = await shrink(file);
        await call("/api/entry/" + entryId + "/photo", {
          method: "POST",
          headers: { "content-type": out.type },
          body: out.blob,
        });
        location.reload();
      } catch (err) {
        status("Not saved", "error");
        alert("Could not add that photo.\n\n" + err.message);
      }
    });
    input.click();
  }

  window.addEventListener("beforeunload", function (e) {
    var el = document.activeElement;
    if (el && el.classList && el.classList.contains("ed") && el.textContent !== el.dataset.before) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
})();

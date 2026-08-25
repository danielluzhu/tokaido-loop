/** Exercises the chat bot's tools directly, without calling the API. */
import { TOOLS, runTool } from "../src/chat";
import { db, exportDoc } from "../src/db";
import { undo } from "../src/store";

const TRIP = 1;

let pass = 0, fail = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${detail ? "  — " + detail : ""}`);
  ok ? pass++ : fail++;
};

// --- schemas are well-formed and strict where they take arguments
for (const t of TOOLS) {
  const s: any = t.input_schema;
  const hasArgs = Object.keys(s.properties ?? {}).length > 0;
  check(
    `schema ${t.name}`,
    s.type === "object" && s.additionalProperties === false && Array.isArray(s.required) &&
      (!hasArgs || (t as any).strict === true) &&
      Object.keys(s.properties).every((k) => s.required.includes(k)),
    hasArgs ? "strict, every property required" : "no args",
  );
}

const entries = () => db.query<{ c: number }, []>("SELECT COUNT(*) AS c FROM entries WHERE trip_id=1").get()!.c;
const city = (id: number) =>
  JSON.parse(db.query<{ d: string }, [number]>("SELECT data AS d FROM entries WHERE id=?").get(id)!.d).city;

const doc: any = runTool(TRIP, "get_itinerary", {});
check("get_itinerary", doc.entries.length > 0 && doc.settings.title, `${doc.entries.length} entries`);

const first = doc.entries[0].id;
const was = city(first);
runTool(TRIP, "set_field", { path: `entry:${first}:city`, value: "TESTVILLE" });
check("set_field nested", city(first) === "TESTVILLE");
runTool(TRIP, "set_field", { path: `entry:${first}:city`, value: was });

const before = entries();
const newId: any = runTool(TRIP, "add_entry", { kind: "leg", after_id: first });
check("add_entry returns id", entries() === before + 1 && typeof newId.id === "number", `id ${newId.id}`);

const order1 = db.query<{ id: number }, []>("SELECT id FROM entries WHERE trip_id=1 ORDER BY position").all().map((r) => r.id);
runTool(TRIP, "move_entry", { id: newId.id, direction: "up" });
const order2 = db.query<{ id: number }, []>("SELECT id FROM entries WHERE trip_id=1 ORDER BY position").all().map((r) => r.id);
check("move_entry", order1.join() !== order2.join());

runTool(TRIP, "delete_entry", { id: newId.id });
check("delete_entry", entries() === before);

const noteAdd: any = runTool(TRIP, "edit_notes", { action: "add", id: null, heading: "T", body: "B" });
const notes = () => db.query<{ c: number }, []>("SELECT COUNT(*) AS c FROM notes WHERE trip_id=1").get()!.c;
const n1 = notes();
runTool(TRIP, "edit_notes", { action: "delete", id: noteAdd.id, heading: null, body: null });
check("edit_notes add/delete", notes() === n1 - 1);

const slots = () =>
  JSON.parse(db.query<{ d: string }, [number]>("SELECT data AS d FROM entries WHERE id=?").get(first)!.d).slots.length;
const s0 = slots();
runTool(TRIP, "edit_slots", { entry_id: first, action: "add", label: "Eat", index: null });
const s1 = slots();
runTool(TRIP, "edit_slots", { entry_id: first, action: "remove", label: null, index: s1 - 1 });
check("edit_slots add/remove", s1 === s0 + 1 && slots() === s0);

// --- errors surface as thrown, so the loop can return is_error to Claude
let threw = false;
try { runTool(TRIP, "set_field", { path: "bogus:1:x", value: "y" }); } catch { threw = true; }
check("bad path throws", threw);
threw = false;
try { runTool(TRIP, "nope", {}); } catch { threw = true; }
check("unknown tool throws", threw);

check("undo tool", typeof (runTool(TRIP, "undo", {}) as any).ok === "boolean");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

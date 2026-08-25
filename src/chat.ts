import Anthropic from "@anthropic-ai/sdk";
import { exportDoc } from "./db";
import {
  addEntry,
  addNote,
  addSlot,
  applyField,
  deleteEntry,
  deleteNote,
  deleteSlot,
  shift,
  snapshot,
  undo,
} from "./store";

export const MODEL = "claude-opus-5";

export function hasCredentials() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

const SYSTEM = `You edit a travel itinerary for a trip to Japan, on behalf of its owner.

The itinerary is a sequence of entries rendered as a vertical timeline:
- a "day" entry is one stop: a day label, a city, a chip, and a list of slots
  (usually Arrive / Do / Stay) whose bodies hold the actual prose.
- a "leg" entry is travel between two stops: title, meta (train, duration, fare)
  and a note.
There are also "note" cards at the end for practical advice, and top-level
settings: title, eyebrow, standfirst, route, stats, notesHeading, caveat.

Field bodies use a tiny markup. Preserve it when you rewrite text:
  **bold**   *italic*   \`mono\`
  a line beginning "> " renders as an indented aside
  a line beginning "+ " renders as a smaller sub-note
Use "\\n" to separate those lines within one field value.

Paths for set_field look like:
  setting:title
  setting:stats:0:value
  entry:7:city
  entry:7:slots:1:body
  entry:7:chip:label
  note:3:heading
  photo:12:alt

Working rules:
- Call get_itinerary first whenever you need ids or current wording. Ids are
  not guessable and change as entries are added.
- Make the edit the person asked for. Don't rewrite surrounding text they
  didn't mention.
- Match the existing voice: plain, specific, no filler. Fares and times are
  approximate — keep hedges like "≈" and "~" where they already exist.
- When you change something, say briefly what you changed. Don't paste the
  whole itinerary back.
- If a request is ambiguous in a way that changes the result, ask before
  editing. Otherwise just do it.
- You can undo the last change with the undo tool.`;

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_itinerary",
    description:
      "Read the whole itinerary: settings, every entry with its id and fields, note cards, and photo metadata. Call this before editing so you have current ids and wording.",
    input_schema: { type: "object", properties: {}, additionalProperties: false, required: [] },
  },
  {
    name: "set_field",
    description:
      "Set one field to a new value. The path addresses a single string, e.g. 'entry:7:slots:1:body' or 'setting:title'.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Colon-separated field path." },
        value: { type: "string", description: "The new value, in the field markup." },
      },
      required: ["path", "value"],
      additionalProperties: false,
    },
  },
  {
    name: "add_entry",
    description:
      "Add a new day or travel leg. It is inserted directly after after_id, or at the start when after_id is omitted. Returns the new entry's id; fill it in with set_field.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["day", "leg"] },
        after_id: { type: ["integer", "null"], description: "Entry id to insert after." },
      },
      required: ["kind", "after_id"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_entry",
    description: "Delete a day or leg by id. Its photos are hidden, not destroyed, so undo restores them.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { id: { type: "integer" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "move_entry",
    description: "Move a day or leg one position up or down the timeline.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        id: { type: "integer" },
        direction: { type: "string", enum: ["up", "down"] },
      },
      required: ["id", "direction"],
      additionalProperties: false,
    },
  },
  {
    name: "edit_slots",
    description:
      "Add or remove a row inside a day entry. Rows are the Arrive / Do / Stay lines. Use set_field to change an existing row's text.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        entry_id: { type: "integer" },
        action: { type: "string", enum: ["add", "remove"] },
        label: { type: ["string", "null"], description: "Row label when adding, e.g. 'Eat'." },
        index: { type: ["integer", "null"], description: "Zero-based row index when removing." },
      },
      required: ["entry_id", "action", "label", "index"],
      additionalProperties: false,
    },
  },
  {
    name: "edit_notes",
    description: "Add or delete one of the practical note cards at the end of the itinerary.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["add", "delete"] },
        id: { type: ["integer", "null"], description: "Note id when deleting." },
        heading: { type: ["string", "null"] },
        body: { type: ["string", "null"] },
      },
      required: ["action", "id", "heading", "body"],
      additionalProperties: false,
    },
  },
  {
    name: "undo",
    description: "Undo the most recent change to the itinerary.",
    input_schema: { type: "object", properties: {}, additionalProperties: false, required: [] },
  },
];

/** Tools that change something; used to decide when to snapshot and reload. */
const MUTATING = new Set([
  "set_field",
  "add_entry",
  "delete_entry",
  "move_entry",
  "edit_slots",
  "edit_notes",
  "undo",
]);

export function runTool(name: string, input: any): unknown {
  switch (name) {
    case "get_itinerary":
      return exportDoc();
    case "set_field":
      applyField(input.path, input.value);
      return { ok: true, path: input.path };
    case "add_entry":
      return { ok: true, id: addEntry(input.kind, input.after_id) };
    case "delete_entry":
      deleteEntry(input.id);
      return { ok: true };
    case "move_entry":
      return { ok: shift("entries", input.id, input.direction) };
    case "edit_slots":
      if (input.action === "add") addSlot(input.entry_id, input.label ?? "Note");
      else deleteSlot(input.entry_id, input.index ?? 0);
      return { ok: true };
    case "edit_notes":
      if (input.action === "add")
        return { ok: true, id: addNote(input.heading ?? undefined, input.body ?? undefined) };
      deleteNote(input.id);
      return { ok: true };
    case "undo":
      return { ok: undo() };
    default:
      throw new Error("unknown tool: " + name);
  }
}

export type ChatEvent =
  | { type: "text"; text: string }
  | { type: "tool"; name: string; summary: string }
  | { type: "done"; changed: boolean }
  | { type: "error"; message: string };

/**
 * Runs the agentic loop, yielding events as they happen so the browser can
 * stream them. Returns when Claude stops asking for tools.
 */
export async function* chat(
  history: Anthropic.MessageParam[],
): AsyncGenerator<ChatEvent> {
  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = [...history];
  let changed = false;

  for (let turn = 0; turn < 12; turn++) {
    let final: Anthropic.Message;
    try {
      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        // The system prompt and tool list never vary, so cache the prefix.
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        tools: TOOLS,
        messages,
      });
      stream.on("text", (delta) => void delta); // keep the stream draining
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield { type: "text", text: event.delta.text };
        }
      }
      final = await stream.finalMessage();
    } catch (err: any) {
      if (err instanceof Anthropic.AuthenticationError)
        yield { type: "error", message: "The API key is missing or invalid." };
      else if (err instanceof Anthropic.RateLimitError)
        yield { type: "error", message: "Rate limited by the API — try again shortly." };
      else if (err instanceof Anthropic.APIError)
        yield { type: "error", message: `API error ${err.status}: ${err.message}` };
      else yield { type: "error", message: err?.message ?? "Something went wrong." };
      return;
    }

    if (final.stop_reason === "refusal") {
      yield { type: "error", message: "Claude declined that request." };
      return;
    }

    messages.push({ role: "assistant", content: final.content });

    const calls = final.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    if (!calls.length) break;

    // All results for one assistant turn go back in a single user message.
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const call of calls) {
      if (MUTATING.has(call.name) && call.name !== "undo") snapshot();
      try {
        const out = runTool(call.name, call.input as any);
        if (MUTATING.has(call.name)) changed = true;
        yield { type: "tool", name: call.name, summary: describe(call.name, call.input as any) };
        results.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: JSON.stringify(out),
        });
      } catch (err: any) {
        results.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: String(err?.message ?? err),
          is_error: true,
        });
      }
    }
    messages.push({ role: "user", content: results });
  }

  yield { type: "done", changed };
}

function describe(name: string, input: any) {
  switch (name) {
    case "get_itinerary":
      return "read the itinerary";
    case "set_field":
      return `edited ${input.path}`;
    case "add_entry":
      return `added a ${input.kind}`;
    case "delete_entry":
      return `deleted entry ${input.id}`;
    case "move_entry":
      return `moved entry ${input.id} ${input.direction}`;
    case "edit_slots":
      return input.action === "add" ? "added a row" : "removed a row";
    case "edit_notes":
      return input.action === "add" ? "added a note card" : "deleted a note card";
    case "undo":
      return "undid the last change";
    default:
      return name;
  }
}

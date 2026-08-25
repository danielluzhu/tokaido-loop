# Tokaido Loop

An eight-day Japan rail itinerary — Tokyo out to Fukuoka, then back east
through Osaka and Shizuoka — served as a Bun webapp you can edit in place or
just talk to.

It started as a photo of a Notes-app table listing four cities and three
weekdays. Those weekdays turned out to describe a loop, with the one blank row
falling exactly on the empty Sunday between them.

## What it does

- **Reads as a document.** A rail-line timeline down the left: filled dots for
  arrival days, hollow for stay-put days, travel legs sitting on the line.
- **Edits in place.** `/edit` turns every field on the page into a
  contenteditable that saves when you click away. Add, reorder and delete days,
  legs, rows and note cards. 50-deep undo.
- **Takes instructions.** A chat dock runs a Claude tool-use loop whose tools
  mutate the itinerary — "move Osaka before Fukuoka", "the Shizuoka fare is
  wrong". Chat edits and hand edits share one undo stack.
- **Publishes.** Exports a standalone page or a self-contained artifact
  fragment with every photo inlined as a data URI.

## Running it

```sh
bun install
bun run server.ts          # http://localhost:4321
```

The database seeds itself on first run. For the chat bot, set
`ANTHROPIC_API_KEY`; without it the dock opens and says so, and nothing else
breaks.

## Layout

| Path | |
|---|---|
| `server.ts` | routes, SSE chat endpoint, exports |
| `src/db.ts` | schema and the seed itinerary |
| `src/store.ts` | every mutation, shared by the HTTP API and the chat tools |
| `src/render.ts` | one renderer for view, edit and artifact output |
| `src/chat.ts` | tool definitions and the agentic loop |
| `data/` | content as JSON plus photos, so git can diff it |
| `deploy/` | systemd units and operational notes |

## Photos

From Wikimedia Commons under open licences, with photographer and licence
printed under each image. `scripts/fetch-photos.ts` refreshes them; `+ Add
photo` in the editor uploads your own.

## Accuracy

Fares, journey times and opening hours are planning figures, not quotes. Check
anything you are about to book.

# Deploy

The itinerary is served by `server.ts` under systemd as `tokaido-loop.service`,
listening on port 4321 and reachable at https://jk-4321.another.ac.

## Install

```sh
sudo cp deploy/tokaido-loop.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now tokaido-loop
```

## Operate

```sh
systemctl status tokaido-loop      # is it up
journalctl -u tokaido-loop -f      # follow logs
sudo systemctl restart tokaido-loop
```

Reading the journal without `sudo` requires membership in `systemd-journal`;
that group change lands on next login.

## Where the content lives

Content is in SQLite at `itinerary.db`, not in the source. Edit it in the
browser at `/edit`. Only changes to `server.ts`, `src/` or `public/` need a
restart.

`itinerary.html` is **generated** — it is the artifact fragment, refreshed with
`curl -s localhost:4321/export/artifact.html > itinerary.html`. Don't hand-edit it.

## Back up

```sh
curl -s localhost:4321/export/data.json > backup.json          # export
curl -X POST localhost:4321/api/import -d @backup.json \
     -H 'content-type: application/json'                       # restore
```

## Photos

Images live in the `photos` table as blobs, served from `/photo/:id`. The
seeded set came from Wikimedia Commons under open licences — credit and
licence are stored per photo and printed under each image.

```sh
bun run scripts/fetch-photos.ts           # fill in any stop with no photo
bun run scripts/fetch-photos.ts --force   # re-fetch everything
```

Commons throttles Bun's `fetch` but not `curl`, so the script shells out for
the binary downloads.

In `/edit`, "+ Add photo" on any day uploads your own. The browser resizes to
1400px and re-encodes to JPEG before upload, because this box has no image
library. Deletes are soft, so undo can bring a photo back.

The artifact export inlines every photo as a `data:` URI — published artifacts
run under a CSP that blocks external hosts, so `/photo/:id` would not load.

## Chat bot

`/api/chat` runs a Claude tool-use loop whose tools mutate the itinerary
through `src/store.ts` — the same code path the HTTP editing API uses, so
chat edits land on the same undo stack. Model: `claude-opus-5`, adaptive
thinking, streamed to the browser over SSE.

It needs an Anthropic API key. Without one the dock still opens and says so;
nothing else breaks.

```sh
sudo sh -c 'echo "ANTHROPIC_API_KEY=sk-ant-..." > /etc/tokaido-loop.env'
sudo chmod 600 /etc/tokaido-loop.env
sudo systemctl restart tokaido-loop
curl -s localhost:4321/api/chat/status     # {"ready":true}
```

The file is root-owned and read by systemd before it drops to the `ubuntu`
user, so the key is never in a user-readable file. `EnvironmentFile` is
prefixed with `-`, so a missing file is not an error.

Test the tools without spending API calls:

```sh
bun run scripts/test-tools.ts
```

**No auth on the endpoint.** Anyone who can reach the site can chat, and that
spends your API budget. Fine while the port is private to you; lock it down
before opening the port publicly.

## Pushing to GitHub

Two mechanisms, one pusher per commit:

- **`tokaido-sync.timer`** — every 5 minutes: export content, commit if
  anything moved, push if local is ahead. It suppresses the post-commit hook
  for its own commits (`TOKAIDO_NO_PUSH=1`), because two pushers racing the
  same commit gets one rejected on a stale ref. It also pushes when local is
  ahead for any other reason, so a hook push that failed while offline is
  picked up on the next tick.
- **`.githooks/post-commit`** — pushes any manual commit immediately.
  Backgrounded, so committing never blocks on the network and never fails if
  the remote is unreachable. Tracked in the repo via `core.hooksPath`.

```sh
systemctl list-timers tokaido-sync      # when it next fires
journalctl -u tokaido-sync -f           # what it did
/workspace/scripts/sync.sh              # run one now
git commit --no-verify                  # or TOKAIDO_NO_PUSH=1 to skip the hook
```

Content is exported to `data/` rather than tracking `itinerary.db`: a 3.5MB
binary that rewrites on every keystroke makes for a fast-growing repo and
useless diffs. `scripts/import-content.ts` rebuilds the database from `data/`,
which is what makes the repo an actual backup — verified lossless.

`itinerary.html` is generated and no longer tracked; it inlines every photo as
a data URI, so it is ~5MB and rewrites on every content change.

## Trips

`/` lists trips; `/t/<slug>` is one; the form on the index creates one with a
single placeholder day and drops you into its editor. Content tables carry a
`trip_id`, so each trip has its own settings, entries, notes, photos and undo
stack. Passing another trip's row id to a trip's API is rejected, not applied.

`data/` holds one directory per trip plus `trips.json`.

**The sync timer runs on a schedule and cannot tell whether the app is
healthy.** During the multi-trip migration it fired while the database was torn
down and committed an empty export over good content. Two guards now stand in
the way:

- `scripts/validate-export.ts` fails the sync if the export has no trips, a
  trip with no entries or no title, or a referenced photo file that is missing
  or truncated.
- `sync.sh` refuses to commit when more than three content files would be
  deleted. Deliberate ones need `TOKAIDO_ALLOW_DELETE=1 scripts/sync.sh`.

If you are about to do anything that stops the service or rebuilds the
database, stop the timer first:

```sh
sudo systemctl stop tokaido-sync.timer
# ... work ...
sudo systemctl start tokaido-sync.timer
```

Content is recoverable from git either way: `git log -- data/` and check the
file sizes, then `git show <commit>:data/<slug>/itinerary.json`.

## Themes

`src/theme.ts` validates and renders per-trip styling. The theme lives in
`settings.theme`, which is why undo, `data/` export and the artifact all carry
it for free.

Three things it gets right that are easy to get wrong:

- The override block is emitted **after** the base stylesheet, so it wins
  without `!important`.
- Dark values are written into both the `prefers-color-scheme` media query and
  the `[data-theme="dark"]` stamp, or a manual toggle keeps the old palette.
- A light-only theme is copied into the dark rules too. Otherwise setting a new
  accent leaves dark mode on the previous one, which reads as a bug.

Font names are checked against Google Fonts at set time. A typo would otherwise
fall back silently and look like the change did nothing.

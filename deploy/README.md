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
# sync catch-up probe

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

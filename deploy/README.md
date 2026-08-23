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

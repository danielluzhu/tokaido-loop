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

Editing `itinerary.html` needs no restart — `server.ts` re-reads it per
request. Only changes to `server.ts` itself require one.

Reading the journal without `sudo` requires membership in `systemd-journal`;
that group change lands on next login.

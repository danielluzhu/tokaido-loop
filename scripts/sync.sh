#!/usr/bin/env bash
# Export content, then commit and push anything that changed.
# Run by tokaido-sync.timer; safe to run by hand.
set -uo pipefail
cd /workspace || exit 1

export PATH="/home/ubuntu/.bun/bin:/usr/local/bin:/usr/bin:/bin"

bun run scripts/export-content.ts >/dev/null 2>&1 || {
  echo "export failed; leaving the tree alone"
  exit 1
}

git add -A
if git diff --cached --quiet; then
  exit 0                       # nothing changed
fi

# Name the commit after what actually moved.
files=$(git diff --cached --name-only)
if grep -qv '^data/' <<<"$files"; then
  subject="Sync: code and content"
elif grep -q '^data/photos/' <<<"$files"; then
  subject="Sync: itinerary content and photos"
else
  subject="Sync: itinerary content"
fi

git commit -q -m "$subject" -m "$(git diff --cached --stat | tail -1)" || exit 1
git push -q origin HEAD 2>&1 | tail -3

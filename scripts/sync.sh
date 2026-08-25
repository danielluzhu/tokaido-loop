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

# Never commit an export that lost content -- this timer runs on a schedule and
# has no idea whether the database is mid-migration.
if ! bun run scripts/validate-export.ts; then
  echo "refusing to commit; run scripts/sync.sh by hand once the app is healthy"
  git checkout -- data 2>/dev/null
  exit 1
fi

# A sudden mass deletion of tracked content is the same failure wearing a
# different hat: let it be deliberate, not automatic.
deleted=$(git diff --numstat --diff-filter=D -- data | wc -l)
if [ "$deleted" -gt 3 ] && [ -z "${TOKAIDO_ALLOW_DELETE:-}" ]; then
  echo "refusing to commit: $deleted content files would be deleted."
  echo "if that is intended: TOKAIDO_ALLOW_DELETE=1 scripts/sync.sh"
  exit 1
fi

git add -A
if ! git diff --cached --quiet; then
  # Name the commit after what actually moved.
  files=$(git diff --cached --name-only)
  if grep -qv '^data/' <<<"$files"; then
    subject="Sync: code and content"
  elif grep -q '^data/photos/' <<<"$files"; then
    subject="Sync: itinerary content and photos"
  else
    subject="Sync: itinerary content"
  fi
  # Suppress the post-commit hook: this script does its own push below, and
  # two pushers racing the same commit gets one of them rejected on a stale ref.
  TOKAIDO_NO_PUSH=1 git commit -q -m "$subject" -m "$(git diff --cached --stat | tail -1)" || exit 1
fi

git remote get-url origin >/dev/null 2>&1 || exit 0

# Push whenever local is ahead -- this also catches up commits whose hook push
# failed earlier (offline, transient error), so the timer is self-healing.
git fetch -q origin main 2>/dev/null
if [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main 2>/dev/null || echo none)" ]; then
  exit 0
fi

for attempt in 1 2 3; do
  if git push -q origin HEAD:main 2>/tmp/tokaido-push.err; then
    exit 0
  fi
  # Someone pushed from elsewhere: replay our commits on top and retry.
  if grep -qE 'non-fast-forward|cannot lock ref|rejected' /tmp/tokaido-push.err; then
    git fetch -q origin main && git rebase -q origin/main || { git rebase --abort 2>/dev/null; }
  fi
  sleep $((attempt * 3))
done

echo "push failed after 3 attempts:"; cat /tmp/tokaido-push.err
exit 1

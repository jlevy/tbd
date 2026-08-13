#!/usr/bin/env bash
# Repro harness for tbd-rdsb: doctor --fix intermittently leaves no migration
# commit at the sync-branch tip.
#
# Usage: repro-rdsb.sh <iterations> [--load N]
# Exits 0 if every iteration produced a migration commit, 1 on first failure
# (leaving that iteration's scratch dir in place for inspection).

set -uo pipefail

ITERATIONS="${1:-20}"
LOAD=0
if [ "${2:-}" = "--load" ]; then LOAD="${3:-8}"; fi

ROOT="$(mktemp -d "${TMPDIR:-/tmp}/rdsb-repro-XXXXXX")"
TBD="${TBD_BIN:-tbd}"

load_pids=()
start_load() {
  for _ in $(seq 1 "$LOAD"); do
    ( end=$((SECONDS + 3600)); while [ $SECONDS -lt $end ]; do :; done ) &
    load_pids+=($!)
  done
}
stop_load() {
  for p in "${load_pids[@]:-}"; do kill "$p" 2>/dev/null || true; done
}
trap stop_load EXIT

[ "$LOAD" -gt 0 ] && start_load

fail=0
for i in $(seq 1 "$ITERATIONS"); do
  d="$ROOT/iter-$i"
  mkdir -p "$d"; cd "$d" || exit 1

  # Match the failing tryscript exactly: a bare origin remote is configured, and
  # sync pushes to it. Without a remote the failure does not reproduce.
  git init --bare -q "$d/../origin-$i.git"
  git init -q --initial-branch=main
  git config user.email t@e.com; git config user.name T; git config commit.gpgsign false
  echo "# t" > README.md; git add -A; git commit -qm init
  git remote add origin "$d/../origin-$i.git"
  git push -q -u origin main
  "$TBD" init --prefix=rc >/dev/null 2>&1
  "$TBD" create "Initial Issue 1" >/dev/null 2>&1
  "$TBD" create "Initial Issue 2" >/dev/null 2>&1
  "$TBD" sync >/dev/null 2>&1 || true

  # Plant a file in the pre-worktree ("wrong") location.
  mkdir -p .tbd/data-sync/issues
  for n in 1 2; do
    printf '%s\n' '---' "id: is-00000000000000000wrongloc$n" "title: Migrated $n" 'status: open' \
      'kind: task' 'priority: 2' 'created_at: 2025-01-01T00:00:00.000Z' \
      'updated_at: 2025-01-01T00:00:00.000Z' 'version: 1' 'type: is' '---' 'B' \
      > ".tbd/data-sync/issues/is-00000000000000000wrongloc$n.md"
  done

  # The test runs a plain doctor before the fixing one.
  "$TBD" doctor >/dev/null 2>&1 || true

  W="$(git rev-parse --path-format=absolute --git-common-dir)/tbd/data-sync-worktree"
  before_tip="$(git -C "$W" rev-parse HEAD)"

  "$TBD" doctor --fix >"$d/doctor.log" 2>&1

  tip_msg="$(git -C "$W" log --oneline -1)"
  after_tip="$(git -C "$W" rev-parse HEAD)"

  if echo "$tip_msg" | grep -q "tbd: migrate"; then
    echo "iter $i: ok"
  else
    fail=1
    echo "iter $i: FAIL - tip is not the migration commit"
    echo "  before: $before_tip"
    echo "  after : $after_tip  ($tip_msg)"
    echo "  --- sync-branch log ---"
    git -C "$W" log --oneline -5 | sed 's/^/    /'
    echo "  --- reflog (what moved HEAD) ---"
    git -C "$W" reflog -8 | sed 's/^/    /'
    echo "  --- worktree status ---"
    git -C "$W" status --porcelain | sed 's/^/    /'
    echo "  --- file migrated to worktree? ---"
    ls "$W/.tbd/data-sync/issues/" | grep wrongloc | sed 's/^/    /' || echo "    (absent)"
    echo "  --- still in wrong location? ---"
    ls "$d/.tbd/data-sync/issues/" 2>/dev/null | grep wrongloc | sed 's/^/    /' || echo "    (absent)"
    echo "  --- doctor output (Data location) ---"
    grep -iE "data location|migrat" "$d/doctor.log" | sed 's/^/    /'
    echo "  scratch kept at: $d"
    break
  fi
  cd /; rm -rf "$d"
done

stop_load
if [ "$fail" -eq 0 ]; then
  echo "all $ITERATIONS iterations produced a migration commit"
  rm -rf "$ROOT"
fi
exit "$fail"

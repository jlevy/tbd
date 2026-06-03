---
sandbox: true
env:
  NO_COLOR: '1'
  FORCE_COLOR: '0'
path:
  - ../dist
timeout: 60000
patterns:
  ULID: '[0-9a-z]{26}'
  SHORTID: '[0-9a-z]{4,5}'
  TIMESTAMP: "\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z"
before: |
  # Isolated bare repo as "origin" with an UNRELATED orphan tbd-sync (env B).
  rm -rf ../origin-158.git ../seed-158
  mkdir -p ../origin-158.git
  git init --bare ../origin-158.git

  mkdir -p ../seed-158/.tbd/data-sync/issues
  ( cd ../seed-158
    git init --initial-branch=tbd-sync
    git config user.email "b@example.com"
    git config user.name "Env B"
    git config commit.gpgsign false
    printf '%s\n' '---' 'type: is' 'id: is-01aaaaaaaaaaaaaaaaaaaaaa01' 'title: Remote only issue' \
      'status: open' 'kind: task' 'priority: 2' 'version: 1' \
      'created_at: 2026-01-01T00:00:00.000Z' 'updated_at: 2026-01-01T00:00:00.000Z' '---' 'env B body' \
      > .tbd/data-sync/issues/is-01aaaaaaaaaaaaaaaaaaaaaa01.md
    git add -A
    git commit -m "env B orphan"
    git push ../origin-158.git tbd-sync:refs/heads/tbd-sync )

  # Primary repo with its own independent orphan tbd-sync (unrelated to env B).
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  git config commit.gpgsign false
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"

  tbd init --prefix=test >/dev/null
  tbd create "Local only issue" --type=task >/dev/null
  tbd sync >/dev/null 2>&1 || true
  git remote add origin ../origin-158.git
---
# tbd CLI: Unrelated history + dirty worktree rescues in one shot (#158)

A transiently dirty sync worktree (tbd’s own uncommitted data-sync writes) must not
block the unrelated-history rescue, and `tbd doctor` must not bounce the user between
`tbd sync` and `tbd doctor --fix`.

See: plan-2026-06-03-unrelated-rescue-dirty-worktree.md

* * *

## A dirty internal worktree at the moment of rescue

# Test: Leave an uncommitted issue in the sync worktree

```console
$ WT="$(git rev-parse --path-format=absolute --git-common-dir)/tbd/data-sync-worktree"; printf '%s\n' '---' 'type: is' 'id: is-01aaaaaaaaaaaaaaaaaaaaaa02' 'title: Uncommitted local' 'status: open' 'kind: task' 'priority: 2' 'version: 1' 'created_at: 2026-01-02T00:00:00.000Z' 'updated_at: 2026-01-02T00:00:00.000Z' '---' body > "$WT/.tbd/data-sync/issues/is-01aaaaaaaaaaaaaaaaaaaaaa02.md"; git -C "$WT" status --porcelain | grep -c . | tr -d ' '
1
? 0
```

* * *

## doctor must route to the rescue, not loop back to sync

# Test: Sync-consistency does not bounce the user to `tbd sync` for unrelated histories

```console
$ tbd doctor 2>&1 | grep -i "Sync consistency" -A1 | grep -ci "run: tbd sync to reconcile" | tr -d ' '
0
? 0
```

* * *

## doctor --fix rescues in one shot despite the dirty worktree

# Test: tbd doctor --fix succeeds (no “uncommitted changes” dead-end)

```console
$ tbd doctor --fix 2>&1 | grep -i "Remote sync branch"
[..]Remote sync branch - rescued: adopted origin/tbd-sync base[..]
? 0
```

# Test: The rescue never printed the dirty-worktree refusal

```console
$ tbd doctor 2>&1 | grep -ci "uncommitted changes" | tr -d ' '
0
? 0
```

# Test: origin/tbd-sync is now an ancestor (push fast-forwards)

```console
$ git fetch -q origin tbd-sync && git merge-base --is-ancestor origin/tbd-sync tbd-sync && echo "fast-forwardable"
fast-forwardable
? 0
```

# Test: tbd sync settles, and the previously-uncommitted issue survived

```console
$ tbd sync >/dev/null 2>&1; tbd list --json 2>/dev/null | jq -r '[.[] | select(.title == "Uncommitted local")] | length'
1
? 0
```

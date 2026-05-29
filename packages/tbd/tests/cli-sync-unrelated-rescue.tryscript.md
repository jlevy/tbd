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
  # Isolated bare repo as "origin" (avoid the shared ../origin.git).
  rm -rf ../origin-rescue.git ../seed-rescue
  mkdir -p ../origin-rescue.git
  git init --bare ../origin-rescue.git

  # Seed the remote with an UNRELATED orphan tbd-sync (as if environment B
  # initialized independently): one remote-only issue, no common ancestor with
  # whatever this repo creates locally.
  mkdir -p ../seed-rescue/.tbd/data-sync/issues
  ( cd ../seed-rescue
    git init --initial-branch=tbd-sync
    git config user.email "b@example.com"
    git config user.name "Env B"
    git config commit.gpgsign false
    printf '%s\n' '---' 'type: is' 'id: is-01envbrescue0000000remote1' 'title: Remote only issue' \
      'status: open' 'kind: task' 'priority: 2' 'version: 1' \
      'created_at: 2026-01-01T00:00:00.000Z' 'updated_at: 2026-01-01T00:00:00.000Z' '---' 'env B body' \
      > .tbd/data-sync/issues/is-01envbrescue0000000remote1.md
    git add -A
    git commit -m "env B orphan"
    git push ../origin-rescue.git tbd-sync:refs/heads/tbd-sync )

  # Primary repo with NO remote yet (so the local tbd-sync is an independent
  # orphan, unrelated to env B's).
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  git config commit.gpgsign false
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
---
# tbd CLI: Unrelated-history detect → rescue → sync (end to end)

Reproduces the #139 race end to end: two environments create independent orphan
`tbd-sync` branches with no common ancestor.
`tbd doctor` must flag this as a hard finding (never healthy), `tbd doctor --fix` must
rescue non-destructively, and the following `tbd sync` must fast-forward with both
sides’ issues preserved.

See: plan-2026-05-29-tbd-sync-unrelated-history-hardening.md

* * *

## Build an unrelated local tbd-sync, then attach the remote

# Test: Initialize tbd and create a local-only issue

```console
$ tbd init --prefix=test >/dev/null && tbd create "Local only issue" --type=task >/dev/null && echo ok
ok
? 0
```

# Test: Commit the local orphan tbd-sync (no remote configured yet)

```console
$ tbd sync >/dev/null 2>&1; echo "synced"
synced
? 0
```

# Test: Attach the remote whose tbd-sync is unrelated to ours

```console
$ git remote add origin ../origin-rescue.git && echo "attached"
attached
? 0
```

* * *

## Detection: doctor reports a hard finding routed to --fix

# Test: tbd doctor flags the unrelated history (not healthy)

```console
$ tbd doctor 2>&1 | grep -i "Remote sync branch"
[..]Remote sync branch - [..]unrelated[..]
? 0
```

# Test: The remediation points at tbd doctor --fix

```console
$ tbd doctor 2>&1 | grep -iA1 "histories are unrelated" | grep -i "doctor --fix" | head -1
[..]tbd doctor --fix[..]
? 0
```

* * *

## Rescue: doctor --fix reconciles non-destructively

# Test: tbd doctor --fix runs the rescue and adopts the remote base

```console
$ tbd doctor --fix 2>&1 | grep -i "Remote sync branch"
[..]Remote sync branch - rescued: adopted origin/tbd-sync base[..]
? 0
```

# Test: A backup branch preserves the pre-rescue state

```console
$ git branch | grep -c "tbd-backup-" | tr -d ' ' | awk '$1 >= 1 {print "ok"}'
ok
? 0
```

# Test: origin/tbd-sync is now an ancestor of local tbd-sync (push fast-forwards)

```console
$ git merge-base --is-ancestor origin/tbd-sync tbd-sync && echo "fast-forwardable"
fast-forwardable
? 0
```

* * *

## Sync: fast-forwards, both issues preserved on the remote

# Test: tbd sync succeeds after the rescue

```console
$ tbd sync >/dev/null 2>&1; echo "exit=$?"
exit=0
? 0
```

# Test: The remote tbd-sync now carries BOTH issues (local-only + remote-only)

```console
$ git fetch -q origin tbd-sync && git ls-tree -r --name-only origin/tbd-sync | grep -c 'issues/is-' | tr -d ' '
2
? 0
```

# Test: tbd list shows both issues locally

```console
$ tbd list 2>&1 | tail -1
2 issue(s)
? 0
```

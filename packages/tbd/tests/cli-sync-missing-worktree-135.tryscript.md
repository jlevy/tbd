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
before: |
  # Bare repo as local "origin". Use an isolated name (the shared ../origin.git
  # is persistent across tryscripts and would leak other scenarios' tbd-sync
  # issues into our sync, breaking exact counts).
  rm -rf ../origin-135.git
  mkdir -p ../origin-135.git
  git init --bare ../origin-135.git

  # Primary repo.
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  git config commit.gpgsign false
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
  git remote add origin ../origin-135.git
  git push -u origin main
---
# tbd CLI: Missing-worktree regression (#135)

Reproduces the issue #135 scenario: the shared sync worktree is absent (as in a fresh
ephemeral clone that has the `tbd-sync` branch but no materialized worktree).
Data commands must auto-heal the worktree and read the real issues — and must **never**
silently fall back to writing under the gitignored `.tbd/data-sync/` path in the main
checkout.

See: plan-2026-05-29-tbd-sync-unrelated-history-hardening.md (#135 verification)

* * *

## Setup: create and sync issues, then drop the worktree

# Test: Initialize tbd

```console
$ tbd init --prefix=test 2>&1 | head -1
✓ Initialized tbd repository (prefix: test)
? 0
```

# Test: Create two issues

```console
$ tbd create "Issue A" --type=task >/dev/null && tbd create "Issue B" --type=task >/dev/null && echo created
created
? 0
```

# Test: Sync so the issues are committed on tbd-sync (as a fresh clone would have)

```console
$ tbd sync >/dev/null 2>&1; echo "synced"
synced
? 0
```

# Test: Two issue files are committed on the tbd-sync branch

```console
$ git ls-tree -r --name-only tbd-sync | grep -c 'issues/is-' | tr -d ' '
2
? 0
```

# Test: Simulate a fresh clone with no materialized worktree

```console
$ rm -rf $(git rev-parse --path-format=absolute --git-common-dir)/tbd/data-sync-worktree && rm -rf .tbd/data-sync && echo "worktree absent"
worktree absent
? 0
```

* * *

## tbd list heals and reads the real issues (no silent fallback)

# Test: tbd list reflects the real issues (does not silently report empty)

```console
$ tbd list 2>&1 | tail -1
2 issue(s)
? 0
```

# Test: Worktree was auto-materialized

```console
$ test -d $(git rev-parse --path-format=absolute --git-common-dir)/tbd/data-sync-worktree && echo "materialized"
materialized
? 0
```

# Test: NOTHING was written under the gitignored .tbd/data-sync/ wrong location

```console
$ ls .tbd/data-sync/issues/*.md 2>/dev/null | wc -l | tr -d ' '
0
? 0
```

* * *

## tbd create after heal writes to the worktree, never to .tbd/data-sync/

# Test: Create another issue after the heal

```console
$ tbd create "Issue C" --type=task 2>&1 | head -1
✓ Created [..]
? 0
```

# Test: Still nothing under .tbd/data-sync/ in the main checkout

```console
$ ls .tbd/data-sync/issues/*.md 2>/dev/null | wc -l | tr -d ' '
0
? 0
```

# Test: The new issue lives in the shared worktree

```console
$ ls $(git rev-parse --path-format=absolute --git-common-dir)/tbd/data-sync-worktree/.tbd/data-sync/issues/*.md 2>/dev/null | wc -l | tr -d ' ' | awk '$1 >= 3 {print "ok"}'
ok
? 0
```

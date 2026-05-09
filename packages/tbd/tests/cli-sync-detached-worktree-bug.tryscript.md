---
sandbox: true
env:
  NO_COLOR: '1'
  FORCE_COLOR: '0'
path:
  - ../dist
timeout: 60000
before: |
  # Create a bare git repository to serve as local "origin" remote
  mkdir -p ../origin.git
  git init --bare ../origin.git

  # Set up a test git repository (primary repo)
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  git config commit.gpgsign false
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"

  # Add the local bare repo as origin and push
  git remote add origin ../origin.git
  git push -u origin main
---
# Detached-HEAD worktree: ref advance via `git update-ref`

Under the multi-worktree-safe model (plan-2026-05-08), the hidden worktree is on
detached HEAD so sibling working trees of the same repo can share the `tbd-sync` branch
ref without `git worktree add` failing.
Commits in the worktree advance HEAD only; the branch ref is advanced explicitly via
`git update-ref` (production sync uses CAS + merge-and-retry on race).

This file previously asserted the inverse (detached HEAD was a bug).
Renamed conceptually but kept under the same filename for git history continuity.
See `plan-2026-05-08-multi-worktree-sync-support.md`.

## Setup

# Test: Initialize tbd and create initial issue

```console
$ tbd init --prefix=test 2>&1 | head -1
✓ Initialized tbd repository (prefix: test)
? 0
```

```console
$ tbd create "Initial Issue" --type=task
✓ Created [..]
? 0
```

```console
$ tbd sync
✓ [..]
✓ [..]
? 0
```

## Worktree must be detached after init+sync (multi-worktree-safe state)

# Test: Worktree HEAD is detached (no symbolic ref)

```console
$ git -C .tbd/data-sync-worktree symbolic-ref -q HEAD || echo "(detached)"
(detached)
? 0
```

# Test: Worktree HEAD matches the branch ref

```console
$ test "$(git -C .tbd/data-sync-worktree rev-parse HEAD)" = "$(git rev-parse tbd-sync)" && echo "match"
match
? 0
```

## Migration leaves the worktree detached

# Test: Create an issue file in the wrong (legacy) location

```console
$ mkdir -p .tbd/data-sync/issues
? 0
```

```console
$ printf '%s\n' '---' 'id: is-00000000000000000000000000' 'title: Wrong Location Issue' 'status: open' 'kind: task' 'priority: 2' 'created_at: 2025-01-01T00:00:00.000Z' 'updated_at: 2025-01-01T00:00:00.000Z' 'version: 1' 'type: is' '---' 'Test body' > .tbd/data-sync/issues/is-00000000000000000000000000.md
? 0
```

# Test: Doctor detects the issue

```console
$ tbd doctor 2>&1 | grep -i "Data location"
[..] Data location - [..] issue(s) in wrong location[..]
? 0
```

# Test: Doctor --fix migrates the data

```console
$ tbd doctor --fix 2>&1 | grep -i "Data location"
[..] Data location - migrated [..] file(s)[..]
? 0
```

# Test: Migration created a commit in the worktree

```console
$ git -C .tbd/data-sync-worktree log --oneline -1
[..]
? 0
```

# Test: Worktree is STILL detached after migration

The migration commits on detached HEAD; ref advance is explicit.

```console
$ git -C .tbd/data-sync-worktree symbolic-ref -q HEAD || echo "(detached)"
(detached)
? 0
```

# Test: Branch ref was advanced to match worktree HEAD

migrateDataToWorktree advances tbd-sync via update-ref after the commit.

```console
$ test "$(git -C .tbd/data-sync-worktree rev-parse HEAD)" = "$(git rev-parse tbd-sync)" && echo "in sync"
in sync
? 0
```

# Test: Local branch has commit ahead of remote (the migration commit)

```console
$ git rev-list --count origin/tbd-sync..tbd-sync | tr -d ' ' | awk '$1 >= 0 {print "ok"}'
ok
? 0
```

# Test: Sync pushes the migration commit

```console
$ tbd sync 2>&1
✓ [..]
✓ [..]
? 0
```

# Test: After sync, ahead count is 0

```console
$ git rev-list --count origin/tbd-sync..tbd-sync | tr -d ' '
0
? 0
```

# Test: Worktree is STILL detached after sync push

```console
$ git -C .tbd/data-sync-worktree symbolic-ref -q HEAD || echo "(detached)"
(detached)
? 0
```

# Test: Remote has the migration commit

```console
$ git log origin/tbd-sync --oneline -1
[..]
? 0
```

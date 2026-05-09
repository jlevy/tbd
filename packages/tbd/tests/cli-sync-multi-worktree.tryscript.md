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
  SHA: '[0-9a-f]{40}'
  TIMESTAMP: "\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z"
before: |
  # Bare origin repo (tryscript shares /tmp across runs, so reset for isolation).
  rm -rf ../origin.git ../codex-checkout
  git init --bare ../origin.git
  git -C ../origin.git symbolic-ref HEAD refs/heads/main

  # Primary checkout (the user's main working tree)
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  git config commit.gpgsign false
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
  git remote add origin ../origin.git
  git push -u origin main
---
# Multi-worktree sync support (sibling working tree of same repo)

Verifies that two working trees of the same repository can each have their own hidden
`tbd-sync` worktree without `git worktree add` failing.
Reproduces the topology from `plan-2026-05-08-multi-worktree-sync-support.md` (primary
checkout + Codex/agent worktree on a feature branch).

The headline invariants captured in this golden tryscript:

1. Both worktrees can independently set up tbd, create issues, and sync.
2. The sibling’s hidden worktree does NOT collide with the primary’s “tbd-sync is
   already used by worktree” error.
3. Both `.tbd/data-sync-worktree/` worktrees are on detached HEAD (the
   multi-worktree-safe state).
4. After both sides sync, `tbd-sync` reflects commits from both worktrees.

## Setup: primary checkout, then carve out a sibling worktree

# Test: Primary tbd setup --auto

```console
$ tbd setup --auto --prefix=test 2>&1 | grep -c "Initialized sync branch" | tr -d ' '
1
? 0
```

# Test: Commit + push tbd config so sibling sees it

```console
$ git add .tbd/ .claude/ && git commit -q -m "tbd init" && git push -q origin main && echo "ok"
ok
? 0
```

# Test: Primary creates an issue and syncs

```console
$ tbd create "Primary issue" --type=task 2>&1 | grep -o '✓ Created'
✓ Created
? 0
```

```console
$ tbd sync 2>&1 | grep -E 'sent|Already' | head -1
✓ Synced: sent 2 new
? 0
```

# Test: Primary’s worktree is on detached HEAD

```console
$ git -C .tbd/data-sync-worktree symbolic-ref -q HEAD || echo "(detached)"
(detached)
? 0
```

# Test: Carve out a sibling worktree on a feature branch

```console
$ git worktree add -q -b feature/codex ../codex-checkout && echo "ok"
ok
? 0
```

## Sibling worktree: tbd setup, create, sync

# Test: Sibling has the same tbd config (committed earlier on main)

```console
$ test -f ../codex-checkout/.tbd/config.yml && echo "config present"
config present
? 0
```

# Test: Sibling tbd setup --auto succeeds (this is the user’s reported failure path)

```console
$ cd ../codex-checkout && git config user.email a@b.c && git config user.name a && git config commit.gpgsign false && tbd setup --auto 2>&1 | grep -cE "Configured integrations|Already configured" | tr -d ' '
1
? 0
```

# Test: Sibling tbd sync auto-creates its OWN worktree (no “already used by worktree” error)

```console
$ cd ../codex-checkout && tbd sync 2>&1 | grep -E 'Worktree|sync|repaired' | head -3
✓ Worktree repaired successfully
✓ Already in sync
? 0
```

# Test: Sibling worktree exists and is on detached HEAD

```console
$ cd ../codex-checkout && git -C .tbd/data-sync-worktree symbolic-ref -q HEAD || echo "(detached)"
(detached)
? 0
```

# Test: Both worktrees coexist in `git worktree list --porcelain`

```console
$ git -C ../codex-checkout worktree list --porcelain | grep -c "data-sync-worktree" | tr -d ' '
2
? 0
```

# Test: Both data-sync-worktree entries are detached

```console
$ git -C ../codex-checkout worktree list --porcelain | grep -A2 "data-sync-worktree" | grep -c "^detached" | tr -d ' '
2
? 0
```

## Sibling adds an issue, both sides round-trip

# Test: Sibling creates an issue (worktree is set up so file goes to correct location)

```console
$ cd ../codex-checkout && tbd create "Sibling issue" --type=task 2>&1 | grep -o '✓ Created'
✓ Created
? 0
```

# Test: Sibling’s new issue is in the worktree (not the legacy direct path)

```console
$ test -d ../codex-checkout/.tbd/data-sync-worktree/.tbd/data-sync/issues && ls ../codex-checkout/.tbd/data-sync-worktree/.tbd/data-sync/issues/*.md | wc -l | tr -d ' '
2
? 0
```

# Test: Sibling sync pushes the new commit

```console
$ cd ../codex-checkout && tbd sync 2>&1 | grep -E 'sent|Already' | head -1
✓ Synced: sent 1 new, 1 updated
? 0
```

# Test: Primary syncs and catches up to sibling’s commit (no rollback)

```console
$ tbd sync 2>&1 | grep -E 'sent|Already' | head -1
✓ Already in sync
? 0
```

# Test: After both sync, primary worktree HEAD == tbd-sync ref (no rollback)

```console
$ test "$(git -C .tbd/data-sync-worktree rev-parse HEAD)" = "$(git rev-parse tbd-sync)" && echo "match"
match
? 0
```

# Test: Sibling worktree HEAD == tbd-sync ref

```console
$ test "$(git -C ../codex-checkout/.tbd/data-sync-worktree rev-parse HEAD)" = "$(git rev-parse tbd-sync)" && echo "match"
match
? 0
```

## End-state golden capture (broad-state diff per golden-testing methodology)

These probes capture the full topology so any regression that re-attaches a worktree,
drops a commit, or breaks branch-ref advancement shows up as a diff.
See `tbd guidelines golden-testing-guidelines`.

# Test: tbd-sync log shape

```console
$ git log tbd-sync --oneline | wc -l | tr -d ' '
3
? 0
```

# Test: tbd-sync includes Initialize + two sync commits

```console
$ git log tbd-sync --format="%s"
tbd sync: [..]
tbd sync: [..]
Initialize tbd-sync branch
? 0
```

# Test: Worktree list final shape — 4 entries: primary main + sibling main + 2 detached data-sync worktrees

```console
$ git worktree list --porcelain | grep -cE "^detached$" | tr -d ' '
2
? 0
```

```console
$ git worktree list --porcelain | grep -cE "^branch refs/heads/" | tr -d ' '
2
? 0
```

```console
$ git worktree list --porcelain | grep -E "^branch " | sed 's|.*/||' | sort
codex
main
? 0
```

# Test: No issue files leaked to the legacy direct path on either side

```console
$ ls .tbd/data-sync/issues/*.md 2>/dev/null | wc -l | tr -d ' '
0
? 0
```

```console
$ ls ../codex-checkout/.tbd/data-sync/issues/*.md 2>/dev/null | wc -l | tr -d ' '
0
? 0
```

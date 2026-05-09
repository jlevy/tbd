---
sandbox: true
env:
  NO_COLOR: '1'
  FORCE_COLOR: '0'
path:
  - ../dist
timeout: 60000
before: |
  # Bare origin repo (tryscript shares /tmp across runs, so reset for isolation).
  rm -rf ../origin.git
  git init --bare ../origin.git
  git -C ../origin.git symbolic-ref HEAD refs/heads/main

  # Working tree
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
# Legacy attached worktree migration

Verifies the in-place migration of a hidden worktree from the pre-2026-05-08
attached-HEAD layout to the multi-worktree-safe detached-HEAD layout.
Migration is silent and does NOT move data — only the worktree’s HEAD form changes
(symbolic-ref → detached).
See plan-2026-05-08-multi-worktree-sync-support.md.

## Setup

# Test: Initialize tbd

```console
$ tbd setup --auto --prefix=test 2>&1 | grep -c "Initialized sync branch" | tr -d ' '
1
? 0
```

# Test: Confirm fresh setup gives a detached worktree

```console
$ git -C .tbd/data-sync-worktree symbolic-ref -q HEAD || echo "(detached)"
(detached)
? 0
```

## Simulate the legacy attached state by re-attaching the worktree to tbd-sync

This mimics a worktree created by tbd <= v0.1.26.

# Test: Re-attach to tbd-sync (legacy state)

```console
$ git -C .tbd/data-sync-worktree checkout -q tbd-sync && git -C .tbd/data-sync-worktree symbolic-ref HEAD
refs/heads/tbd-sync
? 0
```

# Test: Doctor reports the legacy attached state as a warning, not an error

```console
$ tbd doctor 2>&1 | grep -iE "Worktree.*(attached|legacy)" | head -1
[..] Worktree - attached to sync branch (legacy state)[..]
? 0
```

# Test: Doctor without --fix does NOT change the state

```console
$ git -C .tbd/data-sync-worktree symbolic-ref HEAD
refs/heads/tbd-sync
? 0
```

## Repair: doctor --fix detaches in place

# Test: doctor --fix repairs the attached state

```console
$ tbd doctor --fix 2>&1 | grep -iE "Worktree.*(detached|repaired)" | head -1
[..] Worktree - detached (legacy attached state repaired)[..]
? 0
```

# Test: After --fix, worktree is detached (no symbolic ref)

```console
$ git -C .tbd/data-sync-worktree symbolic-ref -q HEAD || echo "(detached)"
(detached)
? 0
```

# Test: After --fix, worktree HEAD is unchanged (no data movement)

```console
$ test "$(git -C .tbd/data-sync-worktree rev-parse HEAD)" = "$(git rev-parse tbd-sync)" && echo "match"
match
? 0
```

# Test: After --fix, no migration commit was created

```console
$ git log tbd-sync --oneline | wc -l | tr -d ' '
1
? 0
```

# Test: After --fix, no backup directory was created (in-place repair)

```console
$ test -d .tbd/backups && echo "backup-exists" || echo "no-backup"
no-backup
? 0
```

## Sibling worktree can now share the branch

# Test: Commit primary’s tbd config so the sibling worktree sees it

```console
$ git add .tbd/ .claude/ && git commit -q -m "tbd init" && echo "ok"
ok
? 0
```

# Test: Carve out a sibling worktree

```console
$ git worktree add -q -b feature/codex ../codex-checkout && echo "ok"
ok
? 0
```

# Test: Sibling tbd setup --auto succeeds (would fail before --fix)

```console
$ cd ../codex-checkout && git config user.email a@b.c && git config user.name a && git config commit.gpgsign false && tbd setup --auto 2>&1 | grep -cE "Configured integrations|Already configured" | tr -d ' '
1
? 0
```

# Test: Sibling sync auto-creates its own detached worktree

```console
$ cd ../codex-checkout && tbd sync 2>&1 | grep -E "repaired|sync" | head -2
✓ Worktree repaired successfully
✓ Already in sync
? 0
```

# Test: Both worktrees coexist as detached

```console
$ git -C ../codex-checkout worktree list --porcelain | grep -A2 "data-sync-worktree" | grep -c "^detached" | tr -d ' '
2
? 0
```

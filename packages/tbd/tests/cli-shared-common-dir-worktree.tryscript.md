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
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  git config commit.gpgsign false
  echo "# Shared common-dir test repo" > README.md
  git add README.md
  git commit -m "Initial commit"

  mkdir -p ../origin.git
  git init --bare ../origin.git
  git remote add origin ../origin.git
  git push -u origin main

  mkdir -p .tbd
  cat > .tbd/config.yml <<'YAML'
  tbd_format: f03
  tbd_version: legacy
  display:
    id_prefix: test
  sync:
    branch: tbd-sync
    remote: origin
  settings:
    auto_sync: false
    doc_auto_sync_hours: 24
  YAML
  cat > .tbd/.gitignore <<'EOF'
  data-sync-worktree/
  data-sync/
  state.yml
  docs/
  EOF
  git add .tbd/config.yml .tbd/.gitignore
  git commit -m "Legacy tbd f03 config"

  git worktree add --orphan -b tbd-sync .tbd/data-sync-worktree
  git -C .tbd/data-sync-worktree config user.email "test@example.com"
  git -C .tbd/data-sync-worktree config user.name "Test User"
  git -C .tbd/data-sync-worktree config commit.gpgsign false
  mkdir -p .tbd/data-sync-worktree/.tbd/data-sync/issues
  mkdir -p .tbd/data-sync-worktree/.tbd/data-sync/mappings
  mkdir -p .tbd/data-sync-worktree/.tbd/data-sync/attic/conflicts
  printf '%s\n' \
    '---' \
    'type: is' \
    'id: is-01legacy000000000000000001' \
    'title: Legacy issue from f03 worktree' \
    'kind: task' \
    'status: open' \
    'priority: 2' \
    'version: 1' \
    'labels: []' \
    'dependencies: []' \
    'created_at: 2026-05-17T00:00:00.000Z' \
    'updated_at: 2026-05-17T00:00:00.000Z' \
    '---' \
    'Legacy issue body.' \
    > .tbd/data-sync-worktree/.tbd/data-sync/issues/is-01legacy000000000000000001.md
  printf '%s\n' 'aa01: 01legacy000000000000000001' \
    > .tbd/data-sync-worktree/.tbd/data-sync/mappings/ids.yml
  printf '%s\n' 'schema_version: 1' > .tbd/data-sync-worktree/.tbd/data-sync/meta.yml
  git -C .tbd/data-sync-worktree add .
  git -C .tbd/data-sync-worktree commit -m "Legacy sync data"
  git -C .tbd/data-sync-worktree push -u origin tbd-sync

  git worktree add -b codex-agent agent main
---
# tbd CLI: Shared Common-Dir Worktree Migration

This golden scenario captures the full workflow that motivated the shared common-dir
design:

1. An f03 per-checkout sync worktree owns `tbd-sync`.
2. A linked worktree cannot create its own per-checkout sync worktree because Git
   rejects the duplicate branch checkout.
3. A new tbd write migrates the repository to the current (f06) common-dir layout.
4. The main checkout and linked worktree both create issues through the same shared sync
   worktree.

* * *

## Legacy Per-Checkout Worktree Conflict

# Test: Old per-checkout design fails from a linked worktree

This reproduces the original failure mode: a second checkout cannot attach another local
worktree to the already-owned `tbd-sync` branch.

```console
$ git -C agent worktree add .tbd/data-sync-worktree tbd-sync 2>&1 | grep "already used by worktree"
fatal: 'tbd-sync' is already used by worktree at [..]
? 0
```

* * *

## First New-Client Write Migrates The Layout

# Test: Main checkout create migrates legacy data and writes the new issue

The first mutating command in a checkout whose `.tbd/config.yml` still says `f03` emits
a one-time stderr notice (`tbd-afjh`) before the success line, so users see the tracked
config bump coming rather than discovering it later as a surprise diff.
The migration also materializes the shared worktree for the first time, which emits its
own point-of-use notice (#135).

```console
$ tbd create "Main checkout issue" --type=task
• tbd_format f03 → f06: .tbd/config.yml updated in this checkout. Commit on this branch or merge main to publish the format upgrade.
• tbd-sync worktree was missing; auto-materialized it (fresh clone, or the worktree was removed).
✓ Created test-[SHORTID]: Main checkout issue
? 0
```

# Test: Top-level config was migrated to f06 with common-dir storage

```console
$ cat .tbd/config.yml
tbd_format: f06
tbd_version: legacy
# tbd_upgrades: tbd versions that have run `tbd setup` in this repo (oldest first);
# tbd_version above is the most recent. Informational; updated automatically by setup.
tbd_upgrades:
  - version: legacy
display:
  id_prefix: test
sync:
  branch: tbd-sync
  remote: origin
  storage: git-common-dir-v1
settings:
  auto_sync: false
  doc_auto_sync_hours: 24
  use_gh_cli: true
? 0
```

# Test: Common-dir layout uses the same f06 format ID

```console
$ cat "$(git rev-parse --path-format=absolute --git-common-dir)/tbd/layout.yml"
tbd_format: f06
sync_storage: git-common-dir-v1
data_sync_worktree: data-sync-worktree
lock_profile: data-sync-v1
created_at: [TIMESTAMP]
updated_at: [TIMESTAMP]
? 0
```

# Test: The legacy per-checkout sync worktree was removed

```console
$ test ! -e .tbd/data-sync-worktree && echo "legacy worktree removed"
legacy worktree removed
? 0
```

# Test: Git sees exactly one shared data-sync worktree

```console
$ git worktree list --porcelain | grep "data-sync-worktree" | wc -l | tr -d ' '
1
? 0
```

* * *

## Linked Worktree Uses The Same Shared Sync Worktree

# Test: Main and linked checkouts resolve the same Git common directory

```console
$ MAIN_COMMON=$(git rev-parse --path-format=absolute --git-common-dir) && LINKED_COMMON=$(git -C agent rev-parse --path-format=absolute --git-common-dir) && test "$MAIN_COMMON" = "$LINKED_COMMON" && echo "same git common dir"
same git common dir
? 0
```

# Test: Linked worktree create also succeeds

The linked worktree’s `.tbd/config.yml` is still on `f03` because the format bump commit
only landed on `main`; the first mutating command in the linked checkout therefore fires
the same `tbd-afjh` notice as the main checkout did before bumping in place.

```console
$ (cd agent && tbd create "Linked worktree issue" --type=bug)
• tbd_format f03 → f06: .tbd/config.yml updated in this checkout. Commit on this branch or merge main to publish the format upgrade.
✓ Created test-[SHORTID]: Linked worktree issue
? 0
```

# Test: Both checkouts now use one shared issue store

```console
$ find "$(git rev-parse --path-format=absolute --git-common-dir)/tbd/data-sync-worktree/.tbd/data-sync/issues" -maxdepth 1 -name '*.md' | wc -l | tr -d ' '
3
? 0
```

# Test: No issue files were written to the direct checkout path

```console
$ find .tbd/data-sync/issues -maxdepth 1 -name '*.md' 2>/dev/null | wc -l | tr -d ' '
0
? 0
```

# Test: Stable issue state from the main checkout

The output is normalized to stable fields only; generated IDs and timestamps are
intentionally filtered out.

```console
$ tbd list --all --json | node -e 'const fs=require("fs"); const issues=JSON.parse(fs.readFileSync(0,"utf8")); console.log(issues.map((i)=>i.title+" | "+i.kind+" | "+i.status).sort().join("\n"))'
Legacy issue from f03 worktree | task | open
Linked worktree issue | bug | open
Main checkout issue | task | open
? 0
```

* * *

## Older Client Compatibility Guard

# Test: An f03-era client would reject the migrated f06 repository

This uses the same format ordering contract as tbd itself: a client that only supports
up to f03 must fail closed when it sees the f06 common-dir layout.

```console
$ node -e 'const fs=require("fs"); const format=fs.readFileSync(".tbd/config.yml","utf8").match(/^tbd_format: (\S+)/m)?.[1]; const supported="f03"; if (format !== undefined && format > supported) { console.error("This repository requires a newer version of tbd."); console.error("Config format '"'"'"+format+"'"'"' is from a newer tbd version."); console.error("This tbd version supports up to format '"'"'"+supported+"'"'"'."); console.error("Upgrade tbd: npm install -g get-tbd@latest"); process.exit(1); }'
This repository requires a newer version of tbd.
Config format 'f06' is from a newer tbd version.
This tbd version supports up to format 'f03'.
Upgrade tbd: npm install -g get-tbd@latest
? 1
```

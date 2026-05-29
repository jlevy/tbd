---
title: QA Playbook
description: Manual release-readiness and upgrade validation for get-tbd v0.2.0 (f03 → f04 on-disk format migration)
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# QA Playbook: Release v0.2.0 Upgrade

Manual QA playbook for cutting `get-tbd` v0.2.0 — the first release that ships the
shared common-dir sync worktree (on-disk format `f03` → `f04`). The 0.1.x → 0.2.0 minor
bump (0.x semver: a minor is `0.MINOR.0`) signals the layout change.

**Purpose**: Prove that (a) the new client migrates real `f03` repos to `f04`
idempotently, (b) older clients fail closed against `f04`, (c) the tag-triggered release
pipeline publishes correctly, and (d) the published `v0.2.0` works in real day- to-day
use on this machine after the global install is swapped.

**Estimated Time**: ~90–120 minutes (15 min repo prep, 45–60 min scenarios, 30 min
release + post-publish + global swap).

> This is a manual test: too costly / not pass-fail-crisp to fully cover in unit or
> tryscript tests. The automated suites cover the `f03 → f04` contract in isolation; this
> playbook covers real user repos, multi-worktree sibling state, and the published
> release surface installed globally on this machine.

* * *

## Current Status (last update 2026-05-28)

| Phase | Status | Notes |
| --- | --- | --- |
| Phase 0: Pre-flight — sync, version, decide bump | ✅ Passed | Local main FF to `3c2e7ca`; dead changeset removed; version chosen `v0.2.0` |
| Phase 1: In-repo sanity (build, test, publint) | ✅ Passed | 1091/1091 unit tests pass (added tbd-nrvj migration test, tbd-afjh sibling-bump notice test); both f04 tryscripts; publint clean. Stale `dist/` footgun fixed by tbd-zswv (global-setup now uses build-if-needed.mjs). |
| Phase 2.B/2.C/2.E/2.F/2.G on ATA | ✅ Passed | 3548 issues migrated byte-identically on ATA. All scenarios green. See below. |
| Phase 2.D on flowmark | ✅ Passed | Main checkout f03 → f04 migration ran cleanly (56 issues preserved). Both `/private/tmp/flowmark-pr*` siblings migrated under the shared layout: tbd-afjh notice fires once per checkout, idempotent on rerun. `tbd_version: 0.1.12` baseline exercised without surprises. |
| Findings code fixes | ✅ Passed | tbd-nrvj (doctor --fix migrates) ✅; tbd-afjh (sibling-bump notice) ✅; tbd-r7rt (doctor exit 1 on ✗) ✅; tbd-zswv (stale-dist guard) ✅; tbd-pxxe (cut-release relocated to docs/publishing.md) ✅ |
| Phase 3: Cut release v0.2.0 | ⏳ Pending | Awaiting CHANGELOG + release PR. |
| Phase 4: Post-publish verification | ⏳ Pending |  |
| Phase 5: Global swap on this machine + re-validate | ⏳ Partial | Pre-publish swap already done (`0.1.31-dev.34.cffb142-dirty`). Real re-validate will happen after publish. |

**Status Legend**: ✅ Passed | ❌ Failed | ⏳ Pending | ⏸️ Blocked

**Test Results (last update 2026-05-28):**

- **2.E (old-client rejection)** ✅ — global `v0.1.30` against this repo’s f04:
  - `tbd list` → exit 1, exact upgrade message ✅
  - `tbd sync` → exit 1, exact upgrade message ✅
  - `tbd doctor` → reports “Invalid config file” instead of upgrade message, **exits 0**
    ⚠ The post-0.1.30 doctor surfacing fixes this; mention in release notes so 0.1.30
    users know to upgrade rather than try `doctor`.
  - No silent downgrade of config or layout ✅
- **2.B (ATA main checkout f03 → f04)** ✅ — 3548 issues migrated byte-identically;
  legacy `.tbd/data-sync-worktree/` removed; new worktree at
  `$GIT_COMMON_DIR/tbd/data-sync-worktree`; only tracked diff is the f04 config bump;
  second `tbd sync` is a no-op (idempotent).
  - **UX note**: `tbd status` reports the unhealthy worktree and says “Run: tbd doctor
    --fix”, but `doctor --fix` doesn’t migrate — `tbd sync` does.
    The user has to know to run `tbd sync`. Consider either making `doctor --fix`
    perform the migration, or making `tbd status`/`doctor` say “Run: tbd sync” for this
    specific case.
- **2.C (ATA sibling worktree on `feat/disk-cleanup-skill`, config still f03)** ✅ —
  reads work using the shared f04 layout; first mutating op (`tbd create`) silently
  bumps the sibling’s per-checkout `.tbd/config.yml` to f04. Issue visible across
  worktrees; close from sibling visible from main.
  - **UX note**: The bump is silent — users with multi-worktree setups will get a
    tracked `M .tbd/config.yml` diff on their feature branch and must decide whether to
    commit it. Call this out in release notes.
- **2.F (doctor --fix recovery)** ✅
  - 2.F.1 (layout f03 / config f04): doctor diagnoses “Common-dir layout - mismatched
    with config”; `--fix` rewrites layout from config; second doctor is clean.
  - 2.F.2 (layout f05 / config f04 — future format): doctor surfaces “requires newer tbd
    (found f05) — Upgrade: npm install -g get-tbd@latest”; `--fix` refuses to downgrade
    and surfaces the same message; layout untouched.
    ✅
- **2.G (sign-by-default overlay on ATA)** ✅ — with `commit.gpgsign=true` + broken
  signing key: `tbd create` and `tbd sync` succeed; last three `tbd-sync` commits all
  show `%G? == N` (no signature) → `gitCommit()` correctly overrides ambient
  `commit.gpgsign`.

**Phase 2.D (flowmark) detail:**

- Main checkout f03 → f04 migrated cleanly.
  The tbd-afjh notice fired on the first read (`tbd list`) and config was bumped in
  place. Idempotent on rerun.
- Both `/private/tmp/flowmark-pr47-fresh.vvTbeB` and `/private/tmp/flowmark-pr49.BeDey9`
  detached-HEAD siblings: shared common-dir worktree is `(healthy)`; first command from
  each sibling fired the tbd-afjh notice once and bumped that checkout’s
  `.tbd/config.yml` to f04. Cross-worktree consistency intact.
- The 56 closed issues on `tbd-sync` are visible from the new worktree at the common-dir
  location.

**Next Steps:**

1. Draft v0.2.0 CHANGELOG section (tbd-9urm) — must lead with the f04 migration plus the
   upgrade-message caveat for users on v0.1.30 specifically; document the tbd-afjh
   notice so users with multi-worktree setups expect the per-checkout config bump.
2. Cut release per `docs/publishing.md` (tbd-erav).
3. Phase 4 + 5 after publish (tbd-6q93).

* * *

**Prerequisites**:

- Node.js ≥ 20 and `corepack enable` for `pnpm`
- Git ≥ 2.42 (orphan worktree support)
- A built local CLI at `packages/tbd/dist/bin.mjs` (used as `LOCAL_TBD` below)
- A globally installed older client to exercise rejection (currently `v0.1.30` on this
  machine)
- The two victim repos confirmed at `f03`:

```bash
export LOCAL_TBD="$(pwd)/packages/tbd/dist/bin.mjs"        # this repo's build
export REPO_ATA="/Users/levy/wrk/aisw/ai-trade-arena"      # 1 sibling worktree, current tbd
export REPO_FM="/Users/levy/wrk/github/flowmark"           # 2 sibling worktrees, older tbd_version (0.1.12)
```

Sibling worktrees observed at playbook authoring time:

- `ai-trade-arena` → `ai-trade-arena-disk-cleanup-skill` (branch
  `feat/disk-cleanup-skill`)
- `flowmark` → `/private/tmp/flowmark-pr47-fresh.vvTbeB`,
  `/private/tmp/flowmark-pr49.BeDey9`

These give us a real f03 multi-worktree migration on two different repo shapes without
needing a third victim repo.

* * *

## Related Documentation — Read for Context

- [docs/project/specs/active/plan-2026-05-17-shared-common-dir-sync-worktree.md](../../docs/project/specs/active/plan-2026-05-17-shared-common-dir-sync-worktree.md)
  — the f04 design
- [docs/tbd-format-versioning.md](../../docs/tbd-format-versioning.md) — old-client /
  new-client contract (project-local contributor guide; relocated out of shipped
  guidelines in v0.2.0)
- [docs/publishing.md](../../docs/publishing.md) — tag-triggered release flow
  (project-local; replaced the removed `cut-release` shortcut in v0.2.0)
- [packages/tbd/src/lib/tbd-format.ts](../../packages/tbd/src/lib/tbd-format.ts) —
  single source of truth for `CURRENT_FORMAT` and migrations
- [packages/tbd/tests/cli-shared-common-dir-worktree.tryscript.md](../../packages/tbd/tests/cli-shared-common-dir-worktree.tryscript.md)
  — automated coverage of the layout
- [packages/tbd/tests/cli-format-compatibility.tryscript.md](../../packages/tbd/tests/cli-format-compatibility.tryscript.md)
  — automated future-format rejection

## Phase 0: Pre-flight

### 0.1 Sync local main and confirm the delta

```bash
git checkout main
git fetch --tags origin
git status
git describe --tags --abbrev=0
git log "$(git describe --tags --abbrev=0)..HEAD" --oneline | head -40
```

**Expected**:

- Working tree clean, on `main`, fast-forwarded to `origin/main`.
- Last tag is `v0.1.30`; the log shows the shared common-dir series (PR #121 plus the
  doc cleanup, gpg-sign fix, and shared-lock hardening commits).

**Verify**:

- [ ] `.changeset/` directory is absent (PR #134 dropped Changesets).
- [ ] `packages/tbd/src/lib/tbd-format.ts` shows `CURRENT_FORMAT = 'f04'` and
  `FORMAT_HISTORY.f04.introduced === '0.2.0'`.
- [ ] No stray local changes to `.tbd/config.yml` (a stale `docs_cache` line is benign
  and can be discarded).

### 0.2 Confirm chosen version

**Version: `v0.2.0`** (minor bump).
0.x-semver convention: a minor is `0.MINOR.0`, and the f04 format bump is a real on-disk
layout change — patch-line release would under-signal it.
`FORMAT_HISTORY.f04.introduced` already says `'0.2.0'` so no change needed there.

* * *

## Phase 1: In-repo sanity

### 1.1 Build, lint, typecheck, test

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint:check
pnpm typecheck
pnpm test
pnpm publint
pnpm build
```

**Expected output**: All steps exit 0. `pnpm publint` reports no errors.

**Verify**:

- [ ] No failing tests, no type errors.
- [ ] `packages/tbd/dist/bin.mjs` exists after `pnpm build`.

### 1.2 Run the f04-specific tryscript scenarios

```bash
cd packages/tbd
npx tryscript run tests/cli-shared-common-dir-worktree.tryscript.md
npx tryscript run tests/cli-format-compatibility.tryscript.md
cd ../..
```

**Verify**:

- [ ] Both tryscripts pass.
- [ ] No mention of “format ‘f04’ is from a newer tbd version” inside scenarios that are
  *not* the rejection scenario.

### 1.3 Pack + global install dry run

```bash
pnpm test:install        # builds, packs, installs globally from the tarball
which tbd && tbd --version
pnpm test:uninstall      # restore previous global (v0.1.30 will return)
```

**Verify**:

- [ ] `tbd --version` reports `0.2.0` (or whatever is in `packages/tbd/package.json` at
  the time of pack).
- [ ] No `publint` warnings appear at pack time.

* * *

## Phase 2: Real-repo upgrade scenarios

> Use `$LOCAL_TBD` (this repo’s `dist/bin.mjs`) as the new client and the
> globally-installed `tbd v0.1.30` as the old client.
> Run scenarios from each victim repo’s root unless noted.

### 2.0 Per-repo pre-flight (handle codex-hook noise cleanly)

Real victim repos accumulate untracked artifacts from agent integration (e.g.
`.agents/`, `.codex/`, `.claude/scheduled_tasks.lock`) and sometimes a tracked
`.tbd/config.yml` diff from a setup refresh.
We want a clean baseline so we can attribute every post-migration diff to the migration
itself.

For each victim repo:

```bash
cd "$REPO"
git status --short
git -C "$REPO" worktree list
grep tbd_format .tbd/config.yml
```

Decision rules:

| Status line | Class | Action |
| --- | --- | --- |
| ` M .tbd/config.yml` | Likely benign `docs_cache:` refresh | `git diff .tbd/config.yml` — if only docs_cache adds, `git checkout -- .tbd/config.yml`. Otherwise stash. |
| `?? .agents/`, `?? .codex/`, `?? .claude/scheduled_tasks.lock` | Untracked agent artifacts | Snapshot aside so the playbook’s diff is crisp: `mkdir -p /tmp/qa-aside.$$ && mv .agents .codex .claude/scheduled_tasks.lock /tmp/qa-aside.$$/ 2>/dev/null`. Restore after Phase 2 if you want. |
| `?? .tbd/<other>` | Investigate | If they aren’t in `.tbd/.gitignore`, the user wrote them; don’t move them. |
| Anything in `M src/` etc. | Real in-flight work | **Stop.** Stash with `git stash push -u -m "qa-pre-flight"` before continuing, or use a different victim repo. |

**Verify pre-flight**:

- [ ] `git status` is clean (or only carries untracked agent artifacts you’ve moved
  aside).
- [ ] `grep tbd_format .tbd/config.yml` → `tbd_format: f03`.
- [ ] `git worktree list` matches the expected sibling-worktree shape for this repo.

**Cleanup after scenarios** (per repo):

```bash
mv /tmp/qa-aside.$$/* .  2>/dev/null   # restore the moved-aside artifacts
git stash pop            2>/dev/null   # if you stashed
```

### 2.A Fresh install in a scratch tmpdir

```bash
SCRATCH=$(mktemp -d -t tbd-qa-fresh-XXXXXX)
cd "$SCRATCH" && git init -q && git commit --allow-empty -m init -q
node "$LOCAL_TBD" setup --auto --prefix=qa
node "$LOCAL_TBD" status
node "$LOCAL_TBD" doctor
grep tbd_format .tbd/config.yml
ls "$(git rev-parse --git-common-dir)/tbd"
```

**Verify**:

- [ ] `.tbd/config.yml` contains `tbd_format: f04` and
  `sync.storage: git-common-dir-v1`.
- [ ] `$GIT_COMMON_DIR/tbd/layout.yml` exists with `tbd_format: f04`.
- [ ] `tbd doctor` exits 0, no warnings about layout or temp files.
- [ ] No stray `.tbd/data-sync-worktree/` directory.

### 2.B `ai-trade-arena` migration (single-worktree perspective)

```bash
cd "$REPO_ATA"
# Pre-flight per 2.0
git tag qa-pre-f04-ata 2>/dev/null || true
cp -R .tbd "/tmp/qa-ata-tbd-backup.$$"

node "$LOCAL_TBD" status                  # should auto-migrate or hint at sync
node "$LOCAL_TBD" sync
node "$LOCAL_TBD" doctor
node "$LOCAL_TBD" list | head -20
node "$LOCAL_TBD" list | wc -l
```

**Verify**:

- [ ] `grep tbd_format .tbd/config.yml` → `f04`.
- [ ] `grep tbd_format "$(git rev-parse --git-common-dir)/tbd/layout.yml"` → `f04`.
- [ ] `git worktree list` no longer shows `.tbd/data-sync-worktree`; the common-dir
  worktree shows up under `$GIT_COMMON_DIR/tbd/...`.
- [ ] `tbd list` returns the same issue count as the pre-migration backup
  (`ls /tmp/qa-ata-tbd-backup.$$/data-sync/issues | wc -l` or via the worktree).
- [ ] `tbd show <known-id>` returns identical content (title, body, deps) before vs.
  after.
- [ ] `tbd doctor` is clean.

**Idempotency**:

```bash
node "$LOCAL_TBD" sync
node "$LOCAL_TBD" doctor
```

- [ ] Second pass is a no-op (no migration log lines, no file writes).

### 2.C `ai-trade-arena` sibling worktree (multi-checkout)

```bash
SIBLING="/Users/levy/wrk/aisw/ai-trade-arena-disk-cleanup-skill"
cd "$SIBLING"
git status --short
grep tbd_format .tbd/config.yml          # may still say f03 until branch merges main
node "$LOCAL_TBD" status
node "$LOCAL_TBD" list | wc -l
node "$LOCAL_TBD" doctor
```

**Expected behavior**:

- The sibling’s `.tbd/config.yml` is per-checkout (branch-visible), so it may still say
  `f03` until that branch picks up the migration commit from main.
  **But** because the common-dir layout is shared (`$GIT_COMMON_DIR/tbd/layout.yml` is
  `f04`), and our policy is “config bump is the publish step”, `tbd` here will refuse to
  operate until the branch is reconciled with main — surfacing `formatUpgradeMessage` or
  `CommonDirLayoutError` pointing at `doctor --fix`.
- This is the contract we want: the sibling can’t silently downgrade or split-brain.

**Verify**:

- [ ] If sibling config is still `f03` and layout is `f04`: tbd errors with a clear
  mismatch message naming `tbd doctor --fix` or “merge main into this branch.”
- [ ] Merging main into the sibling branch (or running `doctor --fix` per its
  instructions) resolves the state and both worktrees see `f04`.
- [ ] After reconciliation: `git rev-parse --git-common-dir` returns the same path from
  both worktrees, and `tbd list` returns the same issue set from both.

**Check for ERROR conditions**:

- [ ] No race-condition errors (e.g., “branch already checked out”).
- [ ] No silent downgrade of `$GIT_COMMON_DIR/tbd/layout.yml`.

### 2.D `flowmark` migration (older tbd_version baseline)

`flowmark`’s `.tbd/config.yml` records `tbd_version: 0.1.12` — older than ATA’s. This
exercises the longer migration distance.
Run the same flow as 2.B and 2.C from `/Users/levy/wrk/github/flowmark` and from each
`/private/tmp/flowmark-pr*` sibling.

```bash
cd "$REPO_FM"
# Pre-flight per 2.0 (this repo has M .tbd/config.yml + .agents/ + .codex/ untracked)
cp -R .tbd "/tmp/qa-fm-tbd-backup.$$"

node "$LOCAL_TBD" status
node "$LOCAL_TBD" sync
node "$LOCAL_TBD" doctor
node "$LOCAL_TBD" list | wc -l

for SIB in /private/tmp/flowmark-pr47-fresh.vvTbeB /private/tmp/flowmark-pr49.BeDey9; do
  echo "--- $SIB ---"
  (cd "$SIB" && node "$LOCAL_TBD" status && node "$LOCAL_TBD" doctor)
done
```

**Verify**:

- [ ] Main `flowmark` checkout migrates to `f04` and `tbd_version` is bumped.
- [ ] Both /private/tmp siblings either pick up the migrated state (if their branches
  contain the f04 commit) or fail closed with the same upgrade/mismatch message seen in
  2.C — never silent downgrade.
- [ ] `tbd list` issue count matches the backup.

### 2.E Old client (`v0.1.30`) hits an `f04` repo → fail closed

After 2.B (and/or 2.D) the repo is at `f04`. Now run the globally-installed
`tbd v0.1.30`:

```bash
cd "$REPO_ATA"
tbd --version            # confirm 0.1.30
tbd list                 # should fail
tbd doctor               # should fail with upgrade message
tbd sync                 # should fail
echo "exit: $?"
```

**Verify**:

- [ ] All three commands exit non-zero.
- [ ] Error text includes the supported format (`f03`), the found format (`f04`), and
  the upgrade command (`npm install -g get-tbd@latest`).
- [ ] No silent rewrite of `.tbd/config.yml` back to `f03`.
- [ ] No deletion or rewrite of `$GIT_COMMON_DIR/tbd/layout.yml`.

### 2.F Half-migrated state → `tbd doctor --fix` recovery

Simulate a mid-migration crash by hand-editing the layout:

```bash
cd "$REPO_ATA"
LAYOUT="$(git rev-parse --git-common-dir)/tbd/layout.yml"
cp "$LAYOUT" "$LAYOUT.bak"
sed -i.bak 's/tbd_format: f04/tbd_format: f03/' "$LAYOUT"

node "$LOCAL_TBD" doctor                 # diagnoses mismatch, names doctor --fix
node "$LOCAL_TBD" doctor --fix           # acquires shared lock, rewrites layout from config
node "$LOCAL_TBD" doctor                 # clean

# Negative case (future-format layout, current config):
sed -i.bak 's/tbd_format: f04/tbd_format: f05/' "$LAYOUT"
node "$LOCAL_TBD" doctor                 # MUST surface upgrade message, NOT silently rewrite to f04
cp "$LAYOUT.bak" "$LAYOUT"               # restore
```

**Verify**:

- [ ] First `doctor` reports a layout/config mismatch and names `doctor --fix`.
- [ ] `doctor --fix` rewrites `layout.yml` and the next `doctor` is clean.
- [ ] Future-format negative case surfaces `formatUpgradeMessage` and does **not**
  rewrite `layout.yml` to `f04`.

### 2.G Sign-by-default git environment overlay

Reproduces the failure mode the `commit.gpgsign=false` fix addressed.
Done on whichever victim repo is convenient (use ATA after 2.B; effect is local-config
only).

```bash
cd "$REPO_ATA"
git config --local commit.gpgsign true
git config --local user.signingkey "doesnotexist"

node "$LOCAL_TBD" create "qa sign test" --type=task
node "$LOCAL_TBD" sync
node "$LOCAL_TBD" doctor

# Inspect the internal commit:
COMMON_TBD="$(git rev-parse --git-common-dir)/tbd"
git -C "$COMMON_TBD" log --format=%G? -1 tbd-sync 2>/dev/null || true

git config --local --unset commit.gpgsign
git config --local --unset user.signingkey
```

**Verify**:

- [ ] No “gpg failed to sign” or “worktree corrupted” errors.
- [ ] `tbd-sync` commit shows `N` (no signature) — internal commits ignore ambient
  `commit.gpgsign`.
- [ ] User-facing commits on the working branch are unaffected by tbd.

* * *

## Phase 3: Cut release v0.2.0

Follow [docs/publishing.md](../../docs/publishing.md) once Phase 2 is green.
Summary:

```bash
git checkout main && git pull
git checkout -b claude/release-v0.2.0
# bump packages/tbd/package.json version to 0.2.0
# prepend a "## 0.2.0" section to packages/tbd/CHANGELOG.md per release-notes-guidelines
pnpm release:verify       # build + publint
pnpm test
git commit -am "chore: release get-tbd v0.2.0"
git push -u origin claude/release-v0.2.0
gh pr create --title "chore: release get-tbd v0.2.0" --body "..."
gh pr checks <n> --watch
# merge in UI or: gh pr merge <n> --squash --delete-branch
git checkout main && git pull
git tag v0.2.0 && git push origin v0.2.0
```

**Release notes drafting** (key points to lead with):

- The `f03 → f04` on-disk format bump: every machine touching a repo must upgrade.
- Old clients fail closed with an explicit upgrade message — no silent downgrade.
- Shared common-dir layout fixes multi-worktree state and sibling-checkout drift.
- Hardening: shared-lock boundary for init/repair; internal tbd-sync commits force
  `commit.gpgsign=false` so signed-by-default envs don’t stall migration;
  `tbd doctor --fix` repairs layout/config mismatches and surfaces future-format errors
  clearly.

**Verify**:

- [ ] CHANGELOG heading is exactly `## 0.2.0` (the workflow greps for it).
- [ ] PR CI passes before tag push.

* * *

## Phase 4: Post-publish verification

### 4.1 Watch the release workflow

```bash
gh run list --workflow=release.yml --limit=1
gh run watch <id> --exit-status
```

**Verify**:

- [ ] Workflow exits 0.
- [ ] The “Extract changelog for this version” step finds the `## 0.2.0` section.
- [ ] `Publish to npm` step shows provenance enabled.

### 4.2 Inspect the published package

```bash
npm view get-tbd version
npm view get-tbd dist-tags
gh release view v0.2.0
```

**Verify**:

- [ ] `npm view get-tbd version` → `0.2.0`.
- [ ] `latest` dist-tag points to `0.2.0`.
- [ ] GitHub Release body matches the `## 0.2.0` CHANGELOG section.

### 4.3 Tmpdir smoke test of the published bits

```bash
TMPDIR_SMOKE=$(mktemp -d -t tbd-smoke-XXXXXX)
cd "$TMPDIR_SMOKE" && git init -q && git commit --allow-empty -m init -q
# Use npx to bypass the global install for this isolated check:
npx --yes get-tbd@0.2.0 setup --auto --prefix=smk
npx --yes get-tbd@0.2.0 doctor
npx --yes get-tbd@0.2.0 create "post-release smoke" --type=task
npx --yes get-tbd@0.2.0 list
```

**Verify**:

- [ ] `.tbd/config.yml` lands at `tbd_format: f04`.
- [ ] All commands succeed.

* * *

## Phase 5: Global swap on this machine and re-validate

This is the confidence step the user asked for: replace the globally-installed `v0.1.30`
with the just-published `v0.2.0` and confirm real day-to-day usage works in the same two
repos.

### 5.1 Swap the global install

```bash
which tbd                           # confirm current path
tbd --version                       # confirm 0.1.30
npm install -g get-tbd@0.2.0
tbd --version                       # confirm 0.2.0
which tbd                           # confirm same path (or note any change)
```

**Verify**:

- [ ] `tbd --version` → `0.2.0`.
- [ ] No npm install warnings about peer deps or engines.

### 5.2 Re-validate `ai-trade-arena` with the published global

```bash
cd "$REPO_ATA"
tbd status
tbd doctor
tbd list | head -5
tbd create "qa post-global-swap ATA" --type=task --priority=P3
tbd sync
git status                          # confirm only expected diffs (no surprise tracked changes)
```

**Verify**:

- [ ] All commands succeed against an already-`f04` repo (no re-migration noise).
- [ ] The new task lands and syncs.
- [ ] No new tracked-file diffs surface beyond what `tbd sync` legitimately writes
  (e.g., outbox updates under `.tbd/workspaces/`).
- [ ] `tbd shortcut --list` works (this was the failure mode that surfaced earlier when
  global was `f03`-capable and config was `f04`).

### 5.3 Re-validate `flowmark` with the published global

```bash
cd "$REPO_FM"
tbd status
tbd doctor
tbd list | head -5
tbd create "qa post-global-swap flowmark" --type=task --priority=P3
tbd sync
```

**Verify**:

- [ ] Same checks as 5.2 pass.
- [ ] Sibling /private/tmp worktrees still work (`cd $SIB && tbd status`) or surface the
  documented mismatch error if their branch is behind main.

### 5.4 Self-validate this repo with the published global

```bash
cd /Users/levy/wrk/github/tbd
tbd status
tbd doctor
tbd shortcut --list
tbd guidelines --list
```

**Verify**:

- [ ] All four commands succeed.
  (Right now, with global at `v0.1.30` and this repo at `f04`, `tbd shortcut --list`
  fails closed — that’s how we discovered the upgrade contract is working.
  After the swap it must succeed.)

* * *

## Troubleshooting

### “format ‘f04’ is from a newer tbd version” when running `LOCAL_TBD`

You forgot to rebuild or you’re picking up a stale global `tbd` on `$PATH`. Run with the
explicit path: `node "$LOCAL_TBD" …`. Confirm with `node "$LOCAL_TBD" --version`.

### `release.yml` failed at the changelog step

The grep in `release.yml` is exact: `## 0.2.0` (no trailing date, no extra spaces).
Fix the heading, push another tag (`v0.2.0` cannot be reused — bump to `v0.2.1` or
delete the GH release+tag first).

### A sibling worktree still shows `tbd_format: f03`

`.tbd/config.yml` is per-checkout (branch-visible).
If the sibling worktree is on a branch that hasn’t merged main yet, the f04-bumped
config hasn’t reached it.
Expected behavior is fail-closed with a mismatch message naming `tbd doctor --fix` or
“merge main into this branch.”

### Real victim repo had unexpected uncommitted changes I couldn’t classify

Don’t migrate it. Use a different victim, or stash everything
(`git stash push -u -m qa`), migrate, then carefully reconcile the stash.
Migration writes `.tbd/config.yml` (tracked); preserving an unrelated diff there at the
same time will produce a confusing merge.

* * *

## Success Criteria

Before marking this release as **PASSED**, verify:

- [ ] All Phase 1 commands exit 0, including `publint` and the two f04 tryscripts.
- [ ] Phase 2 scenarios 2.A–2.G pass on `ai-trade-arena` and `flowmark` (and their
  sibling worktrees).
- [ ] An old `v0.1.30` client provably fails closed against an `f04` repo with the
  upgrade message; it does not silently downgrade either format marker.
- [ ] `tbd doctor --fix` repairs a synthetic layout/config mismatch and surfaces (not
  hides) a future-format mismatch.
- [ ] Migration is idempotent on a second pass.
- [ ] `release.yml` completes cleanly and `npm view get-tbd@0.2.0 version` returns
  `0.2.0`.
- [ ] After the global swap to `v0.2.0`, the same two real victim repos and this repo
  itself work cleanly without fail-closed errors.

* * *

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->

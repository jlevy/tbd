---
title: QA Playbook
description: Release-readiness validation for tbd changes, tbd watch, and the durable watch-beads worker pattern
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# QA Playbook: Watch Infrastructure Release

Manual QA playbook for the opt-in bead-watch infrastructure introduced by PR #205:
`tbd changes`, `tbd watch`, and the durable `watch-beads` worker pattern.

**Purpose**: Prove that a packaged release candidate detects real remote bead changes,
preserves existing tbd and Git state, survives realistic operator failures, and remains
optional for repositories that do not invoke it.
The Linear experiment is deliberately separate and never gates this release.

**Estimated Time**: ~90 minutes for the release gate, plus 30–60 minutes per additional
platform and any optional Linear sandbox experiment.

> The automated suites establish deterministic change semantics, resource bounds, and
> failure behavior. This playbook covers the surfaces that benefit from human or real-
> environment judgment: a packed artifact, credentialed Git transport, agent-runner
> permissions, network interruption, operator output, and platform shells.

* * *

## Current Status (last update 2026-08-09)

| Phase | Status | Notes |
| --- | --- | --- |
| Phase 0: Source and disposable-topology validation | ✅ Passed | Local candidate passed the focused 18-test Git-safety suite and the expanded `pnpm qa:watch-release`; the built smoke is now part of all three operating-system CI jobs. |
| Phase 1: Packed artifact | ✅ Passed | Current candidate passed from an isolated npm prefix with install scripts disabled; repeat at the exact release-tag SHA. |
| Phase 2: Credentialed real remote and non-disruption | ⏳ Pending | Required before release promotion; use a disposable private remote. |
| Phase 3: Resilience and durable worker | ⏳ Pending | Required for unattended-worker promotion; the failure/restart protocol is already executable under automation. |
| Phase 4: Platform and operator review | ⏳ Pending | GitHub CI covers macOS, Ubuntu, and Windows; manually sample the actual release artifact on supported operator hosts. |
| Phase 5: Optional Linear sandbox | ⏸️ Blocked | Non-gating; wait for tbd-vm5s and the extension foundations tbd-le2l/tbd-z95g. |
| Phase 6: Cleanup and evidence | ⏳ Pending | Attach results to tbd-t750 and the release record. |

**Status Legend**: ✅ Passed | ❌ Failed | ⏳ Pending | ⏸️ Blocked

**Test Results (last update 2026-08-09):**

- `pnpm --filter get-tbd exec vitest run tests/bead-watch.test.ts` → ✅ 18/18, including
  an existing `origin/tbd-sync` ref that a private fetch must not advance.
- `pnpm qa:watch-release` → ✅ real bare remote, two clones, blocking wake, stable JSON
  and exit codes, concurrent bead/ready watchers, every selector family,
  human/JSON/quiet output, Git-state isolation, normal pull/list/show/ready/sync, and
  rendered `watch-beads` shortcut.
- Local tarball install plus `TBD_QA_BIN=<isolated-prefix>/tbd` smoke → ✅ the packaged
  CLI and bundled `watch-beads` shortcut passed without changing the global install.
- The smoke run exposed and then verified the fix for Git’s opportunistic application of
  `remote.origin.fetch`; the watch fetch now passes an empty `--refmap=`.
- The complete 1,068-case transcript rerun → ✅ after replacing a randomized-ID-adjacent
  missing sentinel with a deterministic distant value (tbd-dbyj).

**Next Steps:**

1. Repeat Phase 1 at the exact release-tag SHA and record the checksum.
2. Run Phase 2 over the same credentialed Git transport users will rely on.
3. Record the release decision and evidence on tbd-t750.

* * *

## Prerequisites

- Node.js 20 or newer, pnpm 10, and Git 2.42 or newer.
- A clean checkout of the release commit.
- For Phase 2, a disposable private GitHub repository and credentials that match the
  intended operator environment.
- For Phase 3, a disposable worker profile with explicitly reviewed filesystem and
  network permissions.
- Never run destructive scenarios against a production bead graph.

Environment variables used below:

```bash
export QA_ROOT="$(mktemp -d -t tbd-watch-release.XXXXXX)"
export QA_INSTALL="$QA_ROOT/install"
export QA_REMOTE_URL="git@github.com:OWNER/DISPOSABLE-TBD-WATCH-QA.git"
```

`QA_ROOT` must point to the newly created disposable directory.
Do not reuse a project checkout or a directory containing user data.

## Related Documentation: Read for Context

- [Watch and external-sync plan](../../docs/project/specs/active/plan-2026-07-19-bead-watch-and-external-sync.md)
  — contract, layering, and non-goals.
- [Release validation plan](../../docs/project/specs/active/valid-2026-08-09-bead-watch-release.md)
  — coverage map, gates, risk, and rollback.
- [Phase 1 validation record](../../docs/project/specs/active/valid-2026-07-19-bead-watch-phase-1.md)
  — prior Claude Code and Codex live demonstrations.
- [Release smoke runner](../../packages/tbd/scripts/validate-watch-release.ts) —
  disposable two-clone executable validation.
- [Watch-beads shortcut](../../packages/tbd/docs/shortcuts/standard/watch-beads.md) —
  at-least-once pending-report/checkpoint protocol.

## Phase 0: Source and Disposable-Topology Validation

### 0.1 Run the focused release smoke

```bash
pnpm qa:watch-release
```

**Expected output**:

```text
✓ Watch release-candidate smoke test passed
✓ Disposable topology removed
```

**Verify**:

- [x] A selected remote update wakes a blocked watcher with `format_version: 1`.
- [x] An unrelated update does not match a static bead selector.
- [x] Two simultaneous watchers in one checkout wake from one commit without ref or
  worktree contention.
- [x] `show`, `list`, `ready`, `sync --pull`, and `sync --status` still work while both
  watchers are blocked and again after the final normal pull.
- [x] The isolation assertion distinguishes normal sync effects from watch side effects:
  state-neutral commands preserve the first snapshot; `sync --pull` advances the local
  branch and hidden worktree; then the post-status snapshot is the watcher baseline.
- [x] Bead, multiple-bead, label, spec, status, ready, and all-selection behavior is
  observed through real committed history.
- [x] Human, JSON, and quiet output plus exit 0, 1, 2, and 3 behavior is observed
  through the built CLI.
- [x] The caller worktree, local sync branch, `origin/tbd-sync`, `FETCH_HEAD`, hidden
  sync worktree, lock presence, and private watch refs are byte-for-byte unchanged by
  `tbd watch`.
- [x] A normal `tbd sync --pull` still works afterward.
- [x] `show`, `list`, `ready`, `sync --status`, and `shortcut watch-beads` still work.

Set `TBD_QA_KEEP=1` only when investigating a failure.
The runner prints the retained topology path; remove that exact disposable directory
when finished.

### 0.2 Run repository gates

```bash
pnpm precommit
pnpm --filter get-tbd test:tryscript
pnpm publint
pnpm check:package-age
```

**Verify**:

- [x] Formatting, lint, typecheck, build, and 1,451 Vitest tests pass.
- [x] All 1,068 CLI transcript cases pass.
- [x] Package validation passes.
- [x] The dependency-age check reports zero violations; this change adds no dependency
  or lockfile delta.

## Phase 1: Packed Artifact

### 1.1 Pack and install without changing the global CLI

```bash
QA_SHA=$(git rev-parse HEAD)
pnpm --filter get-tbd pack --pack-destination "$QA_ROOT"
QA_TARBALL=$(find "$QA_ROOT" -maxdepth 1 -name 'get-tbd-*.tgz' -print -quit)
test -n "$QA_TARBALL"
node --input-type=module -e '
  import { createHash } from "node:crypto";
  import { readFileSync } from "node:fs";
  const path = process.argv[1];
  const sha256 = createHash("sha256").update(readFileSync(path)).digest("hex");
  console.log(`${sha256}  ${path}`);
' "$QA_TARBALL" | tee "$QA_ROOT/artifact.sha256"
npm install --ignore-scripts --prefix "$QA_INSTALL" "$QA_TARBALL"
export TBD_QA_BIN="$QA_INSTALL/node_modules/get-tbd/dist/bin.mjs"
node "$TBD_QA_BIN" --version
"$QA_INSTALL/node_modules/.bin/tbd" --version
printf 'release_sha=%s\n' "$QA_SHA" | tee "$QA_ROOT/release-candidate.txt"
node --version | tee -a "$QA_ROOT/release-candidate.txt"
pnpm --version | tee -a "$QA_ROOT/release-candidate.txt"
git --version | tee -a "$QA_ROOT/release-candidate.txt"
```

On Windows PowerShell, use the generated `tbd.cmd` shim for the second version check.
The smoke runner uses `dist/bin.mjs` through Node on every platform so shell-shim
differences do not obscure product behavior.

**Verify**:

- [x] The tarball contains the CLI, bundled standard docs, and `watch-beads` shortcut.
- [x] `tbd --version` names the intended candidate.
- [ ] At the release tag, record the exact Git SHA, SHA-256 artifact checksum, and
  runtime/tool versions without credentials.
- [x] No global package or user configuration was changed.

### 1.2 Run the same smoke against the installed artifact

```bash
TBD_QA_BIN="$TBD_QA_BIN" pnpm exec tsx packages/tbd/scripts/validate-watch-release.ts
```

**Expected output**: The candidate path points under `$QA_INSTALL`, every step passes,
and the disposable topology is removed.

**Failure conditions**:

- The runner silently falls back to `packages/tbd/dist/bin.mjs`.
- `shortcut watch-beads` is absent from the installed package.
- Output or exit codes differ from Phase 0.

## Phase 2: Credentialed Real Remote and Non-Disruption

### 2.1 Create two independent clones

Use an empty, disposable private repository.
In terminal A:

```bash
git clone "$QA_REMOTE_URL" "$QA_ROOT/writer"
cd "$QA_ROOT/writer"
git switch -c main
git config user.email watch-qa@example.com
git config user.name "Watch Release QA"
git commit --allow-empty -m "Initial fixture"
git push --set-upstream origin main
"$TBD_QA_BIN" init --prefix wat --remote origin
git add --all
git commit -m "Initialize tbd"
git push
WATCH_ID=$("$TBD_QA_BIN" create "Credentialed watch QA" --label watch-release --json \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).id))')
"$TBD_QA_BIN" sync --issues
BASE=$(git rev-parse refs/heads/tbd-sync)
printf 'WATCH_ID=%s\nBASE=%s\n' "$WATCH_ID" "$BASE"
printf 'export TBD_QA_BIN=%q\nexport QA_REMOTE_URL=%q\nexport WATCH_ID=%q\nexport BASE=%q\n' \
  "$TBD_QA_BIN" "$QA_REMOTE_URL" "$WATCH_ID" "$BASE" >"$QA_ROOT/watch.env"
```

In terminal B, set `QA_ROOT` to the exact disposable path created in terminal A, then:

```bash
source "$QA_ROOT/watch.env"
git clone "$QA_REMOTE_URL" "$QA_ROOT/watcher"
cd "$QA_ROOT/watcher"
"$TBD_QA_BIN" sync --issues --pull
git status --short
git rev-parse refs/heads/tbd-sync refs/remotes/origin/tbd-sync
COMMON_DIR=$(git rev-parse --path-format=absolute --git-common-dir)
HIDDEN_WORKTREE="$COMMON_DIR/tbd/data-sync-worktree"
FETCH_HEAD_PATH=$(git rev-parse --path-format=absolute --git-path FETCH_HEAD)
snapshot_watch_state() {
  local output_path=$1
  {
    echo caller_status
    git status --porcelain=v1 --untracked-files=all
    echo local_sync_tip
    git rev-parse refs/heads/tbd-sync
    echo remote_tracking_tip
    git rev-parse refs/remotes/origin/tbd-sync
    echo fetch_head_hash
    if test -f "$FETCH_HEAD_PATH"; then
      git hash-object --no-filters "$FETCH_HEAD_PATH"
    else
      echo absent
    fi
    echo hidden_worktree_head
    git -C "$HIDDEN_WORKTREE" rev-parse HEAD
    echo hidden_worktree_status
    git -C "$HIDDEN_WORKTREE" status --porcelain=v1 --untracked-files=all
    echo sync_lock
    if test -d "$COMMON_DIR/tbd/locks/data-sync.lock"; then
      echo present
    else
      echo absent
    fi
    echo private_watch_refs
    git for-each-ref --format='%(refname) %(objectname)' refs/tbd/watch/
  } >"$output_path"
}
snapshot_watch_state "$QA_ROOT/watcher.before"
"$TBD_QA_BIN" watch --bead "$WATCH_ID" --since "$BASE" \
  --interval 10 --timeout 90 --json
snapshot_watch_state "$QA_ROOT/watcher.after"
diff -u "$QA_ROOT/watcher.before" "$QA_ROOT/watcher.after"
```

While terminal B is blocked, return to terminal A:

```bash
"$TBD_QA_BIN" update "$WATCH_ID" --notes "credentialed remote wake"
"$TBD_QA_BIN" sync --issues
```

**Verify**:

- [ ] Terminal B exits 0 within one interval plus normal network latency.
- [ ] JSON contains exactly the expected bead and notes delta.
- [ ] SSH/HTTPS credentials work non-interactively in the intended runner.
- [ ] Before an explicit pull, terminal B’s local sync ref, remote-tracking ref,
  `FETCH_HEAD`, worktree status, and hidden worktree head remain unchanged.
- [ ] `git for-each-ref refs/tbd/watch/` prints nothing after exit.

### 2.2 Exercise existing workflows while watch is active

Start another bounded watch in terminal B. While it waits, run in both clones:

```bash
"$TBD_QA_BIN" list --label watch-release
"$TBD_QA_BIN" ready
"$TBD_QA_BIN" sync --status
```

Then create and sync an unrelated bead from terminal A.

**Verify**:

- [ ] Existing commands keep their prior output and exit behavior.
- [ ] No hidden-worktree lock contention or unexpected worktree diff appears.
- [ ] An unrelated change does not wake a static bead watch.
- [ ] Stopping the watcher leaves normal create/update/sync behavior intact.

## Phase 3: Resilience and Durable Worker

### 3.1 Brief and persistent network failure

On a disposable clone, start a watch with `--interval 10 --timeout 180`. After its first
healthy observation, temporarily disconnect that process from the network for one or two
intervals, then restore connectivity and publish a selected update.

**Verify**:

- [ ] A brief established outage is retried and the later selected update wakes the
  process.
- [ ] Five consecutive failed observations end with exit 1 and a useful diagnostic.
- [ ] An unavailable credential fails fast at startup.
  The local built-candidate smoke already covers an invalid remote, and CLI tests cover
  an absent branch.
- [ ] A stalled transport is bounded; no Git child remains after the CLI exits.

Do not change system-wide credential or firewall settings on a shared machine.
Prefer a disposable VM/container or a process-scoped network control.

### 3.2 Run the durable worker failure/restart scenario

Render `tbd shortcut watch-beads`, copy its unattended recipe into the disposable
repository, and give it a worker command that intentionally fails on the first attempt
and succeeds idempotently on the second.

**Verify**:

- [ ] The report is moved to `.tbd/<state-name>.pending.tmp` before worker execution.
- [ ] Worker or final-sync failure preserves the pending report and leaves the
  checkpoint unchanged.
- [ ] Restart retries the same report at least once, pulls, and revalidates current
  state before acting.
- [ ] Success syncs output, atomically advances `.tbd/<state-name>.checkpoint.tmp`, and
  removes the pending report.
- [ ] The next watch resumes with `--since <saved-tip>`.
- [ ] HUP, INT, and TERM exit 129, 130, and 143 without deleting durable state.
- [ ] Replaying the worker does not duplicate any external side effect.

### 3.3 Agent-runner permissions

Repeat one read-only wake and one bead-writing worker under the intended Claude Code or
Codex profile.

**Verify**:

- [ ] Read-only watch needs only repository read and remote access.
- [ ] A writing worker can create the Git common-directory lock and reach the remote.
- [ ] The profile does not receive broader filesystem or network access than needed.
- [ ] Runner/model selection is pinned rather than inherited from mutable personal
  defaults.

## Phase 4: Platform and Operator Review

Run the packed-artifact smoke on representative macOS, Ubuntu, and Windows hosts.
CI is the automated floor; this phase samples the actual artifact and shell integration.

**Quality checklist**:

| Item | Check | Status |
| --- | --- | --- |
| Cross-platform built candidate | CI runs the full disposable-topology smoke on macOS, Ubuntu, and Windows. | Automated |
| Minimum runtime | Exact packed artifact passes under the supported Node.js 20 floor. | ⏳ |
| macOS | Packed smoke passes; unattended recipe parses and runs under system Bash 3.2. | ⏳ |
| Ubuntu | Packed smoke and one real-remote wake pass. | ⏳ |
| Windows | Packed smoke passes through PowerShell/Git; `.cmd` shim and CRLF docs extraction remain valid. | ⏳ |
| Human output | Baseline, tip, bead, field, and hunk are understandable without JSON. | ⏳ |
| JSON output | One parseable document on stdout; diagnostics stay on stderr. | ⏳ |
| Quiet mode | No output; exit status alone communicates match/no-match. | ⏳ |
| Idle soak | A 30–60 minute idle watch performs remote observations but no fetch and leaks no private refs. | ⏳ |

## Phase 5: Optional Linear Sandbox Experiment

This phase is **not a PR, merge, or release gate**. Do not start it until tbd-vm5s
defines the revised pilot and the extension-safety work in tbd-le2l/tbd-z95g is ready
for the chosen experiment.

If run, keep provider code and operational state outside core tbd and use a disposable
Linear workspace.

- [ ] Bind by external ID under a module-owned extension namespace; never title-match.
- [ ] Start with one-way import plus status writeback only.
- [ ] Run the same report twice and prove idempotency.
- [ ] Persist a module-owned checkpoint only after external work succeeds.
- [ ] Inject provider timeout, rate limit, malformed mapping, and partial write failure.
- [ ] Prove repositories that never invoke the module have no dependency, config,
  schema, startup, or workflow change.

## Phase 6: Cleanup and Evidence

```bash
git -C "$QA_ROOT/watcher" for-each-ref --format='%(refname)' refs/tbd/watch/
git -C "$QA_ROOT/writer" status --short
git -C "$QA_ROOT/watcher" status --short
```

**Verify before deleting the disposable environment**:

- [ ] No private watch refs or Git child processes remain.
- [ ] No unexpected tracked or untracked state exists outside `.tbd/*.tmp` worker state.
- [ ] Any preserved pending report was inspected and intentionally processed or
  discarded; deleting it drops a wake.
- [ ] Results, artifact version/SHA, platform, transport, and deviations are recorded on
  tbd-t750.
- [ ] The disposable remote and exact `$QA_ROOT` directory are removed deliberately.

## Troubleshooting

### Saved baseline is missing

**Symptom**: `Invalid or missing commit <sha>. Run tbd sync first`.

**Fix**: Run `tbd sync --pull` so the saved checkpoint exists locally, then retry.
If sync history was intentionally rewritten and the baseline is no longer an ancestor,
restart without `--since` to establish a new baseline.

### Watch times out without a wake

Check the configured remote/branch and committed remote tip:

```bash
git config --get remote.origin.url
git ls-remote origin refs/heads/tbd-sync
git rev-parse refs/heads/tbd-sync
```

Confirm the update was followed by `tbd sync`; unsynced local edits are intentionally
invisible to a remote watcher.

### Remote-tracking ref moved during watch

This is a failure. Record the before/after SHAs and candidate version.
The watcher fetch must use an empty Git refmap so the explicit private ref does not
opportunistically apply `remote.origin.fetch`.

## Success Criteria

Before marking the release validation **PASSED**, verify:

- [ ] All automated gates and the packed-artifact smoke pass at the release SHA.
- [ ] One credentialed real-remote wake passes without protected Git-state mutation.
- [ ] Existing tbd workflows remain usable during and after a watch.
- [ ] Durable worker failure/restart and idempotency behavior is accepted for any
  unattended deployment being promoted.
- [ ] Required host/platform samples pass, with no unexplained output or process leak.
- [ ] Linear remains isolated and non-gating.
- [ ] Rollback requires no data migration because the feature is additive and opt-in.

* * *

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->

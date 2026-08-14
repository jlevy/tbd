---
title: "Bead Watch Release Validation Plan"
description: Automated evidence, manual release gates, risk controls, and rollback for PR #205 watch infrastructure
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Validation Plan: Bead Watch Release

## Overview

This is the release-validation plan for PR #205’s opt-in watch infrastructure:
`tbd changes`, `tbd watch`, and the durable `watch-beads` worker pattern.

The validation has three independent decisions:

1. **PR merge**: core semantics, compatibility, resource bounds, Git isolation, the
   executable release smoke, and exact-head CI must pass.
2. **Release promotion**: the packed artifact and one credentialed real-remote scenario
   must also pass; any supported unattended deployment must accept the durable-worker
   and permission checks.
3. **Linear experimentation**: explicitly non-gating.
   It begins only from a revised provider-module design and stays outside core tbd until
   evidence supports promotion.

Related artifacts:

- Governing plan: `plan-2026-07-19-bead-watch-and-external-sync.md`
- Historical live-agent validation: `valid-2026-07-19-bead-watch-phase-1.md`
- Manual playbook: `tests/qa/watch-infrastructure-release.qa.md`
- Executable smoke: `packages/tbd/scripts/validate-watch-release.ts`
- Tracking: tbd-tp6n (validation epic), tbd-961h (initial automated artifacts), tbd-3x5y
  (cross-platform CI and selector/concurrency expansion), and tbd-t750 (remaining manual
  release QA)

## Automated Coverage Completed

### Coverage Map

| Layer | Evidence | Contract covered |
| --- | --- | --- |
| Snapshot change semantics | `issue-changes.test.ts`, `issue-changes-output.test.ts` | Scalar/array/text changes; create/delete; metadata suppression; deterministic order; stable JSON and bounded human output; selectors; readiness edges; malformed snapshots; missing mappings; non-ancestor baselines. |
| Poll loop and deadlines | `bead-watch.test.ts` | Initial/resumed baselines; no idle fetch; unrelated-tip advancement; inclusive final observation; partial intervals; transient failures; failure cap; bounded startup/poll/fetch/ref-resolution budgets; cleanup on every path. |
| Git isolation | `bead-watch.test.ts` plus release smoke | Private ref cleanup; stale-ref reclamation; no local sync ref, configured remote-tracking ref, `FETCH_HEAD`, caller worktree, hidden worktree, or lock mutation. The real two-clone smoke caught Git’s opportunistic remote-ref update and now regresses the empty `--refmap=` fix. |
| CLI contract | `cli-changes.test.ts`, `cli-watch.test.ts`, `exit-codes.test.ts`, `git-exit-code.test.ts` | JSON/human/quiet modes; success 0; operational error 1; usage 2; no-match/timeout 3; SIGINT 130; selector validation and actionable recovery errors. |
| Existing workflow compatibility | Shared selection/workflow/spec tests, full legacy suite, and release smoke | Existing `show`, `list`, `ready`, `sync --pull`, and `sync --status` run while two watchers are active and again after a normal pull; config, sync, worktree, and CLI behavior remains covered after extracting shared predicates. |
| Durable worker protocol | `watch-beads-shortcut.test.ts` | Bash syntax; macOS Bash 3.2; CRLF extraction; persist-before-work; pull/revalidate; injected worker failure; pending retention; restart/retry; final sync; atomic checkpoint; resume; signal exits. |
| Scale and bounded resources | `issue-changes.test.ts`, `performance.test.ts` | 50,000-character bodies; edit-distance cutoff; 128-object `cat-file` batches; 1,000 selected beads; 2,000 all-change reports; existing 5,000-issue performance fixture. |
| CLI breadth | Tryscript suite | End-to-end command transcripts and help surface, including new commands, across the built binary. |
| Release-candidate topology | `pnpm qa:watch-release` | Built candidate, bare remote, two clones, real blocked wake, two concurrent watchers in one checkout, bead/multiple-bead/label/spec/status/ready/all selection, checkpoint pull, human/JSON/quiet output, exit 0/1/2/3, protected Git state, active and post-watch sync, legacy commands, bundled shortcut. |
| Platform CI | `.github/workflows/ci.yml` | The built-candidate release smoke runs after the unit suite on Ubuntu, macOS, and Windows. Coverage/lint, benchmark, package, and security checks remain independent gates. |

### Release Smoke Result

The new `pnpm qa:watch-release` command passed locally on macOS on 2026-08-09. It:

1. Builds the candidate CLI.
2. Creates a temporary bare remote plus independent writer and watcher clones.
3. Initializes tbd, publishes selected, unrelated, blocker, and blocked-ready beads, and
   proves a static selection ignores unrelated movement.
4. Pulls a durable resume checkpoint, starts a real blocking watch, publishes a selected
   remote update, and validates the versioned report.
5. Compares the caller worktree, local sync ref, `origin/tbd-sync`, `FETCH_HEAD`, hidden
   worktree head/status, and private watch refs before and after the watch.
6. Runs simultaneous bead and `--ready` watchers from one checkout, closes a real
   blocker while updating status/spec/notes, runs existing read and pull workflows while
   both watchers are blocked, validates both reports, and repeats the protected-state
   comparison after both private fetches are cleaned up.
7. Exercises every selector family, multiple bead IDs, human/JSON/quiet output, and
   success, operational-error, usage-error, no-match, and timeout exit behavior.
8. Pulls normally and runs `show`, `list`, `ready`, `sync --status`, and
   `shortcut watch-beads` afterward.
9. Removes the disposable topology.

The coexistence check distinguishes ownership of Git side effects.
`show`, `list`, and `ready` must leave the protected snapshot unchanged.
An explicit `sync --pull` must advance the local branch and hidden worktree, while
`sync --status` performs its own normal fetch.
The smoke verifies those expected effects and then uses the resulting local/remote refs,
hidden-worktree head, `FETCH_HEAD`, and lock state as the baseline that the concurrent
watchers may not change.

The first safety run exposed a real gap in the earlier fixture: an explicit Git fetch to
a private ref can still apply the configured `remote.origin.fetch` refmap and advance
`origin/tbd-sync`. The focused test was strengthened to begin with an existing stale
remote-tracking ref, failed before the fix, and passed after the watcher added an empty
`--refmap=`. The end-to-end smoke then passed with every protected state value
unchanged.

### Automated Results

Current validated results for the PR series:

```text
pnpm --filter get-tbd exec vitest run tests/bead-watch.test.ts  18/18 passed
pnpm qa:watch-release                                         expanded smoke passed
packed tarball + isolated-prefix TBD_QA_BIN smoke             passed
pnpm precommit                                                 100 files / 1,451 tests passed
pnpm --filter get-tbd test:tryscript                           1,068 cases passed
pnpm publint                                                   passed
pnpm check:package-age                                         0 violations across 31 pins
```

The full transcript run initially exposed a fixture-only nondeterminism: a randomly
generated short ID could be similar enough to the intended missing sentinel `test-zzzz`
to add a valid fuzzy-match suggestion.
The sentinel is now the deliberately distant, non-generated `test-zzzzzzz`, the
fail-closed error is asserted explicitly, and all 1,068 cases pass.
This validation-found hardening is tracked by tbd-dbyj.

The earlier validation head passed Ubuntu, macOS, Windows, coverage/lint, benchmark,
Cursor Bugbot, and DeepSource.
The CI-wiring commit must repeat those exact-head checks, including the new
built-candidate smoke on all three operating systems.
No dependency or lockfile changes are part of the work.

## Manual Validation Completed

The source candidate has completed a disposable local-transport end-to-end run on macOS.
This is stronger than a mocked CLI test because it uses real Git repositories,
`ls-remote`, private fetches, hidden sync worktrees, two independent clones, and the
built CLI. The same smoke also passed through a tarball installed under an isolated npm
prefix with install scripts disabled, while leaving the global `tbd` installation
untouched.

Earlier Phase 1 validation also completed live Claude Code and Codex demonstrations:

- a background Claude Code task woke an idle interactive session;
- a Codex watch-then-spawn worker consumed a report and synchronized its result;
- two serialized sessions exchanged complete notes replacements through a bead;
- runner/model, timeout, sandbox, and Git-common-directory permission limits were
  recorded in `valid-2026-07-19-bead-watch-phase-1.md`.

Those demonstrations validate the workflow shape.
They do not replace release testing of the exact packed artifact or current credentialed
transport.

## Manual Validation Remaining

The exact procedure and evidence checklist live in
`tests/qa/watch-infrastructure-release.qa.md` and are tracked by tbd-t750.

### Required Before Release Promotion

- [ ] Repeat the passing isolated-prefix tarball smoke at the exact release-tag SHA and
  record the artifact checksum.
- [ ] Run that exact packed artifact under the supported Node.js 22.12.0 runtime floor;
  CI covers the built candidate under Node.js 22.12.0 and Node.js 24 on Linux.
- [ ] Run one selected wake over a disposable private GitHub remote using the same
  SSH/HTTPS credential path as the intended operator.
- [ ] Confirm the remote-tracking ref, local sync ref, `FETCH_HEAD`, caller worktree,
  hidden worktree, lock, and private refs remain unchanged until an explicit pull.
- [ ] Run existing `create`, `update`, `list`, `ready`, `show`, and `sync` workflows
  while a watcher is active and after it exits.
- [ ] Review human, JSON, quiet, timeout, usage-error, and operational-error output for
  operator clarity. Automated assertions already enforce parseability, silence, exit
  classes, and stdout/stderr separation; this check is for human judgment.

### Required Before Promoting an Unattended Worker

- [ ] Interrupt an established watch briefly, restore transport, and confirm it
  recovers; confirm persistent failure exits 1 rather than hanging.
- [ ] Run the pending-report/checkpoint recipe with an injected worker failure, restart,
  idempotent replay, final sync, checkpoint advancement, and signal shutdown.
- [ ] Validate the chosen Claude Code/Codex/CI profile can reach the remote and, when it
  writes beads, can create the Git common-directory lock without broader permissions
  than necessary.
- [ ] Run a 30–60 minute idle soak and check for unexpected fetches, refs, processes,
  output, or resource growth.

### Platform Sampling

- [ ] macOS packed artifact and system Bash 3.2 worker recipe.
  The built-candidate smoke runs in macOS CI on every PR.
- [ ] Ubuntu packed artifact and one real-remote wake.
  The built-candidate smoke runs in Ubuntu CI on every PR.
- [ ] Windows packed artifact through PowerShell/Git, including the `.cmd` shim and
  CRLF-rendered shortcut.
  The built-candidate smoke runs in Windows CI on every PR.

GitHub Actions remains the cross-platform automated gate.
Manual sampling focuses on the packaged artifact, credentials, shell integration, and
operator experience.

## User Validation

The release owner should answer these questions from the playbook evidence:

- Does a watcher wake within the configured interval plus normal transport latency?
- Is the report sufficient to identify the baseline, tip, bead, and changed field
  without inspecting raw Git state?
- Can an operator distinguish no-match/timeout (3), usage error (2), and operational
  failure (1) without retrying the wrong class of failure?
- Does watching remain invisible to a user who continues normal tbd work in the same
  repository?
- After a worker crash, is it obvious whether a report is pending, safe to retry, or
  intentionally discarded?
- Are the chosen runner permissions and idempotency guarantees acceptable for the
  external action it performs?

## Risks and Controls

| Risk | Control and evidence | Residual validation |
| --- | --- | --- |
| Fetch mutates configured refs or shared worktree state | Private collision-resistant ref, `--no-write-fetch-head`, empty `--refmap=`, cleanup in `finally`, focused fixture, two-clone state snapshot. | Repeat on packed artifact and real remote. |
| A stalled or flaky transport hangs or kills workers prematurely | Positive deadline on every network Git process; fetch/resolution share one budget; bounded retry cap; final observation fails closed. | Process-scoped outage and persistent-failure manual run. |
| A wake is lost or duplicated around worker failure | Persist pending before work; pull/revalidate; checkpoint only after worker plus sync; at-least-once delivery; idempotency requirement. | Failure/restart under the intended runner. |
| Large graphs or rewritten bodies exhaust memory | Static selection before deltas; 128-object batches; 50 MB process cap; edit-distance cutoff; scale fixtures. | Optional representative-repo timing/soak. |
| Notes are treated as append-only conversation state | Docs state complete replacement and single-writer semantics; examples pull and rebuild the body. | Operator review; use child beads or external comments for durable history. |
| Concurrent watchers contend or mutate shared state | Collision-resistant per-process private refs; two simultaneous watchers in one checkout; protected-state snapshots after both finish. | Intended-runner soak with normal tbd work in parallel. |
| Existing workflows are disrupted merely by upgrading | No command runs unless invoked; no schema/config/format/dependency change; legacy suite and post-watch compatibility smoke. | Real-repo create/update/sync exercise. |
| Linear work becomes an accidental merge dependency | Provider-neutral report and worker boundary; separate beads/spec; no provider package, schema, config, or imports in core. | Keep optional experiment isolated and non-gating. |

## Decision Gates

### PR Merge Gate

- All focused and full local gates pass.
- The release smoke passes and protected Git state remains unchanged.
- The built-candidate smoke passes in the Ubuntu, macOS, and Windows CI jobs.
- Exact-head GitHub checks pass on Ubuntu, macOS, and Windows, including coverage/lint
  and benchmark.
- All actionable PR threads are resolved.
- No Linear implementation or external credential is required.

### Release Promotion Gate

- The PR merge gate remains green at the release SHA.
- The isolated packed-artifact smoke passes.
- One credentialed real-remote wake and existing-workflow coexistence check pass.
- Any unattended worker being promoted completes its runner-specific resilience,
  permission, and idempotency checks.

### Non-Gating Experiment Gate

Linear experiments may start only after tbd-vm5s defines the revised pilot boundary.
They should use extension-backed external IDs, module-owned state/checkpoints, one-way
import plus status writeback, and injected failure/idempotency tests.
They do not affect the merge or release decision for PR #205.

## Migration and Rollback

There is no IssueSchema, ConfigSchema, `tbd_format`, dependency, or lockfile migration.
Repositories that never call `tbd changes`, `tbd watch`, or `watch-beads` have no new
runtime behavior.

Rollback is operational and data-preserving:

1. Stop watcher and worker processes.
2. Inspect any `.tbd/<state-name>.pending.tmp` before removal; deleting it deliberately
   drops that wake.
3. Retain or remove `.tbd/<state-name>.checkpoint.tmp` according to whether the worker
   will resume later.
4. Verify `git for-each-ref refs/tbd/watch/` is empty; the next watcher also reclaims
   stale PID-owned refs.
5. Install the previous tbd release or revert this additive commit.

Existing bead data and sync history need no downgrade or rewrite.
A rollback cannot undo external side effects already performed by a worker; those are
governed by the worker’s idempotency and provider-specific compensation policy.

## Validation Record

Record on tbd-t750:

- release version and Git SHA;
- artifact checksum or path;
- host OS, Node, pnpm, and Git versions;
- remote transport and credential class, never the credential itself;
- exact commands and exit codes;
- pass/fail for every required checklist item;
- links to CI and any retained failure evidence;
- final release decision and approver.

* * *

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->

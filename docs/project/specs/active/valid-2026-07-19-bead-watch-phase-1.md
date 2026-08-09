# Feature Validation: Bead Watch Phase 1

## Purpose

Record the senior engineering review, automated validation, and live Claude Code and
Codex demonstrations for Phase 1 of bead watch.

**Feature Plan:** `plan-2026-07-19-bead-watch-and-external-sync.md`

## Validation Environment

- Date: 2026-07-19 to 2026-07-20, with PR #205 hardening on 2026-08-09,
  America/Los_Angeles
- Host: macOS, Git 2.50.1
- Implementation: local `get-tbd` development build from PR 196
- Claude Code: 2.1.212, Sonnet 5
- Codex CLI: 0.135.0; successful run pinned `gpt-5.4`
- Demo topology: one temporary local bare remote plus two independent clones

The local-only topology exercised real `ls-remote`, fetch, `tbd sync`, branch movement,
hidden worktrees, and cross-session updates without modifying the tbd repository’s own
beads.

## Senior Engineering Review

The Phase 1 architecture is sound: a pure snapshot diff isolates correctness from
polling, and the blocking command adds only remote-tip observation and a private fetch.
The review tightened the plan before implementation in the following areas:

- Defined initial, resumed, unrelated-history, and no-match baseline behavior.
- Made dynamic filters endpoint-aware while keeping `--ready` edge-triggered.
- Required complete dependency graphs for ready calculations and fail-closed parsing of
  committed issue and ID-mapping data.
- Defined deterministic bead, field, object-key, and text-hunk output.
- Defined one shared JSON document and exact exit and quiet-output behavior.
- Required a collision-resistant private ref, no `FETCH_HEAD` write, no configured ref
  mutation, and cleanup through `finally`.
- Fixed the daemon recipe to chain each report’s `tip` through `--since`; a simple loop
  that starts each watch without a baseline can miss activity while the spawned agent
  runs.
- Kept Git tree paths POSIX on Windows and restricted issue files to the normative flat
  committed layout.
- Required a final observation at the timeout boundary and an explicit wall-time bound
  on every network Git subprocess.
- Bounded Myers trace growth and `cat-file` batches, made substantive field coverage
  compile-time exhaustive, and versioned the standalone JSON report contract.
- Upgraded the daemon recipe from best-effort delivery to a persistent, at-least-once
  pending-report/checkpoint protocol that fails closed on worker or sync errors.
- Corrected the coordination contract: `--notes` replaces the whole body and is not an
  append-only conversation primitive.

No dependency was needed.
Plain Git subprocesses are sufficient and keep the supply chain unchanged.

## Automated Validation

### Unit Testing

The focused suite passed 40 tests across six files:

```text
✓ tests/issue-changes.test.ts (13 tests)
✓ tests/bead-watch.test.ts (5 tests)
✓ tests/cli-changes.test.ts (4 tests)
✓ tests/cli-watch.test.ts (4 tests)
✓ tests/workflow.test.ts (6 tests)
✓ tests/specs-flag.test.ts (8 tests)

Test Files  6 passed (6)
Tests       40 passed (40)
```

Coverage includes scalar, array, text, create, delete, metadata-only, label, status,
spec, ready-edge, explicit-ID, deterministic-order, exact-tip resume, malformed-issue,
missing-mapping, and non-ancestor cases.
Git-facing tests create synthetic sync-branch histories.

### CLI and Safety Integration

CLI tests pin JSON, human, quiet, timeout, operational-error, and usage-error behavior.
The real-Git safety test verifies all of the following across a remote update:

- no fetch while the remote tip is idle;
- fetch only after observed movement;
- unchanged local `tbd-sync` and `origin/tbd-sync` refs;
- unchanged `FETCH_HEAD`;
- unchanged hidden data-sync worktree and lock sentinels;
- removal of every `refs/tbd/watch/*` private ref after completion.

The shared `list` filters and ready predicate also passed their existing regression
suites after extraction for reuse.

### Repository Quality Gates

The repository’s full `pnpm precommit` gate passed after the final review fix.
This ran formatting, ESLint, TypeScript typechecking, a production build, and all 94
Vitest files with 1,399 passing tests.
The additional release and supply-chain checks also passed:

```text
pnpm format:check       passed
pnpm publint            passed
pnpm check:package-age  0 violations across 31 pins
tbd shortcut watch-beads rendered from the production build
```

No dependency or lockfile changed.
The existing audit findings remain tracked in the repository’s supply-chain bead and are
unrelated to this implementation.

## Live Transcript: Watch Then Spawn Codex

Session A started the watcher before Session B wrote:

```bash
node "$TBD_BIN" watch --bead demo-520z --interval 10 --timeout 90 --json \
  >"$WAKE_FILE"
codex exec ... <"$WAKE_FILE"
```

Session B then published the message:

```text
$ tbd update demo-520z --notes 'Session B message: please acknowledge this watch wake.'
✓ Updated demo-520z

$ tbd sync --json
"sent": { "new": 0, "updated": 1, "deleted": 0 }
```

The watcher exited 0 on the next poll and produced:

```json
{
  "format_version": 1,
  "since": "7023afd3e46d8b15b018b84cc3fdd176642a0190",
  "tip": "b4421b1f87c62cd25261d1712cdb869abae0ba66",
  "changes": [
    {
      "id": "demo-520z",
      "change": "updated",
      "fields": [
        {
          "field": "notes",
          "before": null,
          "after": "Session B message: please acknowledge this watch wake."
        }
      ]
    }
  ]
}
```

The successful Codex spawn read that report, pulled current state, constructed a
complete replacement notes body containing the prior text plus its reply, wrote that
body with `tbd update --notes`, and synced.
The serialized demo made this read-modify-write safe; the command itself did not append:

```text
✓ Updated demo-520z
✓ Docs up to date
✓ Synced: sent 1 updated

Bead ID: demo-520z
Sync result: ✓ Docs up to date and ✓ Synced: sent 1 updated
```

### Codex Limits Observed

- `codex exec --help` has no process wall-time flag.
  `tbd watch --timeout` is therefore the portable deadline; the harness can keep a
  terminal session and poll it, but that is not a cross-platform completion
  notification.
- The first invocation inherited `gpt-5.6-sol` from user configuration.
  Codex CLI 0.135.0 was too old for that model and the service rejected the run.
  The successful retry used `--ignore-user-config -m gpt-5.4`. Daemons should pin a
  validated profile or model and monitor runner failures independently of watch
  failures.
- `--sandbox workspace-write` allowed the watcher and report reader but denied creation
  of `.git/tbd/locks/data-sync.lock`, so an agent could not run `tbd update` or
  `tbd sync`. The successful mutation used `danger-full-access` only inside the
  disposable local demo.
  Production runners should explicitly grant the Git common-dir and remote access needed
  by tbd, using the least available permission; they should not blindly copy the demo
  bypass.
- The default recommendation remains watch-then-spawn.
  It avoids depending on an interactive Codex harness to reawaken a model after a
  terminal process completes.

OpenAI documents `codex exec` as the non-interactive pipeline surface and confirms that
stdin is attached as context when a prompt argument is also present:
[Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode).

## Live Transcript: Claude Code Background Wake

Session B was first synchronized to the Codex reply.
Claude Code was then launched interactively and instructed to run the watch as
background Bash:

```text
The background watch task is running (ID b4xf43wvm). I'll wait for its completion
notification before proceeding with the JSON report and sync steps.
```

While Claude was idle, Session A read the current notes, added its follow-up
client-side, wrote the complete replacement body, and synced:

```text
Session A follow-up: Claude, please acknowledge this in-session wake.
```

Within the 10-second polling interval, Claude received an unsolicited completion event:

```text
Background command "Watch demo-520z bead for wake, with 10s interval and 60s timeout"
completed (exit code 0)

The watch task completed with exit code 0. Reading the JSON report now.
The watch detected a change: another session added a follow-up to the replacement notes
body asking Claude to acknowledge the wake.
```

Claude then pulled, re-read current state, constructed another complete replacement
notes body preserving the serialized demo history, wrote it through the tbd CLI, and
synced:

```text
Sync --pull: pulled 1 change from origin/tbd-sync.
Update: replaced notes with prior text plus "Claude reply: acknowledged the in-session wake."
Sync: pushed the update — "Synced: sent 1 updated."
```

### Claude Code Limits Observed

- The interactive session presented its normal workspace-trust prompt before starting;
  automation must establish trust intentionally rather than assume a bypass flag skips
  it.
- Foreground Bash defaults to two minutes and may request up to ten minutes.
  A bounded `tbd watch --timeout 540` fits that ceiling.
- Background Bash returned a task ID and automatically woke the idle interactive session
  on exit 0. This directly validated the intended in-session pattern.
- Claude Code `-p` is not suitable for this in-session pattern because background tasks
  end shortly after the non-interactive run’s final response.
  Use interactive background Bash or the current Monitor tool; keep the bounded
  foreground loop as the portable fallback.
- Background tasks are session-scoped and do not survive exit or resume.

These limits match Anthropic’s current
[tools reference](https://code.claude.com/docs/en/tools-reference#timeout-and-output-limits)
and
[background Bash documentation](https://code.claude.com/docs/en/interactive-mode#background-bash-commands).

## Cross-Agent Transcript and Final State

A final resumed watch from Session A used its local sync tip as `--since` and reported
only Claude’s reply:

```json
{
  "format_version": 1,
  "since": "5ef69ce15cdf2f7b3f5a368f868c61becb108ccd",
  "tip": "a90f31c3d0eb30817832a193cf5cde34b87674c6",
  "changes": [
    {
      "id": "demo-520z",
      "fields": [
        {
          "field": "notes",
          "hunks": [
            { "lines": [{ "type": "add", "text": "Claude reply: acknowledged the in-session wake." }] }
          ]
        }
      ]
    }
  ]
}
```

The remote bead’s final notes were:

```text
Session B message: please acknowledge this watch wake.
Codex reply: acknowledged the watch wake.
Session A follow-up: Claude, please acknowledge this in-session wake.
Claude reply: acknowledged the in-session wake.
```

This validates serialized, single-writer-at-a-time coordination through one bead, with
each complete notes replacement published through `tbd update --notes` and `tbd sync`
and each wake carrying the expected field-level delta.
It does not validate notes as a durable concurrent transcript; child beads or an
external comment model are required for that contract.

## PR #205 Review-Hardening Validation

The 2026-08-09 follow-up added regression and contract coverage for:

- a change first visible on the final timeout-boundary poll;
- real termination of a stalled non-interactive Git subprocess;
- bounded object batching and omission of pathological text hunks;
- report `format_version: 1` and bounded human rendering;
- a blocker deletion making its target ready, confirming that the reported missing-
  blocker lookup is unreachable because blocker IDs come from the same snapshot map;
- macOS system Bash 3.2 syntax and executable ordering invariants for pending-report
  persistence, pull/revalidation, worker execution, final sync, checkpoint advancement,
  and signal exits;
- sequential `--notes` replacement semantics; and
- one shared source of truth for success, operational, usage, no-match, and SIGINT exit
  codes, plus an audit that removed runtime numeric exit literals from the CLI.

The executable shortcut harness injected a worker failure, verified that the pending
report survived with no checkpoint, restarted the loop, verified the same report was
retried, then observed final sync, checkpoint advancement, pending-file removal, and a
resumed watch using `--since <saved-tip>`.

The final local gates all passed:

```text
pnpm precommit                         100 Vitest files, 1,450 tests
pnpm --filter get-tbd test:tryscript  1,068 CLI transcript cases
pnpm format:check                     passed
pnpm lint:check                       passed (including TypeScript and ESLint contract)
pnpm publint                          passed
pnpm check:package-age                0 violations across 31 pins
```

No dependency or lockfile changed.

## Manual Review

No additional manual platform step is required for Phase 1 correctness.
Linear/provider experiments remain separately tracked and are not a merge dependency for
this infrastructure PR.

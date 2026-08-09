---
title: Watch Beads
description: Wake an agent when selected remote bead state changes
category: workflow
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
Use `tbd watch` when an agent or shell process should block until committed bead state
changes. The command polls the configured remote sync-branch tip without touching the
working tree, hidden data-sync worktree, or its lock.

## Choose a Selection

Watch one static bead or a dynamic set:

```bash
tbd watch --bead proj-a7k2 --json
tbd watch --label needs-agent --json
tbd watch --spec plan-2026-07-19-bead-watch-and-external-sync.md --json
tbd watch --status blocked --json
tbd watch --ready --json
tbd watch --all --json
```

Repeated labels are ANDed.
Label, spec, and status watches wake when a changed bead enters, leaves, or changes
within the selection.
`--ready` wakes only when a bead newly becomes open, unassigned, and unblocked.

Exit 0 means a matching change was reported, exit 3 means `--timeout` elapsed, and exit
1 means an operational error (usage errors exit 2, as on every tbd command).
An established watch rides out a bounded run of failed remote polls before exiting 1, so
brief network outages do not end an unattended watch.
At the timeout boundary, watch performs one final remote observation.
Each observation, including any fetch, has one bounded poll-interval budget (at most 30
seconds), so a stalled Git transport exits 1 instead of hanging indefinitely.
The exit-0 JSON document contains `format_version`, `since`, `tip`, and `changes`; pass
`tip` back as `--since` to avoid a gap between invocations.
If sync recovery rewrites the sync branch, a saved `--since` baseline stops being an
ancestor of the new tip and watch exits 1; restart the watch without `--since` to
establish a new baseline.

## Watch, Then Spawn an Agent

This is the default unattended pattern.
It consumes no agent tokens while the remote tip is idle and catches changes that land
while the agent is working.
The pending report is durable and processed at least once: a failed worker or final sync
leaves it in place for the next start, and the checkpoint advances only after both
succeed. Use a unique `state_name` for each selection, run only one owner for that name,
and make worker actions idempotent because a crash after an external side effect can
replay the report.

```bash
set -euo pipefail

state_name=ready-worker
checkpoint_file=".tbd/${state_name}.checkpoint.tmp"
pending_file=".tbd/${state_name}.pending.tmp"
report_tmp=".tbd/${state_name}.report.$$.tmp"
checkpoint_tmp=".tbd/${state_name}.checkpoint.$$.tmp"
ready_tmp=".tbd/${state_name}.ready.$$.tmp"

cleanup() {
  rm -f "$report_tmp" "$checkpoint_tmp" "$ready_tmp"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

while true; do
  if [ ! -s "$pending_file" ]; then
    since_args=()
    if [ -s "$checkpoint_file" ]; then
      IFS= read -r checkpoint <"$checkpoint_file"
      since_args=(--since "$checkpoint")
    fi

    if tbd watch --ready --json "${since_args[@]}" >"$report_tmp"; then
      mv "$report_tmp" "$pending_file"
    else
      watch_status=$?
      rm -f "$report_tmp"
      if [ "$watch_status" -eq 3 ]; then
        continue
      fi
      exit "$watch_status"
    fi
  fi

  tip=$(node -e \
    'const fs=require("node:fs"); console.log(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).tip)' \
    "$pending_file") || exit 1

  # A watch report is a wake signal, not permission to act on stale state.
  if ! tbd sync --pull; then
    echo "Pull failed; pending report preserved at $pending_file" >&2
    exit 1
  fi
  if ! tbd ready --json >"$ready_tmp"; then
    echo "Ready-set revalidation failed; pending report preserved at $pending_file" >&2
    exit 1
  fi

  # Choose one runner. Replace this claude command with codex exec if desired.
  if ! {
    printf '%s\n' 'WATCH REPORT (wake signal):'
    cat "$pending_file"
    printf '%s\n' 'CURRENT READY SET (after tbd sync --pull):'
    cat "$ready_tmp"
  } | claude -p \
    "Re-read current bead state before changing it. Act only if the wake still applies, make external actions idempotent, and follow the repo conventions."; then
    echo "Worker failed; pending report preserved at $pending_file" >&2
    exit 1
  fi

  if ! tbd sync; then
    echo "Final sync failed; pending report preserved at $pending_file" >&2
    exit 1
  fi

  printf '%s\n' "$tip" >"$checkpoint_tmp"
  mv "$checkpoint_tmp" "$checkpoint_file"
  rm -f "$pending_file"
done
```

The `.tmp` state files are covered by tbd’s `.tbd/.gitignore`. Inspect or remove a
preserved pending report deliberately after fixing a worker failure; deleting it drops
that wake. The example is Bash because it uses arrays and `pipefail`.

Use the least agent permissions that can perform the intended action.
In particular, non-interactive runners need network permission before they can run
`tbd sync`; do not bypass sandboxing merely to make the example work.
A Codex worker profile that writes beads must permit the repository’s Git common
directory as well as the working tree and remote.

## Watch Inside an Agent Session

For cross-agent coordination, watch the shared bead directly.
`tbd update --notes` replaces the complete notes body; it does not append a message.
Use notes as single-writer replaceable state, and pull before constructing a
replacement. Concurrent notes use last-writer-wins-with-attic conflict handling, which
preserves a loser for recovery but is not a conversation log.
For a durable multi-writer transcript, create a child bead per message/event or use an
external system with comment IDs.
A future union-by-ID comments model can provide that primitive directly.

### Claude Code

Ask Claude to run this as a background Bash task and react to its completion:

```bash
tbd watch --bead proj-a7k2 --timeout 540 --json
```

On current Claude Code, foreground Bash defaults to two minutes and can request up to
ten minutes, so 540 seconds leaves margin.
Background Bash returns a task ID and stores output for the session to read.
Newer Claude Code releases also expose a Monitor tool, which can interject when a
watched command emits output; use it when available.
Keep a bounded loop as the portable fallback because background tasks do not survive
session exit or resume.
See the official
[Claude Code tools reference](https://code.claude.com/docs/en/tools-reference#timeout-and-output-limits).

### Codex

Prefer the watch-then-spawn pattern.
`codex exec` is designed for non-interactive pipelines, but it has no CLI wall-time
option; bound `tbd watch` itself with `--timeout` when running it inside a Codex
session. A Codex terminal process may continue through a session handle while the agent
polls it, but that is harness behavior rather than a portable wake notification.
See OpenAI’s
[Codex non-interactive mode documentation](https://learn.chatgpt.com/docs/non-interactive-mode).

For an unattended runner, pin a tested profile and model instead of inheriting mutable
personal defaults. Validate that the profile can create `.git/tbd/locks/data-sync.lock`:
Codex CLI 0.135.0’s `workspace-write` sandbox denied that Git-internal write during the
Phase 1 demo even though the checkout itself was writable.
Read-only report handling still worked; bead updates required an explicitly broader
sandbox in the disposable demo environment.

## Inspect Without Waiting

Use the pure local primitive when a caller already has a baseline commit:

```bash
tbd changes --since <commit> --all --json
```

It reads only committed objects on the configured local sync branch.
Exit 0 means matching deltas and exit 3 means none.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->

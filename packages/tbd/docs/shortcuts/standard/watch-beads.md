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

Exit 0 means a matching change was reported, exit 2 means `--timeout` elapsed, and exit
1 means an operational error.
The exit-0 JSON document contains `since`, `tip`, and `changes`; pass `tip` back as
`--since` to avoid a gap between invocations.
If the sync branch history is rewritten (for example by the unrelated-history rescue), a
running watch exits 1 with a baseline-not-an-ancestor error by design; restart it
without `--since` to adopt the new history.

## Watch, Then Spawn an Agent

This is the default unattended pattern.
It consumes no agent tokens while the remote tip is idle, advances from each reported
tip, and catches changes that land while the agent is working.

```bash
wake_file=$(mktemp "${TMPDIR:-/tmp}/tbd-wake.XXXXXX")
trap 'rm -f "$wake_file"' EXIT HUP INT TERM
since_args=()

while true; do
  if tbd watch --ready --json "${since_args[@]}" >"$wake_file"; then
    tip=$(node -e \
      'const fs=require("node:fs"); console.log(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).tip)' \
      "$wake_file") || exit 1
    since_args=(--since "$tip")

    # Choose one runner. The report is attached on stdin.
    claude -p \
      "A tbd watch report follows. Read it, act under the repo conventions, and sync any bead updates." \
      <"$wake_file" || true
    # codex exec --profile bead-worker -C "$PWD" \
    #   "A tbd watch report follows on stdin. Read it, act under the repo conventions, and sync any bead updates." \
    #   <"$wake_file" || true
  else
    watch_status=$?
    if [ "$watch_status" -eq 2 ]; then
      continue
    fi
    exit "$watch_status"
  fi
done
```

Use the least agent permissions that can perform the intended action.
In particular, non-interactive runners need network permission before they can run
`tbd sync`; do not bypass sandboxing merely to make the example work.
A Codex worker profile that writes beads must permit the repository’s Git common
directory as well as the working tree and remote.

## Watch Inside an Agent Session

For cross-agent conversation, watch the shared bead directly.
Agents write messages with `tbd update <id> --notes <message>` and then `tbd sync`;
concurrent notes use the existing last-writer-wins-with-attic behavior.

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

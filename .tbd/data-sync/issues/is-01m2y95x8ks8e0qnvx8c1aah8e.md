---
type: is
id: is-01m2y95x8ks8e0qnvx8c1aah8e
title: Windows setup-tier-agents treats file-as-dir as EEXIST, not ENOTDIR
kind: bug
status: in_progress
priority: 1
version: 2
delegate: unknown@cursor
labels: []
dependencies: []
hold: null
hold_until: null
created_at: 2026-09-20T02:09:02.739Z
updated_at: 2026-09-20T02:09:05.767Z
started_at: 2026-09-20T02:09:05.767Z
---
## Summary

CI Test (windows-latest, Node 24) failed on PRs #309 and #310 after 9852a839 added:

- `exits nonzero without a completion message when 'claude-agents' cannot be read`
- `exits nonzero without a completion message when 'codex-agents' cannot be read`

The tests place a regular file at `.claude/agents` / `.codex/agents`, then run setup. POSIX recursive `mkdir` reports ENOTDIR; Windows Node reports `EEXIST: file already exists, mkdir '...'`. Setup already fails (correct), but the diagnostic does not contain `ENOTDIR` or `not a directory`, so the assertion fails.

Not a flake. Root is #309 (`writeTierAgentFiles` + the new tests). #310 only carries the same code via stack.

## Fix

Normalize the write-path diagnostic when the parent exists as a file so both platforms report `not a directory`. Then rebase #310 onto the new #309 head (`--onto <new-309> 9852a839`).

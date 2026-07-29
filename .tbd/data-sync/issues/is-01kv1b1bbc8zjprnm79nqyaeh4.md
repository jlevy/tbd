---
type: is
id: is-01kv1b1bbc8zjprnm79nqyaeh4
title: "Bulk show (read-only): show A B C -> delimited text / --json array"
kind: task
status: closed
priority: 1
version: 6
spec_path: docs/project/specs/active/plan-2026-07-28-agent-cli-bash-fallbacks.md
labels: []
dependencies:
  - type: blocks
    target: is-01kyknk22z7tn952q0hcwf7h27
parent_id: is-01kyknjks7f7mm37tzt7mntc4k
created_at: 2026-06-13T20:33:39.180Z
updated_at: 2026-07-29T02:56:22.944Z
closed_at: 2026-07-29T02:56:22.944Z
close_reason: "Delivered in PR #198 (agent CLI ergonomics round 2): bulk show, variadic doc readers, variadic deps + create --depends-on, --spec suffix matching, did-you-mean/search-by-ID/overflow hints, point-of-need doc pass. All suites green."
---
Make show variadic: .argument('<ids...>') in show.ts, reusing renderIssueLines/printWithTruncation.

Contract (spec "Phase 1 components"):
- Resolve ALL IDs before rendering; any unknown aborts listing every bad ID (fail-closed, matches bulk mutators); --ignore-missing renders the found subset, reports skips on stderr, and exits 0 (same contract as the flag on bulk mutators).
- Dedupe repeated IDs (first occurrence wins); render in argument order.
- Per-issue one-line dim delimiter header for 2+ IDs (`── <id> ──`, matches tree-view box-drawing).
- --max-lines applies PER ISSUE, not to the whole stream.
- Parent auto-context: single-ID behavior unchanged; suppressed by default for 2+ IDs. --show-order still works per issue.
- --json: 1 ID keeps today's object shape (pinned by golden); 2+ IDs emit an array.
- Read-only: no write lock, no summary line, no sync hint.

Goldens in tests/cli-bulk-show.tryscript.md: order, dupes, unknown-ID abort, --ignore-missing + exit 0 + stderr note, json shapes, per-issue max-lines, parent suppression. Existing single-ID goldens stay green.

---
type: is
id: is-01kyknk3k55f2apsqskw132n2j
title: dep add/remove variadic <depends-on...> and create --depends-on
kind: task
status: closed
priority: 2
version: 4
spec_path: docs/project/specs/active/plan-2026-07-28-agent-cli-bash-fallbacks.md
labels: []
dependencies: []
parent_id: is-01kyknjks7f7mm37tzt7mntc4k
created_at: 2026-07-28T06:11:32.068Z
updated_at: 2026-07-29T02:56:22.969Z
closed_at: 2026-07-29T02:56:22.969Z
close_reason: "Delivered in PR #198 (agent CLI ergonomics round 2): bulk show, variadic doc readers, variadic deps + create --depends-on, --spec suffix matching, did-you-mean/search-by-ID/overflow hints, point-of-need doc pass. All suites green."
---
Write-side dependency wiring proportional to intent. Two additive changes:

1. dep add <issue> <depends-on...> and dep remove <issue> <depends-on...>: N edges in one call under one lock. Each edge lives on the BLOCKER's issue file, so N blockers are N validated writes (all IDs resolve and read before anything is written; fail-closed listing bad IDs; duplicates once; already-present edges counted, not errors). Single-edge behavior unchanged.
2. create --depends-on <id> (repeatable): blockers resolved and read before the issue is created, then wired at creation.

Docs: plan-implementation-with-beads.md step 2/3 updated. Goldens in tests/cli-dep-bulk.tryscript.md.

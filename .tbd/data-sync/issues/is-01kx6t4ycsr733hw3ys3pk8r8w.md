---
type: is
id: is-01kx6t4ycsr733hw3ys3pk8r8w
title: "PR #176 Bugbot: --dry-run bypassed for a lone --ignore-missing skip (close/reopen/update)"
kind: task
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-06-13-agent-cli-ergonomics.md
labels: []
dependencies: []
created_at: 2026-07-10T20:05:21.432Z
updated_at: 2026-07-10T20:18:02.865Z
closed_at: 2026-07-10T20:18:02.865Z
close_reason: "Fixed in de2678a5 on PR #176: all three verbs now preview a lone --ignore-missing skip under --dry-run (only the lone already-closed close keeps its legacy idempotent output); locked by tryscript goldens for close/reopen/update. Claim 2 of the Bugbot thread rebutted: duplicate IDs were a usage error in the legacy single-ID CLI, so bulk skip semantics for 2+ argv IDs breaks no contract. Validated: lint, 1365 vitest, 981 tryscript."
---
Bugbot thread discussion_r3561611979 on a1547fc9. Claim 1 (valid): a lone missing ID under --ignore-missing skips checkDryRun in all three bulk verbs — close/reopen gate on (toMutate>0 || ids>1) and update runSingle returns loneMissing before checkDryRun — so --dry-run emits the real-run summary instead of a preview. No writes occur (nothing exists to mutate); the defect is the output contract and inconsistency with the bulk analog ('Would close 0 issues'). Fix: preview every shape except the lone already-closed legacy idempotent output for close; reopen previews unconditionally after its lone not-closed error; update loneMissing checks dry-run before emitting the missing summary. Claim 2 (rebutted): duplicate IDs to reopen were a usage error in the legacy single-ID CLI, so bulk skip semantics for 2+ argv IDs breaks no contract and is documented.

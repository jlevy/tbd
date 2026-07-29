---
type: is
id: is-01kyqdm6j2xrncq9frdq7sjd1q
title: "PR #198 review R3: did-you-mean only fires on some ID-resolution paths"
kind: bug
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-07-28-agent-cli-bash-fallbacks.md
labels: []
dependencies: []
parent_id: is-01kyqdkenfn9rswm3s44vg11j8
created_at: 2026-07-29T17:09:16.994Z
updated_at: 2026-07-29T18:04:24.968Z
closed_at: 2026-07-29T18:04:24.968Z
close_reason: "Review addressed on PR #198: R1-R4 + docs gap fixed in 69b6ec8, Bugbot round-1 trio fixed in 52c9856, Bugbot round-2 pair rebutted in-thread with technical justification. Disposition map posted; CI green on all checks at 52c9856."
---
Medium. Suggestion hint attached to FullCommandContext.resolveId + selected bulk sites only; direct resolveToInternalId callers throw plain NotFoundError: dep runSingle (both IDs), dep runMulti issue arg, dep list, update runSingle, label add/remove. Cardinality-dependent behavior (multi dep add suggests, single does not). Fix: shared resolveIssueId(input, mapping, prefix) helper that throws NotFoundError with hint; migrate every CLI issue-ID boundary; table-driven golden cases for show/update/dep/label.

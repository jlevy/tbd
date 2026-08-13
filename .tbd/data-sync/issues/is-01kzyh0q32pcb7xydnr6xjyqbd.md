---
type: is
id: is-01kzyh0q32pcb7xydnr6xjyqbd
title: Linked bead past max_nesting hard-fails every push when an ancestor is skipped
kind: bug
status: closed
priority: 1
version: 4
labels: []
dependencies: []
parent_id: is-01kzymcx5gjwfra1z0s3rz1g05
created_at: 2026-08-13T21:38:55.714Z
updated_at: 2026-08-13T23:03:20.709Z
closed_at: 2026-08-13T23:03:20.705Z
close_reason: "Fixed in dcc136dd; full local CI and all PR #212 hosted checks passed."
---
PR #212 exempted already-linked beads from the max_nesting skip in core/mirror.ts:202. A linked bead deeper than max_nesting now enters plan.updates. If a SELECTED ancestor between it and the mirror root is itself unlinked and skipped, applyMirror (mirror.ts:334) throws 'parent <id> was not mirrored' for that bead on every run. sync.ts assertIntegrationReportsHealthy promotes it to a command failure, so routine 'tbd sync --push' breaks permanently.

Reproduced with a probe test: root -> mid1 -> mid2 (unlinked, skipped) -> deep (linked), max_nesting 2. Result: failures: [{beadId: tbd-deep, error: 'parent tbd-mid2 was not mirrored'}].

Fix: when a bead is included only because it is already linked, omit parentId from the patch rather than emitting null, and do not require the parent to have been mirrored. The sync engine already does exactly this at sync-engine.ts:636-645 (expectedParentId === undefined -> leave the provider parent alone). Mirror that rule in planMirror.

## Notes

Source: GitHub PR #212 formal review 4931891999. Address via fixed, rebutted, or deferred disposition map.

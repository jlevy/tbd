---
type: is
id: is-01kzyh0q32pcb7xydnr6xjyqbd
title: Linked bead past max_nesting hard-fails every push when an ancestor is skipped
kind: bug
status: open
priority: 1
version: 1
labels: []
dependencies: []
created_at: 2026-08-13T21:38:55.714Z
updated_at: 2026-08-13T21:38:55.714Z
---
PR #212 exempted already-linked beads from the max_nesting skip in core/mirror.ts:202. A linked bead deeper than max_nesting now enters plan.updates. If a SELECTED ancestor between it and the mirror root is itself unlinked and skipped, applyMirror (mirror.ts:334) throws 'parent <id> was not mirrored' for that bead on every run. sync.ts assertIntegrationReportsHealthy promotes it to a command failure, so routine 'tbd sync --push' breaks permanently.

Reproduced with a probe test: root -> mid1 -> mid2 (unlinked, skipped) -> deep (linked), max_nesting 2. Result: failures: [{beadId: tbd-deep, error: 'parent tbd-mid2 was not mirrored'}].

Fix: when a bead is included only because it is already linked, omit parentId from the patch rather than emitting null, and do not require the parent to have been mirrored. The sync engine already does exactly this at sync-engine.ts:636-645 (expectedParentId === undefined -> leave the provider parent alone). Mirror that rule in planMirror.

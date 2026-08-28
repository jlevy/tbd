---
type: is
id: is-01m14z05cqkapvfaydtyv9gb26
title: "tbd sync never prints a tracker line: reportIntegrationRun uses verbose-only output.info"
kind: bug
status: open
priority: 0
version: 1
spec_path: docs/project/specs/active/plan-2026-08-28-sync-convergence-and-stability.md
labels: []
dependencies: []
parent_id: is-01m14yzbwwg92e5k7z7d4kyn00
created_at: 2026-08-28T19:54:26.071Z
updated_at: 2026-08-28T19:54:26.071Z
---
GH #265 defect 1, confirmed by code. reportIntegrationRun (sync.ts:374) and reportIntegrationPush (sync.ts:388) emit through this.output.info, which writes nothing unless --verbose or --debug is set (cli/lib/output.ts:419-420). A plain 'tbd sync' that folds in the tracker, reconciles it and writes to Linear therefore prints no tracker line at all: not a success, not a skip, not a failure. Operators following the documented session-closing protocol believe the mirror is reconciled when it is not.

The same trap was already diagnosed one call site earlier: the skip notice at sync.ts:167-181 carries the comment 'info() is verbose-only, so reporting it there would leave the ordinary run exactly as silent as before' and uses notice() for that reason. The report path was never converted.

Fix: convert both report methods to output.notice (default-visible, --json-safe via the structured-data argument). A folded run that did nothing should still say so.

---
type: is
id: is-01m05xpyh3fz4dd9masskp0ats
title: "Archive ownership policy: policy.archive manual (default) or on_close"
kind: feature
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-3
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-16T18:35:28.162Z
updated_at: 2026-08-16T18:35:41.468Z
closed_at: 2026-08-16T18:35:41.467Z
close_reason: "Implemented with the honest-dates work: schema ArchiveMode, engine honoring it in both directions, adapter archiveIssue/unarchiveIssue, mock server modelling both mutations, and 8 tests covering manual/on_close in both directions plus the trashed and no-duplicate cases."
---
Shipped. Adds policy.archive to the f08 policy block, defaulting to manual.

manual: the tracker's archive belongs to the people using it. tbd never archives or unarchives; an archived item is treated as a settled pair and goes quiet; a bead reopened under an archived item is reported with the remedy rather than acted on. The tracker's own retention (Linear's team-level auto-archive) keeps working underneath, which is the right place for that policy to live.

on_close: tbd owns the lifecycle. Closing a bead archives its item; reopening restores it. Both halves together on purpose — archiving without restoring would strand reopened work.

The enum rather than a boolean is the extension point: on_close_after: <duration> and similar fit here without another format bump.

Adapter gains optional archiveIssue/unarchiveIssue so a provider without an archive concept simply omits them.

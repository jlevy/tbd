---
type: is
id: is-01kzydg1771r1wn3csas8pqcwc
title: Render full-sync managed blocks from reconciled canonical values
kind: bug
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies: []
parent_id: is-01kzy93y91gssqs5nbv6zga00g
created_at: 2026-08-13T20:37:23.297Z
updated_at: 2026-08-13T20:50:48.806Z
closed_at: 2026-08-13T20:50:48.805Z
close_reason: Fixed with a red/green sync-engine regression. Full sync now renders projected status and priority from ReconcileResult.merged rather than the pre-sync bead, so remote-winning/pulled values and the managed summary converge in one run. Documented in the integration plan and design; focused tests, full CI, and live Linear QA pass.
---
A final semantic review found that runSync renders the provider managed block from the pre-reconcile bead. When a remote-owned or conflict-winning status/priority is pulled, the same run can leave the block stale. Add a regression that pulls a remote canonical change and assert the block reflects the merged value; render the projection from ReconcileResult.merged while retaining structural bead fields and counts.

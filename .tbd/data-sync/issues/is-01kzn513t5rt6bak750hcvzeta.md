---
type: is
id: is-01kzn513t5rt6bak750hcvzeta
title: Fold into tbd sync behind sync_on_tbd_sync (default off)
kind: task
status: closed
priority: 3
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies: []
parent_id: is-01kzn2wa8b53y8wjh1gegbzhhx
created_at: 2026-08-10T06:16:15.941Z
updated_at: 2026-08-13T09:54:26.495Z
closed_at: 2026-08-13T09:54:26.495Z
close_reason: "Implemented in PR #206 Phase 2. The delivered equivalents are bridge-state.ts link records, reconcile.ts field matrix, intents.ts replay, conflict attic/comment lifecycle, sync-engine.ts orchestration, integration documentation plus real-binary E2E, and the guarded tbd sync fold. Revalidated after merging v0.5.0 main: typecheck/build pass, 189 integration tests pass, and 73 integration/bridge/query/web-seam tests pass."
extensions:
  linear:
    id: 490f9047-fbe4-4065-92bf-9cf61aad7c3f
    linked_at: 2026-08-11T06:50:59.990Z
    key: TBD-126
    url: https://linear.app/finterm-ai/issue/TBD-126/fold-into-tbd-sync-behind-sync-on-tbd-sync-default-off
---
Optional integration into the existing tbd sync flow, ordered so external phases ride the same git sync and run under the same lock. Defaults off until conflict handling has been exercised deliberately, including a forced both-sides conflict. Spec Component 10 and Rollout.

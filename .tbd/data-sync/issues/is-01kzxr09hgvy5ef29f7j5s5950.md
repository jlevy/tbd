---
type: is
id: is-01kzxr09hgvy5ef29f7j5s5950
title: Reconcile live items behind retained create journals
kind: bug
status: closed
priority: 0
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - integration
  - review
dependencies: []
parent_id: is-01kzx848mdfzapsc2ddm6hm0zt
created_at: 2026-08-13T14:21:47.436Z
updated_at: 2026-08-13T14:30:53.723Z
closed_at: 2026-08-13T14:30:53.722Z
close_reason: Fixed with red-green TDD; spec, design, user docs, and changelog updated; full local gates pass.
---
PR #206 thread PRRT_kwDOQ109P86Y9qLe reports that a retained create_issue journal can represent a provider item that already exists while a follow-up attachment/splice op remains failed. The pending-create classification currently skips liveness fetch, so pull-only can hide that live pair from field/comment reconciliation. Reproduce with TDD and distinguish confirmed missing provisional creates from live links without adding mutable state.

## Notes

Validated Bugbot's claim with a red pull-only regression: an existing remote item plus retained create+attachment journal and empty delta was skipped entirely. Fixed by always including delta-missing linked IDs in targeted liveness; only a confirmed absence with the exact durable create claim suppresses orphan output. A live item now reconciles normally while follow-up journal work remains, and pull-only leaves that journal/provider follow-up untouched. Full proof: 1,930 Vitest, 1,084 Tryscript, focused 61/61, format/lint/typecheck/build, publint, and package-age 31 pins/0 violations.

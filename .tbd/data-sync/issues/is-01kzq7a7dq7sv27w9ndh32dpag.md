---
type: is
id: is-01kzq7a7dq7sv27w9ndh32dpag
title: tbd list --defer-before is declared but never implemented
kind: bug
status: closed
priority: 2
version: 5
spec_path: docs/project/specs/active/plan-2026-08-28-sync-convergence-and-stability.md
labels:
  - cli
dependencies: []
created_at: 2026-08-11T01:34:40.566Z
updated_at: 2026-09-14T04:19:19.793Z
closed_at: 2026-09-14T04:16:44.538Z
close_reason: "Fixed on main by PR #264 (c1235d3c/cb771d2f, merged 2026-09-13). readyIssueIds now takes an explicit 'now' and excludes a bead whose deferred_until is still in the future (lib/issue-selection.ts deferralPending); list --defer-before is parsed at the CLI boundary and filtered in selectIssues (cli/commands/list.ts, lib/issue-query.ts deferredBefore). Covered by tests/deferred-until.test.ts and tests/hold-axis.test.ts; verified on 52d5c2f7."
resolution: null
duplicate_of: null
---
ListOptions declares deferBefore (--defer-before <date>, 'Deferred before date' in help) but filterIssues never reads it: the flag is a silent no-op. Found during the Phase 2 issue-query extraction, which preserves the no-op rather than silently changing behavior. Fix: implement (filter deferred_until < date) or remove the flag; either way add a transcript.

---
type: is
id: is-01m0ermn5x3fntq0ntt3x19pp6
title: Restore the dead exhaustiveness guards over Issue fields
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-18-tracker-state-model-and-linear-mapping.md
delegate: claude-code@spud10
labels: []
dependencies: []
parent_id: is-01m0ermjzgy620e6gx9mtp7z9d
hold: null
hold_until: null
created_at: 2026-08-20T05:00:00.060Z
updated_at: 2026-08-20T05:07:03.503Z
started_at: 2026-08-20T05:00:45.255Z
closed_at: 2026-08-20T05:07:03.502Z
close_reason: Fixed. IssueFieldName derives from the pre-passthrough shape; both FIELD_STRATEGIES and ISSUE_CHANGE_FIELD_ORDER point at it and now fail on an unregistered field (verified with a canary). The restored guard found docs and refs missing from the change-report order since f08 — tbd changes never reported them — now registered.
resolution: null
duplicate_of: null
---
FIELD_STRATEGIES (file/git.ts) and ISSUE_CHANGE_FIELD_ORDER (lib/issue-changes.ts) both declare Record<keyof Issue, ...> and document themselves as making a new Issue field a compile error. IssueSchema.passthrough() widens keyof Issue to string|number, so neither has bitten since f08 — proven this session by adding six fields with no type error. Fix: derive the key set from a non-widened source so the guard works again.

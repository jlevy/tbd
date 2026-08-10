---
type: is
id: is-01kzn50xxkvctdk2803abt4aaz
title: "lib/issue-selection.ts + core/selection.ts: kind filter and mirrorSet"
kind: task
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzn50zedj6hwqx4j3e07mwqy
parent_id: is-01kzn2w9w9gx9j6h3b250jnyzf
created_at: 2026-08-10T06:16:09.906Z
updated_at: 2026-08-10T17:35:53.888Z
closed_at: 2026-08-10T17:35:53.888Z
close_reason: Implemented in claude/linear-integration (c23d14d7, 3f1354e9, eb2c5bcf). Verified by 1561 vitest tests and a live check against the Linear API.
---
SharedIssueFilters currently has no kind filter (only issueMatchesSharedFilters and readyIssueIds). Extend it with kinds rather than writing a parallel filter: the mirror must NOT grow its own filter semantics, same constraint tbd web accepts. core/selection.ts mirrorSet(issues, config) returns beads matching select (default kinds: [epic], active statuses) plus any explicitly linked bead. Explicit links always win over selection rules. Spec Component 6.

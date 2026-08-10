---
type: is
id: is-01kzn514mxmazhwq9fn1qpcpvt
title: "integrations/github/: client, adapter, mapping"
kind: task
status: open
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzn5152hkvnx553tj4gwgc28
parent_id: is-01kzn2wakpq2963exxqhj8xkdc
created_at: 2026-08-10T06:16:16.797Z
updated_at: 2026-08-10T06:16:17.232Z
---
REST over native fetch (no Octokit for a handful of endpoints). Credential via GITHUB_TOKEN then gh auth token fallback. Binary open/closed state model, much simpler than Linear: no state UUIDs to cache. Reuses every seam from Phase 1 unchanged, which is the test of whether the adapter interface was right. Spec Component 11 and Dependencies.

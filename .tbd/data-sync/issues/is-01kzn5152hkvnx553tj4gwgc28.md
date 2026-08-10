---
type: is
id: is-01kzn5152hkvnx553tj4gwgc28
title: "PR links: extensions.github.prs to attachmentLinkGitHubPR"
kind: task
status: open
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzn515e154th2ehqthkpcv0v
parent_id: is-01kzn2wakpq2963exxqhj8xkdc
created_at: 2026-08-10T06:16:17.232Z
updated_at: 2026-08-10T06:16:17.600Z
---
tbd has no PR field and adding one is premature, so PR and issue URLs live in the extensions.github namespace ({ prs: [...], issue: ... }) — which is why the extensions per-namespace merge fix is a Phase 1 prerequisite. The mirror surfaces them on Linear items via attachmentLinkGitHubPR / attachmentLinkGitHubIssue so Linear renders its native PR UI, letting an epic show its implementing PRs. Spec Component 4 and 5.

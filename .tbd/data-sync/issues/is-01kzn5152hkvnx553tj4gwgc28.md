---
type: is
id: is-01kzn5152hkvnx553tj4gwgc28
title: "PR links: extensions.github.prs to attachmentLinkGitHubPR"
kind: task
status: open
priority: 2
version: 6
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - github
  - integration
dependencies:
  - type: blocks
    target: is-01kzn515e154th2ehqthkpcv0v
  - type: blocks
    target: is-01kzx8knkqyxmghreewwsy16h9
parent_id: is-01kzn2wakpq2963exxqhj8xkdc
created_at: 2026-08-10T06:16:17.232Z
updated_at: 2026-08-13T11:05:24.413Z
extensions:
  linear:
    id: e4a2e265-ed0d-439d-9db3-51186d517dcf
    linked_at: 2026-08-11T06:51:04.870Z
    key: TBD-129
    url: https://linear.app/finterm-ai/issue/TBD-129/pr-links-extensionsgithubprs-to-attachmentlinkgithubpr
---
Define pull requests as implementation relationships, not generic issue-sync targets: GitHub issues participate in outbound projection, explicit inbound creation, and two-way sync, while PRs are read-only associations stored in extensions.github.prs with stable repo/number/url and refreshed display metadata. Add provider-generic helpers that preserve the existing extensions.github issue-link payload, CLI verbs to link/unlink/list PR associations without changing PR title/body/state, and Linear attachmentLinkGitHubPR/attachmentLinkGitHubIssue upserts keyed by URL. Cover namespace merges, stale/closed PR refresh, duplicate association idempotency, and coexistence with a GitHub issue link.

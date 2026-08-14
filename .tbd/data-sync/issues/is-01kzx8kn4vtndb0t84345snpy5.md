---
type: is
id: is-01kzx8kn4vtndb0t84345snpy5
title: Implement GitHub issue link, explicit inbound selection, outbound projection, and bidirectional sync
kind: feature
status: open
priority: 2
version: 6
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - github
  - integration
dependencies:
  - type: blocks
    target: is-01kzx8knkqyxmghreewwsy16h9
  - type: blocks
    target: is-01kzn515e154th2ehqthkpcv0v
parent_id: is-01kzn2wakpq2963exxqhj8xkdc
created_at: 2026-08-13T09:52:44.698Z
updated_at: 2026-08-13T16:00:38.649Z
extensions:
  linear:
    id: 0e08d8c7-a478-49f2-aedf-db9934fc6f5a
    linked_at: 2026-08-13T16:00:38.649Z
    key: TBD-155
    url: https://linear.app/finterm-ai/issue/TBD-155/implement-github-issue-link-explicit-inbound-selection-outbound
---
Exercise the provider-generic paths in cli/commands/integration.ts and integrations/core/{mirror,sync-engine,intents,reconcile,link-store,link-guard}.ts with the GitHub adapter: link and unlink an existing owner/repo#N issue, create a bead through sync --pull --external, policy-selected sync --push, inbound/outbound/two-way title-description-status-priority-label mapping, append-only issue comments, crash replay and strict pull deferral, bulk guards, orphan handling, local and cross-repository duplicate refusal, and deterministic second-run no-op. Add real built-CLI E2E coverage and ensure Linear behavior remains unchanged.

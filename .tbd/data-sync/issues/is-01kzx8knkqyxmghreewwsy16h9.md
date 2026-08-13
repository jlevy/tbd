---
type: is
id: is-01kzx8knkqyxmghreewwsy16h9
title: Validate GitHub integration through the built CLI and a live pilot repository
kind: task
status: open
priority: 2
version: 4
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - github
  - integration
  - release-candidate
dependencies:
  - type: blocks
    target: is-01kzn515e154th2ehqthkpcv0v
parent_id: is-01kzn2wakpq2963exxqhj8xkdc
created_at: 2026-08-13T09:52:45.174Z
updated_at: 2026-08-13T15:59:38.794Z
extensions:
  linear:
    id: 4fb64dc7-d929-4ac3-81d2-f9040582f16c
    linked_at: 2026-08-13T15:59:38.793Z
---
After the GitHub adapter, issue lifecycle, and PR-association work land, run mock-server real-binary E2E plus a bounded live pilot against a disposable GitHub issue and PR. Prove status and gh-token fallback, link, sync --pull --external, sync --push, full sync, comments, unlink, PR association and Linear attachment rendering, crash replay, strict pull deferral, local and remote duplicate guards, rate-limit and permission remedies, cross-clone convergence, and no mutation of PR content. Audit and clean up the pilot, then run the full quality and package gates.

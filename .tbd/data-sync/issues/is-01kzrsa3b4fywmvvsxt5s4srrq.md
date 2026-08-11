---
type: is
id: is-01kzrsa3b4fywmvvsxt5s4srrq
title: "Phase 5.2: retire development spike and reconcile release/spec metadata"
kind: task
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - cleanup
  - release
  - web
dependencies:
  - type: blocks
    target: is-01kzrsac4r354tm2b2f89mg0ve
parent_id: is-01kzrs6s3fn7gtzgt70wx9yzas
created_at: 2026-08-11T16:08:25.188Z
updated_at: 2026-08-11T16:24:59.902Z
extensions:
  linear:
    id: 9c286db2-62f0-45e8-a147-30497157ddb1
    linked_at: 2026-08-11T16:24:59.902Z
    key: TBD-149
    url: https://linear.app/finterm-ai/issue/TBD-149/phase-52-retire-development-spike-and-reconcile-releasespec-metadata
---
Delete packages/tbd/scripts/bead-web.ts and bead-web.html; move only reusable demo/QA topology code under tests; move CHANGELOG from Internal to Features; mark completed phase checklists with commit/test evidence; update PR title/body to shipped reality and ensure no dead flags, dormant mutation routes, stale comments, or dev-only paths remain.

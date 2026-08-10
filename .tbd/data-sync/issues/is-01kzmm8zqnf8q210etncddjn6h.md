---
type: is
id: is-01kzmm8zqnf8q210etncddjn6h
title: Release-validate bead watch infrastructure
kind: epic
status: in_progress
priority: 1
version: 5
spec_path: docs/project/specs/active/plan-2026-07-19-bead-watch-and-external-sync.md
labels:
  - bead-watch
  - validation
dependencies: []
child_order_hints:
  - is-01kzmm943t45fn4vq1wena9mav
  - is-01kzmm9dhgj1ygc3qysrehs66v
created_at: 2026-08-10T01:23:28.116Z
updated_at: 2026-08-10T01:47:07.613Z
---
Own PR #205 release validation: a repeatable two-clone smoke script, a manual QA playbook for packaged artifacts and real remotes, recorded automated evidence, compatibility and rollback checks, and explicit non-gating Linear experiment boundaries.

## Notes

Automated release-validation implementation tbd-961h is complete and fully gated. tbd-t750 remains open for exact-tag packaging evidence, credentialed real-remote/resilience/runner/platform execution before release promotion. PR #205 merge remains independent of the manual release gate and all Linear work.

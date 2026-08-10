---
type: is
id: is-01kzmm943t45fn4vq1wena9mav
title: Add watch release smoke script and validation plan
kind: task
status: closed
priority: 1
version: 5
spec_path: docs/project/specs/active/plan-2026-07-19-bead-watch-and-external-sync.md
labels:
  - bead-watch
  - validation
dependencies:
  - type: blocks
    target: is-01kzmm9dhgj1ygc3qysrehs66v
parent_id: is-01kzmm8zqnf8q210etncddjn6h
created_at: 2026-08-10T01:23:32.601Z
updated_at: 2026-08-10T01:47:07.324Z
closed_at: 2026-08-10T01:47:07.323Z
close_reason: Added the repeatable two-clone release smoke and isolated-package entrypoint, full release validation plan, and manual QA playbook; fixed the remote-tracking refmap regression found by the smoke. Validated 18 focused tests, the source and packed-artifact smokes, precommit (100 files/1,451 tests), 1,068 tryscript cases, publint, package age, formatting, and documentation links.
---
Implement and execute a deterministic release-candidate smoke script over a real bare remote and two clones; add the QA playbook; map unit, CLI, harness, tryscript, platform-CI, manual, risk, and rollback coverage; update PR #205.

## Notes

Implemented packages/tbd/scripts/validate-watch-release.ts and pnpm qa:watch-release; added tests/qa/watch-infrastructure-release.qa.md and valid-2026-08-09-bead-watch-release.md; reconciled the active plan. The first two-clone safety run exposed origin/tbd-sync advancing via Git's configured refmap. Added a red/green focused regression and fixed private fetch with --refmap=. Targeted 18/18 and the full release smoke now pass. Full gates, commit, push, PR update, and exact-head CI remain.

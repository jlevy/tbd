---
type: is
id: is-01kzx8jw39zc4dpgx6w82rg3dm
title: Complete Linear RC package, docs, review, and CI gate
kind: task
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - integration
  - release-candidate
dependencies: []
parent_id: is-01kzx848mdfzapsc2ddm6hm0zt
created_at: 2026-08-13T09:52:19.048Z
updated_at: 2026-08-13T15:07:57.614Z
closed_at: 2026-08-13T15:07:57.613Z
close_reason: Linear release-candidate gate complete. Main v0.5.0 merged semantically; package/docs/installed skill/spec aligned; disposable live Linear matrix passed; all 13 review findings fixed with thread replies and resolutions; 1,931 Vitest and 1,084 Tryscript checks pass; all hosted Ubuntu/macOS/Windows/coverage/benchmark/security/review checks green on 8e00e188.
---
After the integrity guard and live soak, review PR #206 thread-by-thread; verify CHANGELOG Unreleased scope, README/manual/design/development/installed skill consistency, package contents, npm dry-run, secret hygiene, no-integration inert behavior, and backward compatibility. Run format, lint, typecheck, build, focused integration/web seam tests, full unit and tryscript suites, publint, and package QA; push the branch and require hosted checks to reach a final green result before assigning the release-candidate disposition.

## Notes

Final gate is deliberately the only remaining Phase 2 task: push PR head, post complete five-thread disposition map, resolve all threads, and watch hosted checks to final green before declaring the Linear integration an RC.

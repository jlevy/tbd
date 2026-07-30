---
type: is
id: is-01kytcq03tr6v60sjvpn3ew8z6
title: pnpm test skips tryscript CLI suites; gate them locally
kind: task
status: open
priority: 2
version: 1
labels: []
dependencies: []
created_at: 2026-07-30T20:51:03.417Z
updated_at: 2026-07-30T20:51:03.417Z
---
The label-parser regression on PR #199 (fixed in 89e3ff9) survived two local full-suite runs because pnpm test = vitest only; the tryscript CLI golden suites (~1068 cases) run solely in the CI coverage job via test:coverage. Options: add test:tryscript to the pre-push gate (adds ~7min, likely too slow), a fast smoke subset in pre-push, or at minimum document the split in development.md so agents run test:tryscript before pushing CLI-behavior changes.

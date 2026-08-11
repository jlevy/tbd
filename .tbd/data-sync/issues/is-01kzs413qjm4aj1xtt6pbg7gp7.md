---
type: is
id: is-01kzs413qjm4aj1xtt6pbg7gp7
title: "R14: Launch pnpm pack through the Windows command processor"
kind: bug
status: in_progress
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - pr-207
  - final-review
  - ci
dependencies: []
parent_id: is-01kzrs2jrjg3pzase83ebxdjyg
created_at: 2026-08-11T19:15:45.009Z
updated_at: 2026-08-11T19:18:24.977Z
---
Windows run 31526276017 / job 93895272144 passes 1,498 runnable tests, the five-case web transcript, and watch release smoke, then fails qa:web-package at validate-web-package.mjs:88 with spawn pnpm ENOENT. On Windows pnpm is installed as a .cmd command shim, which node:child_process execFile cannot execute directly. In packages/tbd/scripts/validate-web-package.mjs, add a platform-safe pnpm pack invocation: retain direct execFile on POSIX and execute pnpm through ComSpec on win32 while keeping controlled arguments separate. Preserve the existing tarball extraction, exact launcher/page/API proof, and cleanup. Acceptance: qa:web-package passes locally and in the Windows matrix.

## Notes

Implemented packArchive in packages/tbd/scripts/validate-web-package.mjs: POSIX launches pnpm directly; Windows launches pnpm.cmd through ComSpec with /d /c and windowsHide. Local validation passed: pnpm --filter get-tbd qa:web-package, pnpm run ci:quality, pnpm check:package-age (31 pins, 0 violations), and formatting. Awaiting the final GitHub Actions Windows matrix before closure.

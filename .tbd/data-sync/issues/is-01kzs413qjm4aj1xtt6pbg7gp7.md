---
type: is
id: is-01kzs413qjm4aj1xtt6pbg7gp7
title: "R14: Launch pnpm pack through the Windows command processor"
kind: bug
status: closed
priority: 1
version: 5
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - pr-207
  - final-review
  - ci
dependencies: []
parent_id: is-01kzrs2jrjg3pzase83ebxdjyg
created_at: 2026-08-11T19:15:45.009Z
updated_at: 2026-08-11T19:29:57.480Z
closed_at: 2026-08-11T19:29:57.479Z
close_reason: "Fixed with packArchive: direct pnpm execFile on POSIX and pnpm.cmd through ComSpec on Windows. GitHub Actions run 31527569977 passed qa:web-package on Windows, macOS, and Ubuntu; local package proof and quality gates also passed."
---
Windows run 31526276017 / job 93895272144 passes 1,498 runnable tests, the five-case web transcript, and watch release smoke, then fails qa:web-package at validate-web-package.mjs:88 with spawn pnpm ENOENT. On Windows pnpm is installed as a .cmd command shim, which node:child_process execFile cannot execute directly. In packages/tbd/scripts/validate-web-package.mjs, add a platform-safe pnpm pack invocation: retain direct execFile on POSIX and execute pnpm through ComSpec on win32 while keeping controlled arguments separate. Preserve the existing tarball extraction, exact launcher/page/API proof, and cleanup. Acceptance: qa:web-package passes locally and in the Windows matrix.

## Notes

Fixed with packArchive: direct pnpm execFile on POSIX and pnpm.cmd through ComSpec on Windows. GitHub Actions run 31527569977 passed qa:web-package on Windows, macOS, and Ubuntu; local package proof and quality gates also passed.

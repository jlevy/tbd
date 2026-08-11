---
type: is
id: is-01kzs0t9x5jqmn4jffn2s4652n
title: "R11: Invoke the focused web transcript cross-platform"
kind: bug
status: closed
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - pr-207
  - final-review
  - ci
dependencies: []
parent_id: is-01kzrs2jrjg3pzase83ebxdjyg
created_at: 2026-08-11T18:19:36.228Z
updated_at: 2026-08-11T19:29:54.299Z
closed_at: 2026-08-11T19:29:54.297Z
close_reason: Fixed by invoking the built CLI through Node in the focused transcript. GitHub Actions run 31527569977 passed the full Windows job, including the 5-case tbd web CLI transcript; Ubuntu and macOS also passed.
---
Windows CI passes the platform-safe Vitest suite but cannot resolve extensionless dist/tbd from the tryscript PATH. In packages/tbd/tests/cli-web.tryscript.md, invoke the built entry explicitly with node and TRYSCRIPT_TEST_DIR for setup/help/dry-run/validation. Keep the Unix/published launcher identity covered by validate-web-package.mjs. Rerun the focused transcript, web package proof, and full local quality gate before push.

## Notes

Fixed by invoking the built CLI through Node in the focused transcript. GitHub Actions run 31527569977 passed the full Windows job, including the 5-case tbd web CLI transcript; Ubuntu and macOS also passed.

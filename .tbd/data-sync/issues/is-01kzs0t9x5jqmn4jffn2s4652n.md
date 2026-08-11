---
type: is
id: is-01kzs0t9x5jqmn4jffn2s4652n
title: "R11: Invoke the focused web transcript cross-platform"
kind: bug
status: in_progress
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - pr-207
  - final-review
  - ci
dependencies: []
parent_id: is-01kzrs2jrjg3pzase83ebxdjyg
created_at: 2026-08-11T18:19:36.228Z
updated_at: 2026-08-11T18:19:40.410Z
---
Windows CI passes the platform-safe Vitest suite but cannot resolve extensionless dist/tbd from the tryscript PATH. In packages/tbd/tests/cli-web.tryscript.md, invoke the built entry explicitly with node and TRYSCRIPT_TEST_DIR for setup/help/dry-run/validation. Keep the Unix/published launcher identity covered by validate-web-package.mjs. Rerun the focused transcript, web package proof, and full local quality gate before push.

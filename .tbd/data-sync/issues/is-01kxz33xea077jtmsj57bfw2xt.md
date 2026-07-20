---
type: is
id: is-01kxz33xea077jtmsj57bfw2xt
title: Remediate pre-existing pnpm audit findings
kind: chore
status: closed
priority: 1
version: 2
labels:
  - dependencies
  - security
dependencies: []
created_at: 2026-07-20T06:23:51.241Z
updated_at: 2026-07-20T06:24:42.157Z
closed_at: 2026-07-20T06:24:42.156Z
close_reason: Duplicate of tbd-ujyy; existing security chore already owns dev-tool audit triage.
---
The frozen-lockfile setup audit on 2026-07-19 reported one critical and ten high dev-tool advisories in Vitest/Vite, Rollup, minimatch, picomatch, and defu. Review patched release ages under the 14-day cool-off, then upgrade and re-audit in a dependency-focused change. Do not mix with Phase 1 bead watch.

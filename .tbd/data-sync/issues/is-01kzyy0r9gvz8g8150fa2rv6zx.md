---
type: is
id: is-01kzyy0r9gvz8g8150fa2rv6zx
title: Triage development dependency audit findings
kind: task
status: open
priority: 2
version: 2
labels:
  - security
  - supply-chain
dependencies: []
created_at: 2026-08-14T01:26:08.431Z
updated_at: 2026-08-14T18:49:16.987Z
---
After the CVE-2026-59870 production fix, pnpm audit --prod is clean but a full pnpm audit reports 32 development-only findings (including Vitest/Vite, Rollup, minimatch, picomatch, defu, PostCSS, and brace-expansion). Review exploitability in this repo and upgrade only the concrete affected toolchain paths after SUPPLY-CHAIN-SECURITY.md cool-offs; keep production release safety separate from dev-server/test-tool exposure.

## Notes

Reproduced from the frozen lockfile on 2026-08-14 while validating PR #220: 32 findings (1 critical, 23 high, 8 moderate). The families and counts match this bead; no dependency was added or upgraded in the docs-only PR.

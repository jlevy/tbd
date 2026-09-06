---
type: is
id: is-01kzyy0r9gvz8g8150fa2rv6zx
title: Triage development dependency audit findings
kind: task
status: open
priority: 2
version: 3
labels:
  - security
  - supply-chain
dependencies: []
created_at: 2026-08-14T01:26:08.431Z
updated_at: 2026-09-06T16:25:43.502Z
---
After the CVE-2026-59870 production fix, pnpm audit --prod is clean but a full pnpm audit reports 32 development-only findings (including Vitest/Vite, Rollup, minimatch, picomatch, defu, PostCSS, and brace-expansion). Review exploitability in this repo and upgrade only the concrete affected toolchain paths after SUPPLY-CHAIN-SECURITY.md cool-offs; keep production release safety separate from dev-server/test-tool exposure.

## Notes

Rechecked from unchanged frozen lockfile on 2026-09-06 during coordination research (tbd-kvs3): full pnpm audit reports 34 findings (1 critical, 24 high, 9 moderate), all through development-tool paths; pnpm audit --prod reports zero. 31 direct pins passed the 14-day age check. Install scripts were disabled. Review runs use trusted local fixtures without starting Vitest UI or a public development server. Existing 2026-08-14 result was 32 (1 critical, 23 high, 8 moderate). Remediation remains tracked here; no dependency versions changed.

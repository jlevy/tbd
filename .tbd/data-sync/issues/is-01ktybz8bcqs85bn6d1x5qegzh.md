---
type: is
id: is-01ktybz8bcqs85bn6d1x5qegzh
title: Triage dev-tooling vulnerabilities reported by pnpm audit
kind: chore
status: open
priority: 2
version: 1
labels:
  - supply-chain
  - maintenance
dependencies: []
created_at: 2026-06-12T16:52:15.844Z
updated_at: 2026-06-12T16:52:15.844Z
---
PR #153 review validation: pnpm audit failed on 2026-06-12 with 16 dev-tooling vulnerabilities: 1 critical, 9 high, 6 moderate. Production audit was clean. Affected paths include vitest/vite/rollup, tsdown/defu, c8/test-exclude/minimatch/brace-expansion, tryscript/fast-glob/micromatch/picomatch, and typescript-eslint/tinyglobby/picomatch. Triage upgrades under the 14-day package-age policy and document any exception.

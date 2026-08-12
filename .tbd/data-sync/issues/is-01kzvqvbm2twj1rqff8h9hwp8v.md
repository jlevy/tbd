---
type: is
id: is-01kzvqvbm2twj1rqff8h9hwp8v
title: Triage workspace development dependency audit advisories
kind: bug
status: open
priority: 1
version: 1
labels:
  - supply-chain
  - development
dependencies: []
created_at: 2026-08-12T19:40:36.865Z
updated_at: 2026-08-12T19:40:36.865Z
---
On 2026-08-12 after installing merged main at 5cd66bf1, pnpm audit reported 34 workspace advisories: 1 critical, 25 high, and 8 moderate, primarily through Vitest/Vite/Rollup, c8/minimatch, tryscript/picomatch, tsdown/defu, and related development tooling. The production-only js-yaml advisory remains separately tracked by tbd-6gy0. Follow SUPPLY-CHAIN-SECURITY.md cooldown and audit rules, deduplicate shared transitive roots, assess exposure, and update only to verified patched releases.

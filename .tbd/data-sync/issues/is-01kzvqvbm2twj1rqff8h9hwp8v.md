---
type: is
id: is-01kzvqvbm2twj1rqff8h9hwp8v
title: Triage workspace development dependency audit advisories
kind: bug
status: closed
priority: 1
version: 3
labels:
  - supply-chain
  - development
dependencies: []
parent_id: is-01kzvr00wp6yqv6cbhgagx0ve8
created_at: 2026-08-12T19:40:36.865Z
updated_at: 2026-08-12T23:38:11.214Z
closed_at: 2026-08-12T23:38:11.213Z
close_reason: Triaged the full workspace audit. The critical Vitest advisory requires its optional development UI server to be listening; this repository neither installs nor starts that UI. Other non-production findings are confined to development servers/build tooling and trusted repository inputs, so no release-blocking upgrade is justified.
---
On 2026-08-12 after installing merged main at 5cd66bf1, pnpm audit reported 34 workspace advisories: 1 critical, 25 high, and 8 moderate, primarily through Vitest/Vite/Rollup, c8/minimatch, tryscript/picomatch, tsdown/defu, and related development tooling. The production-only js-yaml advisory remains separately tracked by tbd-6gy0. Follow SUPPLY-CHAIN-SECURITY.md cooldown and audit rules, deduplicate shared transitive roots, assess exposure, and update only to verified patched releases.

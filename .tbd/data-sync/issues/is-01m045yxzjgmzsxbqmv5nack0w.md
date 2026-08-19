---
type: is
id: is-01m045yxzjgmzsxbqmv5nack0w
title: "Electrobun: write electrobun-app-development-patterns guideline"
kind: feature
status: closed
priority: 1
version: 6
labels: []
dependencies:
  - type: blocks
    target: is-01m045zbvt4hrnr20fereas3fa
  - type: blocks
    target: is-01m045zdsxka8ty06fzp1sn84v
  - type: blocks
    target: is-01m045zfqascxq7t0sprw9rdxa
parent_id: is-01m045xkh80njyhawssyg9sgtp
created_at: 2026-08-16T02:21:09.490Z
updated_at: 2026-08-16T02:45:10.665Z
closed_at: 2026-08-16T02:45:10.665Z
close_reason: "Wrote electrobun-app-development-patterns.md (722 lines) following the Electron doc's structure. Central verified finding: the updater applies updates with no signature or payload-digest verification. Also documents that Electrobun is no longer Bun-first (mainProcess defaults to cottontail, its own JSC runtime), that sandbox and RPC are mutually exclusive with no contextIsolation equivalent, and the bus-factor-one maturity profile. Recommendation is scoped to internal/trusted distribution without auto-update."
---
Same structure as electron-app-development-patterns. Must be honest about beta maturity and give a clear when-to-use/when-not-to-use recommendation backed by evidence.

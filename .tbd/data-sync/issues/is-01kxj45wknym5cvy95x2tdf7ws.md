---
type: is
id: is-01kxj45wknym5cvy95x2tdf7ws
title: Restore dependency auditing after npm audit endpoint retirement
kind: bug
status: open
priority: 2
version: 1
labels:
  - supply-chain
  - tooling
dependencies: []
created_at: 2026-07-15T05:32:16.884Z
updated_at: 2026-07-15T05:32:16.884Z
---
During GitHub #190 implementation on 2026-07-15, pnpm audit --audit-level=moderate failed before producing findings because https://registry.npmjs.org/-/npm/v1/security/audits returned HTTP 410 and directed clients to the bulk advisory endpoint. The repository currently pins pnpm 10.28.2. Determine whether a safe pnpm upgrade, alternate audited command, or repository script should restore the required post-install and CI audit gate under the 14-day policy. Keep this separate from existing tbd-ujyy, which tracks actual vulnerability triage.

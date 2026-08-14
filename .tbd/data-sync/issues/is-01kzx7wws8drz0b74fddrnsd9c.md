---
type: is
id: is-01kzx7wws8drz0b74fddrnsd9c
title: Upgrade pnpm/action-setup after supply-chain cooldown
kind: chore
status: open
priority: 3
version: 1
labels:
  - ci
  - supply-chain
dependencies: []
deferred_until: 2026-08-18T00:00:00Z
created_at: 2026-08-13T09:40:18.855Z
updated_at: 2026-08-13T09:40:18.855Z
---
GitHub Actions now warns that pnpm/action-setup@v4 targets deprecated Node.js 20. The current v6.0.10 release (published 2026-08-03) supports pnpm 10 but remains inside this repository's mandatory 14-day dependency cooldown until 2026-08-17T12:06:25Z. After the cooldown, review the v4→v6 changelog and source/supply chain, pin the approved immutable commit SHA if consistent with workflow policy, update all four uses in .github/workflows/ci.yml and .github/workflows/release.yml, and validate CI plus a release dry run. Do not migrate to pnpm/setup in this bead because that successor requires pnpm 11 and broadens scope.

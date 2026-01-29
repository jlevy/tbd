---
created_at: 2026-01-29T20:56:52.154Z
dependencies:
  - target: is-01kg5resvdj6wszs3rfhf11xnt
    type: blocks
  - target: is-01kg5rq03d9j2vph00jhc52ta1
    type: blocks
id: is-01kg5rptnwx5ryd07qasy41ee9
kind: epic
labels: []
priority: 0
status: open
title: "Epic: Fix silent error swallowing in sync and prevent it across codebase"
type: is
updated_at: 2026-01-29T20:57:45.783Z
version: 4
---
## Overview

Critical bug discovered where `tbd sync` silently swallowed push failures. This epic tracks fixing the immediate bug and implementing systematic improvements to prevent this pattern across the codebase.

## Sub-issues

- **tbd-ca3g**: Fix the immediate sync silent failure bug (P0)
- **tbd-qeuw**: Post-mortem and process improvements (P1)

## Scope

1. Fix the immediate bug in sync.ts
2. Audit codebase for similar patterns
3. Implement systematic prevention (lint rules, types, tests)
4. Update development guidelines

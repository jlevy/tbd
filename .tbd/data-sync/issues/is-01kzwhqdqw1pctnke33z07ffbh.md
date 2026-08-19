---
type: is
id: is-01kzwhqdqw1pctnke33z07ffbh
title: Replace rough native titles with a fast consistent tooltip system
kind: feature
status: closed
priority: 2
version: 2
labels:
  - web
  - release-readiness
dependencies: []
parent_id: is-01kzw6y8ppmp6bt6nd8tgmmspn
created_at: 2026-08-13T03:12:50.939Z
updated_at: 2026-08-13T04:06:22.852Z
closed_at: 2026-08-13T04:06:22.852Z
close_reason: Implemented, covered by focused tests, documented in the authoritative web design and user docs, passed the full 1,626-test CI suite, and validated in the live browser.
---
Replace visible native-title tooltips across the viewer with one delegated, accessible tooltip primitive based on the proven MetaBrowser/KPress pattern. Keep a short but deliberate hover/focus delay, fast smooth transitions using design tokens, dark-mode-safe chrome, viewport-aware placement, and no per-target listeners or tooltip DOM proliferation. Apply consistently to controls, watcher/status explanations, exact timestamps, and copied literals while retaining native semantics where useful. Document the timing and visual contract in the authoritative CSS design-system comments and add interaction/DOM tests.

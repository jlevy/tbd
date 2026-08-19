---
type: is
id: is-01kzwj40j5ws6dgganzmg24etj
title: Render relative ages as sans chrome and exact timestamps as literals
kind: bug
status: closed
priority: 2
version: 2
labels:
  - web
  - release-readiness
dependencies: []
parent_id: is-01kzw6y8ppmp6bt6nd8tgmmspn
created_at: 2026-08-13T03:19:43.428Z
updated_at: 2026-08-13T04:06:22.881Z
closed_at: 2026-08-13T04:06:22.881Z
close_reason: Implemented, covered by focused tests, documented in the authoritative web design and user docs, passed the full 1,626-test CI suite, and validated in the live browser.
---
Correct the typography semantics for Updated: the visible relative age (for example 5m ago) is derived viewer chrome and must use the standard sans compact style; the exact ISO timestamp revealed on hover/focus is the underlying literal and remains monospace. Encode this split in the tooltip primitive, authoritative CSS design-system comments, and regression assertions without adding another font size.

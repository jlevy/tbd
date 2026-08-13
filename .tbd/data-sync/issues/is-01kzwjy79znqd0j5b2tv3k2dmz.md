---
type: is
id: is-01kzwjy79znqd0j5b2tv3k2dmz
title: Make the Beads/sidebar divider continuous and symmetrically owned
kind: bug
status: closed
priority: 2
version: 3
labels:
  - web
  - release-readiness
dependencies: []
parent_id: is-01kzw6y8ppmp6bt6nd8tgmmspn
created_at: 2026-08-13T03:34:02.302Z
updated_at: 2026-08-13T04:06:22.900Z
closed_at: 2026-08-13T04:06:22.900Z
close_reason: Implemented, covered by focused tests, documented in the authoritative web design and user docs, passed the full 1,626-test CI suite, and validated in the live browser.
---
The sidebar/Status region draws a left border while the Beads region has no matching full-height right edge, leaving a visually partial divider. Move divider ownership to the two-column main layout so one continuous border spans the complete taller column, with deliberate spacing on both sides; remove it at the <=900px stacked breakpoint. Document the layout ownership rule and verify computed geometry in wide and stacked layouts.

## Notes

Live geometry: main and aside both measured 20307.01171875px and the aside divider rendered continuously for the full grid height; stacked breakpoint remains covered by CSS regression.

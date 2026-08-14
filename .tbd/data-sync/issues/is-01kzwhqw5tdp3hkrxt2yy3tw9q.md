---
type: is
id: is-01kzwhqw5tdp3hkrxt2yy3tw9q
title: Default the board to Updated descending then Priority ascending
kind: feature
status: closed
priority: 1
version: 2
labels:
  - web
  - release-readiness
dependencies: []
parent_id: is-01kzw6y8ppmp6bt6nd8tgmmspn
created_at: 2026-08-13T03:13:05.719Z
updated_at: 2026-08-13T04:06:22.857Z
closed_at: 2026-08-13T04:06:22.857Z
close_reason: Implemented, covered by focused tests, documented in the authoritative web design and user docs, passed the full 1,626-test CI suite, and validated in the live browser.
---
Change initial board controls to a deterministic composed flat sort: Updated descending primary, Priority ascending secondary. Since global Updated ordering conflicts with parent-first hierarchy, Pretty must default off; explicitly enabling Pretty clears the custom stack and restores hierarchical CLI priority order. Preserve the selected default stack across live updates, keep URL/query and header ordinal indicators canonical, and update tests plus design/docs for the exact behavior and command-equivalence caveat.

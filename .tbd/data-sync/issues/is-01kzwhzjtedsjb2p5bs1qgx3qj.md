---
type: is
id: is-01kzwhzjtedsjb2p5bs1qgx3qj
title: Make label facets iteratively reflect conjunctive intersections
kind: feature
status: closed
priority: 1
version: 2
labels:
  - web
  - release-readiness
dependencies: []
parent_id: is-01kzw6y8ppmp6bt6nd8tgmmspn
created_at: 2026-08-13T03:17:18.285Z
updated_at: 2026-08-13T04:06:22.870Z
closed_at: 2026-08-13T04:06:22.870Z
close_reason: Implemented, covered by focused tests, documented in the authoritative web design and user docs, passed the full 1,626-test CI suite, and validated in the live browser.
---
Turn the 32-label multi-chooser into dynamic conjunctive faceting. Compute facets from rows satisfying the current non-label filters/search; after selecting labels, each unselected label tally is the size of the result after adding that label to the current AND set, and zero-overlap unselected labels are hidden. Selected labels must always remain visible for removal, with counts reflecting the current intersection. Removing any selected label must immediately broaden/recount the menu without losing keyboard focus or changing the repeated --label AND contract. Add server and browser-contract regressions for select, further intersection, zero hiding, and de-intersection.

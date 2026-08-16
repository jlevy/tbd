---
type: is
id: is-01kzwj7jw5w3qs8yvartsrapbt
title: Add dynamic tallies to Status, Type, and Priority facets
kind: feature
status: closed
priority: 1
version: 4
labels:
  - web
  - release-readiness
dependencies: []
parent_id: is-01kzw6y8ppmp6bt6nd8tgmmspn
created_at: 2026-08-13T03:21:40.484Z
updated_at: 2026-08-13T04:06:22.894Z
closed_at: 2026-08-13T04:06:22.894Z
close_reason: Implemented, covered by focused tests, documented in the authoritative web design and user docs, passed the full 1,626-test CI suite, and validated in the live browser.
---
Generalize the viewer's facet design system beyond labels. Status, Type, and Priority chooser options must show live counts conditioned on search and every other active filter while excluding their own dimension, so readers can see the result of switching values. Status includes active and any aggregates plus each lifecycle value; Type and Priority include any plus each value. Labels keep iterative repeated-label AND counts. Add a typed bounded facet payload, update native chooser option copy without disturbing semantic colors/selection, document the shared facet-count rule, and cover cross-filter recomputation.

## Notes

Authoritative counting model: every displayed tally is conditional on search and all active filters in other dimensions, never a global standalone count. Omit only the menu's own dimension so a single-select chooser can show the result of switching it; label candidate counts add that label atop the full current cross-facet state plus all selected labels.

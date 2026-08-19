---
type: is
id: is-01kzvdvegnze8rh8mzt9m4msry
title: Use shared section-heading command vocabulary for Beads
kind: task
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
  - design-system
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T16:45:54.068Z
updated_at: 2026-08-12T17:21:46.051Z
closed_at: 2026-08-12T17:21:46.050Z
close_reason: "Implemented and verified in the shared web design-system pass: source/CSS contract tests 32/32; focused concurrency/UI suite 304/304; full repository gate 113 files and 1,591 tests; CLI transcripts 1,075/1,075; packed web artifact passed; light/dark live-browser geometry, behavior, ordering, copy feedback, and 1,000-row resource bounds validated."
---
Replace the 'equivalent: tbd list ...' prose line with the same section-heading vocabulary used by STATUS / tbd status: a BEADS small-cap heading followed by the live monospace command. Keep it in the filter-owned region and preserve dynamic updates for every filter. Factor the CSS so board and aside headings share typography/color roles, update the authoritative design-system comment, and add DOM/CSS contract plus live-browser validation.

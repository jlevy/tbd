---
type: is
id: is-01kzve129mjd23tw6x4nnf67v6
title: Add reusable hover-to-copy affordance for literal values
kind: feature
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
  - design-system
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T16:48:58.163Z
updated_at: 2026-08-12T17:21:46.057Z
closed_at: 2026-08-12T17:21:46.057Z
close_reason: "Implemented and verified in the shared web design-system pass: source/CSS contract tests 32/32; focused concurrency/UI suite 304/304; full repository gate 113 files and 1,591 tests; CLI transcripts 1,075/1,075; packed web artifact passed; light/dark live-browser geometry, behavior, ordering, copy feedback, and 1,000-row resource bounds validated."
---
Adapt MetaBrowser/kpress's reveal-on-hover copy-button pattern for tbd. Add one accessible, subtle, token-based copy primitive for literal/monospace values: board bead IDs, equivalent-command hints, repository/status values, sync-branch tip, and monospace expanded-body values. Reserve layout space to prevent shifts; reveal on container hover or keyboard focus; stop propagation so row copy never toggles expansion; use navigator.clipboard with success/failure feedback; document the coverage rule; and add interaction/CSS/live-browser tests in light and dark modes.

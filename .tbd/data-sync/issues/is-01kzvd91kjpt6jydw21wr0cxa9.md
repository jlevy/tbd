---
type: is
id: is-01kzvd91kjpt6jydw21wr0cxa9
title: Keep expanded-row emphasis limited to bead identity
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
created_at: 2026-08-12T16:35:51.025Z
updated_at: 2026-08-12T17:21:46.010Z
closed_at: 2026-08-12T17:21:46.010Z
close_reason: "Implemented and verified in the shared web design-system pass: source/CSS contract tests 32/32; focused concurrency/UI suite 304/304; full repository gate 113 files and 1,591 tests; CLI transcripts 1,075/1,075; packed web artifact passed; light/dark live-browser geometry, behavior, ordering, copy feedback, and 1,000-row resource bounds validated."
---
In packages/tbd/src/web/styles.css, preserve the light gray hover state but remove the persistent gray background for expanded summary/body rows. On expansion, apply stronger weight only to bead ID and title; status, priority, kind, labels, and other semantic fields retain their normal weights. Document the rule and cover it with CSS contract tests and live-browser validation.

---
type: is
id: is-01kzve12mwmp0jjbva56gen07x
title: Fold update count into observer connection tooltip
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
created_at: 2026-08-12T16:48:58.523Z
updated_at: 2026-08-12T17:21:46.064Z
closed_at: 2026-08-12T17:21:46.064Z
close_reason: "Implemented and verified in the shared web design-system pass: source/CSS contract tests 32/32; focused concurrency/UI suite 304/304; full repository gate 113 files and 1,591 tests; CLI transcripts 1,075/1,075; packed web artifact passed; light/dark live-browser geometry, behavior, ordering, copy feedback, and 1,000-row resource bounds validated."
---
Remove the redundant header update-count pill. Keep one observer pill whose visible state communicates server connection plus local watcher health (starting/watching/error/disconnected); include the session-local observed update count and a concise explanation in its tooltip. Ensure EventSource disconnection overrides watcher phase visibly and recovers on reconnect. Update DOM/client tests and validate live state transitions.

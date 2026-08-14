---
type: is
id: is-01m00h4r097kwbjg224wn8xxbk
title: Correct the '~10% of beads' selection claim and document max_nesting skips
kind: bug
status: open
priority: 2
version: 2
spec_path: docs/project/research/current/research-2026-08-14-agent-sync-protocol-and-hooks.md
labels: []
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-14T16:19:36.585Z
updated_at: 2026-08-14T16:50:18.055Z
---
The 'roughly 10% of a typical repository's beads' figure appears in the setup-linear shortcut and in the PRESETS comment in integrations/core/policy.ts. Measured here it is 45% (114 of 254 active), because the specs:active clause dominates in a spec-driven repo: 105 of the 114 qualify on spec, not on being an epic.

Also document that planMirror skips unlinked beads deeper than max_nesting within the selection, so 114 selected produces 70 created and 44 skipped here — a 39% gap that will surprise whoever runs the first mirror.

Research: research-2026-08-14-agent-sync-protocol-and-hooks.md F1, F2

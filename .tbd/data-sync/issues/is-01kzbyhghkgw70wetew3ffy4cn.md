---
type: is
id: is-01kzbyhghkgw70wetew3ffy4cn
title: Rework Linear pilot spec under the integration layering (extensions-first, separable module)
kind: task
status: open
priority: 2
version: 1
labels: []
dependencies: []
created_at: 2026-08-06T16:29:43.335Z
updated_at: 2026-08-06T16:29:43.335Z
---
Rework plan-2026-07-20-linear-bead-sync-pilot.md (currently on PR #197) to conform to the integration architecture in the watch-infrastructure spec: bead-side bindings in extensions.bridge (no linked schema field, no tbd_format gate for the pilot), bridge config and state in the module's own files (not .tbd/config.yml — its strip-mode policy would force a format bump), sync as a cleanly separable module invoked explicitly (not folded into tbd sync), pilot field scope narrowed to import + status writeback. Keep: single-source invariant, base-snapshot 3-way model for the fields that need it, mapping tables, verified Linear API research. Re-gate epic tbd-g305's phase beads to the reworked plan; promotion to first-class linked field / tbd bridge command / format bump happens post-pilot with evidence.

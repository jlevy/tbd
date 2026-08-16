---
type: is
id: is-01kzbyhghkgw70wetew3ffy4cn
title: Rework Linear pilot spec under the integration layering (extensions-first, separable module)
kind: task
status: closed
priority: 1
version: 6
spec_path: docs/project/specs/active/plan-2026-07-19-bead-watch-and-external-sync.md
labels:
  - linear-sync
dependencies:
  - type: blocks
    target: is-01kxz3kfz7n7y23n9rzmy28f98
parent_id: is-01kxz3kfz7n7y23n9rzmy28f98
created_at: 2026-08-06T16:29:43.335Z
updated_at: 2026-08-15T05:33:51.860Z
closed_at: 2026-08-15T05:33:51.860Z
close_reason: "The legacy PR #197 integration design was superseded by the active external-tracker plan and the production implementation merged in PR #206."
extensions:
  linear:
    id: 1820450c-c0ab-461f-8df7-0a1c755a59cc
    key: TBD-5
    url: https://linear.app/finterm-ai/issue/TBD-5/rework-linear-pilot-spec-under-the-integration-layering-extensions
    linked_at: 2026-08-10T19:37:31.504Z
---
Rework plan-2026-07-20-linear-bead-sync-pilot.md (currently on PR #197) to conform to the integration architecture in the watch-infrastructure spec: bead-side bindings in extensions.bridge (no linked schema field, no tbd_format gate for the pilot), bridge config and state in the module's own files (not .tbd/config.yml — its strip-mode policy would force a format bump), sync as a cleanly separable module invoked explicitly (not folded into tbd sync), pilot field scope narrowed to import + status writeback. Keep: single-source invariant, base-snapshot 3-way model for the fields that need it, mapping tables, verified Linear API research. Re-gate epic tbd-g305's phase beads to the reworked plan; promotion to first-class linked field / tbd bridge command / format bump happens post-pilot with evidence.

## Notes

This is the next provider-design step after PR #205. Produce a new Linear-specific plan under the current Integration Layer rules before any provider code starts; re-scope or supersede the deferred legacy phase beads. PR #205 merge and watch release validation do not depend on this task.

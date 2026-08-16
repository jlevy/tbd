---
type: is
id: is-01m00h74jxrdkgs06btjdx4v22
title: "Decide whether to lift this repo's sync_on_tbd_sync: false pilot override"
kind: task
status: open
priority: 2
version: 5
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-1
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-14T16:20:55.004Z
updated_at: 2026-08-16T00:10:47.181Z
extensions:
  linear:
    id: ebc1983f-1e76-41f5-9d60-619b37244db1
    linked_at: 2026-08-16T00:10:47.181Z
---
This repository sets integrations.sync_on_tbd_sync: false — a deliberate pilot override recorded in plan-2026-08-10-external-tracker-integrations.md. While it stands, plain tbd sync does not touch Linear here at all, so none of the visibility work in this epic is observable in the dogfooding repo.

The schema default is true (enabling an integration is itself the opt-in). Decide whether the pilot's exit criteria are met, and lift it if so.

Research: research-2026-08-14-agent-sync-protocol-and-hooks.md §1.2, §8 Phase 0

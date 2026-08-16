---
type: is
id: is-01kzz3769yd8krf2xafhgbvjrg
title: "Remove the pilot sync_on_tbd_sync: false override once f07 ships"
kind: task
status: open
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies: []
created_at: 2026-08-14T02:57:02.269Z
updated_at: 2026-08-16T00:10:47.092Z
extensions:
  linear:
    id: 12da9525-185c-4339-8959-a4f71fd0334b
    linked_at: 2026-08-16T00:10:47.092Z
---
This repo's .tbd/config.yml still carries integrations.sync_on_tbd_sync: false from the Linear pilot. With f07 gating pre-0.6.0 clients out, the config-stripping hazard that justified keeping the override is closed. Re-evaluate removing it so plain tbd sync covers Linear here, per the Rollout Plan step 3 in plan-2026-08-10-external-tracker-integrations.md.

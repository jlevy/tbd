---
type: is
id: is-01kxz3mf4ytsqe23z53h0z8c7q
title: "Phase 1: Linear client, config gating, link/unlink/import, single-bead sync"
kind: feature
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-07-20-linear-bead-sync-pilot.md
labels:
  - linear-sync
dependencies:
  - type: blocks
    target: is-01kxz3mfsysxwdhm0yfwg1sfa6
parent_id: is-01kxz3kfz7n7y23n9rzmy28f98
created_at: 2026-07-20T06:32:53.662Z
updated_at: 2026-07-20T06:46:21.568Z
---
Generic tbd bridge command group (decided 2026-07-20: bridge, not per-provider commands) with provider inference from refs (linear:ENG-123, URLs, owner/repo#123): bridges config block + LINEAR_API_KEY gating; thin Linear GraphQL client (rate-limit header aware; raw fetch pending Open Question 2); ensureMeta caching team workflow-state UUIDs by type + labels; tbd bridge link/unlink/import <ref> with one-source-per-bead guard; mapping tables as pure functions (status incl. blocked/deferred label round-trip, bijective priority map) with exhaustive unit tests; tbd bridge sync for one link: 3-way diff vs base snapshot, pull-apply, push, state refresh, echo suppression. Bridge state at .tbd/data-sync/bridge/<provider>/ on the sync branch. Manual e2e vs sandbox Linear team. Spec Design §2-§5, Phase 1.

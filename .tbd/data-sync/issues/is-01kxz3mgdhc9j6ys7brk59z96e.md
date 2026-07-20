---
type: is
id: is-01kxz3mgdhc9j6ys7brk59z96e
title: "Phase 3: tbd watch --json + dispatch conventions + agent coordination QA playbook"
kind: feature
status: open
priority: 1
version: 1
spec_path: docs/project/specs/active/plan-2026-07-20-linear-bead-sync-pilot.md
labels:
  - linear-sync
dependencies: []
parent_id: is-01kxz3kfz7n7y23n9rzmy28f98
created_at: 2026-07-20T06:32:54.961Z
updated_at: 2026-07-20T06:32:54.961Z
---
tbd watch --json: snapshot-diff loop over the shared worktree emitting JSONL bead events (event_id ULID, type, actor, changed fields, prev values) with --types filter; actor filtering from last_actor; document dispatch conventions (assignee=agent, labels=mode, status=lifecycle) in tbd-docs + skill docs; QA playbook for the full loop: Linear issue → sync import → watch wakes agent → agent closes bead → Linear shows completed, with two agents + bridge running concurrently and no echo/ping-pong. Spec Design §6, Phase 3.

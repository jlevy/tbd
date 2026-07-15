---
type: is
id: is-01kv1cyx8vn2yyw5q1gmjdxcdv
title: Fix stale sync docs (tbd-docs.md + tbd-design.md)
kind: task
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-06-13-agent-cli-ergonomics.md
labels: []
dependencies: []
parent_id: is-01kv199ns2s6hs8zzxxf6vwkz5
created_at: 2026-06-13T21:07:16.378Z
updated_at: 2026-06-13T23:24:44.533Z
closed_at: 2026-06-13T23:24:44.533Z
close_reason: "Done in 35b8c73: corrected all stale --no-sync/auto_sync claims in tbd-docs.md and tbd-design.md to reflect stage-then-publish (issue writes stage to the local tbd-sync worktree; tbd sync publishes; --no-sync is a documented no-op for issue writes; auto_sync default false, not applied)."
---
Correct the --no-sync/auto_sync as-real-issue-write claims: tbd-docs.md ~L805-827, L1094-1098, L1263-1267 and tbd-design.md ~L1608-1646, L2936-2961. Reflect stage-then-publish + opt-in --sync.

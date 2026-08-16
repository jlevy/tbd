---
type: is
id: is-01m044p9c6bhvyb8bbryag33hz
title: Prove whether Linear bumps updatedAt when a comment is created
kind: task
status: open
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-3
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-16T01:58:57.662Z
updated_at: 2026-08-16T02:11:52.720Z
extensions:
  linear:
    id: 19fa31e8-49b0-47be-891d-93f9c181b11c
    linked_at: 2026-08-16T02:11:52.720Z
---
Carried over from the original runbook and still unproven. The delta-gated comment fetch assumes creating a comment advances the issue's updatedAt; if it does not, the watermark prefilter will miss inbound comments.

The 2026-08-15 live cycle ran with comments=two_way but exercised no comment traffic (commentsPushed and commentsPulled were both 0 throughout), so this remains open. Post a comment in Linear by hand, then check whether the issue's updatedAt moved.

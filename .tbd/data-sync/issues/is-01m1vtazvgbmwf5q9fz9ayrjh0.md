---
type: is
id: is-01m1vtazvgbmwf5q9fz9ayrjh0
title: Drain initial ready backlog and validate claims in the watch worker recipe
kind: task
status: open
priority: 2
version: 2
labels: []
dependencies: []
created_at: 2026-09-06T16:55:29.903Z
updated_at: 2026-09-06T17:00:14.638Z
---
watch --ready observes entry into readiness after its baseline, not initial ready backlog. The durable single-owner watch-beads recipe begins waiting without an initial scan. Add documented startup/restart reconciliation so existing ready tasks are considered, then revalidate and check start JSON claimed/skipped (foreign skip exits zero). Preserve single-owner checkpoint state and handle crash-after-processing replay idempotently. Test initial backlog, completion during downtime, lost claim, separate worker state names; coordinate claim instructions with existing tbd-c4zl. Research: docs/project/research/current/research-2026-09-06-bead-agent-coordination.md.

Landing addendum: main c43e2d41 now excludes future deferred_until in readiness and evaluates both change snapshots at one clock. Remote watch skips unchanged tips; a later unrelated commit still evaluates both snapshots at the same time, so clock-only deferral expiry is not a ready edge. The board computes fresh ready state on response but has no expiry-triggered SSE/refetch. Extend worker reconciliation to periodic/timer-based readiness checks, not only initial drain and change wakes; test existing deferred task becoming eligible without a Git write. Source reviewed, no live-agent expiry test run.

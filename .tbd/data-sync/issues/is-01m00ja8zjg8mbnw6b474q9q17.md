---
type: is
id: is-01m00ja8zjg8mbnw6b474q9q17
title: tbd sync --issues silently excludes the tracker
kind: bug
status: open
priority: 2
version: 2
labels:
  - sync-efficiency
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-14T16:40:06.386Z
updated_at: 2026-08-14T16:40:22.019Z
---
syncIntegrations = Boolean(options.integrations) || (!hasSurfaceFlag && !options.status), so passing --issues sets hasSurfaceFlag and drops Linear with no mention in the output. An agent narrowing to --issues for speed has no way to know the tracker went stale.

Fix: either include the tracker in the --issues surface (beads and their mirror are arguably one logical thing, which would also remove the surprise in tbd-<sync --push bug> rather than documenting it), or say so in the output.

Research: research-2026-08-14-agent-sync-protocol-and-hooks.md §1.2, E12, open question 9

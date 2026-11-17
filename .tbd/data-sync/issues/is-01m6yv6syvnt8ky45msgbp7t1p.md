---
type: is
id: is-01m6yv6syvnt8ky45msgbp7t1p
title: "PR #332 B1: cwd- or git-relative closing spellings are kept as tbd wiring"
kind: bug
status: closed
priority: 1
version: 2
labels: []
dependencies: []
parent_id: is-01m6yv6qega7ts908s41sm9pqm
created_at: 2026-11-09T00:26:53.787Z
updated_at: 2026-11-09T00:41:15.613Z
closed_at: 2026-11-09T00:41:15.612Z
close_reason: "Fixed in 842ef29e on PR #332; disposition reply posted"
resolution: null
duplicate_of: null
---
High. hook-commands.ts accepted bare, ./ and git rev-parse --show-toplevel spellings for every slot, so from a nested checkout (attic/lib) the clone's script ran after every Bash call. Review: https://github.com/jlevy/tbd/pull/332#pullrequestreview-5820357750

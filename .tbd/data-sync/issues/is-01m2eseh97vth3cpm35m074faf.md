---
type: is
id: is-01m2eseh97vth3cpm35m074faf
title: Release notes and release gate for the coordination stack
kind: task
status: open
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies: []
parent_id: is-01m2erp0t0njvw8medbk3x70vz
created_at: 2026-09-14T01:45:31.686Z
updated_at: 2026-09-14T01:45:59.033Z
---
The repository composes release notes at release time from CHANGELOG (no changesets). Items the coordination stack adds, from the release-compatibility review:
- identity.agent_map is now honored: invalid values fail integration commands (tbd-tia7), valid values send delegateId on --push, which can start Linear Agent Sessions (tbd-80vz).
- Upgrade every clone: comment lineage protection (#279) only holds when the merging client is upgraded; a v0.8.1 merger still moves comments onto a replacement link.
- Mixed-version teams: `tbd setup --auto` rewrites the AGENTS.md block and skill files differently on old and new clients, and doctor reports the other version's block as stale.
- Changed strings: `tbd status` hint now `tbd setup --auto`; `integration comment` success message and help; unconfigured `integration status` example nests `target:`; adapter errors and the mapping warning say `identity.user_map` / `identity.agent_map` (visible in JSON sync warnings); prime --brief adds the `tbd start` claim step and a corrected Beads warning.
- Conflict counts in `tbd sync` can rise: a relink on one side plus an unrelated edit on the other now counts a namespace conflict.
Also gate the release on the tbd sync attic decision (tbd-ajq2) and on tbd-od0z (main since #264 widens the Linear alternation).

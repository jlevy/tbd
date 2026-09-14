---
type: is
id: is-01m2eseh97vth3cpm35m074faf
title: Release notes and release gate for the coordination stack
kind: task
status: open
priority: 1
version: 6
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies: []
parent_id: is-01m2erp0t0njvw8medbk3x70vz
created_at: 2026-09-14T01:45:31.686Z
updated_at: 2026-09-14T02:59:00.180Z
---
The repository composes release notes at release time from CHANGELOG (no changesets). Items the coordination stack adds, from the release-compatibility review:
- identity.agent_map is now honored: invalid values fail integration commands (tbd-tia7), valid values send delegateId on --push, which can start Linear Agent Sessions (tbd-80vz).
- Upgrade every clone: comment lineage protection (#279) only holds when the merging client is upgraded; a v0.8.1 merger still moves comments onto a replacement link.
- Mixed-version teams: `tbd setup --auto` rewrites the AGENTS.md block and skill files differently on old and new clients, and doctor reports the other version's block as stale.
- Changed strings: `tbd status` hint now `tbd setup --auto`; `integration comment` success message and help; unconfigured `integration status` example nests `target:`; adapter errors and the mapping warning say `identity.user_map` / `identity.agent_map` (visible in JSON sync warnings); prime --brief adds the `tbd start` claim step and a corrected Beads warning.
- Conflict counts in `tbd sync` can rise: a relink on one side plus an unrelated edit on the other now counts a namespace conflict.
Also gate the release on the tbd sync attic decision (tbd-ajq2) and on tbd-od0z (main since #264 widens the Linear alternation).

Update 2026-09-14: tbd-ajq2 decided (sync always saves conflicts to the attic; attic documented as a recovery store), so the release notes describe attic recovery rather than a git-history caveat.

2026-09-14: Release 1 is stage B of the merge, release, and format upgrade map in the stability sprint plan (PR #277). Before tagging, in addition to the notes: tbd-od0z landed; tbd-ajq2 landed; pnpm qa:upgrade-package and pnpm release:verify pass; and because generated agent surfaces change, the packed candidate is validated in a fresh first-party downstream checkout (docs/development.md release step 4). User upgrade: npm install -g get-tbd@latest, then tbd setup --auto and commit the generated-surface diff; no format migration.

2026-09-14: the stack is on main. Add as release gates: tbd-s3zx (third-party extensions comments rewritten on merge, now reachable from main), tbd-apnu, tbd-cskr.

f08 compatibility review 2026-09-14 (see 'f08 Compatibility Contract for Sprint Fixes' in the stability sprint plan): release notes state 0.8.1 as the minimum for any clone that runs integration sync (0.7.x already drops base.slot and refinement_* on rewrite, and leaves resolution set on reopened beads), and state any further minimum that tbd-s4kb (T3) requires for the Backlog mapping.

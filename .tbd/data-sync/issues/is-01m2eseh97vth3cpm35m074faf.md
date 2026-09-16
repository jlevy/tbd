---
type: is
id: is-01m2eseh97vth3cpm35m074faf
title: Release notes and release gate for the coordination stack
kind: task
status: in_progress
priority: 1
version: 12
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
delegate: claude-code@spud10.local
labels: []
dependencies: []
parent_id: is-01m2erp0t0njvw8medbk3x70vz
hold: null
hold_until: null
created_at: 2026-09-14T01:45:31.686Z
updated_at: 2026-09-16T08:58:45.777Z
started_at: 2026-09-16T06:37:08.142Z
duplicate_of: null
extensions:
  linear:
    id: 2f20c626-78c2-4a48-9904-5f80572914a7
    linked_at: 2026-09-16T08:28:28.343Z
---
The repository composes release notes at release time from CHANGELOG (no changesets). Items the coordination stack adds, from the release-compatibility review:

* identity.agent_map is now honored: invalid values fail integration commands (tbd-tia7), valid values send delegateId on --push, which can start Linear Agent Sessions (tbd-80vz).
* Upgrade every clone: comment lineage protection (#279) only holds when the merging client is upgraded; a v0.8.1 merger still moves comments onto a replacement link.
* Mixed-version teams: `tbd setup --auto` rewrites the AGENTS.md block and skill files differently on old and new clients, and doctor reports the other version's block as stale.
* Changed strings: `tbd status` hint now `tbd setup --auto`; `integration comment` success message and help; unconfigured `integration status` example nests `target:`; adapter errors and the mapping warning say `identity.user_map` / `identity.agent_map` (visible in JSON sync warnings); prime --brief adds the `tbd start` claim step and a corrected Beads warning.
* Conflict counts in `tbd sync` can rise: a relink on one side plus an unrelated edit on the other now counts a namespace conflict.
  Also gate the release on the tbd sync attic decision (tbd-ajq2) and on tbd-od0z (main since #264 widens the Linear alternation).

Update 2026-09-14: tbd-ajq2 decided (sync always saves conflicts to the attic; attic documented as a recovery store), so the release notes describe attic recovery rather than a git-history caveat.

2026-09-14: Release 1 is stage B of the merge, release, and format upgrade map in the stability sprint plan (PR #277). Before tagging, in addition to the notes: tbd-od0z landed; tbd-ajq2 landed; pnpm qa:upgrade-package and pnpm release:verify pass; and because generated agent surfaces change, the packed candidate is validated in a fresh first-party downstream checkout (docs/development.md release step 4). User upgrade: npm install -g get-tbd@latest, then tbd setup --auto and commit the generated-surface diff; no format migration.

2026-09-14: the stack is on main. Add as release gates: tbd-s3zx (third-party extensions comments rewritten on merge, now reachable from main), tbd-apnu, tbd-cskr.

f08 compatibility review 2026-09-14 (see 'f08 Compatibility Contract for Sprint Fixes' in the stability sprint plan): release notes state 0.8.1 as the minimum for any clone that runs integration sync (0.7.x already drops base.slot and refinement\_\* on rewrite, and leaves resolution set on reopened beads), and state any further minimum that tbd-s4kb (T3) requires for the Backlog mapping.

## Notes

2026-09-15 release-readiness audit at main 7120d16f, 83 commits after v0.8.1. Closed after verified merges and green PR CI: tbd-yqq7 in #292, tbd-evn3 in #293, and tbd-80vz in #294. Remaining correctness gates: tbd-od0z is partial; tbd-s4kb mixed-version T3 is open; tbd-bdkj has not landed. Exact-main hosted CI run 35052496902 passed. pnpm release:verify passed. pnpm qa:upgrade-package passed all seven scenarios. pnpm audit --prod is clean and check:package-age passed 31 pins; full audit has 36 dev-only findings tracked by tbd-0am0. Local format, lint, typecheck, and build passed; the full Vitest run hit four load-sensitive bounds, and all four passed alone, tracked under tbd-2pqp, tbd-6p9s, and tbd-jzen. Candidate doctor now finds generated surfaces current after setup, but still reports actor-shaped assignees tbd-a273/tbd-f7vr and a Linear link on tbd-zy0f with no bridge record. Fresh first-party downstream package validation remains pending. Release metadata has not been started: package version is 0.8.1 and CHANGELOG has no candidate section. TODO.md and the stability sprint spec carry this snapshot. Open PRs #21, #174, and #253 are explicitly deferred. Version remains a decision: current delta supports patch 0.8.2 under docs/publishing.md, while the prior bead note said 0.9.0.

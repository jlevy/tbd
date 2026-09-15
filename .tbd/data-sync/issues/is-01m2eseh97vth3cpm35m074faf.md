---
type: is
id: is-01m2eseh97vth3cpm35m074faf
title: Release notes and release gate for the coordination stack
kind: task
status: open
priority: 1
version: 7
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies: []
parent_id: is-01m2erp0t0njvw8medbk3x70vz
created_at: 2026-09-14T01:45:31.686Z
updated_at: 2026-09-15T21:26:58.676Z
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

## Notes

2026-09-15 release-readiness review (main @ 1238038e, v0.8.1 + 66 commits).

Gate status: tbd-dmkd, tbd-0oz8, tbd-s3zx, tbd-w3tv closed earlier; tbd-ajq2, tbd-apnu, tbd-tia7, tbd-cskr and T1/T2/T4 (tbd-3dti, tbd-stdj, tbd-9fpp) closed 2026-09-15 with evidence from #287/#288. Still open: tbd-80vz (delegateId sent on every push, closed beads included; mirror.ts ~:292-294), tbd-od0z (partial), tbd-s4kb (T3, not started). New gates filed 2026-09-15 and wired as blockers: tbd-yqq7 (issues/.gitattributes never reaches existing repos) and tbd-evn3 (--push mirror sends status without slot and fights the reconciler after #290). Windows timeouts: tbd-jzen. Windows setup-test timeouts turned the #288 merge run red; watch the release-merge SHA.

Verdict: for users without a tracker configured, no blocker once the gitattributes gate lands. Linear users need the --push slot fix, T3 or a stated minimum version, and tbd-bdkj before the notes can claim #265 fixed.

Release process not started: packages/tbd/package.json still 0.8.1 and packages/tbd/CHANGELOG.md has no new section (verify-release-metadata.ts fails the tag without both); supply-chain review, qa:upgrade-package, release:verify, and the fresh downstream first-party checkout (generated surfaces changed: skill-baseline/brief/minimal, tbd-prime.md, ensure-gh-cli.sh) all pending. #268 bumped checkout v7.0.1, setup-node v7.0.0, pnpm/action-setup v6.0.10, action-gh-release v3.0.3; release.yml inputs are unchanged, but the OIDC publish step and gh-release v3 first run at the tag (npm publishes before the GitHub Release; recover with gh release create from extract-changelog.ts output). The plan calls for a minor (0.9.0).

Draft note inputs. Fixes: ready honors a future deferred_until, list --defer-before works, bare dates for --due/--defer (#264); guidelines grouped by category (#264); gh pinned to 2.97.0 with a version floor and stacked-PR support, PR shortcuts no longer hardcode --base main (#266); a failed backup aborts worktree repair, and a Beads import short-ID collision no longer overwrites an issue (#287); sync actually writes attic entries (#288); Linear pairs stop alternating for single-version teams (#290); js-yaml CVE-2026-84375 (#280); status hint now `tbd setup --auto`. Do not list s3zx (introduced and fixed inside this candidate). Guidance: agent-run-operations-rules guideline (#289), stacked-prs shortcut, tbd start claim step in prime and skill surfaces.

Behavior changes: agent_map is honored (a malformed map fails integration commands and doctor/status name the key; a valid map sends delegateId on every --push, which can start Linear Agent Sessions); the first run moves not-ready linked work from Todo to Backlog, future-deferred beads included; 0.8.1 is the minimum for clones running integration sync, plus whatever T3 establishes; sync writes attic entries, prints new summary strings, and exits nonzero when archiving fails; issues/.gitattributes merge=binary raises conflict counts once present; comment lineage protection needs the merging client upgraded (#279); mixed-version setup --auto churn on generated surfaces; sync --dry-run tracker notice; changed strings (integration comment "Comment queued on", target: nesting in the integration status example, agent_map messages); JSON changes additive only (conflictsNotArchived); format stays f08. Known issues to name if unfixed: tbd sync hides the tracker line unless verbose and lacks --yes (#276; workaround: tbd integration sync --yes); #267 pairs seeded by 0.8.1 stay stuck.

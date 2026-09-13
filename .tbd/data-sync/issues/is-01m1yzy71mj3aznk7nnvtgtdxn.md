---
type: is
id: is-01m1yzy71mj3aznk7nnvtgtdxn
title: "Close #238, #255, #195 and bead tbd-a0sl with citations to the fixes on main"
kind: task
status: open
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-5
dependencies: []
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-07T22:31:06.033Z
updated_at: 2026-09-13T23:17:38.639Z
---
Already fixed on main. #238: skill-baseline.md:148 'Where beads live: on the dedicated tbd-sync branch' (bead tbd-a0sl under the 2026-08-28 plan closes with it). #255: ensure-gh-cli.sh:264-270 states the ref-scoped broker consequence inline and skill-baseline.md:180 carries it; the optional doctor channel model is not planned because the egress test belongs in the session hook that already runs it. #195: decision rule at setup-github-cli.md:192, per-command prefix form at ensure-gh-cli.sh:258-259, and setup --auto rewrites ensure-gh-cli.sh on every run (setup.ts:1021). Comment on each issue with the lines, close.

Revision 2026-09-13 (plan review against main and PRs #278-#283): #195 acceptance criterion 4 (a fresh agent reaching working gh unaided) is still open, tracked by tbd-mslv; the closing comment should say so and cite tbd-mslv rather than 'fixed'. #238 residue: packages/tbd/.claude/skills/tbd/SKILL.md (committed, agent-loaded) does not mention tbd-sync. If PR #283 merges first, the skill-baseline.md citations move from :148/:180 to :154/:186.

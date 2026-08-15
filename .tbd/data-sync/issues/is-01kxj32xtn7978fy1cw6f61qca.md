---
type: is
id: is-01kxj32xtn7978fy1cw6f61qca
title: Reconcile legacy skill-guidance tracking and close delivered issues
kind: task
status: closed
priority: 2
version: 5
labels:
  - project-hygiene
  - agent-skills
dependencies: []
parent_id: is-01kxj30jgtpk96nys50nr6peve
created_at: 2026-07-15T05:13:11.252Z
updated_at: 2026-08-15T05:36:50.668Z
closed_at: 2026-08-15T05:36:50.668Z
close_reason: "Completed in merged PR #191; GitHub issues #161 and #190 were closed on merge and the full cross-platform validation passed."
---
Clean up overlapping tracking after the implementation and validation work is complete.

Acceptance criteria:
- Reconcile tbd-udka so its old guideline-alignment scope is closed as superseded or narrowed to genuinely remaining runtime alignment.
- Move implemented plan-2026-06-13-cli-skill-guideline-pprose-gaps.md from active to done and correct its status metadata.
- Merge still-relevant findings from plan-2026-06-03-tbd-agent-cli-guideline-improvements.md into the refreshed guidance or create explicit follow-up beads; do not leave ambiguous duplicate scope.
- Update the parent epic with final validation and disposition of every GitHub #190 acceptance criterion.
- Close GitHub #161 and #190 only after their delivered changes are linked and the independent dry-run bug is fixed or explicitly split into its own accepted GitHub issue.
- Run tbd sync and verify no untracked follow-up remains.

## Notes

Tracking cleanup is reconciled: June 3 and June 13 plans moved to done with final disposition; tbd-udka is closed as superseded; tbd-230y is the explicit non-blocking future cosmetic migration; tbd-o2xt tracks the retired npm audit endpoint. PR https://github.com/jlevy/tbd/pull/191 is ready and all GitHub Actions checks pass. It carries merge-time closure for GitHub #161/#190, so this bead remains in progress only until merge confirms delivery.

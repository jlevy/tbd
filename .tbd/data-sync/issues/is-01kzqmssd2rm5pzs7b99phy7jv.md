---
type: is
id: is-01kzqmssd2rm5pzs7b99phy7jv
title: "PR #206 review R1: legacy top-level linked beads read as unlinked"
kind: bug
status: closed
priority: 2
version: 2
labels: []
dependencies: []
parent_id: is-01kzqms8fz0d4dyfw4wsm8djfs
created_at: 2026-08-11T05:30:21.985Z
updated_at: 2026-08-11T05:37:34.286Z
closed_at: 2026-08-11T05:37:34.284Z
close_reason: "Rebutted with evidence: legacy shape never released; zero linked: entries on the sync branch; the only affected store (this repo, 78 beads) was migrated pre-revert. Doctor tripwire covers residual risk (Phase 2)."
---
Bugbot High, packages/tbd/src/integrations/core/link-store.ts:24-31. Claim: beads with a top-level linked entry from the pre-revert f07 schema lose the link on IssueSchema.parse and re-mirror as duplicates. Verified reality: zero beads on the sync branch carry linked: (grep of data-sync worktree), the f07 write path existed only on this unreleased branch for hours, and the one affected store (this repo, 78 beads) was migrated before the revert landed. Disposition: rebut.

---
type: is
id: is-01ktycs66v724378sxzb4sk8jm
title: "Review/F6: doctor blind to forks.yml corruption (fold into doctor fork checks bead 5xt0)"
kind: bug
status: open
priority: 3
version: 2
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels: []
dependencies: []
parent_id: is-01ktxg3eqj62dhphs6dnbb30jf
created_at: 2026-06-12T17:06:25.626Z
updated_at: 2026-06-12T17:45:59.502Z
---

## Notes

Deferred (Tier 3): doctor's fork-manifest awareness folds into the broader doctor fork-checks bead tbd-5xt0. Note: readForkManifest is already tolerant of a corrupt/partly-invalid forks.yml (drops bad entries with a warning, 6b4d266), so this is an added doctor *check*, not a crash risk. Tracked for the doctor-checks work, not this review pass.

---
type: is
id: is-01ktycs66v724378sxzb4sk8jm
title: "Review/F6: doctor blind to forks.yml corruption (fold into doctor fork checks bead 5xt0)"
kind: bug
status: closed
priority: 3
version: 3
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels: []
dependencies: []
parent_id: is-01ktxg3eqj62dhphs6dnbb30jf
created_at: 2026-06-12T17:06:25.626Z
updated_at: 2026-06-12T20:50:39.513Z
closed_at: 2026-06-12T20:50:39.513Z
close_reason: Folded into tbd-5xt0 (doctor fork checks) per its own title note; the forks.yml corruption check ships as part of that check set.
---
## Notes

Deferred (Tier 3): doctor's fork-manifest awareness folds into the broader doctor fork-checks bead tbd-5xt0. Note: readForkManifest is already tolerant of a corrupt/partly-invalid forks.yml (drops bad entries with a warning, 6b4d266), so this is an added doctor *check*, not a crash risk. Tracked for the doctor-checks work, not this review pass.

---
type: is
id: is-01m268ardk0e4wt49c5690pwga
title: Make equal-timestamp LWW resolution direction-independent
kind: bug
status: open
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies: []
parent_id: is-01m1w3g0smx3ezvwz4g8mkmjy9
created_at: 2026-09-10T18:12:26.674Z
updated_at: 2026-09-10T18:12:37.622Z
---
The merge audit found equal updated_at values choose whichever input the caller labels local; there is no content-hash or stable identity tie-break. Verify every caller's orientation and introduce a deterministic direction-independent tie-break if convergence can differ across replicas.

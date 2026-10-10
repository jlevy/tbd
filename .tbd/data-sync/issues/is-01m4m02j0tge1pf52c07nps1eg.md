---
type: is
id: is-01m4m02j0tge1pf52c07nps1eg
title: Allow close to clear a bead hold atomically
kind: bug
status: open
priority: 2
version: 1
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies: []
parent_id: is-01m1w3d1e63qg5e2wpz31qkmvn
created_at: 2026-10-10T22:48:55.065Z
updated_at: 2026-10-10T22:48:55.065Z
---
Observed with tbd 0.10.0: closing an otherwise completed held bead fails validation with 'hold: hold is only valid on work that is not closed'. The operator must first clear the hold, then close in a second mutation. Define and test safe close semantics for held work, preferably clearing the hold in the same locked mutation or returning a specific actionable remedy. Keep separate from collaborator-coordination guidance.

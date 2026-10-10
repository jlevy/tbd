---
type: is
id: is-01m4m02jecabtv1sfxkzt9etyd
title: Align bulk update --spec behavior with variadic CLI help
kind: bug
status: open
priority: 2
version: 1
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies: []
parent_id: is-01m1w3d1e63qg5e2wpz31qkmvn
created_at: 2026-10-10T22:48:55.499Z
updated_at: 2026-10-10T22:48:55.499Z
---
Observed with tbd 0.10.0: 'tbd update <multiple IDs> --spec PATH' is accepted by the variadic command/help shape but rejected at runtime because bulk shared fields exclude --spec. A large exact-path repair therefore requires sequential updates. Decide whether --spec is safely bulkable and implement it, or make the help/validation reject the combination before mutation with a clear explanation. The refused command made no mutation. Keep separate from collaborator-coordination guidance.

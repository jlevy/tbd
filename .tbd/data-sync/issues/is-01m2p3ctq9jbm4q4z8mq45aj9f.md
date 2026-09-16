---
type: is
id: is-01m2p3ctq9jbm4q4z8mq45aj9f
title: Make doctor --fix repair orphaned dependency references
kind: bug
status: open
priority: 2
version: 1
labels:
  - doctor
  - dependencies
dependencies: []
created_at: 2026-09-16T21:54:02.599Z
updated_at: 2026-09-16T21:54:02.599Z
---
The Dependencies diagnostic marks orphaned dependency references fixable and tells users to run tbd doctor --fix, but the dependency check does not receive the fix option and no code removes orphaned edges. Reproduce by writing a blocks edge to a missing issue, running tbd doctor to see [fixable], then running tbd doctor --fix and observing the same edge and finding remain. Either implement the advertised repair with regression coverage and user documentation or stop labeling the condition fixable and give an accurate manual remedy.

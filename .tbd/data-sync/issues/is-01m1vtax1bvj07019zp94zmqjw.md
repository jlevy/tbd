---
type: is
id: is-01m1vtax1bvj07019zp94zmqjw
title: Define concurrent relationship removal and post-merge graph validation
kind: task
status: open
priority: 2
version: 1
labels: []
dependencies: []
created_at: 2026-09-06T16:55:27.018Z
updated_at: 2026-09-06T16:55:27.018Z
---
Coordination review pure-source probes: base dependencies [A], local [], remote [A,B] merge to [A,B], resurrecting removal; removal survives when remote is unchanged. Separately merging A.parent=B and B.parent=A from parentless graph emits no merge conflicts; findHierarchyProblems detects cycle. No full two-clone graph test yet. Establish desired removal/conflict policy and validate graph invariants after sync; compare small metadata references with tombstoned edge records/observed-remove semantics before reusing current merge for new relationships. Do not select a general CRDT without evidence. Research: docs/project/research/current/research-2026-09-06-bead-agent-coordination.md.

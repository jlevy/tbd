---
type: is
id: is-01m2erpjrg6pwg8fjveft1s99f
title: "Merge #283 (dormant inventory and transitions; agent_map fix; docs reconciliation)"
kind: task
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies:
  - type: blocks
    target: is-01m2eseh97vth3cpm35m074faf
parent_id: is-01m2erp0t0njvw8medbk3x70vz
created_at: 2026-09-14T01:32:26.767Z
updated_at: 2026-09-14T01:46:01.449Z
---
Layer 4 of tbd-m88s. Branch codex/native-comment-inventory, restacked 2026-09-14 to 175eac50 (patch-identical to reviewed a48a4416). Final Astra verdict approved the additive dormant boundary at a48a4416. Reachable changes: identity.agent_map now reaches the Linear adapter (delegates push, which starts Linear Agent Sessions); generated AGENTS.md/prime/skill text; CLI message text; packaged docs rewrite.

2026-09-14 release-compatibility review: no format or read-path break; native-comment modules unreachable from bin, cli, and index. Follow-ups tracked: tbd-tia7 (invalid agent_map now fails), tbd-80vz (delegateId on every push), tbd-xzyh (status hint names a nonexistent command; pre-existing), tbd-af8w (comment delivery docs), and the docs attic claim under tbd-ajq2. Release notes in tbd-lz1q.

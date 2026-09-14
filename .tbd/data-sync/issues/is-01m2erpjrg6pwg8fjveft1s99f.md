---
type: is
id: is-01m2erpjrg6pwg8fjveft1s99f
title: "Merge #283 (dormant inventory and transitions; agent_map fix; docs reconciliation)"
kind: task
status: closed
priority: 1
version: 6
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies:
  - type: blocks
    target: is-01m2eseh97vth3cpm35m074faf
parent_id: is-01m2erp0t0njvw8medbk3x70vz
created_at: 2026-09-14T01:32:26.767Z
updated_at: 2026-09-14T02:42:25.472Z
closed_at: 2026-09-14T02:42:25.472Z
close_reason: "Merged to main with the coordination stack in 9753fad5 (PR #283 merge, 2026-09-14), after #278/#279/#282 landed in the same merge chain. CI was green at each layer's head before merge."
resolution: null
duplicate_of: null
---
Layer 4 of tbd-m88s. Branch codex/native-comment-inventory, restacked 2026-09-14 to 175eac50 (patch-identical to reviewed a48a4416). Final Astra verdict approved the additive dormant boundary at a48a4416. Reachable changes: identity.agent_map now reaches the Linear adapter (delegates push, which starts Linear Agent Sessions); generated AGENTS.md/prime/skill text; CLI message text; packaged docs rewrite.

2026-09-14 release-compatibility review: no format or read-path break; native-comment modules unreachable from bin, cli, and index. Follow-ups tracked: tbd-tia7 (invalid agent_map now fails), tbd-80vz (delegateId on every push), tbd-xzyh (status hint names a nonexistent command; pre-existing), tbd-af8w (comment delivery docs), and the docs attic claim under tbd-ajq2. Release notes in tbd-lz1q.

2026-09-14 status: restacked to 175eac50 (patch-identical to reviewed a48a4416), mergeable CLEAN, all seven checks green. Content ready; waits on #282. A docs commit recording the landing and compatibility follow-ups in the coordination plan exists locally (1a76bdfb on update/pr283-plan) and was not pushed: adding commits to this PR needs the owner's go-ahead.

Update 2026-09-14: the coordination-plan docs commit was pushed as 4a42a6ac (head of #283; base ecd2a682). PR descriptions for #278, #279, #282, #283 now open with a Current status section.

---
type: is
id: is-01m1vtb2rddhs388xtwkhabz5q
title: Run phase-gated cross-agent coordination and native-comment experiments
kind: task
status: open
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies: []
parent_id: is-01m1w39s0rrg0dp4p90cb4gg67
created_at: 2026-09-06T16:55:32.876Z
updated_at: 2026-09-09T02:39:55.309Z
---
Execute the experiment matrix in docs/project/research/current/research-2026-09-06-bead-agent-coordination.md at the release gates in the September 6 phased coordination plan. The requested plan proposes independent append-only records; compare them with the repaired embedded baseline before freezing the Phase 2 format. Preserve the remaining Git snapshot versus durable discovery, same-store versus independent-clone ownership, actual Claude/Codex continuation, and linked-only Linear direction/relink/backfill/disable cases. Agent Mail Rust v0.3.32 is a reference for inbox/idempotency contracts, not an assumed throughput equivalent. Capture session/bead/message IDs, destination delivery keys, Git tips, claim outcomes, checkpoints, latency, duplicate work, recovery, API/Git cost, and unrun cases. Initial source research is complete; candidate/host/load experiments are not. This issue does not itself activate an unattended deployment.

## Notes

Phase 2 format experiment started in tbd-e1tu. Compare a hash-sharded immutable one-file-per-comment model against the repaired embedded provider-comment baseline. Record collision/idempotency behavior, directory distribution, retry semantics, bounded read cost, Git diff size, and preservation failure injection before f09 is activated. Cross-host runtime and Linear cases remain open for later release gates.

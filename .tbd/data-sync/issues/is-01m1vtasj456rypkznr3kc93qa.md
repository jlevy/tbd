---
type: is
id: is-01m1vtasj456rypkznr3kc93qa
title: Distinguish simultaneous agents sharing a checkout before accepting an existing claim
kind: bug
status: open
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies: []
parent_id: is-01m1w3d1e63qg5e2wpz31qkmvn
created_at: 2026-09-06T16:55:23.459Z
updated_at: 2026-09-06T19:48:18.190Z
---
Disposable CLI probe: whoami --ensure-id in Claude environment followed by Codex environment in the same checkout returns identical stored agid and friendly name despite different harness labels. start compares delegate friendly name and can consider another live session already yours. Existing identity is checkout-scoped. Define durable agent versus session/invocation identity and preserve explicit --as/TBD_AGENT cooperative usage; test concurrent same/different harness instances and worktree scope. Coordinate with tbd-owa5/tbd-ppn1 runtime refs and tbd-c4zl instruction adoption. Do not infer that local repair gives independent-clone exclusivity. Research: docs/project/research/current/research-2026-09-06-bead-agent-coordination.md.

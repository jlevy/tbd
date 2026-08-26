---
type: is
id: is-01m0xm8na51f2q7fa5g198mcdz
title: Reconcile atomic-write rules across Rust and general filesystem guidance
kind: task
status: closed
priority: 2
version: 8
labels: []
dependencies:
  - type: blocks
    target: is-01m0xm8xxea50zg2tab8nfx92s
  - type: blocks
    target: is-01m0xm94j0raw4q1gcedr099ft
  - type: blocks
    target: is-01m0xm9ccj14d0pnbw7m9bkjet
  - type: blocks
    target: is-01m0xm9m2p48wy0tsss6akmcxe
  - type: blocks
    target: is-01m0xm9tc3ryqjh3xv2ad3eqhg
parent_id: is-01m0xm6ckrwa936ffezb6qsxmk
created_at: 2026-08-25T23:32:09.155Z
updated_at: 2026-08-26T00:33:07.989Z
closed_at: 2026-08-26T00:33:07.988Z
close_reason: Scoped atomic replacement to persistent authoritative paths and reconciled the general, Rust, Python, and TypeScript rules with append, exclusive-create, stream, and scratch contracts.
resolution: null
duplicate_of: null
---
Note in some other places you're recommending against always using atomic output files in Rust. Let's make sure that we're consistent across this too.

Audit the Rust-specific and language-neutral filesystem guidance together. State the specific rationale and the decision boundary rather than replacing one blanket rule with another; leave it up to the agent to decide when the principle applies.

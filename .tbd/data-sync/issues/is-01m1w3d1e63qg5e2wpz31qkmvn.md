---
type: is
id: is-01m1w3d1e63qg5e2wpz31qkmvn
title: "Coordination phase 1: stabilize existing sync, comments, and claims"
kind: epic
status: open
priority: 1
version: 10
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies:
  - type: blocks
    target: is-01m1w3g0smx3ezvwz4g8mkmjy9
parent_id: is-01m1w39s0rrg0dp4p90cb4gg67
child_order_hints:
  - is-01m1w45ztfgjxphk4w15eg8w9b
  - is-01m1vtafa87ktgfm55m897yhfy
  - is-01m1vtak4krbsf3yx1p9x9vewg
  - is-01m1vtap5bmx36expphmmyyh3j
  - is-01m1vtasj456rypkznr3kc93qa
  - is-01m1vtax1bvj07019zp94zmqjw
  - is-01m1vtazvgbmwf5q9fz9ayrjh0
created_at: 2026-09-06T19:33:54.245Z
updated_at: 2026-09-06T19:51:22.464Z
---
Release gate for existing-contract repairs: preserve concurrent comments in every recovery path; destination-stable Linear delivery; canonical alias/conflicting-content handling; distinct concurrent worker identities; opt-in atomic eligible-work claim with explicit outcome; startup/periodic readiness; graph removal and validation policy. Reuse September defect beads and existing instruction owners. Each fix may ship independently; the full gate closes only after all proofs. No native comment format or automatic background process is required.

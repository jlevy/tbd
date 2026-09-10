---
type: is
id: is-01m1w3g0smx3ezvwz4g8mkmjy9
title: "Coordination phase 2: native comments with complete manual Git exchange"
kind: epic
status: open
priority: 1
version: 8
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies:
  - type: blocks
    target: is-01m1w3g81f4j2dgmqexbvxb7rn
  - type: blocks
    target: is-01m1w3gbk8ne1p59cyy2bqda1z
parent_id: is-01m1w39s0rrg0dp4p90cb4gg67
child_order_hints:
  - is-01m220hjjpx5nv44za5c8jbp6a
  - is-01m220htdx8tv5k1mpjavfpsca
  - is-01m220j40yd8fcw9n3yf4412dv
  - is-01m22b72fpparmvxhj4q2938n7
  - is-01m24xt1pee8wg02a509z3g283
created_at: 2026-09-06T19:35:31.891Z
updated_at: 2026-09-10T05:49:18.925Z
---
Add independent append-only native comment records, stable identity and authorship, bounded CLI reads, comments-aware one-shot change reports, format/old-client gating, and every save/import/outbox/history-recovery path. Compare record candidates before freezing format. Existing Linear comments remain supported until explicit projection migration in phase 4.

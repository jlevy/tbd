---
type: is
id: is-01m0c5r461zmx3ctgsxq94s0bq
title: "Actor axis: delegate field and identity that resolves itself"
kind: epic
status: open
priority: 2
version: 6
spec_path: docs/project/specs/active/plan-2026-08-18-actor-axis-and-identity.md
assignee: josh
labels: []
dependencies: []
child_order_hints:
  - is-01m0c5rbazv8b7mdemyaqqh995
  - is-01m0c5rk9zcamj2r525dazj73w
  - is-01m0c5rsgkvdv8ad02eaq7109k
  - is-01m0c8v94j74sqaj35ts5xrjjf
created_at: 2026-08-19T04:51:21.920Z
updated_at: 2026-08-19T05:56:03.947Z
---
tbd has one actor field, so an agent cannot hold a bead without displacing the human accountable for it. Adds `delegate` beside `assignee` and replaces identity configuration with identity resolution: humans resolve against each tracker's own member directory and bind by provider user id, agents carry the agid-{ulid} identity tbd already mints and never publish except through an explicit agent_map.

Identity is per provider — a Linear UUID and a GitHub login are different identifiers — with the tbd handle as the join key and bindings under bridge/<provider>/users/.

Design discussion: https://github.com/jlevy/tbd/issues/246
Sibling: epic tbd-og20 (state axis, https://github.com/jlevy/tbd/issues/244)

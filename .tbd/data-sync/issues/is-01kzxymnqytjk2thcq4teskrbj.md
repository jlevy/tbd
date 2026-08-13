---
type: is
id: is-01kzxymnqytjk2thcq4teskrbj
title: Clear stale Linear status carrier labels on status transitions
kind: bug
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - linear
  - integration
dependencies: []
parent_id: is-01kzxy6mhd66ah3xr0960n34kf
created_at: 2026-08-13T16:17:46.749Z
updated_at: 2026-08-13T17:55:56.207Z
closed_at: 2026-08-13T17:55:56.206Z
close_reason: Linear status transitions now replace only tbd-owned blocked/deferred carrier labels while preserving human labels; adapter regressions and the full integration suite pass.
---
Changing a local bead from blocked/deferred to a status without a carrier can leave tbd:blocked or tbd:deferred on the Linear item because toInput only writes labelIds when the target adds a carrier or labels are otherwise patched. Preserve unrelated labels while replacing both tbd-owned carrier labels deterministically and test blocked/deferred transitions.

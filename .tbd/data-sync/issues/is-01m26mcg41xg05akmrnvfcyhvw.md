---
type: is
id: is-01m26mcg41xg05akmrnvfcyhvw
title: "PR #283 review ASTRA-283-01: index invalid entries once per transition classification"
kind: bug
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies: []
parent_id: is-01m26mca0pcvxgstk7bhct6sx1
created_at: 2026-09-10T21:43:06.624Z
updated_at: 2026-09-10T21:56:27.551Z
closed_at: 2026-09-10T21:56:27.550Z
close_reason: Fixed ASTRA-283-01 by building one per-invocation invalid-entry index per source inventory, keyed under both filename and embedded IDs without duplicate claims. Added a structural regression proving one full traversal per inventory and a 50,000-record repository benchmark. The exact reviewer workload fell from 32,954 ms to 115 ms locally. Focused native-comment/integration tests passed 306 with one platform skip; full CI passed 171 files and 2,592 tests with one skip; format, typecheck, ESLint, build, publint, and diff checks passed.
resolution: null
duplicate_of: null
---
Astra P2 at https://github.com/jlevy/tbd/pull/283#issuecomment-5625831806: packages/tbd/src/file/native-comment-transition.ts:224-232 rebuilds and filters every inventory entry for every comment ID, making clean classification quadratic under the accepted 100,000-entry ceiling. Build a per-invocation invalid-entry lookup indexed under both filename and embedded IDs, preserving dual-claim semantics without duplicates; add a regression proving invalid-entry scans are not repeated per identity and record representative benchmark evidence. Also append the scale evidence to tbd-z3ag before f09 activation.

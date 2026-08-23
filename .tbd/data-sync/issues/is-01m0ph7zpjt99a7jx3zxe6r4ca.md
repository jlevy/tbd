---
type: is
id: is-01m0ph7zpjt99a7jx3zxe6r4ca
title: Add a test for guideline group assignment
kind: task
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-08-23-rust-quality-floor-and-guideline-mapping.md
labels: []
dependencies: []
parent_id: is-01m0ph6ehhhryj0z52a1c3b3rv
created_at: 2026-08-23T05:24:40.274Z
updated_at: 2026-08-23T05:39:03.546Z
closed_at: 2026-08-23T05:39:03.546Z
close_reason: "Fixed in 03fb8ef: explicit name set replaces the substring matches, Rust and Cross-cutting groups added, guidelineGroupFor exported and covered by packages/tbd/tests/guideline-groups.test.ts (5 tests). Verified no drift in generated agent surfaces."
resolution: null
duplicate_of: null
---
Nothing asserts that a guideline lands in its intended GUIDELINE_GROUPS heading, which is why the testing misrouting is invisible today. Add a test covering the general, per-language, and catch-all cases, including a rust-testing-rules style name.

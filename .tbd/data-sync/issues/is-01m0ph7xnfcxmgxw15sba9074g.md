---
type: is
id: is-01m0ph7xnfcxmgxw15sba9074g
title: Guideline groups misroute language-specific testing rules
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-23-rust-quality-floor-and-guideline-mapping.md
labels: []
dependencies:
  - type: blocks
    target: is-01m0ph9p5f90bmf150tbc7n2x6
parent_id: is-01m0ph6ehhhryj0z52a1c3b3rv
created_at: 2026-08-23T05:24:38.191Z
updated_at: 2026-08-23T05:39:03.540Z
closed_at: 2026-08-23T05:39:03.540Z
close_reason: "Fixed in 03fb8ef: explicit name set replaces the substring matches, Rust and Cross-cutting groups added, guidelineGroupFor exported and covered by packages/tbd/tests/guideline-groups.test.ts (5 tests). Verified no drift in generated agent surfaces."
resolution: null
duplicate_of: null
---
packages/tbd/src/file/doc-cache.ts assigns each guideline to the first GUIDELINE_GROUPS entry whose match returns true, matching on the guideline name rather than its category frontmatter. The General engineering group is checked first and matches n.includes('testing'), so a rust-testing-rules document would land in the group whose note reads 'Read all of these for any engineering work' and be served to Python and TypeScript sessions. The same pattern catches any future <lang>-testing-rules. Add a Rust group ordered ahead of General engineering, and tighten the testing match so it cannot capture a language-prefixed name.

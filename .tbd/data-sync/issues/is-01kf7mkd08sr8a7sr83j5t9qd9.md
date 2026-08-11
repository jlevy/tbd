---
type: is
id: is-01kf7mkd08sr8a7sr83j5t9qd9
title: "Spec: CLI Output Design System"
kind: epic
status: open
priority: 2
version: 16
spec_path: docs/project/specs/active/plan-2026-01-17-cli-output-design-system.md
labels: []
dependencies: []
created_at: 2026-01-18T04:07:52.583Z
updated_at: 2026-08-11T07:07:02.157Z
extensions:
  linear:
    id: 337fd396-bb4e-45fe-8af1-97335d619e77
    key: TBD-60
    url: https://linear.app/finterm-ai/issue/TBD-60/spec-cli-output-design-system
    linked_at: 2026-08-10T19:36:13.703Z
    comments:
      - id: bbeb755a-5540-40ef-8bb0-9ddba8add1aa
        at: 2026-08-11T07:07:02.014Z
        author: josh
        body: |-
          **tbd sync conflict**

          Field `description` on `tbd-pt3v` diverged and one value was discarded.

          - Kept: `"sha256v2:e93c44830631674ef3deccbf67ad839b7ba65039573b32ce2cea9b36b2673270"`
          - Discarded: `"sha256v2:0272e3ca7e028d987b3e62848e32404b0e7755cba917d09a46ca2c4ffc836b0a"`

          The discarded value is archived at `.tbd/data-sync/attic/conflicts/is-01kf7mkd08sr8a7sr83j5t9qd9`.
          Resolve this comment once the divergence has been reconciled.
---
Systematically review and standardize all CLI output across tbd. Establish a universal CLI design system that ensures consistent output structure, formatting, colors, and conventions across all commands and output modes.

Reference: docs/project/specs/active/plan-2026-01-17-cli-output-design-system.md

Goals:
1. Document all output categories and when each should be used
2. Standardize color semantics across all output types
3. Define verbose vs debug mode boundaries clearly
4. Establish formatting conventions for tables, lists, IDs, etc.
5. Create guidelines for error messages, success messages, and progress
6. Review existing commands for compliance and fix inconsistencies

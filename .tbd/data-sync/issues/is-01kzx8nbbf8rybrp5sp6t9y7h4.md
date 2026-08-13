---
type: is
id: is-01kzx8nbbf8rybrp5sp6t9y7h4
title: Add shared external-link query and conditional facet semantics
kind: task
status: open
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - web
  - integration
dependencies:
  - type: blocks
    target: is-01kzx8ncczb69sp1bgyk20pyt5
parent_id: is-01kzx8mkeyergsd0hmq8zj1zd7
created_at: 2026-08-13T09:53:40.206Z
updated_at: 2026-08-13T15:59:38.808Z
extensions:
  linear:
    id: 114dc6cf-4e88-45b1-9ec1-193123311384
    linked_at: 2026-08-13T15:59:38.808Z
---
Extend lib/issue-query.ts IssueQuery, defaultIssueQuery(), filterIssues(), and describeQuery() with linked=any|linear|github|none; add cli/commands/list.ts --linked so every browser filter has an honest equivalent command. In cli/web/board.ts parseBoardQuery() and BoardState.buildBoardResponse(), compute an External chooser with All, Linked, Linear, GitHub, and Unlinked options. Counts must be conditional on every other active filter, zero-count unselected options hidden, selected options retained, and the selected All label must omit a redundant tally. TDD in issue-query.test.ts, list CLI tests, web-board.test.ts, and web-core.test.ts.

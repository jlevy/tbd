---
type: is
id: is-01m2rwdjyc4rsmdjpep232dzeh
title: "PR #310 A3: tests snapshot temp setup output not committed repo files"
kind: bug
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
delegate: unknown@cursor
labels: []
dependencies: []
parent_id: is-01m2rwa0a8t56qkzsdv3ky8gff
hold: null
hold_until: null
created_at: 2026-09-17T23:49:50.668Z
updated_at: 2026-09-18T00:03:42.094Z
started_at: 2026-09-17T23:50:56.553Z
closed_at: 2026-09-18T00:03:42.094Z
close_reason: "fixed in f21167349284c5ccf16f2722c6660c17b365f2c7: A1 golden updated and tryscript passed; A2 generator bytes in .claude/agents/tbd-*.md and tbd doctor current; A3 committed-file test plus lefthook/CI format-md path alignment."
resolution: null
duplicate_of: null
---
Medium. packages/tbd/tests/setup-tier-agents.test.ts snapshots temp setup output, not committed repo files. CI format-md excludes .claude/*; pre-commit hook still flowmarks .claude/agents/**. Review A: https://github.com/jlevy/tbd/pull/310#issuecomment-5722767108. Fix: test that each committed tbd-* file equals renderTierAgentDefinition (or the canonical formatted form). Align hook and CI path sets.

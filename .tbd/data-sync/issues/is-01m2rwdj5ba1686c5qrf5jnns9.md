---
type: is
id: is-01m2rwdj5ba1686c5qrf5jnns9
title: "PR #310 A1: stale agent-model-tiers size golden in cli-doc-output.tryscript.md"
kind: bug
status: closed
priority: 0
version: 3
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
delegate: unknown@cursor
labels: []
dependencies: []
parent_id: is-01m2rwa0a8t56qkzsdv3ky8gff
hold: null
hold_until: null
created_at: 2026-09-17T23:49:49.867Z
updated_at: 2026-09-18T00:03:42.086Z
started_at: 2026-09-17T23:50:56.542Z
closed_at: 2026-09-18T00:03:42.086Z
close_reason: "fixed in f21167349284c5ccf16f2722c6660c17b365f2c7: A1 golden updated and tryscript passed; A2 generator bytes in .claude/agents/tbd-*.md and tbd doctor current; A3 committed-file test plus lefthook/CI format-md path alignment."
resolution: null
duplicate_of: null
---
Blocker. packages/tbd/tests/cli-doc-output.tryscript.md:44. Coverage & Lint fails: golden still says agent-model-tiers (5.65 kB, ~1.6k tok), CI got 7.96 kB, ~2.3k tok. Review A: https://github.com/jlevy/tbd/pull/310#issuecomment-5722767108. Fix: update the golden and re-run pnpm --filter get-tbd exec tryscript run tests/cli-doc-output.tryscript.md.

---
type: is
id: is-01m2rwdjgzrasd8388jm6x9ykx
title: "PR #310 A2: committed .claude/agents/tbd-*.md wrap differs from generator"
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
created_at: 2026-09-17T23:49:50.239Z
updated_at: 2026-09-18T00:03:42.091Z
started_at: 2026-09-17T23:50:56.549Z
closed_at: 2026-09-18T00:03:42.091Z
close_reason: "fixed in f21167349284c5ccf16f2722c6660c17b365f2c7: A1 golden updated and tryscript passed; A2 generator bytes in .claude/agents/tbd-*.md and tbd doctor current; A3 committed-file test plus lefthook/CI format-md path alignment."
resolution: null
duplicate_of: null
---
Medium. .claude/agents/tbd-*.md vs tierAgentBody in packages/tbd/src/cli/commands/setup.ts:927-935. inspectManagedArtifact is byte-for-byte; doctor reports stale. Codex files and vitest snapshots match the generator. Same as unmarked Bugbot inline https://github.com/jlevy/tbd/pull/310#discussion_r4041888813 — do not treat as a second finding. Review A: https://github.com/jlevy/tbd/pull/310#issuecomment-5722767108. Fix: write generator bytes (or generate then flowmark and make the generator emit that canonical form). Prove tbd doctor is clean on those four files.

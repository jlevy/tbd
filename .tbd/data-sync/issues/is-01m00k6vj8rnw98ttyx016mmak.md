---
type: is
id: is-01m00k6vj8rnw98ttyx016mmak
title: Research/spec shortcuts should create the tracking bead first, not last
kind: task
status: open
priority: 2
version: 5
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - traceability
  - phase-3
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-14T16:55:42.919Z
updated_at: 2026-08-16T00:10:47.236Z
extensions:
  linear:
    id: 28755771-99c4-4a23-9e38-b36be27978dd
    linked_at: 2026-08-16T00:10:47.236Z
---
Worked example, from this brief: the research doc was written first, an epic was created afterwards to track it, 24 children were filed under that epic — and spec_path was set on NONE of them until the traceability section went looking and found the linkage missing. Nothing in tbd prime, the skill tiers, new-research-brief, or AGENTS.md asks for it. new-research-brief says to create the document and update it as you learn; it never mentions a bead.

What the shortcut should say:
1. Bead first — create the tracking epic when the research STARTS, titled for the question, spec_path pointed at the doc that is about to exist.
2. Sync immediately, so the epic shows in Linear as Started while the work is under way rather than as a fait accompli.
3. File children as findings turn into work; they inherit spec_path automatically.
4. Attach the PR when it opens, and the GitHub issue if one exists.
5. Attach the plan spec to the same epic when research turns into a plan, so one bead carries the whole arc: question -> findings -> plan -> implementation.

Same edit belongs in new-architecture-doc and new-plan-spec.

Research: research-2026-08-14-agent-sync-protocol-and-hooks.md §5.4, E9

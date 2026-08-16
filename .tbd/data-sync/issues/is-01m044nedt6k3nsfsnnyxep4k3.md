---
type: is
id: is-01m044nedt6k3nsfsnnyxep4k3
title: Managed block embeds the current git branch, so spec links break after merge
kind: bug
status: in_progress
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-3
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-16T01:58:30.073Z
updated_at: 2026-08-16T02:10:12.617Z
extensions:
  linear:
    id: d998d291-f161-4713-9d55-e1ae03e17c4f
    linked_at: 2026-08-16T02:10:12.617Z
---
The managed block renders the spec permalink against whichever branch the sync ran from: `blob/claude/linear-sync-agent-hooks-vqatny/docs/...`. Two consequences, both real as of 2026-08-15:

1. Syncing the same beads from a different branch rewrites every managed block, because the rendered link differs. A full-mirror write triggered purely by which branch an agent happened to be on.
2. Once the branch is deleted after the PR merges, every one of those links 404s. This repository has 205 mirrored issues carrying them right now.

The permalink should resolve against a stable ref (the default branch, or the merge commit) rather than the working branch. See resolveSpecLinks in src/cli/lib/integration-runner.ts and renderManagedBlock in src/integrations/core/managed-block.ts.

Largest remaining source of avoidable Linear writes.

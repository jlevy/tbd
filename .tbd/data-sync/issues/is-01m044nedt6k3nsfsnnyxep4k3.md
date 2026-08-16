---
type: is
id: is-01m044nedt6k3nsfsnnyxep4k3
title: Managed block embeds the current git branch, so spec links break after merge
kind: bug
status: closed
priority: 1
version: 5
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-3
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-16T01:58:30.073Z
updated_at: 2026-08-16T02:26:42.146Z
closed_at: 2026-08-16T02:26:42.146Z
close_reason: "Spec permalinks now resolve against the durable trunk first (origin/main, then main), with the working branch only as a fallback for a spec that exists nowhere else. Verified live: 75 of the mirrored issues flipped from a feature-branch URL to a main URL and the mirror settled clean afterwards. The remaining 42 are specs that only exist on this branch; they move to main on the first sync after merge, which is the designed fallback. Regression test integrations-permalink-branch.test.ts exercises resolveSpecLinks end to end and fails with the old ordering."
extensions:
  linear:
    id: d998d291-f161-4713-9d55-e1ae03e17c4f
    linked_at: 2026-08-16T02:11:47.227Z
---
The managed block renders the spec permalink against whichever branch the sync ran from: `blob/claude/linear-sync-agent-hooks-vqatny/docs/...`. Two consequences, both real as of 2026-08-15:

1. Syncing the same beads from a different branch rewrites every managed block, because the rendered link differs. A full-mirror write triggered purely by which branch an agent happened to be on.
2. Once the branch is deleted after the PR merges, every one of those links 404s. This repository has 205 mirrored issues carrying them right now.

The permalink should resolve against a stable ref (the default branch, or the merge commit) rather than the working branch. See resolveSpecLinks in src/cli/lib/integration-runner.ts and renderManagedBlock in src/integrations/core/managed-block.ts.

Largest remaining source of avoidable Linear writes.

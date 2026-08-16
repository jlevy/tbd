---
type: is
id: is-01kzyh2066kdr5yymjef2k6nsx
title: repoUrl is threaded through the mirror but never supplied
kind: task
status: open
priority: 4
version: 7
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies: []
parent_id: is-01kzn2w85qxpbp8cqtn7mkbvkg
created_at: 2026-08-13T21:39:37.797Z
updated_at: 2026-08-16T00:13:23.656Z
extensions:
  linear:
    id: b16a6190-5337-462b-8bb0-afbfad7651ea
    linked_at: 2026-08-16T00:13:23.656Z
---
mirrorExtrasFor (sync-engine.ts:527) always passes repoUrl: undefined, and MirrorContext.repoUrl is never supplied by integration-runner.ts. Both renderManagedBlock and attachmentsFor branch on it, so the 'Bead: [id](url)' line and the bead-source attachment are unreachable in practice. Either wire a real permalink (core/permalink.ts already builds blob URLs) or delete the branches.

## Notes

Deferred from PR #212: wiring or deleting repoUrl is independent permalink/dead-path cleanup and should not expand the marker-migration patch.

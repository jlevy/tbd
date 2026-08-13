---
type: is
id: is-01kzyh2066kdr5yymjef2k6nsx
title: repoUrl is threaded through the mirror but never supplied
kind: task
status: open
priority: 4
version: 1
labels: []
dependencies: []
created_at: 2026-08-13T21:39:37.797Z
updated_at: 2026-08-13T21:39:37.797Z
---
mirrorExtrasFor (sync-engine.ts:527) always passes repoUrl: undefined, and MirrorContext.repoUrl is never supplied by integration-runner.ts. Both renderManagedBlock and attachmentsFor branch on it, so the 'Bead: [id](url)' line and the bead-source attachment are unreachable in practice. Either wire a real permalink (core/permalink.ts already builds blob URLs) or delete the branches.

---
type: is
id: is-01m7khcyvzmqkg2t38d052k5zx
title: "PR #332 D2: Decide whether to bump the integration format so an older same-format tbd cannot undo the hook hardening"
kind: task
status: open
priority: 2
version: 1
labels: []
dependencies: []
created_at: 2026-11-17T01:19:32.735Z
updated_at: 2026-11-17T01:19:32.735Z
---
Review D (Medium), owner decision. AGENT_INTEGRATION_FORMAT stays f100 (packages/tbd/src/lib/integration-paths.ts:53); an older f100 tbd rewrites the four hook scripts to the old bodies and appends its legacy Codex commands beside the wrappers. Options: bump to f101 per docs/tbd-format-versioning.md (weigh with D3), or keep f100 and state the mixed-version loss in the changelog. Review: https://github.com/jlevy/tbd/pull/332#pullrequestreview-5930928560

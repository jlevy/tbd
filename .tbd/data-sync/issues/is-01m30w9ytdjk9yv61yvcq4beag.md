---
type: is
id: is-01m30w9ytdjk9yv61yvcq4beag
title: "PR #310: Coverage & Lint golden drift after F6 (8.52→8.56 kB)"
kind: bug
status: in_progress
priority: 0
version: 2
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
delegate: unknown@cursor
labels: []
dependencies: []
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
hold: null
hold_until: null
created_at: 2026-09-21T02:21:47.212Z
updated_at: 2026-09-21T02:21:52.171Z
started_at: 2026-09-21T02:21:52.171Z
---
Coverage & Lint failed on ef794435 (PR #310). format:check, lint:check, typecheck, and vitest all passed. tryscript cli-doc-output.tryscript.md: Guidelines --list produces clean output expected agent-model-tiers (8.52 kB, ~2.4k tok) but got (8.56 kB, ~2.4k tok). Cause: Review F6 docs commit grew packages/tbd/docs/guidelines/agent-model-tiers.md without updating the size golden. Same class as closed tbd-7bvg. Last green head 38519193 (7/7).

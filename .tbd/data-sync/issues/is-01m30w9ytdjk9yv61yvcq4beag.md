---
type: is
id: is-01m30w9ytdjk9yv61yvcq4beag
title: "PR #310: Coverage & Lint golden drift after F6 (8.52→8.56 kB)"
kind: bug
status: closed
priority: 0
version: 3
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
delegate: unknown@cursor
labels: []
dependencies: []
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
hold: null
hold_until: null
created_at: 2026-09-21T02:21:47.212Z
updated_at: 2026-09-21T02:35:48.309Z
started_at: 2026-09-21T02:21:52.171Z
closed_at: 2026-09-21T02:35:48.309Z
close_reason: "Coverage & Lint golden drift fixed in 4d80424c: agent-model-tiers --list size 8.52→8.56 kB. format/lint/typecheck were already green. CI 7/7 on that SHA. Parallel local fix faa13584 was the same hunk and was not pushed."
resolution: null
duplicate_of: null
---
Coverage & Lint failed on ef794435 (PR #310). format:check, lint:check, typecheck, and vitest all passed. tryscript cli-doc-output.tryscript.md: Guidelines --list produces clean output expected agent-model-tiers (8.52 kB, ~2.4k tok) but got (8.56 kB, ~2.4k tok). Cause: Review F6 docs commit grew packages/tbd/docs/guidelines/agent-model-tiers.md without updating the size golden. Same class as closed tbd-7bvg. Last green head 38519193 (7/7).

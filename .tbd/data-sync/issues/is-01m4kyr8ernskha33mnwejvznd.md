---
type: is
id: is-01m4kyr8ernskha33mnwejvznd
title: Add opt-in coordination guidance and explicit claim-conflict handling
kind: task
status: in_progress
priority: 1
version: 7
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
delegate: codex-pr324-ci-01a127df
labels: []
dependencies: []
parent_id: is-01m1w3d1e63qg5e2wpz31qkmvn
child_order_hints:
  - is-01m4madt9jmnbg4npfwpyge98r
  - is-01m4manp9y8srxqpyce3sbq1xe
hold: null
hold_until: null
created_at: 2026-10-10T22:25:49.004Z
updated_at: 2026-10-11T01:54:07.805Z
started_at: 2026-10-10T22:26:03.414Z
---
Add a lightweight, optional coordination shortcut or guideline for projects with multiple collaborators. Clarify that tbd start claims are advisory, that skipped claims must be checked explicitly, and that same-clone and cross-clone behavior differ. Add minimal routes from the baseline skill, delegation, and handoff guidance. Preserve lightweight use: do not require beads, sync, or network access for every session, read, or trivial task. Do not add a distributed lease. Assess released CLI compatibility before changing start exit behavior; prefer structured explicit outcomes and documentation unless a narrowly compatible runtime improvement is proven. Coordinate scope with tbd-6nmq and tbd-zxg6 rather than duplicating their identity and worker-loop implementation.

## Notes

Delivered proposal in https://github.com/jlevy/tbd/pull/324 from codex/coordination-guidance (79c77e30, 2e7a5f31, b1f34739): opt-in coordinate-collaborators shortcut; structured single-bead claim conflict checks without exit-code change; distinct identity and same-clone/cross-clone limits; checkpoint, takeover, and handoff acknowledgement guidance; minimal baseline/prime/delegation/handoff routes; actor-axis contract test; generated inventories and installed skills refreshed. Local focused validation passed (23 tests, dedicated installed-skill drift, and doc-references 2/2); broad pre-push run reached 3027 passes and 3 skips with only a transient 10-second doc-reference setup timeout, then that suite passed alone in 43.5 seconds. PR CI platform tests all passed (Ubuntu Node 22, Ubuntu Node 24, macOS Node 24, Windows Node 24); Benchmark and DeepSource passed. Coverage & Lint remains failed before branch lint/coverage because pnpm audit --prod finds newly published GHSA-hp3w-g68c-fv3c through the unchanged gray-matter/js-yaml/argparse/sprintf-js lock chain. No patched sprintf-js release or supported within-range lock-only fix exists; no suppression or unsupported major override applied. Separate dependency tbd-tfyc owns remediation. Keep this contribution bead open until the dependency is resolved and the proposal is accepted; PR was not merged.

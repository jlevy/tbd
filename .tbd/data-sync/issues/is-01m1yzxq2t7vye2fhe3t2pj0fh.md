---
type: is
id: is-01m1yzxq2t7vye2fhe3t2pj0fh
title: "list --specs: location markers on group headers; --specs --json emits groups"
kind: task
status: open
priority: 3
version: 2
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-2
dependencies: []
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-07T22:30:49.680Z
updated_at: 2026-09-07T22:31:42.536Z
---
GH #271. renderGroupedBySpec (list.ts:145-189) keys groups on the exact stored string and lives only in the text formatter, so --specs --json silently emits the flat array (list.ts:108-112) and a stale path shows no marker. Add the resolver's class to non-present group headers ('(moved -> done/...)', '(on branch x)', '(missing)') and emit groups under --json. Zero-bead spec files are spec status's job. Update tests/cli-list-specs.tryscript.md and tests/specs-flag.test.ts.

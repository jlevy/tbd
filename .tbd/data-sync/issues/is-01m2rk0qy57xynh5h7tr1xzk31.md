---
type: is
id: is-01m2rk0qy57xynh5h7tr1xzk31
title: "PR #307 A1: doctor --fix deletes edges into present-but-invalid issue files"
kind: bug
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
delegate: claude-code@spud10.local
labels: []
dependencies: []
parent_id: is-01m2rk07a26hew8fzbz8njv6r4
hold: null
hold_until: null
created_at: 2026-09-17T21:05:32.612Z
updated_at: 2026-09-17T21:47:08.299Z
started_at: 2026-09-17T21:46:46.217Z
closed_at: 2026-09-17T21:47:08.298Z
close_reason: "fixed in 16df8995: liveness is the union of the ids the store holds as files and the ids that parse, so an edge into a present-but-invalid target is kept; the diagnostic reports it as 'target file present but invalid' and does not mark it fixable. Confirmed by 'keeps an edge whose target file is present but does not parse' in packages/tbd/tests/doctor-orphaned-dependencies.test.ts (fails before, passes after)."
resolution: null
duplicate_of: null
---
Blocker. packages/tbd/src/cli/commands/doctor.ts:1015-1021 (repair) and :995-1003 (diagnostic). listIssues(..., { warnOnInvalid: false }) drops unparseable files, so a target whose file exists but does not parse (conflict markers, newer format) is treated as deleted and its inbound edges are removed. Fix: treat file presence as liveness, mirror in the diagnostic, regression test, update docs/tbd-docs.md. Review A: https://github.com/jlevy/tbd/pull/307#pullrequestreview-5238514945

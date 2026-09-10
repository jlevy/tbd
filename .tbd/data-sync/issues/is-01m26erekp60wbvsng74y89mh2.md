---
type: is
id: is-01m26erekp60wbvsng74y89mh2
title: Correct doctor workflow-state verification guidance
kind: bug
status: closed
priority: 3
version: 3
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
delegate: codex@spud10.local
labels: []
dependencies: []
parent_id: is-01m262ajn3ttv71mxamxce3ykf
hold: null
hold_until: null
created_at: 2026-09-10T20:04:46.837Z
updated_at: 2026-09-10T20:20:03.485Z
started_at: 2026-09-10T20:05:03.926Z
closed_at: 2026-09-10T20:20:03.485Z
close_reason: Reconciled implementation and documentation, validated links and formatting, passed lint/build/publint/golden tests, and passed focused tests; the single full-suite load timeout passed in isolation.
resolution: null
duplicate_of: null
---
packages/tbd/src/cli/commands/doctor.ts says tbd integration status reports live workflow-state bindings, but the status probe only verifies viewer, organization, and target team. Correct the source guidance to name the actual live verification surface and cover it with an existing or focused test if output changes.

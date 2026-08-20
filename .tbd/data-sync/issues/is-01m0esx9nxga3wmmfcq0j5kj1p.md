---
type: is
id: is-01m0esx9nxga3wmmfcq0j5kj1p
title: Invariant violations surface as raw Zod dumps in the CLI
kind: bug
status: closed
priority: 3
version: 3
spec_path: docs/project/specs/active/plan-2026-08-18-tracker-state-model-and-linear-mapping.md
delegate: claude-code@spud10
labels: []
dependencies: []
parent_id: is-01m0ermjzgy620e6gx9mtp7z9d
hold: null
hold_until: null
created_at: 2026-08-20T05:22:11.772Z
updated_at: 2026-08-20T05:37:42.008Z
started_at: 2026-08-20T05:36:11.767Z
closed_at: 2026-08-20T05:37:42.007Z
close_reason: "Fixed: writeIssue formats ZodError through the existing formatZodError instead of letting the raw issue array reach the CLI. 'tbd update <id> --hold blocked' on a closed bead now prints 'hold: hold is only valid on work that is not closed' as one line. Test added."
resolution: null
duplicate_of: null
---
Observed while dogfooding: 'tbd update <id> --hold blocked' on a closed bead prints 'Error: Failed to update issue: [' followed by the raw Zod issue array. The refusal is correct and the message inside it is good ('hold is only valid on work that is not closed'), but it is buried in JSON. The new superRefine invariants make this path reachable from ordinary CLI use, so it is worth formatting.

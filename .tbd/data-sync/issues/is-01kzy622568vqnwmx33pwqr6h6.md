---
type: is
id: is-01kzy622568vqnwmx33pwqr6h6
title: "PR #206 R15: require project scope in live Linear release gate"
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - linear
  - review
  - qa
dependencies: []
parent_id: is-01kzx8jw39zc4dpgx6w82rg3dm
created_at: 2026-08-13T18:27:25.477Z
updated_at: 2026-08-13T18:36:22.950Z
closed_at: 2026-08-13T18:36:22.949Z
close_reason: "Fixed: the Linear release gate cannot report project-scope success without an explicit tested project; regression and live/full QA are green."
---
Bugbot thread PRRT_kwDOQ109P86ZCkFu at packages/tbd/scripts/validate-linear-integration-live.ts:656-660. A run without --project returns early from automatic-inbound-scope but records it complete. Make project scope required for this Linear release gate, add import-safe argument validation proof, and keep docs/usage consistent.

## Notes

Fixed by extracting import-safe live-QA option parsing, requiring both --team and --project, normalizing argv, and removing the automatic-inbound-scope early success path. TDD covers missing-project rejection and normalized valid arguments. Live project-scoped QA passed all 11 scenarios; full gate passed 134 files / 1,966 tests.

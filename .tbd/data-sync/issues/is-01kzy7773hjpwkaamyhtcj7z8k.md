---
type: is
id: is-01kzy7773hjpwkaamyhtcj7z8k
title: "PR #206 R16: preserve assignee divergence during unmapped remote freeze"
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - linear
  - review
dependencies: []
parent_id: is-01kzx8jw39zc4dpgx6w82rg3dm
created_at: 2026-08-13T18:47:42.960Z
updated_at: 2026-08-13T18:52:53.711Z
closed_at: 2026-08-13T18:52:53.710Z
close_reason: "Fixed: unmapped remote assignee freezes preserve the prior bridge base, so local edits remain divergent and recover correctly when mapping resumes."
---
Bugbot thread PRRT_kwDOQ109P86ZC8vo at core/reconcile.ts and sync-engine.ts. When provider assignee is unmapped, skipping reconcile leaves merged.assignee seeded from local and advances bridge base, absorbing local edits that were never pushed. Preserve the prior canonical bridge-base assignee while frozen, retain the live local value, write no provider identity, and prove the later mapped reconciliation still sees the local divergence.

## Notes

Fixed with TDD: an unmapped provider assignee now freezes reconciliation at the prior canonical bridge-base value, not the live local value. The engine regression edits josh to riley while Linear holds an unmapped identity, proves the bead stays riley and base stays josh with no PII, then restores a mapped Linear identity and proves riley pushes successfully. Focused tests passed 111/111; live API QA passed 11/11 with cleanup; full gate passed 134 files / 1,966 tests plus format, lint, typecheck, build, publint, dependency-age, and diff checks.

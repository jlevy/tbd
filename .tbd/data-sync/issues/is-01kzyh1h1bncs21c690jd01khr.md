---
type: is
id: is-01kzyh1h1bncs21c690jd01khr
title: "Live QA: assert which failures occurred instead of tolerating any exit 1"
kind: bug
status: open
priority: 2
version: 1
labels: []
dependencies: []
created_at: 2026-08-13T21:39:22.283Z
updated_at: 2026-08-13T21:39:22.283Z
---
validate-linear-integration-live.ts:196-202 added expectReportOutput, which accepts exit code 0 OR 1 for the automatic-inbound-scope scenario. The rationale is legitimate (ambient real-project items can legitimately fail unrelated imports), but as written a genuine regression that makes the scenario's own work fail now passes, because nothing asserts WHICH failures occurred.

Fix: keep tolerating exit 1, but parse report.failures and require that none of them name either scenario-owned sentinel. That preserves ambient tolerance without discarding the signal the gate exists to provide.

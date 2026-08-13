---
type: is
id: is-01kzyh1h1bncs21c690jd01khr
title: "Live QA: assert which failures occurred instead of tolerating any exit 1"
kind: bug
status: in_progress
priority: 2
version: 3
labels: []
dependencies: []
parent_id: is-01kzymcx5gjwfra1z0s3rz1g05
created_at: 2026-08-13T21:39:22.283Z
updated_at: 2026-08-13T22:41:47.012Z
---
validate-linear-integration-live.ts:196-202 added expectReportOutput, which accepts exit code 0 OR 1 for the automatic-inbound-scope scenario. The rationale is legitimate (ambient real-project items can legitimately fail unrelated imports), but as written a genuine regression that makes the scenario's own work fail now passes, because nothing asserts WHICH failures occurred.

Fix: keep tolerating exit 1, but parse report.failures and require that none of them name either scenario-owned sentinel. That preserves ambient tolerance without discarding the signal the gate exists to provide.

## Notes

Source: GitHub PR #212 formal review 4931891999. Address via fixed, rebutted, or deferred disposition map.

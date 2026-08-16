---
type: is
id: is-01m067b9z5bag3j86b3j7cjv5r
title: "QA playbook: Linear integration live validation"
kind: task
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-3
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-16T21:23:52.420Z
updated_at: 2026-08-16T21:24:04.528Z
closed_at: 2026-08-16T21:24:04.526Z
close_reason: "Playbook written and executed end to end: full pass on 2026-08-16 against workspace Finterm, team OS, three repos, 296 issues. Results logged in the document."
---
Written as docs/project/specs/active/valid-2026-08-16-linear-integration-live.md.

Captures the live validation that the automated suite cannot do, in repeatable form: preconditions and rate-limit headroom, provisioning idempotence, two-way field sync, a genuine both-sides conflict with archive and comment verification, comments in both directions with the no-duplication check, settling and cost measurement, failure recovery, and cleanup.

Written because the recurring lesson of this integration is that a mock is only as good as the constraints it models — every defect found live came from the mock being kinder than Linear. The playbook lists the six defects it has already caught so a future reader knows what it is for.

Run before any release that touches sync behavior.

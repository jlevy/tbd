---
type: is
id: is-01kzxdxa13azzfh0fk89cw80bh
title: Do not journal suppressed outbound writes during integration pull
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - integration
  - pr-review
dependencies:
  - type: blocks
    target: is-01kzx8jvr185a27s7c85zcwrvj
parent_id: is-01kzx848mdfzapsc2ddm6hm0zt
created_at: 2026-08-13T11:25:23.874Z
updated_at: 2026-08-13T11:49:49.532Z
closed_at: 2026-08-13T11:49:49.532Z
close_reason: Implemented and reviewed. Focused real-binary/engine regressions and the complete local RC gate set pass; live Linear lifecycle, explicit inbound, conflict, orphan, and two-clone soak evidence is recorded in the QA playbook.
---
PR #206 thread PRRT_kwDOQ109P86YTR1K: inbound-only reconciliation still builds update_issue intents for suppressed outbound patches and deletes them at the end without applying them. The local bead/base can re-plan that change, but the redundant journal creates misleading crash state. Exclude external patches from the new run journal during --pull; retain pre-existing intents; prove pull creates no new outbound journal and the next full sync pushes once.

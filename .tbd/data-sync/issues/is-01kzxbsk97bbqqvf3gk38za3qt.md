---
type: is
id: is-01kzxbsk97bbqqvf3gk38za3qt
title: Add an explicit inbound selector to the unified integration sync vocabulary
kind: task
status: closed
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzx8jvr185a27s7c85zcwrvj
parent_id: is-01kzx848mdfzapsc2ddm6hm0zt
created_at: 2026-08-13T10:48:25.126Z
updated_at: 2026-08-13T11:49:49.461Z
closed_at: 2026-08-13T11:49:49.461Z
close_reason: Implemented and reviewed. Focused real-binary/engine regressions and the complete local RC gate set pass; live Linear lifecycle, explicit inbound, conflict, orphan, and two-clone soak evidence is recorded in the QA playbook.
---
The old import verb was deliberately retired in favor of sync --pull, but stale spec passages still promise one-off imports and the CLI has no equivalent selector. Design and implement sync --pull --external <ref...> so explicitly named external items can become beads independent of inbound policy, with one-source guard, bulk guard, no external writes, dry-run/reporting, docs, and real-binary tests.

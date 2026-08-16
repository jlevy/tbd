---
type: is
id: is-01kzxawcw1hgqx2bzajsrnbtx9
title: Journal tracker conflict comments for exact replay
kind: bug
status: closed
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzx8jvr185a27s7c85zcwrvj
parent_id: is-01kzx848mdfzapsc2ddm6hm0zt
created_at: 2026-08-13T10:32:28.283Z
updated_at: 2026-08-13T11:49:49.419Z
closed_at: 2026-08-13T11:49:49.419Z
close_reason: Implemented and reviewed. Focused real-binary/engine regressions and the complete local RC gate set pass; live Linear lifecycle, explicit inbound, conflict, orphan, and two-clone soak evidence is recorded in the QA playbook.
---
Final concurrency review found conflict reports bypass the write-ahead intent journal: sync generates a fresh UUID and calls adapter.postConflict() after the journal commit, so a crash after the comment lands but before base advance can duplicate the report on retry, contradicting the exactly-once design. Add a replayable conflict-comment intent with a stable client UUID and report payload, ensure a replayed remote-wins conflict is not planned and posted again in the same recovery run, and cover crash-before/after-provider-write for local- and remote-winner paths.

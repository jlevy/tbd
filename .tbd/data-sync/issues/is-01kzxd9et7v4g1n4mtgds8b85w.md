---
type: is
id: is-01kzxd9et7v4g1n4mtgds8b85w
title: Fail closed on malformed integration intent journals
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - integration
  - durability
dependencies:
  - type: blocks
    target: is-01kzx8jvr185a27s7c85zcwrvj
parent_id: is-01kzx848mdfzapsc2ddm6hm0zt
created_at: 2026-08-13T11:14:33.410Z
updated_at: 2026-08-13T11:49:49.519Z
closed_at: 2026-08-13T11:49:49.519Z
close_reason: Implemented and reviewed. Focused real-binary/engine regressions and the complete local RC gate set pass; live Linear lifecycle, explicit inbound, conflict, orphan, and two-clone soak evidence is recorded in the QA playbook.
---
packages/tbd/src/integrations/core/intents.ts listIntentFiles silently skips unreadable or schema-invalid write-ahead journals. A skipped create_issue loses the stable client UUID and lets the next sync create a duplicate external item. Parse every .yml intent fail-closed with its filename before replay/planning; distinguish an absent intents directory from a damaged file; test malformed YAML and schema-invalid content, then document the recovery boundary.

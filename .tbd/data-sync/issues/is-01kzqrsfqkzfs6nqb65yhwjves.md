---
type: is
id: is-01kzqrsfqkzfs6nqb65yhwjves
title: init accepts id prefixes the display-id parser cannot resolve
kind: bug
status: closed
priority: 1
version: 5
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - release-blocker
  - ids
dependencies:
  - type: blocks
    target: is-01kzx8jvr185a27s7c85zcwrvj
  - type: blocks
    target: is-01kzx8jw39zc4dpgx6w82rg3dm
parent_id: is-01kzx848mdfzapsc2ddm6hm0zt
created_at: 2026-08-11T06:40:06.386Z
updated_at: 2026-08-13T11:49:49.390Z
closed_at: 2026-08-13T11:49:49.389Z
close_reason: Implemented and reviewed. Focused real-binary/engine regressions and the complete local RC gate set pass; live Linear lifecycle, explicit inbound, conflict, orphan, and two-clone soak evidence is recorded in the QA playbook.
---
Release blocker exposed by the integration real-binary E2E. cli/lib/prefix-detection.ts isValidPrefix() accepts forced prefixes matching [a-z][a-z0-9._]*, but lib/ids.ts extractShortId()/extractPrefix() and lib/schemas.ts ExternalIssueIdInput only recognize alphabetic prefixes. Establish one shared display-prefix grammar and use it consistently for init/setup validation, ID parsing, schemas, web PUBLIC_ID acceptance, and documentation. TDD must prove e2e-<short>, foo.bar-<short>, and foo_bar-<short> resolve through create/show/update/integration link while malformed or ambiguous inputs still fail clearly.

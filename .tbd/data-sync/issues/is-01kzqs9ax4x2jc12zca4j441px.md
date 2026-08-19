---
type: is
id: is-01kzqs9ax4x2jc12zca4j441px
title: sync should detect multiple beads linked to one external item
kind: bug
status: closed
priority: 1
version: 6
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - integration
  - release-blocker
dependencies:
  - type: blocks
    target: is-01kzx8jvr185a27s7c85zcwrvj
  - type: blocks
    target: is-01kzx8jw39zc4dpgx6w82rg3dm
parent_id: is-01kzx848mdfzapsc2ddm6hm0zt
created_at: 2026-08-11T06:48:45.731Z
updated_at: 2026-08-13T11:49:49.399Z
closed_at: 2026-08-13T11:49:49.399Z
close_reason: Implemented and reviewed. Focused real-binary/engine regressions and the complete local RC gate set pass; live Linear lifecycle, explicit inbound, conflict, orphan, and two-clone soak evidence is recorded in the QA playbook.
extensions:
  linear:
    id: d81f3bf1-4d78-41a5-81ae-f5254dcd6d89
    linked_at: 2026-08-11T06:51:08.880Z
    key: TBD-132
    url: https://linear.app/finterm-ai/issue/TBD-132/sync-should-detect-multiple-beads-linked-to-one-external-item
---
Release blocker. Add one provider-generic duplicate-link validator shared by integrations/core/link-store.ts, runSync() in integrations/core/sync-engine.ts, and checkIntegrations() in cli/commands/doctor.ts. Before any replay, fetch, push, import, or base advance, group valid extensions.<provider>.id values and reject every holder of an external id owned by more than one bead; report provider, external ref, and all deterministic display IDs while allowing unrelated links to continue. TDD in integrations-link-store.test.ts, integrations-sync-engine.test.ts, integration-cli-e2e.test.ts, and doctor coverage must prove pre-existing corrupt links cannot double-write, all holders are skipped, unrelated pairs still converge, and human/JSON remedies are actionable.

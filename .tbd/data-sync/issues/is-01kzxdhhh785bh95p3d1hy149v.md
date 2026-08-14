---
type: is
id: is-01kzxdhhh785bh95p3d1hy149v
title: Journal manual link ownership claims before Linear writes
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
created_at: 2026-08-13T11:18:58.339Z
updated_at: 2026-08-13T11:49:49.525Z
closed_at: 2026-08-13T11:49:49.525Z
close_reason: Implemented and reviewed. Focused real-binary/engine regressions and the complete local RC gate set pass; live Linear lifecycle, explicit inbound, conflict, orphan, and two-clone soak evidence is recorded in the QA playbook.
---
packages/tbd/src/cli/commands/integration.ts IntegrationLinkHandler currently upserts the tbd ownership attachment before persisting the bead link and bridge record. If the provider write succeeds and local persistence fails, the command leaves a remote claim with no local source; if attachment transport fails, there is no retry journal. Persist the link, base, and an upsert_attachments intent first; delete only after success; prove a failed attachment leaves exactly one local link and one intent that the next full sync replays without duplicate content.

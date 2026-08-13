---
type: is
id: is-01kzxdxb1mhthgn46vfxtawv01
title: Surface integration config read failures in tbd sync
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
created_at: 2026-08-13T11:25:24.915Z
updated_at: 2026-08-13T11:49:49.553Z
closed_at: 2026-08-13T11:49:49.553Z
close_reason: Implemented and reviewed. Focused real-binary/engine regressions and the complete local RC gate set pass; live Linear lifecycle, explicit inbound, conflict, orphan, and two-clone soak evidence is recorded in the QA playbook.
---
PR #206 thread PRRT_kwDOQ109P86YW-Vu: Surface 3 catches readConfig and treats undefined as inert, so malformed/unreadable config skips integrations with exit zero. Treat only a valid disabled/inert config as inert; route read failures through fail('integrations'); prove the error is named while independent surfaces retain their work.

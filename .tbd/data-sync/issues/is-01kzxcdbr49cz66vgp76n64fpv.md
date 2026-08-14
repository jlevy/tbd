---
type: is
id: is-01kzxcdbr49cz66vgp76n64fpv
title: Defer inbound-only conflict comments to the next full integration sync
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
created_at: 2026-08-13T10:59:12.771Z
updated_at: 2026-08-13T11:49:49.490Z
closed_at: 2026-08-13T11:49:49.490Z
close_reason: Implemented and reviewed. Focused real-binary/engine regressions and the complete local RC gate set pass; live Linear lifecycle, explicit inbound, conflict, orphan, and two-clone soak evidence is recorded in the QA playbook.
---
A remote-winner conflict under --pull archives and advances the base without posting (correctly read-only), but then no later run can reconstruct the external conflict notice. Journal the post_conflict operation locally with its archive path and client UUID, leave it pending under --pull, and prove the next full sync posts exactly once.

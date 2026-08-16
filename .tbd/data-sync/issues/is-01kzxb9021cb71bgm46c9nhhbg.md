---
type: is
id: is-01kzxb9021cb71bgm46c9nhhbg
title: Resolve display IDs in attic commands
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
created_at: 2026-08-13T10:39:21.152Z
updated_at: 2026-08-13T11:49:49.434Z
closed_at: 2026-08-13T11:49:49.434Z
close_reason: Implemented and reviewed. Focused real-binary/engine regressions and the complete local RC gate set pass; live Linear lifecycle, explicit inbound, conflict, orphan, and two-clone soak evidence is recorded in the QA playbook.
---
After fixing real-ULID attic filename parsing, live QA still showed tbd attic list qa-eqgx as empty because list/show/restore call normalizeIssueId(), which cannot resolve a configured display ID without the loaded mapping. All other user-facing bead commands accept display IDs. Use resolveToInternalId() with the already-loaded mapping for all attic subcommands, retain full internal ID support, add coverage, and verify qa-eqgx can list/show/restore its external-conflict artifact.

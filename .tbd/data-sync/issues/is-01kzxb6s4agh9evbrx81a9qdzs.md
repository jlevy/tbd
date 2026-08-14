---
type: is
id: is-01kzxb6s4agh9evbrx81a9qdzs
title: Parse real ULID attic filenames
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
created_at: 2026-08-13T10:38:08.521Z
updated_at: 2026-08-13T11:49:49.427Z
closed_at: 2026-08-13T11:49:49.427Z
close_reason: Implemented and reviewed. Focused real-binary/engine regressions and the complete local RC gate set pass; live Linear lifecycle, explicit inbound, conflict, orphan, and two-clone soak evidence is recorded in the QA playbook.
---
Live Linear conflict QA wrote a valid attic entry for is-01kzxakjxggsrkx1hty70ms845, but tbd attic list qa-eqgx returned [] because parseAtticFilename() accepts only is-[a-f0-9]+. Internal IDs are is- plus 26 lowercase base32/alphanumeric characters. Align the attic filename parser with the shared internal-ID grammar, add unit/CLI regression coverage using letters beyond f, and confirm the live external-conflict entry is listable/showable/restorable.

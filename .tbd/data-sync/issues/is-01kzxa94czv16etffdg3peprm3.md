---
type: is
id: is-01kzxa94czv16etffdg3peprm3
title: Reject push-only selectors during full integration sync
kind: bug
status: closed
priority: 1
version: 5
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzx8jvr185a27s7c85zcwrvj
parent_id: is-01kzx848mdfzapsc2ddm6hm0zt
created_at: 2026-08-13T10:21:57.022Z
updated_at: 2026-08-13T11:49:49.405Z
closed_at: 2026-08-13T11:49:49.405Z
close_reason: Implemented and reviewed. Focused real-binary/engine regressions and the complete local RC gate set pass; live Linear lifecycle, explicit inbound, conflict, orphan, and two-clone soak evidence is recorded in the QA playbook.
---
Release-candidate review proved integration sync accepts --bead/--type/--status/--label/--spec/--limit without --push, but IntegrationSyncHandler intentionally reconciles every linked pair and ignores outbound selectors. The spec says selectors belong only to the --push projection and bare sync reconciles every link. Fail fast with a usage error when any push-only selector is supplied without --push (including --pull), keep plain full sync unchanged, make help text explicit, and prove the real built CLI rejects the ambiguous form while --push --bead remains exactly scoped. This blocks tbd-40el because silent selector ignore is unsafe during staged live QA.

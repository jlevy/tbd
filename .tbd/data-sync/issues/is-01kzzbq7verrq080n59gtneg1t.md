---
type: is
id: is-01kzzbq7verrq080n59gtneg1t
title: "PR #216 review R2: doctor mislabels unrelated dropped config keys"
kind: bug
status: closed
priority: 2
version: 3
labels:
  - review
dependencies: []
parent_id: is-01kzzbpmdv336m2wnrbqpx473c
created_at: 2026-08-14T05:25:36.749Z
updated_at: 2026-08-14T06:12:49.026Z
closed_at: 2026-08-14T06:12:49.026Z
close_reason: Fixed in bbad205b; complete local release matrix and PR CI are green
---
Formal review 4934238677 on PR #216, packages/tbd/src/cli/commands/doctor.ts:795. The Integrations diagnostic fires for any missing committed top-level key. Only a missing integrations key is evidence of pre-f07 integration loss. Gate on integrations and add a non-integration regression test.

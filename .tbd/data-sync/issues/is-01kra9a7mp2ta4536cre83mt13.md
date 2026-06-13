---
type: is
id: is-01kra9a7mp2ta4536cre83mt13
title: Implement one-shot f03/f04 → f05 migration in tbd-format.ts (workflow W1)
kind: task
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-05-07-docs-config-redesign.md
labels: []
dependencies:
  - type: blocks
    target: is-01kra9aave6br1ysqedyccf8y5
parent_id: is-01kra98szn2ah4f59kmbnfbery
created_at: 2026-05-11T01:09:37.558Z
updated_at: 2026-06-13T01:51:08.469Z
closed_at: 2026-06-13T01:51:08.468Z
close_reason: "Superseded and shipped: the f04→f05 migration landed via the forkable-docs spec (docs/project/specs/done/plan-2026-06-11-forkable-docs.md) on PR #169 as a stamp-only migration in tbd-format.ts, with seamless shared-layout co-migration and fail-closed behavior for older clients. The redesign-era W1 framing (f03/f04→f05 one-shot under the config-redesign model) no longer applies; remaining redesign ideas are f06+ scope."
---
Rewrite type: discriminators to docref:; rename prefix: → bundle:; drop lookup_path: and files:. No runtime compat for deprecated fields. tbd doctor --fix performs the migration; first run after upgrade prompts the user.

Spec: Phase 1 bullet 2 (line ~1605), Workflow W1, Rollout Plan (line ~1719).

---
type: is
id: is-01kzq3fn6v122vfa0nqxca6x4b
title: "Phase 2: linking policy — PolicyDefinitionSchema, presets, select folding"
kind: task
status: closed
priority: 2
version: 6
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzn2wa8b53y8wjh1gegbzhhx
  - type: blocks
    target: is-01kzqp34fh1dkxz9ryvt88ng6m
parent_id: is-01kzn2w85qxpbp8cqtn7mkbvkg
created_at: 2026-08-11T00:27:44.218Z
updated_at: 2026-08-11T06:45:58.187Z
closed_at: 2026-08-11T06:45:58.186Z
close_reason: "Phase 2 implemented in PR #206 (96be7b34..c36dbc70): policy schema and resolution, bridge records with newest-observation merge, pure reconcile matrix, write-ahead intents (OQ7 probed live: comment client UUIDs are exactly-once), the full sync command, append-only comment sequences with union merge, link/unlink/comment with one-source guard and --take stance, doctor config-loss tripwire, sync_on_tbd_sync fold, and end-to-end coverage through the real built binary against the mock. Full suite green in the pre-push hook; live rollout gates before sync_on_tbd_sync tracked in the spec."
extensions:
  linear:
    id: 775dcc1d-676d-4cc1-8036-59b6ff31cc9e
    linked_at: 2026-08-11T00:30:14.875Z
    key: TBD-85
    url: https://linear.app/finterm-ai/issue/TBD-85/phase-2-linking-policy-policydefinitionschema-presets-select-folding
---
core/policy.ts: PolicyDefinitionSchema with outbound/inbound/field_sync clauses, PolicyName presets ('default'), resolvePolicy(config), and folding the Phase 1 'select' key into policy.outbound as a deprecated alias. Pure, exhaustively round-trip tested. First step of Phase 2 because everything else consumes the resolved policy. See spec section 6, 'The linking policy'.

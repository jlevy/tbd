---
type: is
id: is-01kzq3fn6v122vfa0nqxca6x4b
title: "Phase 2: linking policy — PolicyDefinitionSchema, presets, select folding"
kind: task
status: open
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzn2wa8b53y8wjh1gegbzhhx
parent_id: is-01kzn2w85qxpbp8cqtn7mkbvkg
created_at: 2026-08-11T00:27:44.218Z
updated_at: 2026-08-11T00:30:14.877Z
extensions:
  linear:
    id: 775dcc1d-676d-4cc1-8036-59b6ff31cc9e
    linked_at: 2026-08-11T00:30:14.875Z
    key: TBD-85
    url: https://linear.app/finterm-ai/issue/TBD-85/phase-2-linking-policy-policydefinitionschema-presets-select-folding
---
core/policy.ts: PolicyDefinitionSchema with mirror/import/sync clauses, PolicyName presets ('default'), resolvePolicy(config), and folding the Phase 1 'select' key into policy.mirror as a deprecated alias. Pure, exhaustively round-trip tested. First step of Phase 2 because everything else consumes the resolved policy. See spec section 6, 'The linking policy'.

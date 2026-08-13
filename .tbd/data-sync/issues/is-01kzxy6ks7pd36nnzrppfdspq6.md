---
type: is
id: is-01kzxy6ks7pd36nnzrppfdspq6
title: Audit Linear comment synchronization completeness
kind: task
status: closed
priority: 1
version: 10
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - linear
  - integration
  - comments
dependencies: []
parent_id: is-01kzxxj27abvbje3nesecgsk3z
child_order_hints:
  - is-01kzxyaajyhadgprx4ws1gz7mk
  - is-01kzxymmezp743rv5dd9b0gjp1
  - is-01kzxymmz0f92n0apa0hgrvrrc
  - is-01kzxymnb6n160tntcf305prcq
created_at: 2026-08-13T16:10:05.990Z
updated_at: 2026-08-13T17:56:04.353Z
closed_at: 2026-08-13T17:56:04.352Z
close_reason: "Compatibility review is complete: implementation gaps are fixed, all findings are mapped in the authoritative matrix, product/design/development/skill docs agree, deterministic CI is green (132 files, 1,956 tests), and the API-driven Linear gate passed all 11 scenarios with verified cleanup."
extensions:
  linear:
    id: 39aeb027-34ef-42d1-89bd-98f45318844e
    linked_at: 2026-08-13T16:11:12.743Z
    key: TBD-163
    url: https://linear.app/finterm-ai/issue/TBD-163/audit-linear-comment-synchronization-completeness
---
Treat comments as a release-critical integration surface. Reconcile the plan spec, design/manual, QA playbook, CLI/API implementation, automated coverage, and real Linear behavior. Record intentional boundaries versus actual gaps and fix or track every gap.

## Notes

Completed end-to-end comment compatibility audit: append-only union identity, two-way/inbound/outbound/off modes, truthful dry-run previews, empty-body rejection, client-UUID replay, cross-machine union, complete pagination, 10 KiB provider-body cap, and 50 full provider-held entry cap. Unpushed local prose remains whole until a provider id lands. Deterministic integration suites and the live API gate passed. Deliberate boundaries are documented: edits, deletions, reactions, and thread shape are not synchronized.

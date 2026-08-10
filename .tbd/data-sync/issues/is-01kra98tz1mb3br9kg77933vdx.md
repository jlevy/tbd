---
type: is
id: is-01kra98tz1mb3br9kg77933vdx
title: "Phase 3: Migrate bundled docs to external repo (tbd-docs)"
kind: epic
status: open
priority: 3
version: 10
spec_path: docs/project/specs/active/plan-2026-05-07-docs-config-redesign.md
labels: []
dependencies: []
parent_id: is-01kra98fgac70pjft7jnarmave
child_order_hints:
  - is-01kra9bnvxgvmt8mdby5hjshna
  - is-01kra9bp8j6g8fv8pq61srprrw
  - is-01kra9bpmkg2zh03fp5qc2f9nm
  - is-01kra9bq0wa8tcqevenxecy6j5
  - is-01kra9bqdh6ep2k6f1ta3szeb3
  - is-01kra9bqsnbq33f26xd6skfne2
  - is-01kra9br63f467mxc3fjwga2wz
  - is-01kra9brkfj969kby0dk36khzg
created_at: 2026-05-11T01:08:51.809Z
updated_at: 2026-08-10T19:36:34.900Z
extensions:
  linear:
    id: 7ad54ee7-74aa-4285-9edb-e7458ec25a9a
    key: FIN-49
    url: https://linear.app/finterm-ai/issue/FIN-49/phase-3-migrate-bundled-docs-to-external-repo-tbd-docs
    linked_at: 2026-08-10T19:36:34.895Z
---
Goal: the bulk of bundled docs lives in github:jlevy/tbd-docs (or equivalent); the npm package ships a small core. Users get the same default doc set; tbd-docs evolves on its own release cycle.

Spec section: ## Implementation Plan → Phase 3 (line ~1680).

Blocked by: Phase 2 completion (external scheme fetchers, source add/list/remove, sync --docs).

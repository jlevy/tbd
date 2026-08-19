---
type: is
id: is-01m0c5rk9zcamj2r525dazj73w
title: "Phase 2: human identity binding, per provider"
kind: task
status: open
priority: 3
version: 1
spec_path: docs/project/specs/active/plan-2026-08-18-actor-axis-and-identity.md
labels: []
dependencies: []
parent_id: is-01m0c5r461zmx3ctgsxq94s0bq
created_at: 2026-08-19T04:51:37.406Z
updated_at: 2026-08-19T04:51:37.406Z
---
Add listMembers() to the adapter interface and implement it for Linear. Write the resolution ladder (recorded binding, email, login or display name, ask) once against the adapter interface rather than inside the Linear adapter, since identity is per provider.

Persist bindings by provider user id under bridge/<provider>/users/, never guessing non-interactively. Inbound unknown assignee offers a binding interactively and reports otherwise. user_map stays an override; setup migrates its entries into binding records. Doctor prints the resolved actor table offline, flags directory drift, and flags handles with no binding in any configured provider.

Reuses the sibling Phase 1 resolver-and-ask machinery. The per-provider property is tested against a stub second adapter: one handle binding to two ids, partial coverage reporting a skip, rebinding one provider leaving the other untouched.

Open before starting: handle shape at the bind prompt, and whether the no-email rule for binding records is schema-enforced.

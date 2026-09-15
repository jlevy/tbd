---
type: is
id: is-01m2k1xx2apddhzn6mx88t8v1z
title: Make Linear live QA repeatable and maintain its slot-convergence gate
kind: task
status: in_progress
priority: 1
version: 2
labels:
  - linear
  - qa
dependencies: []
parent_id: is-01m2k0q2av2j3dgkaj735byyr6
created_at: 2026-09-15T17:30:41.608Z
updated_at: 2026-09-15T17:30:45.918Z
---
Extend the maintained API-driven Linear QA playbook and runner so tracker/state-slot changes are covered by a stable release scenario, document when the automated live gate and manual two-clone soak must run, record evidence and cleanup expectations, and run the gate against the reconciled PR stack using the gitignored local credential without exposing it.

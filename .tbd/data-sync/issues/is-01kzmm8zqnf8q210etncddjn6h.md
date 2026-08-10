---
type: is
id: is-01kzmm8zqnf8q210etncddjn6h
title: Release-validate bead watch infrastructure
kind: epic
status: in_progress
priority: 1
version: 8
spec_path: docs/project/specs/active/plan-2026-07-19-bead-watch-and-external-sync.md
labels:
  - bead-watch
  - validation
dependencies: []
child_order_hints:
  - is-01kzmm943t45fn4vq1wena9mav
  - is-01kzmm9dhgj1ygc3qysrehs66v
  - is-01kzmpyc9j5y853fnrwzvptt8q
  - is-01kzmr3vyqrttcgjfzwkbyncgh
created_at: 2026-08-10T01:23:28.116Z
updated_at: 2026-08-10T02:41:44.666Z
---
Own PR #205 release validation: a repeatable two-clone smoke script, a manual QA playbook for packaged artifacts and real remotes, recorded automated evidence, compatibility and rollback checks, and explicit non-gating Linear experiment boundaries.

## Notes

Automated release validation is complete: tbd-961h and tbd-3x5y are implemented, tbd-dbyj stabilized the validation transcript, and all local source/package/full-suite gates pass. Exact-head cross-platform CI will gate the PR after push. tbd-t750 remains open solely for exact-tag packaging, Node 20, credentialed real-remote, resilience, runner, platform, operator, and soak evidence before release promotion. PR #205 merge and all watch infrastructure remain independent of Linear experiments.

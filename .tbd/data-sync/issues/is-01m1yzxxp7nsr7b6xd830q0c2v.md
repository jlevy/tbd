---
type: is
id: is-01m1yzxxp7nsr7b6xd830q0c2v
title: tbd status prints the resolved root; repo_root and id_prefix in status --json and doctor --json
kind: task
status: open
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-4
dependencies: []
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-07T22:30:56.452Z
updated_at: 2026-09-07T22:31:45.573Z
---
GH #204 observability half. status.ts:109 sets working_directory to cwd and sections.ts:89 renders it as 'Repository:', so status inside a subdirectory prints a non-repository path while doctor (doctor.ts:295) prints the resolved root. Print the resolved root; add repo_root and id_prefix to status --json and doctor --json. The data-safety half (git-boundary walk, prefix validation) is tbd-pjan; tbd -C and identity in every --json payload are follow-on beads.

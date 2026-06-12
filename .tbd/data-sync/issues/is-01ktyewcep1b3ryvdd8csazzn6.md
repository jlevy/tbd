---
type: is
id: is-01ktyewcep1b3ryvdd8csazzn6
title: "Windows: unify FORK_DIR vs DEFAULT_FORK_DIR; POSIX rel paths; run fork tryscripts in OS matrix"
kind: bug
status: open
priority: 1
version: 1
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels:
  - pr169-review
dependencies: []
parent_id: is-01ktyesmg1w5p3v0jzt3ryt0zs
created_at: 2026-06-12T17:43:07.478Z
updated_at: 2026-06-12T17:43:07.478Z
---
[Phase 1] PR #169. paths.ts FORK_DIR uses join() (docs\tbd on Windows) and leaks into manifest path fields and output via forkRelPath; doc-fork.ts DEFAULT_FORK_DIR is a POSIX literal used only by tests, so Windows CI tests a value production never uses. Also tryscripts run only on ubuntu (ci.yml). Fix: one POSIX-string constant, join at fs boundaries only, delete the duplicate, add fork tryscripts to the OS matrix.

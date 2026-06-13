---
type: is
id: is-01kv199q7mbcqxrvfd6jpecxnk
title: "Tests: bulk mutators, atomicity, quiet and json contract"
kind: task
status: open
priority: 2
version: 1
spec_path: docs/project/specs/active/plan-2026-06-13-agent-cli-ergonomics.md
labels: []
dependencies: []
parent_id: is-01kv197ns6jwkg2q82w7awjn15
created_at: 2026-06-13T20:03:16.340Z
updated_at: 2026-06-13T20:03:16.340Z
---
Phase 1 tests. tryscript goldens: bulk close/reopen/update with mixed already-closed and unknown IDs; --ignore-missing; single-ID backward compatibility; --reason-file and stdin bodies; --quiet single-line output; the --json results array shape. vitest: validate-all-then-apply policy and summary exit codes (non-zero when any target failed).

---
type: is
id: is-01ktyew72edy9pn4h308mfyc00
title: Reconcile spec golden-test maps with shipped CLI output (single source of truth)
kind: task
status: open
priority: 1
version: 1
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels:
  - pr169-review
dependencies: []
parent_id: is-01ktyesmg1w5p3v0jzt3ryt0zs
created_at: 2026-06-12T17:43:01.966Z
updated_at: 2026-06-12T17:43:01.966Z
---
[Phase 0.5] PR #169. Spec golden maps and shipped output disagree in a dozen places (update/missing/fork/unfork wording, list --json fields stale/word_count, Recorded-base line, diff labels). Update the spec maps to the mostly-better shipped wording, then treat them as binding: validate each remaining phase against its golden block as it lands.

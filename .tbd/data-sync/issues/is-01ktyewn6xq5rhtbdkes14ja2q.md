---
type: is
id: is-01ktyewn6xq5rhtbdkes14ja2q
title: Actionable fork-overwrite refusal message
kind: task
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-06-11-forkable-docs.md
labels:
  - pr169-review
dependencies: []
parent_id: is-01ktyesmg1w5p3v0jzt3ryt0zs
created_at: 2026-06-12T17:43:16.445Z
updated_at: 2026-06-12T18:20:27.590Z
closed_at: 2026-06-12T18:20:27.590Z
close_reason: "Fixed in a3a5b37: overwrite refusal now lists options (tbd docs diff / fork --force). Verified empirically on e8b5112."
---
[Phase 1] PR #169. Fork conflict error is bare ('already exists and is not an unmodified fork') with no next steps, unlike unfork. Per error-handling-rules and the spec golden: list options (tbd docs diff NAME / tbd docs fork NAME --force).

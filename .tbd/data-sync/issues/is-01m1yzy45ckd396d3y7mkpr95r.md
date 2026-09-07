---
type: is
id: is-01m1yzy45ckd396d3y7mkpr95r
title: Closing reminder fires on gh pr create and gh pr ready
kind: feature
status: open
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-5
dependencies: []
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-07T22:31:03.081Z
updated_at: 2026-09-07T22:31:47.011Z
---
GH #179 and #180. TBD_CLOSE_PROTOCOL_SCRIPT (setup.ts:405-420) matches git push only (:417); agents file a PR and stop without watching CI. Extend the one template to match gh pr create and gh pr ready, recover the PR number from the tool response when present, and defer to tbd closing. Both the Claude and Codex surfaces are generated from that template (setup.ts:606, :1197), so it propagates by construction, which is #180's cross-agent ask. #180's upsert-by-identity already exists (setup.ts:986-993, :1200-1212); its remaining ask, a --dry-run diff of hook changes, is a follow-on.

---
type: is
id: is-01kzy06a8qy5jw2m29wsasx7vc
title: Paginate Linear labels and ownership attachments safely
kind: bug
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - linear
  - integration
  - pagination
dependencies: []
parent_id: is-01kzxz1e815hsxmyhykdabhcxr
created_at: 2026-08-13T16:44:53.398Z
updated_at: 2026-08-13T17:55:57.258Z
closed_at: 2026-08-13T17:55:57.257Z
close_reason: "All correctness-sensitive Linear collections now paginate: team labels, issue labels, issue fetches, projects, comments, and attachment ownership probes. Boundary tests beyond first-page sizes and the full suite pass."
---
Issue labels are capped at first:50, team label metadata at first:250, and ownership attachment discovery at first:250. Large Linear workspaces/items can therefore lose label-preservation context, attempt duplicate label creation, or miss a cross-repository tbd claim. Add complete pagination or targeted queries and regression coverage.

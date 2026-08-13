---
type: is
id: is-01kzxymmz0f92n0apa0hgrvrrc
title: Preserve unpushed local comment prose until Linear accepts it
kind: bug
status: open
priority: 1
version: 1
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - linear
  - integration
  - comments
dependencies: []
parent_id: is-01kzxy6ks7pd36nnzrppfdspq6
created_at: 2026-08-13T16:17:45.951Z
updated_at: 2026-08-13T16:17:45.951Z
---
capEntries currently truncates long locally authored bodies and stubs old pending entries before their first push, so the full prose can never reach Linear. Keep unpushed bodies intact, apply body/count compaction only after a provider id proves the tracker holds the original, reject empty local comments, and document the temporary pending-state exception.

---
type: is
id: is-01m044ntts3mchercdbj5ysc1w
title: Mirror-only push maintains no bridge record, so identifiers never refresh
kind: bug
status: open
priority: 2
version: 1
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-3
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-16T01:58:42.775Z
updated_at: 2026-08-16T01:58:42.775Z
---
`tbd integration sync --push` runs the one-way mirror (applyMirror), which writes bead links but no bridge records. Since the tracker identifier moved to the bridge record, a push-only workflow now stores it nowhere.

Self-healing: the next full sync repairs it, and `tbd sync` folds a full integration sync in, so this is transient rather than permanent. It is still a mode inconsistency of the kind we are trying to avoid.

Cheap to fix: ISSUE_UPDATE_MUTATION already selects `issue { id identifier url updatedAt }` (src/integrations/linear/queries.ts:127), but applyChanges narrows the return to `{updatedAt}` and discards the rest. Widen it and let the mirror's caller persist the identifier — no extra request.

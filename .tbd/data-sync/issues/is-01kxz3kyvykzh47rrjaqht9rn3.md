---
type: is
id: is-01kxz3kyvykzh47rrjaqht9rn3
title: "Compatibility gate: version/format bump for new synced fields"
kind: task
status: closed
priority: 1
version: 5
spec_path: docs/project/specs/active/plan-2026-07-19-bead-watch-and-external-sync.md
labels:
  - linear-sync
dependencies:
  - type: blocks
    target: is-01kxz3mf4ytsqe23z53h0z8c7q
parent_id: is-01kxz3kfz7n7y23n9rzmy28f98
created_at: 2026-07-20T06:32:36.990Z
updated_at: 2026-08-15T05:33:51.875Z
closed_at: 2026-08-15T05:33:51.875Z
close_reason: "The legacy PR #197 integration design was superseded by the active external-tracker plan and the production implementation merged in PR #206."
---
Issue parsing uses Zod strip mode: older CLIs silently DROP unknown frontmatter (linked, last_actor) when rewriting a bead. Before the new fields ship, bump the minimum-version gate via the existing tbd_format mechanism so pre-pilot CLIs refuse to write. Additive fields only — nil data migration. Pilot spec Rollout step 1.

## Notes

Deferred legacy scope from PR #197. Do not add first-class linked/actor schema fields or a tbd_format gate for the experiment. The active Integration Layer requires extension-backed bindings and module-owned state; tbd-vm5s will close or re-scope this bead if post-pilot evidence later justifies promotion. Not a PR #205 or release blocker.

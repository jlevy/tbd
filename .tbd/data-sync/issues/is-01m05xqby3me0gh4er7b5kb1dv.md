---
type: is
id: is-01m05xqby3me0gh4er7b5kb1dv
title: Write the Linear integration design reference doc
kind: task
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-3
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-16T18:35:41.890Z
updated_at: 2026-08-16T18:46:34.587Z
closed_at: 2026-08-16T18:46:34.586Z
close_reason: "Written: packages/tbd/docs/references/linear-integration-design.md. Each rule paired with the Linear behavior that forces it — identity (mutable team-scoped identifiers), labels (team-wide name uniqueness, groups do not scope), managed block (markdown round-tripping), import dates (create-only backdating), archive lifecycle and policy.archive, multi-repo shape, request-cost model, and what tbd deliberately does not do. setup-linear cross-links to it."
---
The repo has an operational shortcut (setup-linear.md: how to connect) and research/plan docs (why we built it), but no reference explaining how tbd's model maps onto Linear's and why each decision falls out of a Linear constraint. That gap is why the same class of bug kept reaching live: the constraints were known but not written down anywhere a reader would find them.

Cover, each tied to the Linear behavior that forces it: identity (immutable UUID vs mutable team-scoped identifier); labels (team-wide name uniqueness, groups not scoping it, the tbd: namespace); the managed block and markdown round-tripping; import semantics for createdAt/completedAt; the archive lifecycle and policy.archive; multi-repo shape (one team, project per repo); and the request-cost model.

Goes in packages/tbd/docs/references/ so it ships in the docs cache and is forkable.

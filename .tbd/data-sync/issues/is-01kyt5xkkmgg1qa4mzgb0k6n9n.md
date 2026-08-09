---
type: is
id: is-01kyt5xkkmgg1qa4mzgb0k6n9n
title: "PR #196 review N1: watch timeout exit 2 collides with usage-error exit 2"
kind: bug
status: closed
priority: 2
version: 2
labels: []
dependencies: []
parent_id: is-01kyt5x6y2h4d3x7b68jjr6n2j
created_at: 2026-07-30T18:52:19.956Z
updated_at: 2026-07-30T19:12:33.280Z
closed_at: 2026-07-30T19:12:33.279Z
close_reason: "Fixed in f71b1cf on PR #196; CI green"
---
watch.ts:59-62 exits 2 on timeout; ValidationError also exits 2 (errors.ts:39-48). watch-beads daemon recipe continues on 2, so a usage error hot-spins. Fix chosen: timeout exits 3 (mirrors changes' no-matches=3); update spec/docs/recipe/tests. PR #196

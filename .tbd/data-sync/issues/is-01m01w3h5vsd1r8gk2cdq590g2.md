---
type: is
id: is-01m01w3h5vsd1r8gk2cdq590g2
title: tbd doctor should report duplicate and contested short IDs in ids.yml
kind: feature
status: open
priority: 3
version: 1
labels: []
dependencies: []
created_at: 2026-08-15T04:50:25.595Z
updated_at: 2026-08-15T04:50:25.595Z
---
PR #232 repairs contested duplicate short IDs in `mappings/ids.yml` at load time. That is the right place for the repair, but nothing surfaces the condition as a health signal — the user sees only a transient warning on the run that happened to load the file.

`tbd doctor` should report when `ids.yml` contains duplicate keys, distinguishing the two cases:

- Benign: same short ID appearing twice with the same ULID (idempotent, no action).
- Contested: same short ID with different ULIDs (a bead was displaced and given a derived replacement short ID; its display ID changed).

The contested case is worth reporting because a bead's display ID silently changing is something a human would want to know about — links and references in docs, commits, and PR bodies still point at the old short ID.

Explicitly deferred in PR #232 as out of scope (a load-time data-integrity repair is not a health check). Raised as S3 in the senior review.

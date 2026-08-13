---
type: is
id: is-01kzyh14se51kt9hhs2ar1ehtr
title: Malformed managed markers freeze all sync for a pair, including comments and pulls
kind: bug
status: open
priority: 2
version: 1
labels: []
dependencies: []
created_at: 2026-08-13T21:39:09.742Z
updated_at: 2026-08-13T21:39:09.742Z
---
sync-engine.ts:775-801 scans every pair for malformed managed-block markers regardless of direction, then drops the pair from synchronizablePairs -- which also drops its bead patch, comment pull, and comment push. On a --pull run the failure text still reads 'skipped all writes for this pair', though a pull performs no provider writes.

Failing closed on the DESCRIPTION is correct: stripManagedBlock returns the raw body on malformed input, so a pull would otherwise write machine text into the bead description. Extending the freeze to comments and unrelated fields is broader than needed.

There is also no way to find stuck pairs: integration status reports config/credential/reachability only, never a count of quarantined pairs, so one can sit frozen indefinitely with a single line in a sync report as the only signal.

Fix: scope the skip to description-bearing operations, reword the message for inbound-only runs, and surface a quarantined-pair count in integration status.

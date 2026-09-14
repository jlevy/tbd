---
type: is
id: is-01m2gcah3bvnrdkfqmpypjcxdz
title: tbd sync --dry-run performs the docs sync for real
kind: bug
status: open
priority: 2
version: 1
labels: []
dependencies: []
created_at: 2026-09-14T16:34:37.803Z
updated_at: 2026-09-14T16:34:37.803Z
---
Found by the senior review of PR #287, out of scope there. cli/commands/sync.ts:476-492: syncDocs honours dryRun only under --status, so a dry run actually writes the docs cache. Verified by the reviewer in a fresh repo: 0 files under .tbd/docs, then 'tbd sync --dry-run --docs' wrote 96 files and printed 'Synced docs: +96 doc(s)'. .tbd/docs is a gitignored cache so the impact is low, but it is the same dishonest-dry-run class PR #287 names, and it means --dry-run is not side-effect free. Fix: honour ctx.dryRun in the docs surface and report what would be synced.

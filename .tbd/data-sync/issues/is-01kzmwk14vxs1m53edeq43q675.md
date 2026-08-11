---
type: is
id: is-01kzmwk14vxs1m53edeq43q675
title: tbd sync --status --json prints a non-JSON Docs banner on stdout
kind: bug
status: closed
priority: 2
version: 5
labels:
  - json-contract
dependencies: []
created_at: 2026-08-10T03:48:45.850Z
updated_at: 2026-08-11T04:42:44.442Z
closed_at: 2026-08-11T04:42:44.442Z
close_reason: Fixed in e5c9360d with regression tests; full suite (103 files / 1458 tests) green through the pre-push gate
---
printDocSyncStatus() in packages/tbd/src/cli/lib/docs-sync-output.ts:65-77 writes to stdout with raw console.log and has no --json guard. syncDocs(statusOnly) in commands/sync.ts:188 calls it unconditionally, so 'tbd sync --status --json' can emit a human 'Docs:' block ahead of its JSON document whenever the docs cache is stale (settings.doc_auto_sync_hours).

Reproduce: let the docs cache go stale, then run 'tbd sync --status --json 2>/dev/null'. The Docs banner appears on stdout before the '{'.

Impact: any agent or script that pipes 'tbd sync --status --json' into a JSON parser breaks intermittently, depending only on cache staleness. Other --json surfaces (list, ready, changes, watch) are unaffected; those were checked.

Pre-existing, not introduced by the watch-infrastructure work (PR #205). Found while building the bead web viewer QA instrument, which had to parse defensively as a result.

Fix: route the status output through this.output and suppress it under ctx.json, the way the rest of the command does.

## Notes

Fixed on claude/tbd-web-spike: OutputManager.isJson + printDocSyncStatus early return; regression test tests/docs-sync-output.test.ts; live-verified stale-cache --json is pure JSON. Awaiting full-suite gate before close.

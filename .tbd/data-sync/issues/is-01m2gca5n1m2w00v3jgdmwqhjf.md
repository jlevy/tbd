---
type: is
id: is-01m2gca5n1m2w00v3jgdmwqhjf
title: "PR #287 review R7: tautological id assertion in import collision test"
kind: task
status: closed
priority: 3
version: 3
delegate: claude-code@vm
labels: []
dependencies: []
parent_id: is-01m2gc9377byvp9mbna5c70bvp
hold: null
hold_until: null
created_at: 2026-09-14T16:34:26.081Z
updated_at: 2026-09-14T16:40:26.854Z
started_at: 2026-09-14T16:38:47.549Z
closed_at: 2026-09-14T16:40:26.854Z
close_reason: "Fixed. Verified the finding first: import.ts:544 calls updateConfigPrefixIfNeeded, which rewrites display.id_prefix from coll to src (:734-742), so every id renders src-... after the import and 'not.toBe(native.id)' could never fail. The test now compares short-ID SUFFIXES: the imported bead's suffix differs from the contested short ID, the native issue's suffix still equals it, the repository holds exactly 2 issues, and the imported bead carries extensions.beads.original_id === 'src-<short>'. A comment records why whole-id comparison is wrong here."
resolution: null
duplicate_of: null
---
tests/import-short-id-collision.test.ts:89. expect(imported[0].id).not.toBe(native.id) cannot fail: tbd import calls updateConfigPrefixIfNeeded (import.ts:544, 730-745), switching the display prefix from coll to src, so list renders every id as src-... and it can never equal coll-.... The real pin is line 82, show(native.id).title, which fails on the old code. Fix: compare short-ID suffixes, or assert two issues with distinct ids and the two titles; optionally assert extensions.beads.original_id on the imported bead.

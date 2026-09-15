---
type: is
id: is-01m2gca4jrj61b6yn1e10dzk43
title: "PR #287 review R5: weak arrayContaining assertion in merge-refs test"
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
created_at: 2026-09-14T16:34:24.984Z
updated_at: 2026-09-14T16:40:25.881Z
started_at: 2026-09-14T16:38:46.716Z
closed_at: 2026-09-14T16:40:25.881Z
close_reason: "Fixed: replaced expect.arrayContaining(['a','b']) with an exact toEqual({ comments: ['a','b','c'], note: 'remote' }). The finding's reasoning checks out — theirs is newer, mergeBeadAcrossRefs passes ours as local (git.ts:2609), namespace LWW is nsLocalTime >= nsRemoteTime (git.ts:1204) — so the winner is deterministic and the weak assertion could not see a re-sort, which the comment above it claimed to test. Comment updated to say why the assertion is exact."
resolution: null
duplicate_of: null
---
tests/merge-refs.test.ts:366-367. The winner is deterministic: theirs is newer (2025-01-04 vs 01-03), mergeBeadAcrossRefs passes ours as local (git.ts:2609), and namespace LWW is nsLocalTime >= nsRemoteTime (git.ts:1204), so the result must be exactly { comments: ['a','b','c'], note: 'remote' }. expect.arrayContaining(['a','b']) also passes for ['a','b'], ['b','a','c'] and ['a','b','c','x'] — and the comment claims 'nothing is dropped or re-sorted', which the assertion cannot see. Fix: exact toEqual.

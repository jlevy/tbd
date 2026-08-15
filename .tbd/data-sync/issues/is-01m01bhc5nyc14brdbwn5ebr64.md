---
type: is
id: is-01m01bhc5nyc14brdbwn5ebr64
title: Duplicate short-ID keys in ids.yml drop a bead's display mapping
kind: bug
status: closed
priority: 1
version: 5
labels: []
dependencies: []
created_at: 2026-08-15T00:00:53.429Z
updated_at: 2026-08-15T05:47:00.900Z
closed_at: 2026-08-15T05:47:00.899Z
close_reason: "Fixed and shipped in merged PR #232 (4dbefd65); the duplicate-ID repair and 44 focused tests are now on main."
---
`mappings/ids.yml` is keyed short -> ulid and merged with `merge=union` (see the sync branch's `mappings/.gitattributes`). Union merge keeps both sides' lines, so two clones that each allocate the same unseen short ID produce a file with that key twice. `parseYamlToleratingDuplicateKeys` (yaml-utils.ts:183) resolves duplicates as "last occurrence wins", so one of the two beads silently loses its mapping.

Measured against the shipped loader with a three-line ids.yml where `00wl` appears twice:

    Warning: ids.yml contains 1 duplicate key(s): 00wl.
    shortToUlid size: 2
    00wl -> 01bbbb...                             (second writer wins)
    ulidToShort has A (first writer)?  false
    ulidToShort has B (second writer)? true
    display for A THREW: No short ID mapping found for internal ID: is-01aaaa...
    display for B: tbd-00wl

Two effects. The losing bead has no entry in `ulidToShort`, so `formatDisplayId` (ids.ts:283) throws its "This is a bug" error — any command that formats that bead fails rather than degrading. And the short ID now resolves to the other bead, so `tbd show tbd-00wl` silently addresses the wrong issue.

`generateUniqueShortId` cannot prevent this: it retries against a mapping loaded from local disk, so two clones both see the ID as free. The append-only guard in `saveIdMapping` (id-mapping.ts:154) does not catch it either, since the entry count does not shrink.

Probability is low per event — both clones must draw the same unseen 4-char ID in the same offline window — but it scales with the square of how much work happens off-sync, and rises again past 50K issues where `calculateOptimalLength` is still handing out 5 chars.

Possible directions, not yet decided:
- Have `loadIdMapping` detect a duplicate key and re-allocate one side rather than dropping it (the file is append-only, so both ULIDs are recoverable from the raw document via `parseDocument`).
- Have `tbd doctor --fix` repair duplicates, which the existing warning already promises ("will be auto-fixed on next save") but does not deliver for the losing side.
- Longer term, invert the key to ulid -> short, which is collision-free under union merge by construction.

Found while researching agent identity (research-2026-08-14-agent-and-session-identity.md section 5.4), where it decided the storage layout: agent records use one file per canonical ID rather than a flat union-merged map.

## Notes

Review fully addressed across 7b5f47e (R1/R2/R3/R4/R5/R7/S2 + docs) and 0024a4f (loud-failure path tests). Disposition posted at PR #232 comment 5300737158.

Verified by execution, not by reading: loaded this repo's real 1,743-entry ids.yml (274 quoted keys) with an injected duplicate — 1,744 short IDs, 1,744 ULIDs, 0 beads fail to render, quoted bystander renders as tbd-0622. Before 7b5f47e that scenario dropped all 274. Conflict-marker ordering from 735e9ee survived the parser swap at all three read paths.

Correction to my own earlier note: I attributed uncovered yaml-utils.ts:277-278 to the new primitive. Those lines are in parseYamlToleratingDuplicateKeys (declared :246), which predates this PR. parseYamlDocumentEntries (198-245) is fully covered.

That misattribution surfaced tbd-xt7r: parseYamlToleratingDuplicateKeys now has zero production callers, kept alive only by its own tests. It is the last-occurrence-wins parser that caused this bug, so leaving it exported lets a future caller reach for the wrong one. Not folded into #232 to keep scope tight post-review.

main advanced d55790f -> 2e56669 (PR #233) but touched only docs/development.md and docs/publishing.md — disjoint from this PR, no conflict.

Awaiting re-review.

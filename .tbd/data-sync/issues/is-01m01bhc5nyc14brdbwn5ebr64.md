---
type: is
id: is-01m01bhc5nyc14brdbwn5ebr64
title: Duplicate short-ID keys in ids.yml drop a bead's display mapping
kind: bug
status: in_progress
priority: 1
version: 2
labels: []
dependencies: []
created_at: 2026-08-15T00:00:53.429Z
updated_at: 2026-08-15T00:59:54.540Z
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

Fix in PR #232 (branch claude/fix-ids-yml-duplicate-short-ids), authored by a subagent, reviewed here.

Approach: deterministic repair at load. parseAllIdEntries reads every duplicate line-by-line, resolveDuplicateShortIds gives the contested short ID to the lexicographically smallest ULID (earliest-created bead), and deriveShortIdFromUlid assigns displaced ULIDs a replacement taken from 4-char windows of their own ULID — starting at the tail, so candidates come from the 80 random bits rather than the shared timestamp prefix. No randomness, so clones converge.

Review found and got fixed: the first revision checked duplicates before merge-conflict markers, so a conflicted-AND-duplicated ids.yml parsed silently instead of raising MergeConflictError — parseAllIdEntries skips marker lines, so both sides of an unresolved conflict were treated as live data. Fixed in 735e9ee; verified by probe that conflicted input now throws in both loadIdMapping and parseIdMappingFromYaml while clean duplicates still repair.

Known residual, documented in the PR and deliberately not fixed here: clones at different sync states can derive different replacements for the same displaced ULID, producing two short IDs aliasing one bead. Alias, not data loss; the true two-ULID conflict still self-heals as a duplicate key.

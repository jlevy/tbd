---
type: is
id: is-01m01bhc5nyc14brdbwn5ebr64
title: Duplicate short-ID keys in ids.yml drop a bead's display mapping
kind: bug
status: in_progress
priority: 1
version: 3
labels: []
dependencies: []
created_at: 2026-08-15T00:00:53.429Z
updated_at: 2026-08-15T04:50:43.331Z
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

Senior review on PR #232 (jlevy, OWNER) requested changes. One blocker, independently verified here and worse than the review measured.

R1 blocker: parseAllIdEntries' regex cannot match a QUOTED key, and tbd's own stringifyYaml quotes any short ID that looks like a YAML scalar. Measured: 1,727 of 200,000 generateShortId(4) outputs (0.864%, ~1 in 116) serialize unreadably. But in this repo 274 of 1,739 live ids.yml entries are quoted — 15.8% — because migrated beads have numeric short IDs ('1', '100', '1000', '0622'). Once any duplicate exists anywhere in the file, the repair branch discards EVERY quoted entry in the whole file, so a single union-merge duplicate would break 274 unrelated beads here. Verified end to end: bystander entry dropped, formatDisplayId throws. That is this very bug reintroduced by its own fix.

Fix direction (R2, subsumes R1/R3/R4/R5): delete the regex rather than patch it. parseYamlToleratingDuplicateKeys already builds an AST via parseDocument(uniqueKeys: false) that retains every duplicate pair, then discards it with toJSON(). Add one yaml-utils primitive returning all pairs plus the duplicate-key set, and use it for both detection and extraction — collapsing three parsers with three notions of a line into one.

Also in scope: R3 trailing-comment drop, R4 undefined written into Map<string,string>, R5 restore loud failure on non-conforming lines, R6 27-char ULID fixture, R7 hardcoded length 4 vs calculateOptimalLength, S2 loadIdMappingRaw, and tbd-design.md:675 which still carries the false auto-fix claim.

Root cause of the gap: every fixture used hand-picked keys (a1b2, 00wl) the regex happens to handle. Coverage measured the repair code; nothing measured whether the repair could see the file.

Filed out of scope: tbd-64aq (invert ids.yml to ULID-keyed — the structural fix), tbd-r0fv (doctor check), tbd-g2fd (diff3 markers, pre-existing on main).

Confirmed correct and not to be touched: the 735e9ee conflict-marker ordering fix, resolveIdMappingConflicts, the smallest-ULID-wins tiebreak, and the tail-first window scan.

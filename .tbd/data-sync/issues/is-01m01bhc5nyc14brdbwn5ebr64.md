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
updated_at: 2026-08-15T06:24:40.457Z
closed_at: 2026-08-15T06:24:40.456Z
close_reason: |-
  Fixed and merged to main as PR #232 (merge commit 4dbefd6, 4 commits).

  Root cause: mappings/ids.yml is keyed short -> ulid under merge=union, so two clones could mint the same short ID for different beads; the loader resolved duplicates last-wins, dropping one bead's mapping entirely — formatDisplayId threw for it and its short ID silently addressed the other bead.

  Fix: deterministic repair at load. Duplicate pairs are read from the YAML AST that parseDocument already builds (new parseYamlDocumentEntries primitive), the lexicographically smallest ULID keeps the contested short ID, and displaced ULIDs get a replacement derived from tail-first windows of their own ULID — no randomness, so clones converge.

  Two defects were caught in review before merge, both by me and by jlevy's senior review: an ordering bug where duplicate-key handling ran before merge-conflict detection (so a conflicted file parsed as live data), and a blocker where the original regex line parser could not match YAML-quoted keys. The latter mattered far more than it looked: 274 of this repo's 1,739 live entries are quoted because migrated beads have numeric short IDs, so one duplicate would have broken 274 unrelated beads. Verified after the fix against the real file: 1,744 short IDs, 1,744 ULIDs, 0 beads fail to render.

  Follow-ups filed, none blocking: tbd-64aq (invert ids.yml to ULID-keyed — the structural fix that makes union merge collision-proof), tbd-r0fv (doctor check), tbd-g2fd (diff3 markers, pre-existing), tbd-xt7r (parseYamlToleratingDuplicateKeys now has no production callers).
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

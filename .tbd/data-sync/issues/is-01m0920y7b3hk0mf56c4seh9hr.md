---
type: is
id: is-01m0920y7b3hk0mf56c4seh9hr
title: Interrupted sync leaves beads linked to issues that were never created
kind: bug
status: closed
priority: 1
version: 3
labels: []
dependencies: []
parent_id: is-01m091zrhym1y81tm7g22hheyh
created_at: 2026-08-17T23:48:33.118Z
updated_at: 2026-08-18T00:05:38.191Z
closed_at: 2026-08-18T00:05:38.191Z
close_reason: Fixed in 8fcbacc3. Selection previews now report why beads were selected (kind vs inherited spec_path) and warn when inheritance dominates; the sync fold defaults to guarded so a plain tbd sync no longer waives the bulk guard; the bridge link record is written before the follow-up round trips that previously left half-written pairs; and doctor reports both abandoned lock sidecars (--fix clears provably dead ones) and beads whose link has no bridge record. 2240 tests pass.
---
When the first Linear push was interrupted partway, the repo was left with **799 beads carrying an `extensions.linear` block but only 326 bridge link files and only 326 real Linear issues**. About 473 beads claimed a link to an issue that had never been created.

The bead-side stamp and the bridge record are not written as one unit, and the bead side appears to be applied across the selected set rather than per confirmed remote create.

Consequences, in order of severity:

- Those beads look mirrored, so they are excluded from future creates. Their issues would never have been made, and the mirror silently under-reports **permanently**. Nothing converges this; a later `sync` reports `nothing to do`.
- A later dry run reported `would update 536`, counting phantom pairs as live.
- `tbd doctor` reported the repository healthy, including `ID mapping coverage` and `Integrations - linear`. Nothing compares bead extensions against bridge links.

Asks:

- Write the bead extension only after the remote create is confirmed, or make the pair recoverable as a single unit on the next run.
- Add a doctor check reconciling `extensions.<provider>` against `bridge/<provider>/links/`, reporting beads holding one and not the other.
- Give `unlink` a selector for "every bead whose external item no longer exists". Repairing this by hand meant diffing the bridge directory against the issue frontmatter and mapping internal ids to display ids, and `mappings/ids.yml` quotes numeric-looking ids, which is easy to miss and silently drops those beads from any script.

**Distinguish from a benign case**: after a *successful* push, `tbd sync --issues` leaves extensions ahead of committed bridge links, because the surface flag skips the tracker surface. A plain `tbd sync` reconciles it. The real defect is bead extensions outnumbering **live remote issues**, which is the check the doctor rule should make.

## Notes

Mechanism located in code, and it is narrower than this report first assumed.

`applyMirror` (mirror.ts) was already correct: it calls `onLinked` only after
`adapter.createIssue` returns a ref, so the bead is never stamped for a create that did
not happen.

The gap is in the sync-engine outbound create path. Order was:

1. `adapter.createIssue(...)` -> ref
2. `writeLink(...)` + `callbacks.writeBead(...)`, persisting `extensions.<provider>`
3. `adapter.upsertAttachments(...)`  (network)
4. `adapter.spliceDescription(...)`  (network)
5. `adapter.fetchIssues([ref.id])`   (network)
6. `writeLinkRecord(...)`, persisting the bridge record

Steps 3 to 5 are three network round trips during which the bead claims a link the
bridge has no record of. An interruption anywhere in that window leaves the pair
half-written, and because the bead reads as linked it is never created again, so the
tracker item is orphaned with no path back.

Fixed by writing the bridge record immediately after step 2 and refining it after the
read-back, so the durable pair exists before any further remote call.

What this does NOT explain: the original 799-vs-326 skew observed in the reporting repo.
That is far larger than this window should produce, and a confound was identified later:
`tbd sync --issues` commits `issues/` but skips the tracker surface, so a *committed*
state can legitimately show many extensions against few bridge records until the next
full `tbd sync`. The measurement that would separate the two was not taken at the time
and cannot be reconstructed.

So: the ordering defect is real and fixed on its own merits. Whether it caused the
observed skew is unproven. The new doctor check reports the condition regardless of
cause, and phrases it to distinguish the benign lag from a genuine half-write.

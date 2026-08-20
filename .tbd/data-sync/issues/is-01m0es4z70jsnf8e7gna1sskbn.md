---
type: is
id: is-01m0es4z70jsnf8e7gna1sskbn
title: update-specs-status encodes tbd shortcomings that belong in the tool
kind: epic
status: open
priority: 1
version: 1
labels: []
dependencies: []
created_at: 2026-08-20T05:08:54.623Z
updated_at: 2026-08-20T05:08:54.623Z
---
The update-specs-status shortcut has accreted guidance that reads as workarounds for things tbd cannot do itself. Reviewing PR #245's edits to it, several steps exist only because the CLI will not answer a question directly. Each is a candidate feature; the shortcut should shrink as they land.

Observed while editing it in PR #245:

1. TRIAGE NEEDS A QUERY, NOT A PROCEDURE. The shortcut tells an agent to run tbd list --json per epic and hand-compare open/total children and unchecked checkboxes. That produced a real vacuous-truth bug (0 open children reads as complete for an epic that decomposed into nothing). tbd list --json omits closed beads, so 'all children closed' and 'no children ever' are indistinguishable without a second command. A first-class query — child totals including closed, or a lifecycle classification — would delete the whole triage table.

2. SPEC LIFECYCLE IS A STATE MACHINE TBD DOES NOT MODEL. The folders draft/active/paused/done/archive are exactly the slot vocabulary the tracker work just built for beads, restated in prose for documents. tbd knows a spec's beads; it could classify the spec.

3. MOVING A SPEC IS A LINK REWRITE THE TOOL SHOULD DO. The shortcut warns that git mv is wrong and that inbound references appear in several shapes. Measured on this repo: 1323 dangling references, 982 mechanically repairable. That is a tbd command, not a checklist item.

4. EPICS WITHOUT spec_path ARE INVISIBLE. 22 of 104 here. The shortcut adds a recovery step; doctor should report it.

5. STATUS LINES ARE PROSE THE PROCESS PARSES. Guidance warns that keyword matching misreads 'Active (4 of 10 items landed)'. If status must be machine-read it should be a field, not a sentence.

Deliverable: decide which of these become tbd features, file them, and shrink the shortcut to whatever genuinely remains judgment. Some guidance may also be worth pushing upstream rather than living in this repo's copy.

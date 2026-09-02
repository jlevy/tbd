---
type: is
id: is-01m0y1rep9djp2ds5g7jyz71zj
title: Cross-document consistency, reference integrity, and duplication sweep
kind: task
status: closed
priority: 1
version: 2
labels: []
dependencies: []
parent_id: is-01m0y1gprchhzvxegj8atrwsj8
created_at: 2026-08-26T03:27:58.153Z
updated_at: 2026-08-26T03:53:59.341Z
closed_at: 2026-08-26T03:53:59.340Z
close_reason: "Swept. Reference integrity clean across all shipped docs. 14 duplicated ideas assigned a single owner and reduced. Formatting and severity vocabulary clean; the footer and ampersand hits are pre-existing and out of scope. One defect too wide for a doc review filed as tbd-dado: electrobun and tauri guidelines fall into the docs/tooling catch-all."
resolution: null
duplicate_of: null
---
Cross-document consistency and duplication sweep over the whole PR #258 corpus.
Scope rules are in the parent epic—read it first (`tbd show tbd-81x8`).
Run this after the per-file beads so it can act on what they found.

## Reference integrity

- Every `**Related**:` entry, every inline backticked document name, and every
  `tbd guidelines <name>` invocation across all changed documents must resolve to a real
  bundled guideline. Script this rather than reading for it.
- Every reference is bidirectional where the documents claim a split: if
  `filesystem-rules` says `rust-filesystem-rules` owns the types, the Rust document must
  actually own them and say so.
- Cross-references to `docs/project/research/current/evidence-2026-08-23-rust-lint-cost.md`
  from a shipped guideline: confirm that path is reachable for a downstream consumer of
  the published package, or state the reference differently.

## Duplication matrix

Build the list of ideas stated in more than one changed document, and for each decide the
single owner. Known candidates from the per-file beads:

- the atomic-publication rationale (4 documents);
- “do not globally ban `std::fs::write`” (3);
- the broken-pipe contract (3);
- the cross-target lint pass and single-platform blindness (2);
- ambient `GIT_DIR` scrubbing (2);
- the timeout-raise-with-measurement rule, with a worked example in each (2);
- machine-specific committed fixtures (2);
- the unpublished-sibling trap (2);
- per-member `[lints]` opt-in (2);
- the MSRV compile-and-test job (3);
- the changed-surface review routing table (4).

## Terminology and formatting

- One term per concept across the corpus: “floor”, “gate”, “quality command”, “verify
  mode”, “release unit”, “publication” versus “atomic write”.
- The `common-doc-guidelines` formatting rules: “and” rather than `&` in prose and
  cross-references (note the existing “TypeScript & JS ecosystem” group heading), em-dash
  usage, Title Case for H1 and H2, the guideline footer on every file.
- The severity vocabulary is used identically wherever it appears.

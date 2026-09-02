---
type: is
id: is-01m0y1gprchhzvxegj8atrwsj8
title: "Factual, clarity, and brevity review of the PR #258 guideline corpus"
kind: epic
status: closed
priority: 1
version: 22
labels: []
dependencies: []
child_order_hints:
  - is-01m0y1q8j39jhy33xkrx846rcx
  - is-01m0y1qa21zgnag8mjd8sqnnpz
  - is-01m0y1qbjnca629bjpgs9q4thn
  - is-01m0y1qd2svp5mxwe88mdkmqzg
  - is-01m0y1qek35qx7xs3d0r3bwf2x
  - is-01m0y1qg5eqmg8kmn4xpjsw0q9
  - is-01m0y1qqpfr4btsay0fvz0gf7w
  - is-01m0y1qs9aekt2jsjx1vjhrdjn
  - is-01m0y1qtvr9mhr0kdet728snxa
  - is-01m0y1qwd8629vh0p160cg1ak8
  - is-01m0y1qxysgz0rryk5ekn1er79
  - is-01m0y1qzeqh2n447qkqrb8r4ea
  - is-01m0y1r10ef89f15ypzq3mdt1z
  - is-01m0y1r8gjhhd34asxg5h4gdzm
  - is-01m0y1ra1zyn30t2szjffbrwp0
  - is-01m0y1rbhd8m825rkeztyxkkq6
  - is-01m0y1rd4ss2xf3ynha9xgkca7
  - is-01m0y1rep9djp2ds5g7jyz71zj
  - is-01m0y1rg8766rxxjy2tkfth6v1
created_at: 2026-08-26T03:23:44.268Z
updated_at: 2026-08-26T03:54:08.475Z
closed_at: 2026-08-26T03:54:08.474Z
close_reason: All 19 sub-beads complete. 27 edits applied across 15 files; every factual claim checked against a primary source, by compiling on rustc 1.94.1, or by running the tool. Two guideline-authoring steps were wrong in ways that would silently produce an unserved guideline; three README cells misdescribed their document; the measured lint table recounts exactly from the TSV apart from a rounding error. Follow-up tbd-dado filed for a group-routing defect too wide for a doc review.
resolution: null
duplicate_of: null
---
Full factual review, plus a clarity and brevity review, of every substantial document
added or changed in [PR #258](https://github.com/jlevy/tbd/pull/258) (“Extract
cross-cutting engineering guidelines and add the Rust family”): 12 new guidelines, a
rewritten `general-testing-rules`, edits across the TypeScript and Python families, the
review shortcuts, and the README and skill surfaces.

## Why

These documents are loaded into agent context. Context efficiency is a hard requirement:
every word an agent reads here is attention it does not have for the repository’s own
code. The goal is maximum specificity, brevity, and accuracy—no blather, nothing
needless.

## Scope of Change

**Do not blanket rewrite.** A wholesale rewrite yields worse quality than the original.
Preserve the character, voice, structure, and detail of each document.

Change only where one of these holds:

1. **Factual or technical error.** A claim about an API, flag, tool behavior, exit
   status, platform difference, or measured number that is wrong or unverifiable.
   Verify against a primary source—the tool’s own docs, the actual source, or by running
   it—before editing, and record that evidence in the finding.
2. **Ambiguity.** A rule a competent engineer could read two ways, or that does not say
   what to actually do.
3. **Vagueness.** A generality where a concrete fact, number, name, or example exists
   and would also be shorter.
4. **Duplication.** The same guidance in more than one place across the corpus where one
   copy plus a reference is correct, or the same thing said twice in one document.
5. **Wordiness.** A sentence that can be stated more cleanly and simply without losing
   information. Per `common-doc-guidelines`: “If removing a sentence loses no
   information about the subject, cut it.”

**Do not change** substance or defensible opinion, style or voice that is merely not
your taste, structure that is not itself causing duplication or ambiguity, or anything
you cannot state a specific defect for.

## Standards Applied

- `tbd guidelines common-doc-guidelines`—the standard this corpus declares it follows
  (every file carries the footer). Especially: be clear and concise; be detailed and
  specific; avoid duplication; describe the present state, not what it replaced;
  calibrate confidence; cut pompousness and meta-commentary; and the formatting rules
  (em dashes, “and” rather than `&`, Title Case for H1 and H2, inline headings).
- `tbd guidelines general-eng-agent-principles`—objectivity; do not report a preference
  as a defect.
- `tbd guidelines code-review-rules`—the Blocker/High/Medium/Low vocabulary for
  findings.

## Output per Sub-Bead

A finding list, then the applied edits. Each finding carries `file:line`, which of the
five categories above, the specific defect, and the fix.
Cite a source or a reproduction for every factual finding: a confidently worded wrong
correction costs more than the finding saves.

## Cross-Document Constraint

Four documents were split from a Rust playbook into a language-neutral core plus a Rust
layer (`filesystem-rules`, `release-engineering-rules`, `code-review-rules`,
`ci-and-gates-rules`). Duplication between a neutral document and its language companion
is the expected defect class, as is a stale cross-reference.
Check that every `**Related**:` entry and every inline document reference resolves to a
real bundled guideline name.

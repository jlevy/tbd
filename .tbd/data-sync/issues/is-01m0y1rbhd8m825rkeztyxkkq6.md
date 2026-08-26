---
type: is
id: is-01m0y1rbhd8m825rkeztyxkkq6
title: Review the review-code shortcuts and new-guideline.md against the actual code
kind: task
status: closed
priority: 1
version: 4
labels: []
dependencies:
  - type: blocks
    target: is-01m0y1rep9djp2ds5g7jyz71zj
parent_id: is-01m0y1gprchhzvxegj8atrwsj8
created_at: 2026-08-26T03:27:54.925Z
updated_at: 2026-08-26T03:53:56.523Z
closed_at: 2026-08-26T03:53:56.523Z
close_reason: "Reviewed. 7 edits across 3 files. Two mechanical claims in new-guideline were wrong and either would produce an unserved guideline: 'general-' is not a group prefix, and an unquoted colon-space is a YAML parse error rather than a nested mapping (both reproduced). Routing gaps against code-review-rules closed in both shortcuts; review-code-rust no longer restates what its own step 2 loads."
resolution: null
duplicate_of: null
---
Review the shortcut edits in this PR:
`packages/tbd/docs/shortcuts/standard/review-code-rust.md` (new),
`review-code.md`, `review-code-python.md`, `review-code-typescript.md`, and
`new-guideline.md`.
Scope rules are in the parent epic—read it first (`tbd show tbd-81x8`).

## What to check

- **Shortcut versus guideline duplication.** `code-review-rules` now owns severity, risk
  ordering, and finding format. `review-code-rust.md` steps 5 and 7 restate both.
  Since step 2 already loads the guideline, decide what the shortcut should keep—a
  shortcut is a procedure, and restating the substance it just loaded is the duplication
  this epic targets.
- **Routing drift.** The changed-surface routing appears in `review-code.md` step 5,
  `review-code-rust.md` step 3, `code-review-rules`, and `rust-code-review-rules`—four
  copies. Verify they agree, then reduce.
- `review-code-python.md` and `review-code-typescript.md` gained a `code-review-rules`
  load but their bodies still carry their own severity language; check for contradiction.

## `new-guideline.md`—verify against the actual code

Every mechanical claim here must be checked against this repository, since a wrong step
silently produces an unserved guideline:

- `DOC_CATEGORIES` in `packages/tbd/src/lib/doc-categories.ts`, and that
  `doc-categories.test.ts` keeps its own copy of the vocabulary.
- **The YAML colon-space claim**: that an unquoted `foo: bar` in a `description` parses
  as a nested mapping and fails the doc-categories test. Reproduce it.
  Also verify the listed leading characters (`-`, `[`, `{`, `*`, `&`, `%`) actually break
  an unquoted scalar.
- `GUIDELINE_GROUPS` and the explicit name sets in `packages/tbd/src/file/doc-cache.ts`,
  and that `guideline-groups.test.ts` fails when a named document is missing.
- The `docs_cache.files` registration step in `.tbd/config.yml`.
- **The build-then-test command sequence.** Run it. Confirm each command exists and each
  path is right, including `packages/tbd/dist/docs/guidelines/<name>.md` and
  `node packages/tbd/dist/bin.mjs docs sync`.
- The prohibition on document-local `alwaysApply`, against what the code actually reads.

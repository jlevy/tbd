---
type: is
id: is-01m0y1r8gjhhd34asxg5h4gdzm
title: Review the TypeScript-family edits (atomic writes, EPIPE, exit status)
kind: task
status: closed
priority: 1
version: 4
labels: []
dependencies:
  - type: blocks
    target: is-01m0y1rep9djp2ds5g7jyz71zj
parent_id: is-01m0y1gprchhzvxegj8atrwsj8
created_at: 2026-08-26T03:27:51.826Z
updated_at: 2026-08-26T03:53:53.693Z
closed_at: 2026-08-26T03:53:53.693Z
close_reason: "Reviewed. No edits needed. All claims verified against primary sources: atomically fsyncs the staged file by default and does not fsync the directory (source-confirmed), process.exitCode is undefined until assigned so ??= 0 preserves a nonzero status, process.exit abandons pending writes, wx is not atomic publication. The guideline's EPIPE sample and this repo's process-stream-errors.ts agree."
resolution: null
duplicate_of: null
---
Review the TypeScript-family edits in this PR:
`packages/tbd/docs/guidelines/typescript-rules.md` (§File Operations replaced by §Always
Atomically Publish Files Completed in One Operation),
`typescript-cli-tool-rules.md` (EPIPE and exit-status rewrite), and
`typescript-lint-format-rules.md` (Related block and Hooks and Gates handoff).
Scope rules are in the parent epic—read it first (`tbd show tbd-81x8`).

## Factual claims to verify

- **`atomically`**: that it writes to a same-directory temp file and renames; that it
  syncs the staged file by default; and that it does **not** sync the containing
  directory after the rename, so it must not be described as crash durability.
  Check the package’s current behavior, not its README’s summary.
- That opening a final path with the `wx` flag exposes it before its contents are
  complete, so `wx` is not atomic create-only publication.
- **The EPIPE handler.** `process.exitCode ??= 0` sets 0 only when unset, so a
  previously selected nonzero status survives. Confirm that is true of Node’s
  `process.exitCode` (it is `undefined` until assigned) and that the stderr handler
  rethrowing is the intended contract.
- That `process.exit()` abandons pending writes while setting `process.exitCode` and
  returning lets streams drain.
- That `process.exit(130)` for SIGINT is correctly described as accepting the loss of
  buffered output.

## Other checks

- **The removed `alwaysApply: true` frontmatter** in `typescript-rules.md` and
  `typescript-lint-format-rules.md`: confirm nothing in the codebase or in a downstream
  consumer format still reads that field, and that `new-guideline.md`’s new prohibition
  matches the actual routing behavior.
- Duplication of the atomic-publication rationale across `typescript-rules`,
  `filesystem-rules`, and `python-modern-guidelines`—three near-identical paragraphs.
- Duplication of the broken-pipe contract across `typescript-cli-tool-rules`,
  `error-handling-rules`, and `rust-cli-rules`.

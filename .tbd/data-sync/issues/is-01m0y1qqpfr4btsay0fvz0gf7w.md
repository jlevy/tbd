---
type: is
id: is-01m0y1qqpfr4btsay0fvz0gf7w
title: Review release-engineering-rules.md for accuracy, duplication, and brevity
kind: task
status: closed
priority: 2
version: 4
labels: []
dependencies:
  - type: blocks
    target: is-01m0y1rep9djp2ds5g7jyz71zj
parent_id: is-01m0y1gprchhzvxegj8atrwsj8
created_at: 2026-08-26T03:27:34.607Z
updated_at: 2026-08-26T03:53:29.312Z
closed_at: 2026-08-26T03:53:29.312Z
close_reason: "Reviewed. 1 edit: npx --no-install is deprecated in favor of npx --no. uv tool run flags verified against uv 0.8.17. Sibling-trap mechanism deferred to rust-release-rules. Checklist kept as an actionable pre-release aid."
resolution: null
duplicate_of: null
---
Review `packages/tbd/docs/guidelines/release-engineering-rules.md` (231 lines, new).
Scope rules are in the parent epic—read it first (`tbd show tbd-81x8`).

## Factual claims to verify

- The isolated smoke-test invocations:
  `uv tool run --isolated --no-index --from <wheel> tool --version` and
  `npx --no-install`. Confirm the flags exist and do what the text claims.
- The channel table’s “key considerations” column—each entry should be a real constraint
  of that channel, not a generic caution.
- The claim that a rerun finding its own successful upload should succeed while one
  finding different bytes under the same version must fail, and that registries actually
  permit that distinction to be detected.
- The unpublished-sibling claim (packaging a sibling first produces a `.crate` in
  `target/package`, not an index entry) is stated here and in `rust-release-rules`;
  verify once and keep it in one place.
- That `--locked`, `--frozen`, and `npm ci` are the committed-resolution flags named
  correctly for their ecosystems.

## Brevity and duplication

- The release checklist at the end restates the body. Decide whether the checklist earns
  its length or should carry only what the body cannot.
- Overlap with `ci-and-gates-rules` on workflow permissions and action pinning, with
  `supply-chain-hardening` on tool pinning and cool-off, and with
  `release-notes-guidelines` on the Fixes rule (which appears in the checklist here and
  as a full section there).

---
title: Rust Quality Floor and Guideline Mapping
description: Map the quality insights accumulated in tbd and the Rust Porting Playbook, extract the non-obvious enforcement practices into a Rust guideline suite, and make the Rust family consistent with the Python and TypeScript families
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: general
---
# Feature: Rust Quality Floor and Guideline Mapping

**Date:** 2026-08-23 (last updated 2026-08-23)

**Status:** Draft

## Overview

tbd guidelines exist to give agents the *non-obvious* practices that raise code quality:
strict type-checker flags, high lint floors, and atypical-but-better conventions that a
model will not produce from its priors.
The TypeScript family does this well.
The Rust suite in the Rust Porting Playbook covers a large surface but stops short of
defining an enforceable floor, and none of it is distributed through tbd.

This spec inventories where every kind of insight currently lives across both
repositories, identifies which insights are portable, and plans the two-way transfer:
playbook Rust guidelines up into tbd, and tbd’s enforcement practices across into Rust.

## Goals

- Produce a single map of insight *kinds* and their current homes across tbd and the
  playbook, so later passes stop rediscovering the same material.
- Define a real Rust lint and type-strictness floor (`rust-lint-format-rules`) modeled
  section-for-section on `typescript-lint-format-rules`, replacing the current “choose
  one of three Clippy strategies” optionality.
- Extract the enforcement practices that exist in tbd only as executable config
  (`eslint.config.js`, `tsconfig.base.json`, `lefthook.yml`, `scripts/`) into
  documented, language-neutral or Rust-specific rules.
- Bring the seven existing Rust guidelines up to the tbd frontmatter and cross-reference
  contract so they can ship as bundled tbd guidelines.
- Add `review-code-rust` so the Rust family has the same shortcut coverage as Python and
  TypeScript.

## Non-Goals

- Upstreaming the porting layer.
  Construct mappings, parity evidence, differential testing, and upstream-sync workflows
  stay in the playbook; only source-language-independent Rust guidance moves to tbd.
- Rewriting the Python or TypeScript families.
  They are the reference shape here, changed only where a genuinely cross-language rule
  is being lifted out of them.
- Changing tbd’s own ESLint or tsconfig settings.
  This spec documents and transfers what is already enforced; it does not retune it.
- Porting tbd itself to Rust.
  That is tracked separately in the playbook’s active TypeScript-to-Rust plans.

## Background

Two repositories hold the relevant material:

- **tbd** (this repo, TypeScript): 31 bundled guidelines in
  `packages/tbd/docs/guidelines/`, plus a decade’s worth of enforcement decisions baked
  into executable config at the repo root.
  The config layer is where the highest-value, least-documented practices live.
- **Rust Porting Playbook** (`attic/rust-porting-playbook/`, cloned for this review):
  seven general Rust guidelines plus five porting guidelines, produced by the
  [2026-08-08 reuse review](https://github.com/jlevy/rust-porting-playbook/blob/main/docs/reviews/rust-guideline-reuse-review-2026-08-08.md),
  which already recommends upstreaming the reusable suite to tbd in two waves and tracks
  it as `rpp-u657`.

The playbook already consumes tbd guidelines through `internal:` docrefs in its
`.tbd/config.yml`, so the distribution mechanism for the reverse direction exists and is
proven. What is missing is a `rust-*` set on tbd’s side to point at.

## Design

### Insight Taxonomy

Insights fall into five kinds.
The kind determines both where a rule belongs and whether it can travel.

| Kind | What it is | Where it lives in tbd | Where it lives in the playbook | Portable? |
| --- | --- | --- | --- | --- |
| A. Enforced config | Settings that make a rule unskippable | `eslint.config.js`, `tsconfig.base.json`, `lefthook.yml`, `package.json` scripts, `.github/workflows/ci.yml`, `scripts/*.mjs` | `.github/workflows/docs-quality.yml`, `scripts/check_*.py` | Concept yes, syntax no |
| B. Codified guidelines | Prose rules an agent loads on demand | `packages/tbd/docs/guidelines/` (general, python, typescript families) | `guidelines/` (rust + porting families) | Directly |
| C. Process assets | Shortcuts, templates, references | `packages/tbd/docs/{shortcuts,templates,references}/` | `playbooks/`, `references/`, `_meta/*-template.md` | Directly |
| D. Project evidence | Dated findings tied to one codebase | `docs/project/{specs,reviews,retrospectives,research}/` | `case-studies/`, `docs/reviews/`, `_meta/playbook-improvement-log.md` | No — cite, never copy |
| E. Distribution | How a doc reaches an agent | `.tbd/config.yml` `docs_cache`, `tbd docs fork`, `docs_cache.local_dirs`, `tbd guidelines --add=<url>` | consumes tbd via `internal:` docrefs | N/A |

Kind A is the priority.
It holds the practices the user is asking for and it is the least documented, because a
config file is the enforcement, not the explanation.

### Finding: Floor Versus Optionality

`typescript-lint-format-rules.md` states a floor — “These rules are the minimum for
every project.
A project may add rules; it may not drop these” — then gives per-toolchain
profiles that implement it and a
[Verifying the Floor](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/typescript-lint-format-rules.md)
section that proves the floor is live.

`rust-project-setup.md` §"Define a Clippy Policy" instead says:

> Choose and document one lint strategy: 1. default Clippy lints plus `-D warnings`; 2.
> a curated set of additional lints; or 3. `clippy::pedantic` with explicit, reviewed
> exceptions.

Option 1 is materially weaker than the other two, and an agent handed three options will
take the cheapest. This is the single largest quality gap between the families, and
closing it is the highest-value item in this spec.

### The Proposed Rust Floor

New guideline `rust-lint-format-rules.md`, mirroring the TypeScript document’s
structure: The Floor → The `[lints]` Floor → profiles → Hooks and Gates → Verifying the
Floor.

Each floor rule is derived from an existing tbd rule, not invented:

| tbd floor rule (source) | Rust analogue | Mechanism |
| --- | --- | --- |
| Everything auto-formattable is auto-formatted | `cargo fmt --all`; `taplo fmt` for TOML; flowmark for Markdown; `--check` variants in CI | `rustfmt.toml`, CI |
| Zero-tolerance, verify-only lint gate | `cargo clippy --locked --workspace --all-targets --all-features -- -D warnings`; never `--fix` in CI | CI job |
| Type checking is a separate strict gate | `[lints.rust] unsafe_code = "forbid"`; `RUSTDOCFLAGS="-D warnings" cargo doc --no-deps` as the doc-link gate | `Cargo.toml`, CI |
| Strictest standard preset plus named rules | `clippy::pedantic` at `warn` with `priority = -1`, plus the named restriction picks below | `[lints.clippy]` |
| `noUncheckedIndexedAccess` | `clippy::indexing_slicing` — forces `.get()` over `[i]` | `[lints.clippy]` |
| Exhaustiveness checks / `noFallthroughCasesInSwitch` | `clippy::wildcard_enum_match_arm` — a new enum variant becomes a compile error, not a silent `_ =>` | `[lints.clippy]` |
| `no-floating-promises` | `clippy::let_underscore_future` plus `#[must_use]` discipline; `unused_must_use` at deny | `[lints.clippy]`, `[lints.rust]` |
| `no-restricted-imports` forcing atomic writes | `disallowed-methods` naming `std::fs::write` and `std::fs::File::create`, directing to `tempfile::NamedTempFile::persist` | `clippy.toml` |
| Strict-preset tuning with a stated reason | `clippy::unwrap_used` and `expect_used` denied outside tests; `panic` denied in library code | `[lints.clippy]` |
| Exceptions are narrow and file-scoped | `#[expect(lint, reason = "...")]` at the narrowest scope | attribute |
| Legacy ratchets toward strict | per-crate `[lints]` overrides, each off-switch carrying a tracker ID in a comment | `Cargo.toml` |

Two of these deserve emphasis because they are the ones an agent will not reach for on
its own:

- **`disallowed-methods` is the Rust `no-restricted-imports`.** tbd uses lint config to
  enforce a *correctness invariant* — that no code path writes a file non-atomically —
  rather than trusting reviewers to notice.
  `clippy.toml` supports exactly this, and `rust-filesystem-rules.md` already states the
  atomic-replacement rule in prose without wiring it to enforcement.
- **`#[expect]` is strictly better than the TypeScript equivalent.** It warns when the
  suppression is no longer needed, so exceptions expire on their own.
  The TypeScript floor has to say “remove obsolete exceptions” as a rule because the
  tooling cannot. This is a case where the Rust guideline should not merely mirror the
  TypeScript one.

The floor table above is a design proposal, not a validated configuration.
Phase 3 validates it against a real Rust codebase before it ships.

### Cross-Language Rules to Lift Out

Four practices are currently trapped in TypeScript-specific documents or in tbd’s config
comments, but are language-neutral.
They should move to the `general-*` family so the Rust suite inherits them instead of
restating them:

1. **The tracked ratchet.** tbd disables `@typescript-eslint/no-unnecessary-condition`
   and omits `exactOptionalPropertyTypes`, and each off-switch carries a bead ID
   (`tbd-s9vn`, `tbd-tdh3`) and a re-enable condition in a comment.
   A suppression with a tracker ID is debt; one without is decay.
   Currently only floor rule 8 of the TypeScript document says this.
2. **The config-contract check.** `scripts/check-eslint-contract.mjs` computes the
   *effective* config and asserts the floor rules are live at error severity, catching
   the case where the gate stays green while the floor is silently off.
   The rule generalizes: a quality gate that is not itself tested is not a gate.
   Its Rust form is a probe fixture that lint must reject.
3. **Hook subprocesses inherit a hostile environment.** `scripts/scrub-git-env.mjs`
   exists because git exports `GIT_DIR` into hook environments, which redirected every
   git subprocess the test suite spawned onto the real repository and let fixtures
   rewrite real refs and tbd data (`tbd-a1lc`). Any tool whose tests shell out to git
   hits this; it is not a TypeScript concern, and it is directly relevant to Rust ports
   of git-touching CLIs.
4. **Generated files are formatter-excluded and drift-tested.** tbd excludes `.tbd/`,
   `.claude/skills/`, `.agents/skills/` and `AGENTS.md` from the Markdown formatter
   because they must match their generator byte-for-byte, and guards that with drift
   tests. The general rule — a formatter and a generator must never both own a file —
   applies everywhere.

### Direction: Playbook to tbd

Per the reuse review’s two-wave recommendation, extended with the new floor document and
the missing shortcut:

- **Wave 1 (common floor):** `rust-rules`, `rust-lint-format-rules` (new),
  `rust-project-setup`, `rust-cli-rules`, `rust-testing-rules`.
- **Wave 2 (specialized):** `rust-filesystem-rules`, `rust-release-rules`,
  `rust-code-review-rules`, plus a `review-code-rust` shortcut that loads
  `rust-code-review-rules` and only the topic guidelines matching the diff.

Three playbook assets are valuable to tbd independent of Rust:

- The reuse review’s **section classification rule** (classify every section by the
  question it answers: general / porting / evidence / navigation) is a reusable
  doc-architecture technique.
  It belongs in `common-doc-guidelines` or the `new-guideline` shortcut.
- The `_meta/` **observation → triage → improvement-log loop** is a working mechanism
  for turning project experience into guideline changes.
  tbd has retrospectives but no structured loop; this is a candidate template.
- `scripts/check_docs.py` validates local links, anchors, code fences, and forbidden
  invisible Unicode across all tracked text.
  tbd runs flowmark but has no anchor or hidden-Unicode validation.

### Consistency Contract

Every Rust guideline must satisfy this before it ships in tbd.
Derived from the Python and TypeScript families as they actually are, not from the
template:

- [ ] Frontmatter: `title`, `description`, `author`, `category: rust`.
- [ ] `globs: "*.rs"` and `alwaysApply: true` on the always-on documents (`rust-rules`,
  `rust-lint-format-rules`), matching `typescript-rules` and
  `typescript-lint-format-rules`.
- [ ] A `**Related**:` block directly under the H1, as Python and TypeScript do.
  The Rust suite currently puts related links in a trailing H2 only; keep that section
  but add the header block so the links load with the first screen.
- [ ] A scope statement answering “use this when…” in the opening paragraph.
- [ ] Rules stated as actionable imperatives with a named benefit
  (`general-eng-agent-principles` §10: no ceremony without a named benefit).
- [ ] Guideline cross-references by bare name (`rust-testing-rules`), never by relative
  path — relative links break once the doc is served from `.tbd/docs/`.
- [ ] External references as full public URLs, per the `new-guideline` shortcut.
- [ ] Severity vocabulary is Blocker / High / Medium / Low.
- [ ] No source-language assumptions, no repo-specific tracker prefixes, and “tracking
  issue or bead” rather than “bead”.
- [ ] The `common-doc-guidelines` footer, and flowmark-clean formatting.

## Implementation Plan

### Phase 1: Map and Verify

- [ ] Confirm `rpp-u657` is still the tracking item for upstreaming, and file a tbd-side
  bead for the receiving work.
- [ ] Diff each of the seven Rust guidelines against the consistency contract above and
  record the per-document deltas.
- [ ] Confirm no `rust-*` name collides with an existing bundled tbd guideline.

### Phase 2: Extract the Cross-Language Rules

- [ ] Add a “Tracked Ratchets” section to `general-coding-rules`, with the tbd config
  comments as the worked example.
- [ ] Add “verify the gate itself” to `general-testing-rules`, citing
  `check-eslint-contract.mjs`.
- [ ] Add the hostile-environment rule (`GIT_DIR` and friends) to
  `general-testing-rules`.
- [ ] Add the generator-versus-formatter ownership rule to `common-doc-guidelines`.
- [ ] Update `typescript-lint-format-rules` floor rules 6 and 8 to reference the new
  general homes rather than restating them.

### Phase 3: Author and Validate the Rust Floor

- [ ] Draft `rust-lint-format-rules.md` in the playbook, mirroring the TypeScript
  document’s section order.
- [ ] Validate the proposed `[lints]` block and `clippy.toml` against a real Rust
  codebase — flowmark-rs is the natural target, since it is first-party and already the
  playbook’s primary case study.
  Record which lints fire, which are noise, and which need a project-level exception.
- [ ] Build the Rust config-contract check: a probe fixture that the lint gate must
  reject, wired into CI so a config regression fails.
- [ ] Cut `rust-project-setup.md` §"Define a Clippy Policy" down to a pointer at the new
  floor document, removing the three-option menu.

### Phase 4: Upstream

- [ ] Wave 1 into `packages/tbd/docs/guidelines/`, registered in `docs_cache.files` as
  `internal:` docrefs.
- [ ] Wave 2, plus the `review-code-rust` shortcut.
- [ ] Point the playbook’s `.tbd/config.yml` at the now-bundled
  `internal:guidelines/rust-*.md` so the playbook consumes them the same way it consumes
  the TypeScript family, and the playbook stops being their home.
- [ ] Record the outcome in `_meta/playbook-improvement-log.md`.

## Testing Strategy

- Guideline structure regressions belong in the playbook’s existing
  `tests/test_rust_guidelines.py`; extend it to assert the consistency contract.
- The Rust floor is validated empirically in Phase 3 by running it against flowmark-rs,
  not by inspection.
- The config-contract probe is the test for the floor itself.
- tbd-side: `pnpm ci:quality` plus the forkable-docs tests already cover a new bundled
  guideline; confirm `tbd docs sync` serves each new name.

## Open Questions

- Should `rust-lint-format-rules` be authored in the playbook first and then upstreamed
  (matching how the other seven were developed), or authored directly in tbd since it
  has no porting content?
  Authoring in the playbook keeps one review venue and one validation target; authoring
  in tbd avoids a second migration.
- Does the Rust floor need profiles at all?
  The TypeScript document needs them because ESLint and Biome are genuine alternatives.
  Rust has one formatter and one linter, so the profile layer may collapse into a single
  configuration — which would make the Rust document shorter than its model, not longer.
- Is `clippy::indexing_slicing` tolerable across a whole codebase, or does it need to be
  scoped to library code with tests exempted, as tbd scopes its unsafe-* relaxations to
  test files? Phase 3 answers this with evidence.

## References

- [`typescript-lint-format-rules`](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/typescript-lint-format-rules.md)
  — the model document
- [`general-eng-agent-principles`](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/general-eng-agent-principles.md)
- [`supply-chain-hardening`](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/supply-chain-hardening.md)
- [Rust guideline reuse review, 2026-08-08](https://github.com/jlevy/rust-porting-playbook/blob/main/docs/reviews/rust-guideline-reuse-review-2026-08-08.md)
  — prior art and the two-wave upstream recommendation
- [Playbook guidelines index](https://github.com/jlevy/rust-porting-playbook/blob/main/guidelines/README.md)
- tbd enforcement config: `eslint.config.js`, `tsconfig.base.json`, `lefthook.yml`,
  `scripts/check-eslint-contract.mjs`, `scripts/scrub-git-env.mjs`,
  `scripts/check-package-age.mjs`

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->

---
title: Rust Quality Floor and Guideline Mapping
description: Add a strict Rust guideline family to tbd by migrating the Rust Porting Playbook suite, extracting its language-neutral core into shared guidelines, and setting the floor at the strictest of tbd's enforced config, the playbook, and the TypeScript family
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: general
---
# Feature: Rust Quality Floor and Guideline Mapping

**Date:** 2026-08-23 (last updated 2026-08-23)

**Status:** Draft

## Overview

tbd guidelines exist to give agents the *non-obvious* practices that raise code quality:
strict type-checker flags, high lint floors, and atypical-but-better conventions a model
will not produce from its priors.
The TypeScript family does this well.
tbd has no Rust coverage at all, and the Rust suite that exists in the Rust Porting
Playbook stops short of defining an enforceable floor.

This spec plans the migration: which documents move, what each becomes, what gets
extracted into language-neutral guidelines that all three families share, and how tbd
routes an agent to the right document for each scenario.

## Goals

- Ship a Rust guideline family in tbd with the same flavor and structure as the Python
  and TypeScript families.
- Set the Rust floor at the *strictest* of the three sources available, with no menu of
  lax alternatives.
- Extract the language-neutral core of the playbook’s Rust documents into shared
  guidelines, so the same rule is written once instead of once per language — and so
  four real gaps in tbd’s own coverage get closed along the way.
- Keep coverage identical after extraction, with explicit routing from every scenario to
  the documents that own it.

## Non-Goals

- Upstreaming the porting layer.
  Construct mappings, parity evidence, differential testing, and upstream-sync workflows
  stay in the playbook.
- Rewriting the Python or TypeScript families beyond the edits needed to route them at
  newly shared guidelines.
- Retuning tbd’s own ESLint or tsconfig settings.
  This spec documents and transfers what is already enforced.
- Porting tbd itself to Rust; that is tracked in the playbook’s active TypeScript plans.

## Background

**Confirmed: tbd has zero Rust coverage today.** No `rust-*` guideline, no
`review-code-rust` shortcut, no `category: rust`. The 31 bundled guidelines carry five
categories — `general` (15), `typescript` (8), `python` (3), `desktop` (3), `convex`
(2). The only mentions of Rust anywhere in `packages/tbd/docs/` are incidental (a
`ripgrep` reference, a tooling aside).

The playbook holds 1,765 lines across seven general Rust guidelines, produced by the
[2026-08-08 reuse review](https://github.com/jlevy/rust-porting-playbook/blob/main/docs/reviews/rust-guideline-reuse-review-2026-08-08.md),
which already recommends upstreaming them in two waves and tracks it as `rpp-u657`. They
were written to tbd’s shape — correct frontmatter, actionable rules, related links,
common footer — so the migration is real but mechanical.

The playbook already consumes tbd guidelines through `internal:` docrefs in its
`.tbd/config.yml`, so the distribution path is proven in one direction.

### Gaps This Exposes in tbd Itself

Auditing the playbook’s Rust documents against tbd’s catalog turned up four topics tbd
has no guideline for, in any language:

| Topic | tbd today | Consequence |
| --- | --- | --- |
| Filesystem behavior | Nothing | `eslint.config.js` forbids `fs.writeFile` in favor of `atomically`, and no guideline explains why. The rule is enforced but not taught. |
| Release engineering | `release-notes-guidelines` only, which is about *notes* | Nothing states release identity, pre-release gates, least-privilege publishing, or artifact smoke tests. |
| Code review rules | Four `review-code*` shortcuts | The shortcuts are procedures with no rules document to load; severity vocabulary lives only in dated review artifacts. |
| CI and gate wiring | Scattered across `pnpm-monorepo-patterns`, `typescript-lint-format-rules` §Hooks and Gates, `supply-chain-hardening` | No single answer to “how is a quality gate wired, and how do you prove it is live?” |

The playbook has strong material on all four.
Extracting it serves both repositories at once.

## Design

### How the Floor Is Set

The Rust floor is the **strictest of three sources**, not a merge of their averages:

1. **This repo’s enforced config** — `eslint.config.js`, `tsconfig.base.json`,
   `lefthook.yml`, `scripts/check-eslint-contract.mjs`. The highest bar, because it is
   executable and has survived iteration.
2. **The playbook’s Rust guidelines** — broadest Rust-specific surface coverage.
3. **tbd’s TypeScript family** — the structural model, and the source of rules that are
   really about strictness rather than about TypeScript.

Where they disagree, the strictest wins.
Where a source has a mechanism the others lack, it is adopted rather than averaged away.

**No menus.** A guideline states one default and the conditions for departing from it.
It does not offer ranked alternatives, because an agent handed options takes the
cheapest one. `rust-project-setup.md` §"Define a Clippy Policy" currently violates this:

> Choose and document one lint strategy: 1. default Clippy lints plus `-D warnings`; 2.
> a curated set of additional lints; or 3. `clippy::pedantic` with explicit, reviewed
> exceptions.

Option 1 is materially weaker than the other two.
This menu is deleted and replaced by the floor below.

### The Rust Floor

New guideline `rust-lint-format-rules`, mirroring `typescript-lint-format-rules`
section-for-section: The Floor → The `[lints]` Floor → Hooks and Gates → Verifying the
Floor. Every floor rule is derived from something already enforced, not invented:

| Source rule | Rust analogue | Mechanism |
| --- | --- | --- |
| Everything auto-formattable is auto-formatted | `cargo fmt --all`; `taplo fmt` for TOML; flowmark for Markdown; `--check` in CI | `rustfmt.toml`, CI |
| Zero-tolerance, verify-only lint gate | `cargo clippy --locked --workspace --all-targets --all-features -- -D warnings`; never `--fix` in CI | CI job |
| Type checking is a separate strict gate | `[lints.rust] unsafe_code = "forbid"`; `RUSTDOCFLAGS="-D warnings" cargo doc --no-deps` as the doc-link gate | `Cargo.toml`, CI |
| Strictest standard preset plus named rules | `clippy::pedantic` at `warn` with `priority = -1`, plus the named picks below | `[lints.clippy]` |
| `noUncheckedIndexedAccess` | `clippy::indexing_slicing` — forces `.get()` over `[i]` | `[lints.clippy]` |
| Exhaustiveness checks | `clippy::wildcard_enum_match_arm` — a new variant becomes an error, not a silent `_ =>` | `[lints.clippy]` |
| `no-floating-promises` | `clippy::let_underscore_future`, `#[must_use]` discipline, `unused_must_use` at deny | `[lints.clippy]`, `[lints.rust]` |
| `no-restricted-imports` forcing atomic writes | `disallowed-methods` naming `std::fs::write` and `std::fs::File::create`, directing to `tempfile::NamedTempFile::persist` | `clippy.toml` |
| Strict-preset tuning with a stated reason | `clippy::unwrap_used` and `expect_used` denied outside tests; `panic` denied in library code | `[lints.clippy]` |
| Exceptions are narrow and file-scoped | `#[expect(lint, reason = "...")]` at the narrowest scope | attribute |
| Legacy ratchets toward strict | per-crate `[lints]` overrides, each off-switch carrying a tracker ID in a comment | `Cargo.toml` |

Two entries carry most of the value:

- **`disallowed-methods` is the Rust `no-restricted-imports`.** tbd uses lint config to
  enforce a *correctness invariant* — that no code path writes a file non-atomically —
  rather than trusting reviewers to notice.
  `clippy.toml` supports exactly this, and the playbook’s filesystem rules state the
  atomic-replacement rule in prose without wiring it to enforcement.
- **`#[expect]` beats the TypeScript equivalent.** It warns once the suppression is
  unnecessary, so exceptions expire on their own.
  The TypeScript floor needs a written “remove obsolete exceptions” rule because its
  tooling cannot do this.
  Where Rust has the better mechanism, the Rust document uses it rather than mirroring.

The floor table is a design proposal, not a validated configuration.
Phase 3 validates it against a real Rust codebase before it ships.

### Document Migration Map

Every playbook Rust document, what it becomes, and where it lands.
“Neutral core” means the sections move into a shared guideline that Python and
TypeScript also use; the Rust document keeps only what is genuinely Rust-specific and
routes to the shared one.

| Playbook document | Lines | Disposition | tbd destination(s) | Wave |
| --- | ---: | --- | --- | --- |
| `rust-rules.md` | 287 | Move as-is | `guidelines/rust-rules.md` (`category: rust`, `globs: "*.rs"`, `alwaysApply: true`) | 1 |
| *(new)* `rust-lint-format-rules.md` | — | Author new, per the floor above | `guidelines/rust-lint-format-rules.md` (`globs: "*.rs"`, `alwaysApply: true`) | 1 |
| `rust-project-setup.md` | 327 | Split: 4 of 12 content sections are neutral | `guidelines/rust-project-setup.md` (Cargo, features, toolchain, rustfmt) + `guidelines/ci-and-gates-rules.md` (new, general) | 1 |
| `rust-cli-rules.md` | 290 | Move; drop the porting-parity pointer | `guidelines/rust-cli-rules.md` | 1 |
| `rust-testing-rules.md` | 201 | Move; route generic assertions at `general-testing-rules` | `guidelines/rust-testing-rules.md` | 1 |
| `rust-filesystem-rules.md` | 234 | Split: 9 of 10 content sections are neutral | `guidelines/filesystem-rules.md` (new, general) + thin `guidelines/rust-filesystem-rules.md` (`Path`/`OsStr` types, `walkdir`, platform metadata) | 2 |
| `rust-release-rules.md` | 267 | Split: 13 of 15 content sections are neutral | `guidelines/release-engineering-rules.md` (new, general) + thin `guidelines/rust-release-rules.md` (crates.io trusted publishing, maturin wheels) | 2 |
| `rust-code-review-rules.md` | 159 | Split: 6 of 7 content sections are neutral | `guidelines/code-review-rules.md` (new, general) + thin `guidelines/rust-code-review-rules.md` (unsafe and FFI review) | 2 |
| *(new)* `review-code-rust.md` | — | Author new, mirroring `review-code-typescript` | `shortcuts/standard/review-code-rust.md` | 2 |
| `porting-principles-and-antipatterns.md`, `python-to-rust-*.md`, `filesystem-heavy-cli-porting.md`, `test-coverage-for-porting.md` | 1,674 | **Stays in the playbook** | — | — |

Result in tbd: 8 `rust-*` documents and 1 shortcut, plus 4 new `general` guidelines that
the TypeScript and Python families also gain.

### New Language-Neutral Guidelines

Each absorbs material from more than one source, which is what makes the extraction pay
for itself:

**`filesystem-rules`** (general) — planning vs.
mutation, atomic visibility vs.
crash durability, backup and collision policy, cross-device moves as copies,
deterministic traversal with error propagation, symlink and root boundaries, honest
partial failure, testing the state machine rather than final bytes.
Absorbs the rationale behind tbd’s `atomically` enforcement, which is currently an
unexplained ESLint rule.
Routes to `rust-filesystem-rules` and (new) a short TypeScript section in
`typescript-rules` §File Operations.

**`release-engineering-rules`** (general) — one release identity, clean pre-release
gate, deliberate automation, minimal workflow authority, cool-off for release tooling,
build once per target, predictable packaging, smoke-test the packaged artifact, channels
chosen by audience, multi-channel coordination without rebuilding, release logic tested
outside the workflow, incident preparation.
Absorbs tbd’s own practice (`release.yml`, `publint`, `release:verify`, the packed
upgrade proof in CI). Complements, does not replace, `release-notes-guidelines`.

**`code-review-rules`** (general) — Blocker/High/Medium/Low severity, loading the rules
that own the changed surface, establishing the review baseline, reviewing highest-risk
boundaries first, findings that can be acted on, the quick scan.
Gives the four existing `review-code*` shortcuts a rules document to load; they
currently have none.

**`ci-and-gates-rules`** (general) — one local command matching CI, CI jobs as
independent evidence, reviewable development automation, dependency and supply-chain
policy at the gate. Absorbs the neutral half of `typescript-lint-format-rules` §"Hooks
and Gates Reference" and becomes the home for the four cross-language practices
currently trapped in tbd’s config comments:

1. **Tracked ratchets.** tbd disables `@typescript-eslint/no-unnecessary-condition` and
   omits `exactOptionalPropertyTypes`, each off-switch carrying a bead ID (`tbd-s9vn`,
   `tbd-tdh3`) and a re-enable condition.
   A suppression with a tracker ID is debt; one without is decay.
2. **Config-contract checks.** `scripts/check-eslint-contract.mjs` computes the
   *effective* config and asserts floor rules are live at error severity, catching the
   case where the gate stays green while the floor is silently off.
   A quality gate that is not itself tested is not a gate.
3. **Hostile hook environments.** `scripts/scrub-git-env.mjs` exists because git exports
   `GIT_DIR` into hook environments, redirecting every git subprocess the test suite
   spawned onto the real repository and letting fixtures rewrite real refs and tbd data
   (`tbd-a1lc`). Any tool whose tests shell out to git hits this.
4. **Generator versus formatter ownership.** Generated files are formatter-excluded and
   drift-tested; a formatter and a generator must never both own a file.

### Routing

Extraction only works if an agent still lands on the right document.
Four routing mechanisms, all already used by tbd:

| Scenario | Loads |
| --- | --- |
| Writing Rust | `rust-rules`, `rust-lint-format-rules` (both `alwaysApply: true`, `globs: "*.rs"`) |
| Starting a Rust project | `rust-project-setup`, `rust-lint-format-rules`, `ci-and-gates-rules` |
| Rust CLI work | `rust-cli-rules`, `error-handling-rules` |
| Any filesystem mutation | `filesystem-rules`, plus `rust-filesystem-rules` in Rust |
| Any release | `release-engineering-rules`, `release-notes-guidelines`, plus `rust-release-rules` in Rust |
| Reviewing Rust | `tbd shortcut review-code-rust` → `code-review-rules`, `rust-code-review-rules`, and the topic guidelines matching the diff |
| Wiring or debugging a quality gate | `ci-and-gates-rules`, plus the language floor document |

Enforced by: `globs`/`alwaysApply` frontmatter; a `**Related**:` block under each H1;
`description` text that makes `tbd guidelines --list` self-routing; and
`docs_cache.files` entries so every new name is served.

### Mechanical Conversion Checklist

Applies to every migrated document.
The current state was measured, not assumed:

- [ ] **Relative links → bare guideline names.** All seven documents cross-link as
  `](rust-rules.md)`. These break once served from `.tbd/docs/`. Convert to
  `` `rust-rules` `` per the `new-guideline` shortcut.
- [ ] **Anchor links dropped or rewritten.** Three documents use section anchors
  (`rust-testing-rules.md#test-filesystem-behavior-in-isolated-roots` and two more);
  anchors do not survive the split.
- [ ] **Repo-local links resolved.** `rust-project-setup` and `rust-release-rules` link
  to `../SUPPLY-CHAIN-SECURITY.md`; `rust-release-rules` also links to
  `../docs/project/research/research-rust-cli-pypi-distribution.md`. Retarget at
  `supply-chain-hardening` or a full public URL.
- [ ] **Porting pointers removed.** `rust-cli-rules`, `rust-filesystem-rules`, and
  `rust-testing-rules` link to playbook porting documents that will not exist in tbd.
- [ ] **Frontmatter completed.** Add `globs: "*.rs"` and `alwaysApply: true` to
  `rust-rules` and `rust-lint-format-rules`, matching their TypeScript counterparts.
  `category: rust` is a new category; confirm `tbd guidelines --list` groups it.
- [ ] **`**Related**:` block added under the H1.** All seven put related links in a
  trailing H2 only. Keep that section, add the header block, matching Python and
  TypeScript.
- [ ] **Optionality removed.** Seven documents contain 19 instances of
  choose/may/either/one-of phrasing.
  Each becomes one default plus the conditions for departing from it.
- [ ] **Tracker language generalized.** “tracking issue or bead”, never “bead”.
- [ ] **Severity vocabulary** is Blocker / High / Medium / Low.
- [ ] **Footer and formatting.** `common-doc-guidelines` footer; flowmark-clean.

## Implementation Plan

### Phase 1: Confirm and Prepare

- [ ] Confirm `rpp-u657` still tracks upstreaming; file the tbd-side receiving bead.
- [ ] Confirm `category: rust` renders correctly in `tbd guidelines --list`.
- [ ] Record per-document deltas against the conversion checklist.

### Phase 2: Extract the Neutral Guidelines

- [ ] Author `ci-and-gates-rules`, `code-review-rules`, `filesystem-rules`, and
  `release-engineering-rules` in `packages/tbd/docs/guidelines/`.
- [ ] Point `typescript-lint-format-rules` §Hooks and Gates and floor rules 6 and 8 at
  `ci-and-gates-rules` instead of restating them.
- [ ] Add the `filesystem-rules` pointer to `typescript-rules` §File Operations, so the
  `atomically` ESLint rule finally has a documented rationale.
- [ ] Have the `review-code*` shortcuts load `code-review-rules`.

### Phase 3: Author and Validate the Rust Floor

- [ ] Draft `rust-lint-format-rules` in the playbook, mirroring the TypeScript document.
- [ ] Validate the `[lints]` block and `clippy.toml` against a real Rust codebase —
  flowmark-rs is the natural target, being first-party and the playbook’s primary case
  study. Record which lints fire, which are noise, and which need a project exception.
- [ ] Build the Rust config-contract check: a probe fixture the lint gate must reject,
  wired into CI.
- [ ] Reduce `rust-project-setup` §"Define a Clippy Policy" to a pointer, deleting the
  three-option menu.

### Phase 4: Migrate

- [ ] Wave 1: `rust-rules`, `rust-lint-format-rules`, `rust-project-setup`,
  `rust-cli-rules`, `rust-testing-rules` — applying the conversion checklist.
- [ ] Wave 2: the three split documents plus `review-code-rust`.
- [ ] Register every new name in `docs_cache.files` as an `internal:` docref.
- [ ] Repoint the playbook’s `.tbd/config.yml` at `internal:guidelines/rust-*.md` so it
  consumes them as it consumes the TypeScript family, and stops being their home.
- [ ] Record the outcome in the playbook’s `_meta/playbook-improvement-log.md`.

## Testing Strategy

- Extend the playbook’s `tests/test_rust_guidelines.py` to assert the conversion
  checklist, so structure regressions fail there before migration.
- Validate the Rust floor empirically in Phase 3 against flowmark-rs, not by inspection.
- The config-contract probe is the test for the floor itself.
- tbd-side: `pnpm ci:quality` plus the forkable-docs tests cover new bundled guidelines;
  confirm `tbd docs sync` serves each new name and `tbd guidelines <name>` resolves it.
- Coverage check after extraction: every H2 section in the seven source documents maps
  to a section in some destination document.
  No section is dropped silently.

## Open Questions

- **Does the Rust floor need a profile layer?** Probably not.
  `typescript-lint-format-rules` needs profiles because ESLint and Biome are genuine
  alternatives; Rust has one formatter and one linter, so the Rust document should be
  shorter than its model, with a single configuration and no branches.
- **Is `clippy::indexing_slicing` tolerable codebase-wide,** or does it need test-file
  scoping the way tbd scopes its `no-unsafe-*` relaxations to tests?
  Phase 3 answers this with evidence.
- **Where is `rust-lint-format-rules` authored?** Drafting in the playbook keeps one
  review venue and one validation target; drafting directly in tbd avoids a second
  migration. Leaning playbook, since Phase 3 validation happens there.
- **Do the four new neutral guidelines need Python counterparts filed?** The Python
  family has no filesystem or release document either.
  Extraction makes them available, but Python-specific companions are out of scope here.

## References

- [`typescript-lint-format-rules`](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/typescript-lint-format-rules.md)
  — the model document
- [`general-eng-agent-principles`](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/general-eng-agent-principles.md)
- [`supply-chain-hardening`](https://github.com/jlevy/tbd/blob/main/packages/tbd/docs/guidelines/supply-chain-hardening.md)
- [Rust guideline reuse review, 2026-08-08](https://github.com/jlevy/rust-porting-playbook/blob/main/docs/reviews/rust-guideline-reuse-review-2026-08-08.md)
  — prior art and the two-wave recommendation
- [Playbook guidelines index](https://github.com/jlevy/rust-porting-playbook/blob/main/guidelines/README.md)
- tbd enforcement config: `eslint.config.js`, `tsconfig.base.json`, `lefthook.yml`,
  `scripts/check-eslint-contract.mjs`, `scripts/scrub-git-env.mjs`,
  `scripts/check-package-age.mjs`

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->

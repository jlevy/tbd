---
title: Rust Quality Floor and Guideline Mapping
description: Add a strict Rust guideline family to tbd by migrating the Rust Porting Playbook suite, extract the undocumented practices from tbd's enforced config, and split the language-neutral core into shared guidelines
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: general
---
# Feature: Rust Quality Floor and Guideline Mapping

**Date:** 2026-08-23 (last updated 2026-08-23)

**Status:** Draft

## Overview

tbd guidelines give agents the non-obvious practices that raise code quality: strict
type-checker flags, high lint floors, and conventions a model will not produce from its
priors. The TypeScript family does this well.
tbd has no Rust coverage at all.

Three bodies of material feed the fix.
The Rust Porting Playbook holds a seven-document Rust suite.
tbd’s own enforced config holds practices that are executable but undocumented.
tbd’s `docs/general/` holds guideline-grade material that was never bundled.
Extracting all three, and splitting out what is not language-specific, produces a Rust
family and closes four coverage gaps that affect every language.

## Goals

- Ship a Rust guideline family in tbd with the same shape as the Python and TypeScript
  families.
- Set the Rust floor at the strictest of the available sources, with no menu of lax
  alternatives.
- Extract the undocumented practices from tbd’s enforced config into guidelines.
- Extract the language-neutral core of the Rust documents into shared guidelines, so
  each rule is written once rather than once per language.
- Keep coverage identical after extraction, with explicit routing from every scenario to
  the documents that own it.

## Non-Goals

- Upstreaming the porting layer.
  Construct mappings, parity evidence, differential testing, and upstream-sync workflows
  stay in the playbook.
- Retuning tbd’s ESLint or tsconfig settings.
  This work documents what is already enforced.
- Porting tbd itself to Rust, tracked in the playbook’s active TypeScript plans.

## Background

**tbd has zero Rust coverage today.** No `rust-*` guideline, no `review-code-rust`
shortcut, no `category: rust`. The 31 bundled guidelines carry five categories:
`general` (15), `typescript` (8), `python` (3), `desktop` (3), `convex` (2). The only
mentions of Rust in `packages/tbd/docs/` are incidental.

The playbook holds 1,765 lines across seven Rust guidelines, produced by the
[2026-08-08 reuse review](https://github.com/jlevy/rust-porting-playbook/blob/main/docs/reviews/rust-guideline-reuse-review-2026-08-08.md),
which recommends upstreaming them in two waves and tracks it as `rpp-u657`. They were
written to tbd’s shape, so the migration is mechanical.
The playbook already consumes tbd guidelines through `internal:` docrefs, so
distribution works in one direction already.

### Four Gaps in tbd’s Own Coverage

Auditing the playbook’s Rust documents against tbd’s catalog found four topics tbd has
no guideline for, in any language:

| Topic | tbd today | Consequence |
| --- | --- | --- |
| Filesystem behavior | Nothing | `eslint.config.js` forbids `fs.writeFile` in favor of `atomically`, and no guideline explains why. The rule is enforced but not taught. |
| Release engineering | `release-notes-guidelines`, which covers notes | Nothing states release identity, pre-release gates, least-privilege publishing, or artifact smoke tests. |
| Code review rules | Four `review-code*` shortcuts | The shortcuts are procedures with no rules document to load. Severity vocabulary lives only in dated review artifacts. |
| CI and gate wiring | Scattered across `pnpm-monorepo-patterns`, `typescript-lint-format-rules`, and `supply-chain-hardening` | No single answer to how a quality gate is wired and how you prove it is live. |

### Unbundled Material in This Repo

`docs/general/` holds 752 lines of guideline-grade material that `tbd guidelines` does
not serve, so no tbd user receives it:

| Document | Lines | Content |
| --- | ---: | --- |
| `agent-rules/tool-development-rules.md` | 323 | Patterns for LLM-usable tools: registry pattern, testing requirements, pitfalls. Overlaps `cli-agent-skill-patterns`. |
| `agent-guidelines/typescript-dependency-injection-guidelines.md` | 293 | Dependency injection for testability. |
| `agent-guidelines/typescript-testing-guidelines.md` | 136 | Testing real system interactions rather than mock existence, integration points, error scenarios, contract compliance. Mostly language-neutral. |

## Design

### How the Floor Is Set

The Rust floor is the strictest of three sources, not a merge of their averages:

1. **This repo’s enforced config.** `eslint.config.js`, `tsconfig.base.json`,
   `lefthook.yml`, `vitest.config.ts`, `scripts/`. The highest bar, because it is
   executable and has survived iteration.
2. **The playbook’s Rust guidelines.** The broadest Rust-specific surface coverage.
3. **tbd’s TypeScript family.** The structural model, and the source of rules that are
   about strictness rather than about TypeScript.

Where they disagree, the strictest wins.
Where one source has a mechanism the others lack, it is adopted rather than averaged
away.

**No menus.** A guideline states one default and the conditions for departing from it.
An agent handed ranked alternatives takes the cheapest one.
`rust-project-setup.md` §"Define a Clippy Policy" currently offers three lint strategies
whose first option, default lints plus `-D warnings`, is materially weaker than the
other two. That menu is deleted and replaced by the floor below.
Across the seven Rust documents there are 19 instances of choose, may, either, and
one-of phrasing to resolve the same way.

### Extraction From This Repo

Each practice below is enforced in this repo and documented nowhere, or documented only
inside a TypeScript-specific document.
The destination column names where it lands.

| Source | Practice | Destination |
| --- | --- | --- |
| `eslint.config.js` `no-restricted-imports` | Lint config enforces a correctness invariant—no code path writes a file non-atomically—rather than trusting review to catch it | `filesystem-rules` for the rationale; `rust-lint-format-rules` for the `disallowed-methods` form |
| `eslint.config.js` and `tsconfig.base.json` ratchet comments | An off-switch carries a tracker ID and a re-enable condition (`tbd-s9vn`, `tbd-tdh3`). A suppression with a tracker ID is debt; one without is decay | `ci-and-gates-rules` |
| `eslint.config.js` `.claude/worktrees/**` ignore | Agent worktrees hold a nested, mid-edit copy of the repo outside the tsconfig project. Linting them reports another agent’s work as your failures | `ci-and-gates-rules` |
| `scripts/check-eslint-contract.mjs` | Assert the *effective* config: compute severity for a probe file and require the floor rules at error. A gate that is not itself tested is not a gate | `ci-and-gates-rules` |
| `scripts/scrub-git-env.mjs`, `tests/scrub-git-env.ts`, `vitest.config.ts` `setupFiles` | Git exports `GIT_DIR` into hook environments, redirecting subprocesses onto the real repository and letting fixtures rewrite real refs (`tbd-a1lc`). Scrub in both the hook wrapper and the test setup; neither layer alone is sufficient | `ci-and-gates-rules`, with a pointer from `general-testing-rules` |
| `vitest.config.ts` platform-conditional timeouts | Raise a timeout only on the platform where it is genuinely tight, and record the measurement that forced it (`bridge-merge` at 5472ms against a 5000ms budget). A global raise masks hangs everywhere else | `general-testing-rules` |
| `lefthook.yml` `parallel: false` with priorities | `stage_fixed` jobs each run `git add` and contend on `.git/index.lock`; lefthook honors priority only when not parallel | `ci-and-gates-rules` |
| `lefthook.yml` `pnpm exec` over `npx` | Hook commands call a pinned local binary and fail if it is missing. A download-capable runner would fetch an unreviewed tool inside the gate | `ci-and-gates-rules` and `supply-chain-hardening` |
| `lefthook.yml` generated-file excludes | A formatter and a generator must never both own a file. Generated files are formatter-excluded and drift-tested | `ci-and-gates-rules` |
| `lefthook.yml` flowmark pin | A cool-off exception is recorded inline at the point of use: exact pin, scoped date override, reason, and a named reviewer | `supply-chain-hardening` |
| `package.json` `lint` versus `lint:check` | Fix mode and verify mode are separate scripts. CI runs the verify one and never commits | `ci-and-gates-rules` |
| `.github/workflows/ci.yml` | Jobs split so failures answer different questions; `pnpm audit --prod` in the gate; `astral-sh/setup-uv@v8.3.2` pinned to a full tag because that action publishes no floating major | `ci-and-gates-rules` |
| `docs/general/agent-guidelines/typescript-testing-guidelines.md` | Test real system interactions, not mock existence. Test integration points, error scenarios, and contract compliance | Neutral sections to `general-testing-rules`; bundle the TypeScript remainder |
| `docs/general/agent-rules/tool-development-rules.md` | LLM-usable tool design | Reconcile with `cli-agent-skill-patterns`, then bundle what survives |
| `docs/general/agent-guidelines/typescript-dependency-injection-guidelines.md` | Dependency injection for testability | Bundle as a `typescript` guideline |
| `docs/project/retrospectives/`, `docs/project/reviews/` | Dated project evidence | Cite, never copy |

### Extraction From the Playbook

Every Rust document, what it becomes, and where it lands.
“Neutral core” means the sections move into a shared guideline that Python and
TypeScript also use, and the Rust document keeps only what is Rust-specific.

| Playbook document | Lines | Disposition | tbd destination | Wave |
| --- | ---: | --- | --- | --- |
| `rust-rules.md` | 287 | Move as-is | `rust-rules` (`globs: "*.rs"`, `alwaysApply: true`) | 1 |
| *(new)* `rust-lint-format-rules.md` | — | Author, per the floor below | `rust-lint-format-rules` (`globs: "*.rs"`, `alwaysApply: true`) | 1 |
| `rust-project-setup.md` | 327 | Split; 4 of 12 content sections are neutral | `rust-project-setup` keeps Cargo shape, features, toolchain, rustfmt; CI, local-command parity, automation review, and dependency policy go to `ci-and-gates-rules` | 1 |
| `rust-cli-rules.md` | 290 | Move; drop the porting-parity pointer | `rust-cli-rules` | 1 |
| `rust-testing-rules.md` | 201 | Move; route generic assertions at `general-testing-rules` | `rust-testing-rules` | 1 |
| `rust-filesystem-rules.md` | 234 | Split; 9 of 10 content sections are neutral | `filesystem-rules` takes planning versus mutation, atomic visibility versus crash durability, backup and collision policy, cross-device moves, deterministic traversal, symlink boundaries, honest partial failure, state-machine testing; `rust-filesystem-rules` keeps `Path` and `OsStr` types and platform metadata | 2 |
| `rust-release-rules.md` | 267 | Split; 13 of 15 content sections are neutral | `release-engineering-rules` takes release identity, pre-release gate, automation choice, workflow authority, tooling cool-off, build-once, packaging, smoke tests, channel selection, multi-channel coordination, release-logic tests, incident preparation; `rust-release-rules` keeps crates.io trusted publishing and maturin wheels | 2 |
| `rust-code-review-rules.md` | 159 | Split; 6 of 7 content sections are neutral | `code-review-rules` takes severity, rule loading, baseline, risk ordering, actionable findings, quick scan; `rust-code-review-rules` keeps unsafe and FFI review | 2 |
| *(new)* `review-code-rust.md` | — | Author, mirroring `review-code-typescript` | `shortcuts/standard/review-code-rust.md` | 2 |
| `porting-principles-and-antipatterns.md`, `python-to-rust-*.md`, `filesystem-heavy-cli-porting.md`, `test-coverage-for-porting.md` | 1,674 | Stays in the playbook | — | — |

Result in tbd: 8 `rust-*` guidelines and 1 shortcut, plus 4 shared guidelines the
TypeScript and Python families also gain.

### The Rust Floor

`rust-lint-format-rules` mirrors `typescript-lint-format-rules` section for section: The
Floor, The `[lints]` Floor, Hooks and Gates, Verifying the Floor.
Every rule is derived from something already enforced.

| Source rule | Rust analogue | Mechanism |
| --- | --- | --- |
| Everything auto-formattable is auto-formatted | `cargo fmt --all`; `taplo fmt` for TOML; flowmark for Markdown; `--check` in CI | `rustfmt.toml`, CI |
| Zero-tolerance, verify-only lint gate | `cargo clippy --locked --workspace --all-targets --all-features -- -D warnings`; never `--fix` in CI | CI job |
| Type checking is a separate strict gate | `[lints.rust] unsafe_code = "forbid"`; `RUSTDOCFLAGS="-D warnings" cargo doc --no-deps` | `Cargo.toml`, CI |
| Strictest standard preset plus named rules | `clippy::pedantic` at `warn` with `priority = -1`, plus the picks below | `[lints.clippy]` |
| `noUncheckedIndexedAccess` | `clippy::indexing_slicing`, forcing `.get()` over `[i]` | `[lints.clippy]` |
| Exhaustiveness checks | `clippy::wildcard_enum_match_arm`, so a new variant is an error rather than a silent `_ =>` | `[lints.clippy]` |
| `no-floating-promises` | `clippy::let_underscore_future`, `#[must_use]` discipline, `unused_must_use` at deny | `[lints.clippy]`, `[lints.rust]` |
| `no-restricted-imports` forcing atomic writes | `disallowed-methods` naming `std::fs::write` and `std::fs::File::create`, directing to `tempfile::NamedTempFile::persist` | `clippy.toml` |
| Strict-preset tuning with a stated reason | `clippy::unwrap_used` and `expect_used` denied outside tests; `panic` denied in library code | `[lints.clippy]` |
| Exceptions are narrow and file-scoped | `#[expect(lint, reason = "...")]` at the narrowest scope | attribute |
| Legacy ratchets toward strict | Per-crate `[lints]` overrides, each off-switch carrying a tracker ID | `Cargo.toml` |

Two entries carry most of the value.
`disallowed-methods` is the Rust `no-restricted-imports`: the playbook states the
atomic-replacement rule in prose without wiring it to enforcement, and `clippy.toml`
supports exactly this.
`#[expect]` improves on the TypeScript equivalent, because it warns once the suppression
is unnecessary, so exceptions expire on their own; the TypeScript floor needs a written
rule to remove obsolete exceptions because its tooling cannot.
Where Rust has the better mechanism, the Rust document uses it rather than mirroring.

This table is a design proposal.
Phase 3 validates it against a real Rust codebase before it ships.

### Routing

Extraction only works if an agent still lands on the right document.

| Scenario | Loads |
| --- | --- |
| Writing Rust | `rust-rules`, `rust-lint-format-rules` (both `alwaysApply: true`, `globs: "*.rs"`) |
| Starting a Rust project | `rust-project-setup`, `rust-lint-format-rules`, `ci-and-gates-rules` |
| Rust CLI work | `rust-cli-rules`, `error-handling-rules` |
| Any filesystem mutation | `filesystem-rules`, plus `rust-filesystem-rules` in Rust |
| Any release | `release-engineering-rules`, `release-notes-guidelines`, plus `rust-release-rules` in Rust |
| Reviewing Rust | `review-code-rust`, which loads `code-review-rules`, `rust-code-review-rules`, and the topic guidelines matching the diff |
| Wiring or debugging a quality gate | `ci-and-gates-rules`, plus the language floor document |

Enforced by `globs` and `alwaysApply` frontmatter, a `**Related**:` block under each H1,
`description` text that makes `tbd guidelines --list` self-routing, and
`docs_cache.files` entries so every new name is served.

### Conversion Checklist

Applies to every migrated document.
Current state was measured, not assumed:

- [ ] **Relative links to bare names.** All seven documents cross-link as
  `](rust-rules.md)`, which breaks once served from `.tbd/docs/`.
- [ ] **Anchors rewritten.** Three documents use section anchors that do not survive the
  split.
- [ ] **Repo-local links resolved.** `rust-project-setup` and `rust-release-rules` link
  to `../SUPPLY-CHAIN-SECURITY.md`; `rust-release-rules` also links to a research
  document under `../docs/`.
- [ ] **Porting pointers removed.** `rust-cli-rules`, `rust-filesystem-rules`, and
  `rust-testing-rules` link to playbook documents that will not exist in tbd.
- [ ] **Frontmatter completed.** Add `globs: "*.rs"` and `alwaysApply: true` to
  `rust-rules` and `rust-lint-format-rules`. `category: rust` is a new category.
- [ ] **Related block added under the H1.** All seven put related links in a trailing H2
  only. Keep that section and add the bolded `Related` header block, matching Python and
  TypeScript.
- [ ] **Optionality removed**, per the no-menus rule.
- [ ] **Tracker language generalized** to “tracking issue or bead”.
- [ ] **Severity vocabulary** is Blocker, High, Medium, Low.
- [ ] **`common-doc-guidelines` followed**, including the footer and flowmark-clean
  formatting.

### Execution

The playbook is checked out with push access at `/home/user/rust-porting-playbook`; the
copy under `attic/` stays read-only for reference.
Playbook changes (the new floor document, the no-menus edits, the structural
regressions) land there on their own branch.
tbd changes (the shared guidelines, the migrated Rust family, the shortcut) land on a
tbd branch. Each side gets its own pull request so the review venues stay separate, as
the reuse review recommended.

## Implementation Plan

### Phase 1: Confirm and Prepare

- [ ] Confirm `rpp-u657` still tracks upstreaming; file the tbd-side receiving bead.
- [ ] Confirm `category: rust` renders correctly in `tbd guidelines --list`.
- [ ] Record per-document deltas against the conversion checklist.

### Phase 2: Extract the Shared Guidelines

- [ ] Author `ci-and-gates-rules`, `code-review-rules`, `filesystem-rules`, and
  `release-engineering-rules` in `packages/tbd/docs/guidelines/`, absorbing the
  extraction table above.
- [ ] Expand `general-testing-rules` with the neutral half of
  `typescript-testing-guidelines`, the platform-conditional timeout rule, and the
  hostile-environment pointer.
- [ ] Point `typescript-lint-format-rules` §Hooks and Gates and floor rules 6 and 8 at
  `ci-and-gates-rules` rather than restating them.
- [ ] Add the `filesystem-rules` pointer to `typescript-rules` §File Operations, giving
  the `atomically` rule a documented rationale.
- [ ] Have the `review-code*` shortcuts load `code-review-rules`.
- [ ] Bundle or retire the three unbundled `docs/general/` documents.

### Phase 3: Author and Validate the Rust Floor

- [ ] Draft `rust-lint-format-rules` in the playbook.
- [ ] Validate the `[lints]` block and `clippy.toml` against a real Rust codebase.
  flowmark-rs is the natural target, being first-party and the playbook’s primary case
  study. Record which lints fire, which are noise, and which need an exception.
- [ ] Build the Rust config-contract check: a probe fixture the lint gate must reject,
  wired into CI.
- [ ] Reduce `rust-project-setup` §"Define a Clippy Policy" to a pointer.

### Phase 4: Migrate

- [ ] Wave 1: `rust-rules`, `rust-lint-format-rules`, `rust-project-setup`,
  `rust-cli-rules`, `rust-testing-rules`, applying the conversion checklist.
- [ ] Wave 2: the three split documents plus `review-code-rust`.
- [ ] Register every new name in `docs_cache.files` as an `internal:` docref.
- [ ] Repoint the playbook’s `.tbd/config.yml` at `internal:guidelines/rust-*.md`, so it
  consumes them as it consumes the TypeScript family.
- [ ] Record the outcome in the playbook’s `_meta/playbook-improvement-log.md`.

## Testing Strategy

- Extend the playbook’s `tests/test_rust_guidelines.py` to assert the conversion
  checklist, so structure regressions fail before migration.
- Validate the Rust floor against flowmark-rs, not by inspection.
- The config-contract probe is the test for the floor itself.
- tbd side: `pnpm ci:quality` and the forkable-docs tests cover new bundled guidelines.
  Confirm `tbd docs sync` serves each new name and `tbd guidelines <name>` resolves it.
- After extraction, every H2 section in the source documents maps to a section in some
  destination document.
  No section is dropped silently.

## Open Questions

- **Does the Rust floor need a profile layer?** Probably not.
  `typescript-lint-format-rules` needs profiles because ESLint and Biome are genuine
  alternatives. Rust has one formatter and one linter, so the Rust document should be
  shorter than its model, with a single configuration.
- **Is `clippy::indexing_slicing` tolerable codebase-wide,** or does it need test-file
  scoping the way tbd scopes its `no-unsafe-*` relaxations?
  Phase 3 answers this with evidence.
- **Where is `rust-lint-format-rules` authored?** Drafting in the playbook keeps one
  review venue and one validation target; drafting in tbd avoids a second migration.
  Leaning playbook, since Phase 3 validation happens there.
- **Do the shared guidelines need Python counterparts?** The Python family has no
  filesystem or release document either.
  Extraction makes the shared ones available; Python-specific companions are out of
  scope here.

## References

- `typescript-lint-format-rules`, the model document
- `general-eng-agent-principles`, `common-doc-guidelines`, `supply-chain-hardening`
- [Rust guideline reuse review, 2026-08-08](https://github.com/jlevy/rust-porting-playbook/blob/main/docs/reviews/rust-guideline-reuse-review-2026-08-08.md),
  prior art and the two-wave recommendation
- [Playbook guidelines index](https://github.com/jlevy/rust-porting-playbook/blob/main/guidelines/README.md)
- This repo’s enforced config: `eslint.config.js`, `tsconfig.base.json`, `lefthook.yml`,
  `vitest.config.ts`, `scripts/check-eslint-contract.mjs`, `scripts/scrub-git-env.mjs`,
  `scripts/check-package-age.mjs`

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->

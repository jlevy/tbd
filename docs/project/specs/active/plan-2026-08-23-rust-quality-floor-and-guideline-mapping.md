---
title: Rust Quality Floor and Guideline Mapping
description: Add a strict Rust guideline family to tbd by migrating the Rust Porting Playbook suite, extract the undocumented practices from tbd's enforced config, and split the language-neutral core into shared guidelines
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: general
---
# Feature: Rust Quality Floor and Guideline Mapping

**Date:** 2026-08-23 (last updated 2026-08-23)

**Status:** In progress — Phases 2-4 complete in tbd; Phase 1 and 3 each leave one item
open that needs the playbook repo or a Rust codebase (noted inline); Phase 5 (playbook
simplification) not started

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
- Admit a compact Rust floor by defect class, enforcement reliability, incidence,
  adoption cost, applicability, and context cost, with named departure conditions.
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

### Consistency Fixes tbd Needs First

Registering a Rust family exposes defects in how tbd serves guidelines.
These block the migration and are fixed before it:

- **`GUIDELINE_GROUPS` has no Rust group.** `packages/tbd/src/file/doc-cache.ts` assigns
  each guideline to the first group whose `match` returns true, matching on the
  guideline *name* rather than its `category` frontmatter.
  Every `rust-*` document would fall through to the catch-all “Docs, process and
  tooling” group.
- **`rust-testing-rules` would be misrouted.** The `General engineering` group matches
  `n.includes('testing')` and is checked first, so a Rust-only document would land in
  the group whose note reads “Read all of these for any engineering work”, and would be
  served to Python and TypeScript sessions.
  The same pattern catches any future `<lang>-testing-rules`.
- **`GUIDELINE_GROUPS` has no test.** Nothing asserts that a guideline lands in the
  intended group, which is why the misrouting above is invisible today.
- **Generated skill files drift.** `.claude/skills/tbd/SKILL.md`,
  `.agents/skills/tbd/SKILL.md`, `skills/tbd/SKILL.md`, and `AGENTS.md` embed the
  generated directory between `BEGIN SHORTCUT DIRECTORY` markers.
  A guideline added without regenerating them is invisible to agents; `tbd-o732`
  recorded exactly this failure on an earlier guideline addition.
- **New names need `docs_cache.files` entries** in `.tbd/config.yml`, or `tbd docs sync`
  does not serve them.

## Design

### How the Floor Is Set

Three sources feed the floor:

1. **This repo’s enforced config.** `eslint.config.js`, `tsconfig.base.json`,
   `lefthook.yml`, `vitest.config.ts`, `scripts/`. The highest bar, because it is
   executable and has survived iteration.
2. **The playbook’s Rust guidelines.** The broadest Rust-specific surface coverage.
3. **tbd’s TypeScript family.** The structural model, and the source of rules that are
   about strictness rather than about TypeScript.

**A rule is admitted on its merits, not on its strictness.** The first version of this
plan said “where they disagree, the strictest wins”, which is not an engineering
criterion: a stricter rule can add false positives, suppressions, tool dependencies, and
ceremony that hide more signal than it recovers.
The admission criteria are the six in `rust-lint-format-rules`—defect class, enforcement
reliability, incidence, measured adoption cost, applicability across project shapes, and
context cost—and a rule clearing fewer than all six is a project preference, not a floor
rule. Where one source has a mechanism the others lack, it is adopted rather than
averaged away.

The evidence base is one codebase shape (a filesystem CLI with a library and an
extension module).
That is enough to *reject* a proposed universal rule and not enough to
*establish* one, which is why the floor now carries explicit departure conditions by
project shape rather than presenting itself as universal.

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
| `eslint.config.js` `no-restricted-imports` | Lint config can enforce a named persistence boundary, but that boundary must distinguish replacement, creation, append, and scratch writes rather than ban general primitives | `filesystem-rules` for the contracts; `rust-filesystem-rules` for Rust operations; `rust-lint-format-rules` for the limits of `disallowed-methods` |
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
| `rust-rules.md` | 287 | Move as-is | `rust-rules` (`globs: "*.rs"`) | 1 |
| *(new)* `rust-lint-format-rules.md` | — | Author, per the floor below | `rust-lint-format-rules` (`globs: "*.rs"`) | 1 |
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
| Unsafe and documentation checks are separate strict gates | `[lints.rust] unsafe_code = "deny"`; `missing_docs = "deny"`; `RUSTDOCFLAGS="-D warnings" cargo doc --no-deps` | `Cargo.toml`, CI |
| Standard preset plus named rules | `clippy::pedantic` at `deny` with `priority = -1`, plus the admitted rules below | `[lints.clippy]` |
| `noUncheckedIndexedAccess` | No universal analogue: `clippy::indexing_slicing` is a per-module ratchet where bounds failure must become recoverable behavior | `[lints.clippy]` |
| Exhaustiveness checks | `clippy::wildcard_enum_match_arm` when exhaustive handling is part of the enum-evolution contract | `[lints.clippy]` |
| `no-floating-promises` | `clippy::let_underscore_future`, `#[must_use]` discipline, `unused_must_use` at deny | `[lints.clippy]`, `[lints.rust]` |
| Persistence boundary enforcement | Intent-specific APIs; optionally disallow a project helper whose contract is always wrong, not `std::fs::write` or `File::create` globally | persistence module, optionally `clippy.toml` |
| Strict-preset tuning with a stated reason | `clippy::unwrap_used` denied outside tests; `expect_used` and `panic` are profile-specific candidates | `[lints.clippy]` |
| Exceptions are narrow and file-scoped | `#[expect(lint, reason = "...")]` at the narrowest scope | attribute |
| Legacy ratchets toward strict | Per-crate `[lints]` overrides, each off-switch carrying a tracker ID | `Cargo.toml` |

`#[expect]` improves on the TypeScript equivalent, because it warns once the suppression
is unnecessary, so exceptions expire on their own; the TypeScript floor needs a written
rule to remove obsolete exceptions because its tooling cannot.
Filesystem enforcement does not transfer directly from `no-restricted-imports`: Clippy
sees the method, not the caller’s replacement, creation, append, or scratch contract.
Where Rust has the better mechanism, the Rust document uses it rather than mirroring.

This table is a design proposal.
Phase 3 validates it against a real Rust codebase before it ships.

### Routing

Extraction only works if an agent still lands on the right document.

| Scenario | Loads |
| --- | --- |
| Writing Rust | `rust-rules`, `rust-lint-format-rules` (both `globs: "*.rs"`) |
| Starting a Rust project | `rust-project-setup`, `rust-lint-format-rules`, `ci-and-gates-rules` |
| Rust CLI work | `rust-cli-rules`, `error-handling-rules` |
| Any filesystem mutation | `filesystem-rules`, plus `rust-filesystem-rules` in Rust |
| Any release | `release-engineering-rules`, `release-notes-guidelines`, plus `rust-release-rules` in Rust |
| Reviewing Rust | `review-code-rust`, which loads `code-review-rules`, `rust-code-review-rules`, and the topic guidelines matching the diff |
| Wiring or debugging a quality gate | `ci-and-gates-rules`, plus the language floor document |

Enforced by `globs` frontmatter, generated-skill routing, a `**Related**:` block under
each H1, `description` text that makes `tbd guidelines --list` self-routing, and
`docs_cache.files` entries so every new name is served.

### Conversion Checklist

Applies to every migrated document.
Current state was measured, not assumed:

- [x] **Relative links to bare names.** All seven documents cross-link as
  `](rust-rules.md)`, which breaks once served from `.tbd/docs/`.
- [x] **Anchors rewritten.** Three documents use section anchors that do not survive the
  split.
- [x] **Repo-local links resolved.** `rust-project-setup` and `rust-release-rules` link
  to `../SUPPLY-CHAIN-SECURITY.md`; `rust-release-rules` also links to a research
  document under `../docs/`.
- [x] **Porting pointers removed.** `rust-cli-rules`, `rust-filesystem-rules`, and
  `rust-testing-rules` link to playbook documents that will not exist in tbd.
- [x] **Frontmatter completed.** Add `globs: "*.rs"` to `rust-rules` and
  `rust-lint-format-rules`. `globs` declare applicability; generated skill routing owns
  always-load policy, which document-local `alwaysApply` could contradict.
  `category: rust` is new.
- [x] **Related block added under the H1.** All seven put related links in a trailing H2
  only. ~~Keep that section and add the bolded `Related` header block~~—**this
  instruction was wrong**, and produced two Related lists per document.
  The family convention (`typescript-rules`, `python-rules`, and the four new
  cross-cutting documents) is the top block only.
  The trailing sections were removed and their unique links folded into the top block.
- [x] **Optionality removed**, per the no-menus rule.
- [x] **Tracker language generalized** to “tracking issue or bead”.
- [x] **Severity vocabulary** is Blocker, High, Medium, Low.
- [x] **`common-doc-guidelines` followed**, including the footer and flowmark-clean
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
  (Not done: the playbook is checked out read-only in this environment.)
- [x] Confirm `category: rust` renders correctly in `tbd guidelines --list`.
- [x] Record per-document deltas against the conversion checklist.
  (Recorded as the checklist above rather than as a separate table.)
- [x] Add a Rust group to `GUIDELINE_GROUPS`, ordered ahead of `General engineering` so
  `rust-testing-rules` is not captured by its `includes('testing')` match.
- [x] Add a test asserting each guideline lands in its intended group.

### Phase 2: Extract the Shared Guidelines

- [x] Author `ci-and-gates-rules`, `code-review-rules`, `filesystem-rules`, and
  `release-engineering-rules` in `packages/tbd/docs/guidelines/`, absorbing the
  extraction table above.
- [x] Expand `general-testing-rules` with the neutral half of
  `typescript-testing-guidelines`, the platform-conditional timeout rule, and the
  hostile-environment pointer.
- [x] Point `typescript-lint-format-rules` §Hooks and Gates and floor rules 6 and 8 at
  `ci-and-gates-rules` rather than restating them.
- [x] Add the `filesystem-rules` pointer to `typescript-rules` §File Operations, giving
  the `atomically` rule a documented rationale.
- [x] Have the `review-code*` shortcuts load `code-review-rules`.
- [~] Bundle or retire the three unbundled `docs/general/` documents.
  One absorbed (`typescript-testing-guidelines`, whose neutral half is now in
  `general-testing-rules`, with a pointer left behind).
  Two left undecided—see the Outcome Note: neither is what the plan described, so
  neither is bundled as written.

### Phase 3: Author and Validate the Rust Floor

- [x] Draft `rust-lint-format-rules` in the playbook.
- [x] Validate the `[lints]` block and `clippy.toml` against a real Rust codebase.
  flowmark-rs is the natural target, being first-party and the playbook’s primary case
  study. Record which lints fire, which are noise, and which need an exception.
- [ ] Build the Rust config-contract check: a probe fixture the lint gate must reject,
  wired into CI. (Not done: tbd has no Rust code, so the probe has no home here.
  `rust-lint-format-rules` §Verifying the Floor specifies it for adopting projects.)
- [x] Reduce `rust-project-setup` §"Define a Clippy Policy" to a pointer.

### Phase 4: Migrate

- [x] Wave 1: `rust-rules`, `rust-lint-format-rules`, `rust-project-setup`,
  `rust-cli-rules`, `rust-testing-rules`, applying the conversion checklist.
- [x] Wave 2: the three split documents plus `review-code-rust`.
- [x] Register every new name in `docs_cache.files` as an `internal:` docref.
- [x] Regenerate the skill files and `AGENTS.md`, so the new guidelines are visible to
  agents rather than only present on disk.
- [ ] Repoint the playbook’s `.tbd/config.yml` at `internal:guidelines/rust-*.md`, so it
  consumes them as it consumes the TypeScript family.
- [ ] Record the outcome in the playbook’s `_meta/playbook-improvement-log.md`.

### Phase 5: Simplify the Playbook

Once tbd serves the Rust family, the playbook should consume it rather than keep a
second copy. This phase is what makes the migration a consolidation instead of a fork.

- [ ] Replace each migrated guideline in `guidelines/` with an `internal:` docref in
  `.tbd/config.yml`, so the playbook loads tbd’s copy the way it already loads the
  TypeScript family.
- [ ] Record the disposition of every moved document in
  `_meta/playbook-improvement-log.md`: which file moved, to which tbd name, and at which
  commit. Git history holds the content; the log holds the mapping.
- [ ] Rewrite `guidelines/README.md` so the general Rust table points at tbd names and
  the porting table stays local.
  The index stops being the home of the Rust suite and becomes a router.
- [ ] Repoint the playbooks, mapping references, and case studies at the tbd names.
- [ ] Reduce `tests/test_rust_guidelines.py` to what still lives in the repository, and
  keep the porting-layer structure assertions.
- [ ] Confirm the porting layer still reads correctly with the general layer external:
  every target-side rule it relies on resolves through tbd.

The porting documents stay in the playbook permanently.
They exist only when another implementation is authoritative, which is the boundary the
2026-08-08 reuse review drew and this phase preserves.

## Outcome Notes

Recorded during implementation, where the result differed from what this plan assumed.

**The Rust floor is stricter than proposed.** The floor table below suggested
`clippy::pedantic` at `warn`. [fdu](https://github.com/jlevy/fdu) enforces it at `deny`,
along with `missing_docs`, `unsafe_code`, and `warnings`, and each clears the admission
criteria above, so the shipped document uses `deny`. `unsafe_code` is `deny` rather than
`forbid`, because `forbid` cannot be overridden at all and the first justified
platform-specific block would force the workspace setting down instead of taking a
scoped exception.

**The lint table was validated, then re-measured after the first method proved wrong.**
The original measurement split each file’s diagnostics at its first `#[cfg(test)]`
attribute. That attribute applies to the *next item*, not to the rest of the file, and
the split misfiled 34% of diagnostics — in both directions.
The measurement now runs two clippy passes and classifies by compile unit and cargo
target. The reproducer is `scripts/measure-rust-lint-cost.mjs`; the full 415-row mapping
and the method are in
`docs/project/research/current/evidence-2026-08-23-rust-lint-cost.md`.

Corrected costs (shipping / build scripts / tests): `let_underscore_future` 0/0/0,
`panic` 2/2/35, `wildcard_enum_match_arm` 12/0/9, `disallowed-methods` for filesystem
writes 0/1/82, `expect_used` 32/7/35, `indexing_slicing` 79/0/119. Every nonzero figure
moved.
The build-script share of `panic` is now supported, while semantic review reversed
the filesystem-method verdict: low incidence measures migration cost but cannot
establish that a global ban fits distinct write contracts.
`clippy::indexing_slicing` costs 79 shipping sites and is **not** a floor rule — this
answers the open question below.
The analogy to `noUncheckedIndexedAccess` is inexact: the TypeScript flag changes an
inferred type and is usually satisfied by a bounds check the code already has, whereas
`indexing_slicing` demands `.get()` plus real error handling at all 79 sites.

**Two traps found by running the checks rather than reasoning about them.** Clippy’s
`allow-unwrap-in-tests` / `allow-expect-in-tests` cover inline `#[cfg(test)]` items but
not integration tests under `tests/`, examples, or build scripts.
And `grep -L 'workspace = true'` is a false pass for lint opt-in, because that string
also appears in inherited package fields; the check has to look for the `[lints]` table
itself.

**The three unbundled `docs/general/` documents are narrower than assumed.**
`typescript-dependency-injection-guidelines` is Convex-specific in its framing, not a
general TypeScript DI guideline, and `tool-development-rules` is specific to the AI
SDK’s `tool()` API rather than to LLM-usable tools in general.
Neither meets the bar for a bundled guideline as written; both are left in place,
undecided. The neutral half of `typescript-testing-guidelines` was absorbed into
`general-testing-rules`, and the source document now carries a pointer naming that
guideline as the authority.

**The group fix shipped is not the one planned.** The plan called for ordering the Rust
group ahead of `General engineering` so `rust-testing-rules` would not be captured by
its `includes('testing')` match.
Ordering only moves the collision: the next `<lang>-testing-rules` hits it again, and so
does any future group added above.
What shipped replaces the substring matches with explicit name sets, which removes the
class rather than the instance, and makes group membership something a test can assert.

**A group can name documents that do not exist.** The Cross-cutting group was wired and
tested before its four documents were authored, so it rendered as an empty heading while
the routing test passed.
`guideline-groups.test.ts` now checks both explicit name sets against what is actually
bundled.

### Response to the Holistic Review (2026-08-23)

`docs/project/reviews/review-2026-08-23-pr258-holistic-engineering-guidelines.md`
requested changes on eight High and five Medium findings.
What changed, and what the evidence for each was:

| Finding | Resolution |
| --- | --- |
| R1 lint-cost method | Re-measured by compile unit; reproducer, raw 415-row mapping, and the 34% misattribution rate published. The counts did not reverse a verdict; later contract analysis, independent of cost, rejected the global filesystem-method ban. |
| R2 gates that cannot fail | Both recipes rewritten and *run*: the old lint-policy loop exits 0 both when it prints a complaint and when a member sits outside `crates/*`; the old cross-lint passes green on a runner with no cross targets. Both new versions were watched failing. |
| R3 action pinning | Tag exception removed. All 15 action references in this repo pinned to commit SHAs, `dependabot.yml` added so pins do not freeze, and `scripts/check-action-pins.mjs` added as the gate, with negative tests. |
| R4 write contracts | `filesystem-rules` names five write contracts and scopes atomic replacement to authoritative-path replacement; the Rust half maps each to an `OpenOptions` spelling. The residual global Clippy ban was removed because the method does not identify the caller’s intent. |
| R5 context budget | Always-load core cut from 2,233 lines / 11,806 words to 136 / 1,090 by routing testing, TDD, goldens, compatibility, commits, coding details, comment policy, and error handling by changed surface. Membership is explicit, `guideline-budget.test.ts` asserts the ceiling, and generated routing is the sole always-load-policy source. |
| R6 strictest wins | Replaced with six admission criteria and per-project-shape departure conditions. |
| R7 FFI unwinding | Corrected: a Rust panic escaping `extern "C"` aborts; a foreign exception entering Rust is the UB case. |
| R8 broken pipes | Neutral contract moved to `error-handling-rules`; Rust and TypeScript recipes fixed so only the primary stdout renderer converts, and a closed stderr can never lower a nonzero status. |
| R9 `abi3` | Removed from the binary-wheel path; extension modules given their own subsection. |
| R10 flush | Example rewritten around a real `BufWriter`, with `into_inner` for error-preserving recovery and a conditional `sync_all`. Compile-verified. |
| R11 test counts | Both count-based proxies replaced with independent-evidence selection. |
| R12 severity anchoring | Both quick-scan tables converted from “default severity” to “question that decides it” plus consequence. |
| R13 authoring order | Build-then-validate through `packages/tbd/dist/bin.mjs`, YAML quoting rather than punctuation avoidance, list nesting fixed. |

Not done, and tracked rather than silently dropped: the `topics` / `appliesTo` /
load-policy metadata refactor R5 proposes (the routing change here delivers the budget
without it), the adversarial decision-scenario suite in S2, and admission records for
every rule in S1 — the criteria are published and applied to the Rust floor, but the
per-rule records are not.

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
- ~~**Is `clippy::indexing_slicing` tolerable codebase-wide,** or does it need test-file
  scoping?~~ **Answered.** No, not as a hard deny: 79 shipping sites in a codebase
  already at this floor.
  It is documented as a per-module ratchet, not a floor rule.
  See Outcome Notes.
- ~~**Where is `rust-lint-format-rules` authored?**~~ **Answered.** Authored directly in
  tbd, which avoids a second migration.
  Validation ran against fdu rather than flowmark-rs, since fdu is a larger first-party
  Rust codebase already at this floor.
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

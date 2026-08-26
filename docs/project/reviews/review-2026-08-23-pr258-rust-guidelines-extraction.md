---
title: 'Senior Review: PR #258 — Cross-Cutting Guidelines and the Rust Family'
description: Full senior engineering review of PR #258 (12 new guidelines, 1 shortcut, expanded general-testing-rules), calibrated for a corpus whose readers are highly capable coding agents—factual verification, duplication and verbosity analysis, routing consistency, and framework fit
author: Review session operated by Joshua Levy with LLM assistance
---
# Senior Review: PR #258 — Cross-Cutting Guidelines and the Rust Family

**PR:** https://github.com/jlevy/tbd/pull/258 (branch
`claude/rust-guidelines-extraction-o9x2yy`)

**Reviewed commit:** `078938d`

**Date:** 2026-08-23

**Scope:** All 29 changed files (+3,802/−32): the four cross-cutting guidelines, the
eight Rust guidelines, the `review-code-rust` shortcut, the expanded
`general-testing-rules`, the `doc-cache.ts`/`doc-categories.ts` changes and their tests,
and the generated and registration surfaces (SKILL.md files, `.tbd/config.yml`, README).
Every new document was read in full and compared against the existing corpus
(`typescript-rules`, `typescript-lint-format-rules`, `python-rules`,
`common-doc-guidelines`, the `new-guideline` shortcut) for convention fit.
Factual claims were verified against primary sources where possible: the `tempfile`
crate’s documentation and Windows implementation, the repo’s own `eslint.config.js` and
`scripts/check-eslint-contract.mjs`, and rustc/clippy/cargo semantics.
The full test suite was run locally on the branch: 158 files, 2,415 tests, all passing,
matching the PR’s claim.

**Review calibration:** The audience for these documents is highly capable coding
agents. Content earns its context cost when it is opinionated-and-likely-correct, covers
what is commonly done inconsistently, or teaches the neglected and non-obvious (the
`tryscript`/golden-testing class of material).
Restating what a strong model already produces from its priors is negative value.
Findings below apply that bar.

## Summary and Verdict

**Verdict: approve with fixes.** The design is right, most of the content clears the
high bar, CI is green, and the code changes are clean and well-tested.
One factual error in a shipped guideline (R1) and one verification step that contradicts
its own principle (R2) should be fixed before merge—both are small, localized edits.
The duplication cluster (R3) is the main simplification opportunity and directly serves
the stated goal of not wasting context on capable agents; it can land in this PR or as
an immediate follow-up, but it should land.

What is strong, specifically:

- **The extraction shape is correct.** Neutral core in four shared documents, thin
  language-specific residue, each split document opening with “read the neutral one
  first; this owns only what is Rust-specific.”
  That structure scales to future language families (the plan already notes Python lacks
  filesystem/release documents) and writes each rule once.
  `rust-release-rules`, `rust-code-review-rules`, and `rust-filesystem-rules` execute
  the split best.
- **The measured-adoption-cost table in `rust-lint-format-rules` is the model to
  replicate.** Measuring candidate lints against a real 35k-line codebase, splitting
  production from test sites, and rejecting two commonly proposed rules with numbers
  ("62 production sites in a codebase already at this floor") converts taste into
  evidence. This is exactly the opinionated, non-obvious content this corpus exists
  for—as are the `#[expect]` expiry rationale, the workspace-lints opt-in trap, the
  `allow-*-in-tests` scope limits, and the false-pass `grep -L 'workspace = true'`
  correction.
- **The four cross-cutting documents are dense with material that is genuinely
  neglected**: the pipeline-exit-status trap with a worked example, self-recorded
  evidence, single-platform lint blindness, the lefthook `parallel: false`/`priority`
  interaction, `GIT_DIR` scrubbing at two layers, suppression ratchets with tracker IDs,
  the unpublished-sibling packaging trap, smoke-testing the packaged artifact rather
  than the build output.
  Verified spot-checks all held (see False Positives).
- **The `doc-cache.ts` fix is better than the plan proposed.** Replacing substring
  matches with exact-name sets removes the root cause (any future `<lang>-testing-rules`
  misroute) rather than working around it with group ordering, and `guidelineGroupFor`
  is exported and tested.

## Design Assessment

The alternative to this shape—complete per-language documents with no shared core—was
rightly rejected: it multiplies every neutral rule by the number of language families
and guarantees drift.
The cost of the chosen shape is pointer-chasing across documents, which the **Related**
blocks and “read it first” openers handle adequately.
The strictest-wins, no-menus floor policy fits the agent audience: an agent handed
ranked alternatives takes the cheapest, so a single stated default with named departure
conditions is the correct genre.
No materially better structure was identified.

Where execution lags the design is discipline about which document owns an artifact.
Several rule statements, config blocks, and examples appear verbatim in two or three
documents that are co-loaded by construction (R3). For this corpus, duplication is not
just a maintenance risk; it is a per-session context tax multiplied across every
downstream repo, and the documents’ own `common-doc-guidelines` names avoiding it as a
rule.

On verbosity calibration: the cross-cutting four, `rust-lint-format-rules`,
`rust-release-rules`, `rust-filesystem-rules`, and `rust-code-review-rules` pass the
“would a capable agent already know this” test well.
`rust-rules` and parts of `rust-project-setup` and `rust-cli-rules` carry the most
textbook material (S1 names specific cuts).
This is consistent with the existing family (`python-rules` and `typescript-rules` also
carry basics), so it is a trim-going-forward suggestion, not a blocker.

## Findings

Severity vocabulary per `code-review-rules`: Blocker/High/Medium/Low.

**R1 (High). `rust-filesystem-rules.md:101` states the opposite of `persist`’s actual
Windows behavior.** The document says “**`NamedTempFile::persist` fails rather than
clobbering on Windows**.” Verified against the `tempfile` crate: the documentation says
“If a file exists at the target path, persist will atomically replace it,” and the
Windows implementation calls `MoveFileExW` with `MOVEFILE_REPLACE_EXISTING` when
overwriting is requested.
`persist` replaces the destination on every platform—that is what makes it usable as the
atomic-replace primitive the same section recommends.
The claim as written also contradicts the section’s own purpose: if `persist` failed on
existing destinations, it could not implement step 5 of `filesystem-rules`’ replacement
sequence on Windows at all.
An agent believing it would treat `persist` as collision-safe and silently clobber,
inverting `filesystem-rules`’ “never make overwrite the fallback” rule.
**Fix:** Replace the sentence with the accurate distinctions: `persist` atomically
replaces an existing destination on all platforms; on Windows it can fail with a
permission error when the destination is open (no POSIX-style replace-while-open);
`persist_noclobber` is the variant that fails when the destination exists.

**R2 (Medium). `rust-lint-format-rules.md:281-284` — the “confirm the effective lint
level” command changes the effective lint level.** Step 2 of “Break Each Floor Rule Once
to Prove It Runs” runs
`cargo clippy --workspace --all-targets -- -W clippy::pedantic 2>&1 | head`. Trailing
command-line lint flags are passed to rustc after the `[lints]`-derived flags, and the
last flag wins, so `-W clippy::pedantic` demotes the manifest’s `deny` to `warn` for
that run. The command therefore cannot confirm the configured level—it overrides it—in a
section whose stated principle is “confirm the effective lint level, not the config
text.” The deliberate-violation probe in the next sentence is the real check.
**Fix:** Delete the `-W` command and let the step be the probe: introduce a violation
(an `unwrap()` in library code, an undocumented public item), run the normal gate with
no extra flags, and confirm it fails.

**R3 (Medium). Whole sections, config blocks, and examples are duplicated across
co-loaded documents.** The inventory, each with the suggested single owner:

- (a) “Raise Gate Timeouts Only With a Recorded Measurement”—full section including the
  identical `bridge-merge`/`isWindows` example—appears in both
  `ci-and-gates-rules.md:281-297` and `general-testing-rules.md`. The plan assigned this
  rule to `general-testing-rules`; keep it there and reduce the CI document to one
  sentence and a pointer.
- (b) `rust-testing-rules` restates three sections of the co-loaded
  `general-testing-rules` with only wording changes and no Rust content: “Keep Tests
  Deterministic” (`rust-testing-rules.md:47-58`), most of “Treat Fixtures as Inputs With
  Provenance” (60-69; the Rust part is `include_str!`/`include_bytes!`), and “Keep
  Ignored and Flaky Tests Actionable” (180-189). The “do not duplicate the same
  assertion at every layer” bullet also now appears in both.
  Cut the neutral restatements; keep the Rust-specific residue.
  This is the one document that does not honor its own “supplements the
  language-agnostic guidance” framing.
- (c) The `filter_map(Result::ok)` bad/good example is verbatim in
  `filesystem-rules.md:166-186` and `rust-filesystem-rules.md:124-144`. It is Rust code
  either way; since `filesystem-rules` needs a concrete illustration for all languages,
  keep it there and have the Rust document add only the
  `entry.io_error().map(|e| e.kind())` refinement and the `filter_entry` pruning note.
- (d) The `disallowed-methods` TOML block is verbatim in
  `rust-lint-format-rules.md:164-172` and `rust-filesystem-rules.md:61-69`. One owner
  (the lint document, which also carries the measured cost), one pointer.
- (e) The `rust-toolchain.toml` block plus the pin-versus-MSRV paragraph appear in both
  `rust-lint-format-rules.md:139-151` and `rust-project-setup.md:122-137`, nearly
  verbatim including the “compiles *and* tests” sentence.
- (f) The verify-gate command block (fmt/clippy/test/doc/deny) appears in
  `rust-lint-format-rules.md:243-250` and `rust-project-setup.md:177-183`.
- (g) The workspace-lints opt-in rule is stated twice within `rust-project-setup` itself
  (`:82-87` and `:162-164`) on top of its full treatment in
  `rust-lint-format-rules.md:107-116`.
- (h) The paired review questions ("did this change make a check unable to fail?"
  / “does this test still assert what its name claims?”) appear in three documents:
  `code-review-rules.md:169-172`, `general-testing-rules.md`, and
  `rust-code-review-rules.md:107-110`. State once in `code-review-rules`; point
  elsewhere.

**Fix:** One owner per artifact plus a pointer, per the split convention the PR itself
establishes. Rough saving is 150-200 lines (~1.5-2k tokens) concentrated in exactly the
document sets that load together, and it removes the drift risk of parallel copies.

**R4 (Medium). `review-code.md` step 5 routes TypeScript and Python but not Rust.** The
general review shortcut (which `review-github-pr` invokes) instructs loading language
rules for TS and Python files and now for topic guidelines, but a Rust diff gets no
language instruction, despite this PR shipping the Rust family and a routing table in
the plan that covers this scenario.
**Fix:** Add a “For Rust files” line to step 5, mirroring the TypeScript one: load
`rust-rules` and `rust-lint-format-rules` (plus `rust-code-review-rules`).

**R5 (Medium). `review-code-typescript` and `review-code-python` do not load
`code-review-rules`, though the plan checks off “Have the `review-code*` shortcuts load
`code-review-rules`.”** Only `review-code` and `review-code-rust` do.
The Rust variant also demonstrates a better structure for a language-focused review
(process + rules + surface routing + gate confirmation) than the older two variants.
**Fix:** Add the `code-review-rules` load line to both older variants (minimum), or
bring them up to the `review-code-rust` shape; alternatively correct the plan checkbox.
The first option is cheap and matches the plan’s intent.

**R6 (Medium). The skill templates that gate discovery never mention Rust, and their
guideline count is stale.** `packages/tbd/docs/install/claude-header.md` lists
TypeScript, Python, and Convex in both the “Use for:” and “Invoke when user mentions:”
trigger lists—an agent hearing “Rust best practices” gets no trigger word.
`skill-baseline.md:12` and `skill-minimal.md:45` still say “25+ engineering guidelines
(TypeScript, Python, …)” while the README on this branch says 40+ (43 are bundled).
The baseline’s User Request → Agent Action table has “Use TypeScript best practices” and
“Use Python best practices” rows but no Rust row, so the primary routing surface never
loads the Rust pair at all.
(Regeneration of the *committed* skill surfaces is separately and deliberately tracked
as `tbd-eidy`; this finding is about the source templates, which that bead does not
cover.) **Fix:** Add Rust to both trigger lists, add a “Use Rust best practices” routing
row that loads `rust-rules rust-lint-format-rules`, and update the counts (or make them
future-proof, e.g. “40+”).

**R7 (Medium). `guideline-groups.test.ts:76-85` cannot catch the next empty-heading
regression—the class it was written for.** The bundled-existence check tests a
hand-copied `named` array.
A future name added to `GENERAL_ENGINEERING_NAMES` or `CROSS_CUTTING_NAMES` in
`doc-cache.ts` without a bundled document reproduces the exact “group names documents
that do not exist” defect the PR description reports, and every test still passes (the
copied list doesn’t contain the new name, and the non-empty-heading check stays
satisfied by the other members).
The deliberate-copy pattern is right for contract vocabularies (`doc-categories.test.ts`
pins an error-message contract); here the set is routing configuration where drift means
silent failure. **Fix:** Export the two sets (or one combined
`EXPLICITLY_GROUPED_GUIDELINES` constant) from `doc-cache.ts` and assert every member is
bundled.

**R8 (Medium).
The seven migrated Rust documents carry two Related lists each; the family
convention is one.** All of `rust-rules`, `rust-project-setup`, `rust-cli-rules`,
`rust-testing-rules`, `rust-filesystem-rules`, `rust-release-rules`, and
`rust-code-review-rules` have both the top `**Related**:` block and a trailing “##
Related Guidelines” section with substantially the same links.
`typescript-rules`, `python-rules`, the four new cross-cutting documents, and the
freshly authored `rust-lint-format-rules` all have the top block only—so the PR is
internally inconsistent as well as duplicative.
The plan’s conversion checklist instructed keeping both ("Keep that section and add the
bolded Related header block"); the instruction is the bug.
**Fix:** Delete the trailing sections (folding any link that appears only there into the
top block) and correct the plan checklist item.

**R9 (Low).
`rust-filesystem-rules.md:89` — the comment describes a writer that is not in
the example.** `staged.flush()?; // flushes the BufWriter, not the file` annotates code
with no `BufWriter`; `NamedTempFile`’s `flush` forwards to `File::flush`, which is a
no-op. The flush-versus-`sync_all` trap is real, but the comment as written teaches a
wrong model of this exact code.
**Fix:** Either wrap the writes in a `BufWriter` so the comment is true, or reword: “a
no-op here, but required the moment a buffered writer wraps the file; `sync_all` is what
reaches the device either way.”

**R10 (Low). Typo in `ci-and-gates-rules.md:81-82`:** “works exactly until the once
somebody forgets” → “until the one time somebody forgets.”

**R11 (Low). Session and plan hygiene.** Beads for work completed in this PR remain open
(`tbd-japx`, `tbd-gr6y`, `tbd-jfs3`, `tbd-3w73`, `tbd-g3b5` at minimum), and the last
bead sync (05:39Z) predates the branch’s final commits.
The plan header says “Phases 1-4 complete in tbd” while Phase 1 leaves two items
unchecked (confirm `rpp-u657`/file the receiving bead; record per-document conversion
deltas) and Phase 3 leaves the Rust config-contract probe unchecked.
The plan also does not record that the shipped group fix (exact-name matching) differs
from the planned one (ordering the Rust group first)—a better fix worth one outcome
note, in the document that otherwise records outcomes diligently.
**Fix:** Close the completed beads and sync; make the status line agree with the
checkboxes; add the one-line outcome note.

## Suggestions (Non-Blocking)

**S1. Trim `rust-rules` (and spots in `rust-project-setup`/`rust-cli-rules`) against the
capable-agent bar.** Candidates where a strong model needs no instruction: the first two
Ownership bullets (borrow-when-reading / own-when-storing), “Organize modules around
coherent responsibilities,” “Explain why, not syntax” (this is `general-comment-rules`,
which is always loaded), the first two Performance bullets, and the explanatory halves
of the `thiserror`/`anyhow` bullets (keep the default-plus-departure-condition framing,
one line each; cut the rationale).
In `rust-project-setup`, “Document the Supported Surface” and “Keep Repository
Configuration Minimal” are mostly inventory a capable agent produces unprompted—the two
bullets worth keeping are `.gitattributes` newline policy and license files matching the
manifest expression.
Keep, emphatically: the clone-as-design-signal destructuring idiom, `Cow` criteria,
no-lock-guards-in-APIs, `Default`-requires-a-decision, `LazyLock` sufficiency,
no-compatibility-re-exports, cancellation safety, bounded queues, the Edition 2024
review list, and the whole SIGPIPE section in `rust-cli-rules`—that is the non-obvious
material.

**S2. Calibrate description frontmatter length.** Self-routing descriptions are the
right goal (they make `tbd guidelines --list` and the directory tables useful), but
several run 60-80 words and render in full in the four generated SKILL surfaces every
session loads (`code-review-rules`, `ci-and-gates-rules`, `filesystem-rules`,
`release-engineering-rules`, `rust-filesystem-rules`, `rust-code-review-rules`). Most
compress ~40% with no routing loss by dropping the trailing “Load …” clause (the group
note already says when to load) and one level of enumerated detail.

**S3. Update the `new-guideline` shortcut to match the process this PR actually
exercised.** It currently says “one-line description,” and omits: the `category`
frontmatter field, `docs_cache.files` registration in `.tbd/config.yml`, the
`GUIDELINE_GROUPS` explicit-name sets for non-prefixed names (plus the
`guideline-groups.test.ts` update), the top `**Related**:` block convention, and
`globs`/`alwaysApply` for always-load language documents.
The next guideline author will rediscover each of these the hard way; this PR is the
evidence of the real checklist.

**S4. Consider ordering “Cross-cutting engineering topics” directly after “General
engineering”** in `GUIDELINE_GROUPS`. Its note says “in any language,” and it currently
renders after Convex, below all language groups it applies to.

**S5. Dedupe the quick-scan tables.** About five rows in
`rust-code-review-rules.md:84-105` are not Rust-specific and repeat the neutral table in
`code-review-rules` (success-before-verify, discarded required result,
one-implementation trait, suppression without tracker ID, ignored test without tracker).
Keep the genuinely Rust rows (`unsafe` without safety argument, lock guard across
`await`, `filter_map(Result::ok)`, `#[allow]` where `#[expect]` expires, `mod.rs`
convention).

**S6. The `tbd-eidy` bug’s proposed CI check is this corpus’s own rule applied to this
repo.** “Regenerate in CI and fail on any difference” (`ci-and-gates-rules`, Generated
Files Have Exactly One Owner) is precisely a drift test for `tbd setup --auto` over the
committed skill surfaces—worth doing while the rule is fresh.

## False Positives (Checked, Confirmed Benign)

- **`@typescript-eslint/no-restricted-imports` in `filesystem-rules`** matches the
  repo’s real `eslint.config.js:132` (the extension rule, not core
  `no-restricted-imports`)—the example faithfully quotes the enforced config.
- **The `check-eslint-contract.mjs` excerpt in `ci-and-gates-rules`** matches
  `scripts/check-eslint-contract.mjs` (`curly`, `no-floating-promises`,
  `use-unknown-in-catch-callback-variable`), including the survived-prettier comment.
- **The pipeline-exit-status example** is correct in both directions: a failing
  `cargo tree` yields empty grep input, `grep -q` returns 1, `!` inverts to 0; the
  “good” form fails the command’s own error and preserves the inverted-match check.
- **README “40+ guideline documents”**: 43 are bundled on this branch.
- Verified correct as stated: `#[expect(lint, reason)]` warning when unfulfilled;
  `unsafe_code` `deny`-not-`forbid` rationale; `forbid` being non-overridable;
  `allow-unwrap-in-tests` not covering `tests/`/examples/build scripts (matches the PR’s
  empirical 996-versus-25 measurement); `disallowed_methods` having no test-scoping
  option; lefthook honoring `priority` only when not parallel; `npx`/`pnpm dlx`/`bunx`
  fetch-on-missing versus `pnpm exec` fail-on-missing; `ErrorKind::CrossesDevices`
  (stable 1.83) under the examples’ 1.85 MSRV; `with_extension` turning `archive.tar.gz`
  into `archive.tar.old`; Rust ignoring SIGPIPE by default; edition 2024 requiring
  `rust-version` ≥ 1.85; clap `default_value_t` with `ValueEnum`; virtual workspaces
  needing an explicit `resolver`; the Clippy `restriction` group containing
  contradictory lints.
- **`generateShortcutDirectory`’s heading-based double lookup** after
  `guidelineGroupFor` is slightly indirect but keeps the rendered directory on the exact
  function the tests pin; fine as is.
- **The fdu lint-cost numbers** (external repo at `d42d970`) are not independently
  reproducible from this session; the method is stated, internally consistent, and the
  two traps it surfaced are documented—accepted as evidence.

## Documentation

- Plan spec: status line, two Phase 1 checkboxes, Phase 3 probe checkbox, and the
  group-fix outcome note (R11); the “Bundle or retire” Phase 2 item reads as done while
  the outcome note honestly records two documents left undecided—reword the checkbox or
  the note so they agree.
- `docs/development.md` needs no changes (the new material is bundled package content,
  not repo workflow).
- README table and count updated correctly; `typescript-testing-guidelines`
  superseded-note is a good pattern for future absorptions.

## CI Status

All green at `078938d`: ubuntu (Node 22.12.0, Node 24), macOS, Windows test jobs;
Coverage & Lint; Benchmark; DeepSource (grade A, secrets clean).
Local run on the branch: 158 files, 2,415 tests passed.
Coverage bot flags `doc-cache.ts` at ~64% lines—the uncovered ranges are pre-existing
rendering paths, and `guidelineGroupFor` itself is covered by the new test.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->

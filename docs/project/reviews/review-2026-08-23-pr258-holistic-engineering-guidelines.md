---
title: 'Holistic Review: PR #258 — Engineering Guideline Corpus'
description: 'Standalone review of PR #258 as a cross-language guideline system for highly capable coding agents, covering evidence quality, policy design, routing cost, and factual correctness'
author: Review session operated by Joshua Levy with LLM assistance
---
# Holistic Review: PR #258 — Engineering Guideline Corpus

**PR:** https://github.com/jlevy/tbd/pull/258

**Reviewed commit:** `9ae5dffef3ea896a32f29f317cec69c1be62876e`

**Date:** 2026-08-23

**Scope:** All 37 changed files (+4,163/−62), including the four cross-cutting
guidelines, eight Rust guidelines, expanded general testing rules, review and authoring
shortcuts, routing code and tests, generated skill surfaces, configuration, the plan,
and the prior review.
All 13 substantive guideline documents were read in full and compared with the existing
TypeScript and Python families.
Claims were checked against primary documentation and, for the lint-cost table, against
fdu at the exact cited commit.

**Calibration:** The readers are highly capable coding agents.
A rule earns permanent context when it changes a likely decision, corrects a persistent
expert error, makes a failure detectable, or supplies evidence an agent would not
otherwise have. Basic language advice and generic diligence are costs, not harmless
filler.

## Summary and Verdict

**Verdict: request changes.** The neutral-core/language-specific split is the right
architecture, and the release, filesystem-planning, gate-integrity, and Rust ownership
material contains useful non-obvious guidance.
The corpus is not ready to become an authoritative agent floor.
Eight High findings affect the evidence behind the floor, the ability of prescribed
checks to fail, supply-chain pinning, filesystem semantics, context allocation, policy
selection, FFI correctness, and CLI exit status.
Five Medium findings cover narrower factual or process defects.

The central design issue is selection, not missing coverage.
The branch often promotes the strictest observed practice into a universal rule, then
loads large parts of the result for every task.
A corpus for capable agents needs the opposite discipline: admit only rules with a named
behavioral delta, evidence, applicability boundary, and context budget.

## Findings

### R1 (High): The published lint-cost evidence uses an invalid production/test boundary

`rust-lint-format-rules.md:192-220` makes measured adoption cost the basis for accepting
or rejecting candidate lints.
The plan records that diagnostics were split at each file’s `#[cfg(test)]` boundary
(`plan-2026-08-23-rust-quality-floor-and-guideline-mapping.md:362-370`). A
`#[cfg(test)]` attribute applies to the next item; it is not a delimiter for the rest of
the file.

The cited fdu commit contains direct counterexamples.
In
[`fdu-core/src/lib.rs`](https://github.com/jlevy/fdu/blob/d42d97025781c21f68ffc94bfddd7ab5b6132245/crates/fdu-core/src/lib.rs#L64-L71),
a test-only module declaration at line 64 is followed immediately by production modules
and exports. In
[`fdu/src/cli.rs`](https://github.com/jlevy/fdu/blob/d42d97025781c21f68ffc94bfddd7ab5b6132245/crates/fdu/src/cli.rs#L993-L1001),
a test-only method inside an implementation is followed by a production method.
The repository contains many more mid-file `#[cfg(test)]` items.
No diagnostic-to-target mapping or raw count is included, so the table cannot be audited
and the reported production costs do not follow from the stated method.

**Fix:** Re-run the measurement with a checked-in reproducer.
Use Cargo metadata and diagnostic target information to distinguish library,
integration-test, example, and build-script targets, and classify inline attributes by
their actual item or module range rather than textual position.
Publish the raw `lint`, `target`, `file`, and `line` mapping with the summarized table.
Revisit every adoption verdict whose production count changes.

### R2 (High): Two recipes meant to prove a gate is live can silently do no required work

`rust-lint-format-rules.md:267-279` prints `NO LINT POLICY` inside a shell loop but
never records failure.
A loop in which every `grep` fails still exits zero after the final `echo`. It also
inspects only `crates/*/Cargo.toml`, missing root packages, nested members, explicit
workspace paths, and exclusions.

`ci-and-gates-rules.md:123-140` tells CI to lint other targets, then skips any target
not installed. A clean runner missing all expected targets therefore reports success
after linting none of the platform-gated code.
That contradicts the document’s own rule that a required check must prove it ran.

**Fix:** Enumerate workspace manifests from `cargo metadata`’s
[`workspace_members` and `manifest_path`](https://doc.rust-lang.org/cargo/commands/cargo-metadata.html),
accumulate missing policies, and exit nonzero.
Give cross-target linting two explicit modes: a permissive local discovery target and a
strict CI target whose expected target set is installed and asserted before linting.
Add a negative test in which one manifest is unlinted and another in which no cross
target is installed; both gates must fail.

### R3 (High): The action-pinning rule permits mutable tags and the workflow follows it

`ci-and-gates-rules.md:295-297` first requires immutable commit SHAs, then permits an
exact tag when an action lacks a floating major tag.
`.github/workflows/ci.yml:75-79` uses that exception for `astral-sh/setup-uv@v8.3.2`.
Whether a tag is broad or exact does not make it immutable.
GitHub’s security guidance states that a tag can move and that a full commit SHA is what
fixes the reviewed code
([GitHub Docs](https://docs.github.com/en/code-security/tutorials/secure-your-organization/protect-against-threats#pin-third-party-actions-to-commit-shas)).

**Fix:** Remove the tag exception.
Pin every third-party action to a full commit SHA, retain the release tag in a trailing
comment for readability, and let an update bot propose reviewed SHA changes.

### R4 (High): “Every file write” erases distinct write contracts

`filesystem-rules.md:27-53` requires every write to go through atomic replacement and
globally bans ordinary write APIs.
`rust-filesystem-rules.md:58-67` carries the same ban into Clippy.
Replacement is the right invariant for an authoritative path whose readers must never
observe partial new contents.
It is the wrong primitive for append-only logs or journals, exclusive creation,
temporary and scratch outputs, streams, and some large sequential artifacts.
Those operations have different collision, ordering, metadata, durability, and cost
contracts.

Rust’s standard library makes the distinction concrete: append mode has concurrent
positioning semantics, while `create_new` is an atomic exclusive-create operation
([`OpenOptions`](https://doc.rust-lang.org/std/fs/struct.OpenOptions.html)). Routing
both through replacement can weaken the intended invariant instead of strengthening it.

**Fix:** Scope atomic replacement to replacement of persistent authoritative paths that
may be observed concurrently or after a crash.
Define intent-specific boundaries such as `replace_atomic`, `create_new`, `append`, and
a separately named durable replacement.
Enforce the boundary in persistence modules or through intent-specific wrappers; do not
ban language primitives globally without an escape that names the alternate contract.

### R5 (High): Mandatory guideline loading consumes more context than the policy justifies

`doc-cache.ts:427-466` puts every `general-*` document plus four exact names in a group
whose generated instruction says to read all entries for any engineering task.
That is 2,201 lines and 11,521 words before repository code, including an 819-line
golden-testing guide, TDD, commit conventions, and backward compatibility.
The two Rust documents marked `alwaysApply` add 597 lines and 3,852 words for every Rust
task. Much of `rust-rules` is baseline material such as borrow read-only inputs, use
domain types, keep APIs minimal, and comment intent.

This does more than waste tokens.
It reduces attention available for local contracts and changed control flow, while
repeatedly anchoring agents on generic advice.
It also leaves two conflicting routing models: the generated directory says read the
entire group, while `skill-baseline.md:126-135` demonstrates only four documents.

**Fix:** Create a small always-loaded core with a measured word or token budget.
Route testing, golden tests, TDD, compatibility, commits, review, filesystem, CI, and
releases by changed surface.
Replace filename-set inference with explicit `topics`, `appliesTo`, and load-policy
metadata, then test the rendered bundle and its budget.
Trim the Rust always-load core to guidance that changes a capable agent’s likely
decision.

### R6 (High): “Strictest wins” is not an engineering admission rule

The plan makes the strictest of three sources authoritative and says disagreement is
resolved by strictness
(`plan-2026-08-23-rust-quality-floor-and-guideline-mapping.md:114-129`).
`rust-lint-format-rules.md:11-29` turns the result into one non-negotiable floor for
every Rust project. Strictness is not a proxy for defect-detection value.
A rule can be stricter and still add false positives, suppressions, tool dependencies,
or ceremony that hides more important signals.

The evidence base is one filesystem CLI. It does not establish the same optimum for a
public library, service, proc macro, embedded or `no_std` target, FFI layer, generated
binding crate, or codebase with an MSRV constraint.
“One default with named departure conditions” is useful; “one universal floor selected
by maximum strictness” is not.

**Fix:** Admit a rule by the defect class it prevents, enforcement reliability, observed
incidence, false-positive and maintenance cost, applicability, and context cost.
Publish a compact universal floor plus project-shape profiles and explicit departure
conditions. Validate proposed universal rules on several materially different
repositories before calling them universal.

### R7 (High): The FFI unwind rule states undefined behavior where Rust guarantees abort

`rust-code-review-rules.md:65-67` says that a Rust panic crossing into C is undefined
behavior and offers `extern "C-unwind"` as a general alternative.
The current Rust Nomicon gives a different matrix: a Rust panic reaching a non-unwind
ABI causes a safe abort; a foreign exception entering Rust through that boundary is
undefined behavior. An unwind ABI is required only when unwinding is intentionally
allowed to cross the boundary
([Rust Nomicon](https://doc.rust-lang.org/nomicon/ffi.html#ffi-and-unwinding)).

**Fix:** State the matrix exactly.
Use `catch_unwind` when the exported function must translate a Rust panic into a foreign
error instead of aborting.
Use `C-unwind` only when cross-language unwinding is an intentional, compatible part of
the ABI contract; do not present it as a generic safety fix.

### R8 (High): Broken-pipe handling loses the sink and can turn real failure into success

`rust-cli-rules.md:168-200` maps any `io::ErrorKind::BrokenPipe` reaching a generic
executable-boundary helper to exit zero.
That result carries no indication that the failed write was primary stdout.
A broken pipe while writing required data to a child process, socket, output file, or
other sink is not successful early consumer termination.

The existing TypeScript family shows the cross-language drift this extraction should
prevent.
`typescript-cli-tool-rules.md:383-396` exits zero for `EPIPE` on both stdout and
stderr. A closed stderr during error reporting can therefore overwrite an operational
failure with success, and `process.exit(0)` can abandon pending writes
([Node.js process documentation](https://nodejs.org/api/process.html#processexitcode)).

**Fix:** Put the neutral contract in a cross-cutting CLI guideline.
Treat expected early closure as success only at the primary stdout renderer and only
after required work has otherwise succeeded.
Preserve errors from other sinks and any existing nonzero outcome.
In Node, return or set `process.exitCode` instead of forcing immediate exit.
Keep only runtime-specific signal and stream mechanics in the language documents.

### R9 (Medium): The binary-wheel section applies an extension-module ABI rule

`rust-release-rules.md:104-117` defines a `bindings = "bin"` path and then recommends
`abi3` “where the extension API allows it.”
Binary bindings package an executable as a script; `abi3` is a PyO3 extension-module
stable ABI. Maturin documents them as separate binding types
([Maturin bindings](https://www.maturin.rs/bindings)). The bullet is inapplicable to the
section’s stated artifact and can cause agents to add irrelevant Python-extension
configuration.

**Fix:** Remove `abi3` from the binary-wheel path.
If extension modules are in scope, add a separate PyO3 subsection with its own
wheel-tag, panic, and interpreter matrix.

### R10 (Medium): The Rust replacement example flushes the wrong abstraction

`rust-filesystem-rules.md:76-87` calls `flush` on an unbuffered `NamedTempFile`, then
says that call becomes required when a buffered writer wraps the file.
If a `BufWriter` owns the pending bytes, the writer itself must be flushed; flushing the
underlying file does not drain the buffer.
Rust’s documentation explicitly requires flushing the `BufWriter` before drop because
drop ignores flush errors
([`BufWriter`](https://doc.rust-lang.org/std/io/struct.BufWriter.html)). The example
also calls `sync_all` unconditionally even though `filesystem-rules.md:77-96` correctly
says sync is required only for a declared crash-durability contract.

**Fix:** Either remove the no-op flush from the unbuffered example or show a real
`BufWriter`, explicitly flush it, recover or release the underlying file without losing
errors, and only then sync.
Make file and parent-directory sync conditional on the declared durability level.

### R11 (Medium): The testing rules optimize test count and coverage instead of evidence

`general-testing-rules.md:17-41` repeatedly minimizes the number of tests and recommends
removing a test when another appears to cover it.
`rust-testing-rules.md:35-45` pulls the other way by requiring a failure test for every
fallible operation. Both are count-based proxies.
Two tests can execute the same lines while protecting different public contracts or
providing much better failure localization; many fallible calls share one recovery
behavior and do not each deserve a test.

**Fix:** Optimize for independent evidence and diagnostic value.
Require each test to name the contract, boundary, failure mode, or interaction it
uniquely establishes; allow intentional overlap when it protects separate consumers or
localizes regressions.
Select failure tests by externally distinct recovery behavior and impact.
Use mutation, property, differential, or fault-injection tests when they strengthen the
oracle, not to raise a count.

### R12 (Medium): Default severities turn a review aid into a pattern-matching anchor

`code-review-rules.md:143-167` says the quick scan is investigative but assigns each
syntax pattern a default severity.
`rust-code-review-rules.md:81-101` is stronger still: any blocking call in an async
executor is a Blocker, repeated clone is High, production `unwrap` is High, and a
one-implementation trait is Medium.
The neutral rules otherwise say severity comes from impact and likelihood and require an
exact failure path before a finding.
The tables encourage the behavior that instruction is trying to prevent: reporting a
grep hit at the preassigned severity.

**Fix:** Replace “default severity” with “question to resolve” and “possible
consequence.” Assign severity only after tracing reachability, impact, likelihood, and
existing containment.
Reserve Blocker for a demonstrated merge-stopping consequence, not a construct such as a
blocking call in isolation.

### R13 (Medium): The authoring shortcut tests new bundled docs with the old bundle

`new-guideline.md:88-118` runs `tbd docs sync` and `tbd setup --auto` before building,
then uses bare `tbd` for validation.
`docs/development.md:44-70` correctly explains that the globally installed CLI contains
the previously published document bundle; official docs must be built first and tested
through `node packages/tbd/dist/bin.mjs`. The shortcut’s order can omit the new
guideline while appearing to validate it.
Its example also bans colon-space in descriptions instead of quoting YAML scalars, and
its step 10 subitems are not nested under the numbered step.

**Fix:** Split official-repository and downstream-project paths.
For this repository, build first, run setup and guideline lookup through the local
`dist` CLI, and assert the new file exists in both `dist/docs` and the synced cache.
Tell authors to quote YAML scalars containing colon-space.
Fix the list nesting.

## Suggestions

**S1. Add an admission record for every always-loaded rule.** Record the surprising
default, failure class, evidence, scope, departure condition, context cost, and a
last-verified version or date.
If a rule cannot fill those fields, route it on demand or remove it.

**S2. Test the corpus as a decision system.** Maintain a small set of adversarial design
and review scenarios with expected decisions.
Evaluate whether adding a guideline changes those decisions in the intended direction,
creates new false positives, or only adds prose the agent already knew.

**S3. Separate durable principles from versioned facts.** Tool versions, platform
behavior, current package-manager flags, and ecosystem support matrices should carry a
primary source and verification date.
Keep the always-loaded layer stable; route versioned operational detail only when its
topic is active.

**S4. Treat copy-paste checks as code.** Keep them in checked-in scripts with positive
and negative tests, then quote or invoke those scripts from the guideline.
A prose shell fragment that has never demonstrated a failing exit status should not be
presented as a gate.

## Prior Review and Confirmed False Positives

The earlier review at `078938d` reported 11 findings.
The response commit fixed the `tempfile::persist` claim, command-line lint override
advice, duplicate Related sections, group-routing tests, source registrations, Rust
review routing, and the other accepted items.
This review does not reopen those findings.
R10 is a narrower residual issue in the new flush wording, and R5 incorporates the
earlier non-blocking context-trimming suggestions because the full routing audit exposed
their system-level cost.

The following suspected issues were checked and dismissed:

- Repeated `-p` package selection is accepted by current Cargo; the multi-package
  `cargo package` example is not a syntax defect.
- `NamedTempFile::persist` is the replacement operation; `persist_noclobber` is the
  create-without-overwrite operation.
  The corrected text now distinguishes them.
- Exact-name routing and its source-of-truth test fix the prior cross-cutting/Rust group
  misclassification at the root rather than by ordering around it.
- The release guideline’s packaged-artifact smoke test, unpublished-sibling warning,
  build-once promotion rule, and retry/conflict distinction are useful and correctly
  owned by the neutral core.

## Validation and CI

All PR checks passed at the reviewed commit: Benchmark; Coverage & Lint; DeepSource
Secrets; Ubuntu on Node 22.12 and 24; macOS on Node 24; and Windows on Node 24. Green CI
confirms the implementation and generated surfaces pass the repository’s checks; it does
not validate the semantic claims in prose, which were reviewed separately here.

The exact fdu evidence commit was checked out read-only and inspected directly.
The shell-loop failure was reproduced: two missing policies were printed and the loop
exited zero. No dependencies were added or upgraded for this review.

## Second-Pass Preservation and Precision Review

**Reviewed commit:** `0c34446b5c2b8a0085d000e7ef44469398b1a40b`

**Scope:** All 54 files changed from `origin/main`, with two deliberate passes: first
over every modified pre-existing tbd document, treating its wording and structure as
authoritative; then over every new Rust and cross-language guideline, gate, script, and
test. The admission standard remained the one above: a change must add correctness,
clarity, precision, or a material omission—not merely restyle sound guidance.

**Verdict at the reviewed commit: request changes.** Nine additional defects survived
the first review.
Four could make a gate or persistence rule report a false result; three
overgeneralized a policy beyond its actual applicability; and two misstated a language
or review contract. The focused corrections described below are included with this
addendum.

### R14 (Medium): The testing expansion obscures a trusted optimization principle

`general-testing-rules.md:17` replaced the original compact list, including “the minimal
set of tests with the maximal coverage,” with a differently framed rule.
The new evidence language was useful, but it did not require rewriting the established
core and could be read as rejecting test-set minimization altogether.

**Correction:** Restore the original list verbatim under `Core Principles`. Put the new
material in a separate `Demand Independent Evidence` section that defines coverage as
independent behavior, boundaries, failure modes, and diagnostic value.

### R15 (High): The lint-cost reproducer accepts partial evidence as a completed run

`measure-rust-lint-cost.mjs:115` previously caught any nonzero Clippy invocation and
continued whenever the process had emitted stdout.
A compile failure after one member therefore produced a plausible table for only the
prefix Cargo reached.
The reproducer also omitted `--locked` and left large temporary target directories
behind.

**Correction:** Require all Cargo invocations to succeed, use the committed dependency
graph, clean temporary directories, and add a regression test in which fake Cargo emits
a valid diagnostic and then exits nonzero.
The test proves that no partial table is accepted.

### R16 (High): A line regex is not a parser for executable workflow references

The action-pin gate recognized only one textual spelling of `uses:`. It missed valid
flow-style maps and spaced keys, while a `uses:` string inside a block-scalar shell
script could be reported as an action.
Both failures undermine a security gate whose green result is meant to prove complete
coverage.

**Correction:** Traverse the parsed workflow structure at the two executable locations
(`jobs.<job>.uses` and `jobs.<job>.steps[*].uses`), retain source line diagnostics, fail
on invalid YAML, and cover the missed and false-positive forms in `action-pins.test.ts`.
This uses the repository’s existing `yaml` dependency.

### R17 (High): The PyO3 section conflates ABI, crate-output, and panic boundaries

`rust-release-rules.md:131` previously prescribed `abi3` without its API, optimization,
or free-threaded-interpreter limits; said a `cdylib` could not also be an `rlib`; and
said a panic reaching Python necessarily aborted.
Rust permits stacked crate types, and PyO3-generated trampolines catch unwinding panics
as `PanicException`. A custom non-unwind FFI boundary and a build using
`panic = "abort"` are different cases.

**Correction:** State the `abi3`/`abi3t` applicability boundary, describe a separate
extension crate as an architecture choice, and distinguish expected `PyResult` failures,
PyO3’s last-resort panic conversion, and aborting custom FFI boundaries.
Link the Rust Reference and current PyO3 documentation beside the claims.

### R18 (Medium): One-version policy needs a named release unit

`release-engineering-rules.md:29` said one version and tag cover all channels without
defining whether an independently versioned package in a monorepo was a channel or a
separate product. Taken literally, the rule imposed lockstep versioning unrelated
packages.

**Correction:** Define the release unit first.
Keep one identity across channels within that unit while allowing independently
versioned packages to have separate units and cadences.

### R19 (Medium): The gate guidance rules out controlled performance regressions

`ci-and-gates-rules.md:220` categorized all timing checks as workflow evidence rather
than gates. That is right for absolute thresholds on heterogeneous shared runners, but
not for dedicated runners or repeated within-run comparisons whose margin exceeds a
measured noise budget.

**Correction:** Prohibit uncontrolled absolute wall-clock gates and state the conditions
under which a performance regression gate is honest.

### R20 (Medium): A failed generic gate must not postpone independent high-risk review

`code-review-rules.md:14`, `rust-code-review-rules.md:17`, and the Rust review shortcut
required gates to pass before review.
They also supplied `--all-features` as if every feature set were composable.
A formatting failure does not justify delaying an independent soundness or data-loss
review, and mutually exclusive features make `--all-features` invalid.

**Correction:** Inspect gate results first and record failures, then continue
independent high-risk review.
Prefer the repository’s documented gate and run its supported feature matrix rather than
assuming one universal Cargo command.

### R21 (Low): Borrowed Rust inputs describe ownership, not read-only behavior

`rust-rules.md:48` said `&str` and `&Path` mean the callee “only reads.”
A callee can parse, hash, compare, or derive and retain owned data from a borrow; the
signature says only that it does not take ownership of the input.
The same paragraph also implied an owned parameter always allocates at every other call
site.

**Correction:** State the ownership transfer precisely and limit the allocation claim to
callers that possess only a borrowed value.

### R22 (High): Filesystem enforcement still contradicts the write-intent model

`filesystem-rules.md:42-75` correctly separates replacement, exclusive creation, append,
stream, and scratch contracts, but then described concurrent append as safe at the
record level and prescribed global bans that cannot observe intent.
`typescript-rules.md:410-434` carried the global replacement rule into the trusted
TypeScript guidance.
Concurrent append writes may interleave, and forcing every write through replacement is
wrong for four of the five named contracts.

**Correction:** State append’s positioning guarantee without promising record atomicity,
scope enforcement to authoritative-persistence boundaries, explain why Rust’s global
method restriction cannot enforce an intent-sensitive rule, and narrow the TypeScript
rule to replacement of authoritative files.

### Second-Pass Validation Notes

The two executable defects were demonstrated with regression tests before their fixes:
the YAML-form test and partial-Clippy-run test both failed against the reviewed code and
pass after the corrections.
The full parent-branch gate then passed: format checks, type checks, ESLint and gate
contract checks, build, and 2,431 tests across 161 files.
Stacked-branch validation is recorded in the PR after the corrected parent is pushed and
the top branch is rebased.

One lower-priority omission is deliberately deferred: the repository currently has no
local composite actions, so the pin gate does not yet recurse into
`.github/actions/**/action.yml` or distinguish Docker image digests from action commit
SHAs. That extension should land with fixtures for both forms rather than be folded into
the workflow-parser correction without coverage.

## Stacked-PR Preservation Review

After the parent corrections, PR #260 was restacked and reviewed only for its residual
delta. The top branch does not edit `general-eng-agent-principles.md`; it preserves that
document and limits its guideline edits to specific claims, executable examples, and
routing behavior.

**Verdict at the restacked commit: request changes.** Three integration defects remained
after the mechanical restack.
The focused corrections below are included in the stacked branch.

### R23 (High): The new cross-target helper hard-codes one invalid feature strategy

`check-rust-gate.mjs` unconditionally passed `--all-features`. That can make the gate
unusable for mutually exclusive features and can leave default, minimal, or named
configurations untested even when they are the public contract.
The inherited Rust floor and project-setup examples repeated the same universal command.

**Correction:** Default to Cargo’s normal feature set, accept explicit `--all-features`,
`--no-default-features`, and `--features` options, reject contradictory options, and
require one invocation for each supported feature combination.
The Rust floor, verification recipe, project-setup example, and plan now state the same
contract, with regression coverage for feature-argument construction.

### R24 (Medium): Generated routing still tells agents to load whole language groups

The new loading policy says to select language documents by changed surface, but the
generated TypeScript, Python, Rust, and Convex headings still said to load every
document in each group.
That contradiction recreates the context-budget problem the routing change is intended
to solve.

**Correction:** Make every generated group note describe selective, surface-based
routing and name the cross-cutting surfaces moved out of the always-load core.

### R25 (High): The MSRV recipe can pass without checking every promised package

The verification block scoped ordinary clippy, test, and docs jobs to `--workspace` but
omitted that flag from both MSRV commands.
In a workspace with a root package or `default-members`, the MSRV job could stay green
while other published members no longer compile or test on their promised compiler.

**Correction:** Use `--workspace` when members share one MSRV; when they do not, require
explicit package or release-unit jobs at each declared `rust-version`. The standalone
docs command also names its workspace scope rather than relying on Cargo’s
default-member selection.

### R26 (High): The commit hook mutates generated skills despite claiming to exclude them

`lefthook.yml` supplied one regex-shaped alternation to `exclude`, but Lefthook 2
interprets each entry as a glob.
The Markdown hook therefore reformatted staged `.agents` and `.claude` skill files after
generation, making both managed artifacts stale in the same commit that was meant to
refresh them.

**Correction:** Replace the pseudo-regex with one glob per generated surface and add a
contract test that passes all five protected paths through the installed Lefthook
matcher. The test’s command fails deliberately if even one path reaches it.

### Stacked-PR Validation Notes

The focused routing, Rust-gate, stream-error, exit-code, and generated-artifact suite
passed 52 tests across six files.
The full stacked-branch gate passed formatting, type checking, ESLint, both contract
gates, the build, and 2,443 tests across 163 files.
The Rust helper is identical in source, the built distribution, and the local docs
cache; the generated skill mirrors were refreshed from the corrected routing policy.
No unresolved Blocker, High, or Medium finding remains in the stacked delta.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->

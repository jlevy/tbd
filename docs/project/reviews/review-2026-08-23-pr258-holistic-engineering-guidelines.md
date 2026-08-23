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

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->

---
title: Rust Lint and Format Rules
description: The lint and auto-formatting floor for every Rust project—the `[lints]` block, the clippy.toml, rustfmt and toolchain pinning, hooks and CI gates, and how to prove the floor is live. Includes measured adoption cost for the lints beyond the floor, taken from a real 35k-line codebase, so a project can decide with evidence rather than taste.
author: Joshua Levy (github.com/jlevy) with LLM assistance
globs: "*.rs"
category: rust
---
# Rust Lint and Format Rules

Rust has one formatter and one linter, so the configuration question is not *which
tools* but *which rules earn a place in the default*.

This document is the Rust counterpart of `typescript-lint-format-rules`.
`ci-and-gates-rules` owns gate wiring in general (fix versus verify mode,
config-contract checks, suppression ratchets, generated-file ownership); this document
says which Rust rules the gate enforces.

**Related**:

- `rust-rules` (language and API design the linter does not cover)
- `rust-project-setup` (Cargo layout, features, workspace shape)
- `ci-and-gates-rules` (how the gate is wired and how you prove it is live)
- `supply-chain-hardening` (pin the toolchain and every lint tool; the cool-off applies)

## What Earns a Place in the Floor

A rule belongs in the floor below only if it clears all six of these.
Anything clearing fewer is a project preference and belongs in that project’s manifest,
not in a document every Rust task loads:

- **Defect class.** It prevents a named failure, not a style someone dislikes.
- **Enforcement reliability.** A tool detects it mechanically, with few false positives
  on correct code.
- **Incidence.** The defect occurs in real Rust rather than in principle.
- **Adoption cost.** Measured on a real codebase—“Measured Adoption Cost” below shows
  what that means and how far a plausible-looking method can be off.
- **Applicability.** It holds across project shapes, or it names the shapes where it
  does not.
- **Context cost.** Stating it changes what a competent engineer would otherwise do.

**Strictness is not one of the six.** A stricter rule can add false positives,
suppressions, tool dependencies, and ceremony that hide more signal than the rule
recovers. Where two sources disagree, the better answer to those six questions wins, not
the one that denies more.
This floor is what survived them against one codebase shape; the departure conditions
below are the boundaries that shape did not test.

## The Floor

A project may add rules.
It may drop one only under a departure condition stated at the end of this section.

1. **Everything auto-formattable is auto-formatted.** `cargo fmt --all` owns Rust
   layout; `taplo fmt` owns TOML; [flowmark](https://github.com/jlevy/flowmark) owns
   Markdown. Nobody hand-formats, and `rustfmt.toml` stays small—`edition`, `max_width`,
   and a readability setting or two.
   Every other knob needs a stated reason.

2. **The lint gate is zero-tolerance and verify-only in CI.**
   `cargo clippy --locked --workspace --all-targets --all-features -- -D warnings`.
   `--all-targets` is load-bearing: without it, tests, examples, and benches are not
   linted at all. Never run `--fix` in CI.

3. **Warnings are denied in the manifest, not only on the command line.** Put
   `warnings = "deny"` in `[lints.rust]` so a local `cargo build` enforces the same
   floor as CI. A floor that exists only in the CI command is one `cargo build` away
   from being invisible.

4. **`pedantic` is denied, not warned.** A warning that nothing fails on is a
   preference. Set it at `priority = -1` so specific overrides win, and allow individual
   pedantic lints back with a reason rather than dropping the group.

5. **Public items are documented and documentation warnings are errors.**
   `missing_docs = "deny"` in `[lints.rust]`, and
   `RUSTDOCFLAGS="-D warnings" cargo doc --locked --no-deps --all-features` as its own
   gate. A broken intra-doc link is a broken link whether or not anyone builds the docs.

6. **`unsafe_code` is denied at the workspace root.** Use `deny`, not `forbid`, unless
   the project genuinely has no unsafe anywhere and never will: `forbid` cannot be
   overridden at all, so the first justified platform-specific `unsafe` block forces you
   to weaken the workspace-wide setting.
   `deny` keeps the default absolute while letting one reviewed module carry a scoped,
   documented `#[expect]`.

7. **`unwrap_used` is denied; `.expect("reason")` is the sanctioned form.** Both panic;
   only one leaves a message that makes the panic diagnosable from a bug report.
   Denying both is a much larger commitment—see the measured cost below.

8. **Exceptions are narrow, scoped, and reasoned.** Use
   `#[expect(lint, reason = "...")]` at the narrowest scope.
   Prefer `expect` over `allow` everywhere the toolchain supports it: `#[expect]` warns
   once the suppression has become unnecessary, so exceptions expire on their own.
   This is strictly better than the TypeScript equivalent, which needs a written rule to
   remove obsolete suppressions because its tooling cannot detect them.

9. **Legacy code ratchets toward strict.** Per-crate `[lints]` overrides relax a rule
   for one member, never for the workspace, and each off-switch carries a tracker ID and
   a re-enable condition (`ci-and-gates-rules`, “Suppressions Are Debt or Decay”).

10. **Platform-gated code is linted for its own platform.** `cfg(target_os = ...)` code
    is invisible to a single-platform clippy run, so a module behind such a gate has
    never been linted anywhere if CI lints only on Linux.
    Add a required cross-target lint pass.
    CI must fail when a declared target is unavailable; a local discovery command may
    report an optional target as skipped, but that command is not a gate.
    See `ci-and-gates-rules`, “Single-platform blindness”.

**Departures by project shape.** These are the known boundaries, each with the reason it
is a boundary rather than an excuse:

- **MSRV below 1.81.** `#[expect]` does not exist there, so rule 8 degrades to
  `#[allow]` plus the written removal discipline the TypeScript family needs for the
  same reason.
- **Crates whose macros expand to forbidden code.** A pyo3 or similar attribute macro
  emitting `unsafe impl` cannot inherit `unsafe_code = "deny"`. Restate every *other*
  lint verbatim in that member; see below.
- **Proc-macro crates.** `pedantic` fires on macro-expanded code the author cannot edit.
  Scope the relaxation to the expansion, not to the crate.
- **No pinned toolchain.** `warnings = "deny"` in the manifest turns every new compiler
  lint into a build failure for everyone at once on the day rustc ships it.
  Pin the toolchain (`rust-project-setup`) or hold denied warnings in the CI command
  only. This does *not* affect your published crate’s consumers: cargo builds registry
  dependencies with `--cap-lints allow`, so your `[lints]` table never breaks a
  downstream build.

## The `[lints]` Floor

Declare lints once at the workspace root:

```toml
[workspace.lints.clippy]
pedantic = { level = "deny", priority = -1 }
# Pedantic lints allowed back, each because it fires on correct code, not because it
# was noisy. Keep this list short and justify additions in review.
missing_errors_doc = "allow"
missing_panics_doc = "allow"
module_name_repetitions = "allow"
must_use_candidate = "allow"
too_many_lines = "allow"
# Not in pedantic; added deliberately.
unwrap_used = "deny"

[workspace.lints.rust]
missing_docs = "deny"
unsafe_code = "deny"
warnings = "deny"
```

**Every member package must opt in.** Workspace lints do not apply on their own:

```toml
[lints]
workspace = true
```

This is the single most common way a Rust lint floor is silently absent.
A workspace can carry a complete `[workspace.lints]` block and enforce none of it, with
a green CI run, because no member opted in.

Where a member genuinely cannot inherit the workspace block—the usual cause is a
proc-macro that expands to code the floor forbids, such as pyo3’s attribute macros
emitting `unsafe impl` under `unsafe_code = "deny"`—**restate every other lint verbatim
in that member** rather than dropping the table:

```toml
# Deliberately not `[lints] workspace = true`: the pyo3 attribute macros expand to
# `unsafe impl` blocks, so the workspace's `unsafe_code = "deny"` cannot apply here.
# Every other workspace lint is repeated verbatim so this crate is not quietly held
# to a lower standard than the core one.
[lints.clippy]
pedantic = { level = "deny", priority = -1 }
# ...the rest of the workspace block, unchanged
```

Opting out of the *inheritance* is sometimes necessary; opting out of the *floor* is
not.

Pin the toolchain so contributors and CI lint identically—clippy gains lints between
releases, so an unpinned channel means a rule set that changes under you:

```toml
# rust-toolchain.toml
[toolchain]
channel = "1.97.1"
components = ["clippy", "rustfmt"]
profile = "minimal"
```

The toolchain pin and the MSRV are different things: the pin makes development and CI
reproducible, `rust-version` states the oldest compiler the package supports, and a
separate CI job proves the MSRV still works.
That job compiles *and* tests—compilation alone misses behavioral and test-only
regressions.

## clippy.toml

The test allowances below preserve the production panic policy without forcing fixture
setup to use production-style recovery:

```toml
# Unit tests live inside the source file under #[cfg(test)], so a path-based
# "production versus test" split does not work in Rust the way it does elsewhere.
# These options are how that distinction is expressed.
allow-unwrap-in-tests = true
allow-expect-in-tests = true
```

One limit matters when using these settings:

- `allow-*-in-tests` covers inline `#[cfg(test)]` items.
  It does **not** cover integration tests under `tests/`, examples, or build scripts,
  which need a crate-level `#![allow(...)]` of their own.

Do not globally disallow `std::fs::write` or `File::create` to enforce atomic
replacement. Those functions are correct for scratch files and other contracts that do
not replace authoritative state; Clippy cannot infer the caller’s write intent, and
`disallowed-methods` has no test or intent scope.
Expose intent-specific persistence operations such as `replace_atomic`,
`replace_durable`, `create_new`, and `append_record` from the module that owns stored
state. If a legacy *project helper* has an unambiguously unsafe contract, disallow that
helper after callers have migrated; do not ban general standard-library operations whose
correctness depends on context.

## Beyond the Floor: Measured Adoption Cost

The lints below are all defensible, and all commonly proposed as floor rules.
Whether they belong in *your* floor is a measurement, not an opinion—and the measurement
is easy to get wrong in a way that looks authoritative.

The numbers are from [fdu](https://github.com/jlevy/fdu) at `d42d970`: 35,081 lines of
Rust across a library, a CLI, and a PyO3 extension module, already at the floor above,
measured with `allow-*-in-tests` enabled.
Method, reproducer, and the full 415-row diagnostic mapping are in
`docs/project/research/current/evidence-2026-08-23-rust-lint-cost.md`.

| Candidate lint | Ships | Build scripts | Tests/examples | Verdict |
| --- | ---: | ---: | ---: | --- |
| `clippy::let_underscore_future` | 0 | 0 | 0 | **Adopt.** Free, and inert in a crate with no async. |
| `clippy::panic` | 2 | 2 | 35 | **Adopt** in library code. Half the non-test cost is `build.rs`, which panics legitimately and needs its own allow. |
| `clippy::wildcard_enum_match_arm` | 12 | 0 | 9 | **Adopt.** Small, and it is what makes adding an enum variant a compile error instead of a silent `_ =>`. |
| `clippy::disallowed_methods` (filesystem writes) | 0 | 1 | 82 | **Do not adopt as a global filesystem policy.** The low shipping count measures migration cost, not semantic fit; write contracts differ by intent. |
| `clippy::expect_used` | 32 | 7 | 35 | **Defer or ratchet.** On top of `unwrap_used`, this means every fallible call in library code returns a `Result`. That is a design commitment, not a lint tweak. |
| `clippy::indexing_slicing` | 79 | 0 | 119 | **Do not deny outright.** The most expensive rule here, in a codebase already at this floor. Adopt per-module with a tracked ratchet, or not at all. |

These counts measure adoption cost in one repository; they do not measure defect
prevention by themselves.
The two most-proposed additions are the two that do not survive contact with a real
codebase. `indexing_slicing` in particular is recommended by analogy to
`noUncheckedIndexedAccess`, but the analogy is inexact: TypeScript’s flag changes an
inferred *type* and is usually satisfied by a bounds check the code already has, whereas
`indexing_slicing` demands `.get()` plus real error handling at all 79 sites.

**Measure by compile unit, not by reading the source.** The obvious method—split each
file at its `#[cfg(test)]` and call the rest test code—is wrong, because a
`#[cfg(test)]` attribute applies to the *next item* and not to the remainder of the
file. Applied to this codebase it misfiled 34% of diagnostics, in both directions.
Ask cargo instead:

```bash
# Pass 1: code that compiles without cfg(test). Pass 2: everything.
# A diagnostic in both is production; one only in pass 2 is test-only. Cargo's
# per-diagnostic target also separates build scripts, examples, and integration tests.
cargo clippy --locked --workspace --lib --bins  --message-format=json -- -W clippy::indexing_slicing
cargo clippy --locked --workspace --all-targets --message-format=json -- -W clippy::indexing_slicing
```

Cap lints at `warn` for the run (`RUSTFLAGS="--cap-lints warn"`). A workspace that
denies warnings stops at its first failing target, and the count you get back describes
whichever crate compiled first rather than the workspace.
Once capped, any nonzero Cargo result is a build or measurement failure; reject it even
if Cargo emitted some diagnostics first, or the table silently describes a prefix of the
workspace. Deduplicate by lint plus primary-span file, line, and column: `--all-targets`
compiles the library twice.

## Hooks and Gates

Pre-commit auto-fixes staged files; pre-push and CI run the identical verify gate.
`ci-and-gates-rules` covers why hooks run sequentially and why fix and verify are
separate commands.

```yaml
pre-commit:
  parallel: false # stage_fixed jobs contend on .git/index.lock if parallel
  commands:
    fmt:
      glob: "*.rs"
      run: cargo fmt --all
      stage_fixed: true
      priority: 1
```

The verify gate, as separate jobs so failures answer different questions:

```bash
cargo fmt --all -- --check
cargo clippy --locked --workspace --all-targets --all-features -- -D warnings
cargo test --locked --workspace --all-features
RUSTDOCFLAGS="-D warnings" cargo doc --locked --workspace --all-features --no-deps
cargo deny --locked check                 # advisories, licenses, sources, bans
cargo +$MSRV check --locked --all-features && cargo +$MSRV test --locked
```

Set `RUSTFLAGS: "-D warnings"` and `CARGO_INCREMENTAL: 0` in the CI environment.
Keep fix mode (`cargo clippy --fix`, `cargo fmt --all`) in a separate `fix` target that
CI never invokes.

`cargo deny` is the dependency-policy gate.
Note one non-obvious setting: allow unused-but-permitted licenses
(`unused-allowed-license = "allow"`), because the allow list is the set of licenses the
project accepts, not an inventory of what the tree happens to contain today.
Warning about entries nothing currently uses trains everyone to skim the audit’s output,
and the next real advisory scrolls past with it.

## Verifying the Floor

After setting up or changing any lint configuration, prove it holds:

1. **Confirm every member has a lint policy.** This is the failure that looks exactly
   like success, so check for the `[lints]` table itself, over the manifests cargo says
   are in the workspace:

   ```bash
   node .tbd/docs/guidelines/scripts/check-rust-gate.mjs lint-policy \
     --manifest-path Cargo.toml
   ```

   Three properties of that tested script are the point.
   **It exits nonzero.** A loop that prints a complaint and reaches its final statement
   exits zero, and a required check that always passes is worse than no check—it is a
   green light with a paper trail.
   **It enumerates from `cargo metadata`,** not from `crates/*/Cargo.toml`: a glob
   misses a root package, a nested member, a member at an explicit path, and it silently
   includes an excluded directory.
   **It counts.** Zero members is what a renamed directory or a broken `cargo metadata`
   looks like, and it is indistinguishable from success otherwise.

   Do not check with `grep -L 'workspace = true'`: that string also appears in inherited
   package fields (`edition.workspace = true`) and inherited dependencies, so it matches
   in manifests that declare no lints at all and reports a clean result for an unlinted
   crate. Checking for inheritance is also the wrong question—a member that legitimately
   cannot inherit declares its own `[lints]` table, and this check must pass for it.

2. **Confirm the effective lint level with a deliberate violation**, not by inspecting
   the config text. Add an `unwrap()` to library code, or an undocumented public item,
   and run the gate exactly as CI runs it—with no extra flags.
   It must fail.

   Do not try to confirm a level by passing the lint on the command line.
   Cargo emits the `[lints]` table as rustc flags first, and arguments after `--` come
   later; the last flag of equal specificity wins.
   So `-- -W clippy::pedantic` *demotes* a manifest `deny` to `warn` for that run, and
   reports on a floor the project does not have.
   The violation probe is the only check that reads the configuration you actually ship.

   Commit that probe as a config-contract check if the project has anywhere to put one
   (`ci-and-gates-rules`).

3. **Confirm `--all-targets` is present** in the CI command.
   Without it a passing clippy run says nothing about test code.

4. **Confirm platform-gated modules are linted.** Run the cross-target lint pass in
   strict mode in CI; if a required target is missing, the gate must fail rather than
   report a successful skip:

   ```bash
   node .tbd/docs/guidelines/scripts/check-rust-gate.mjs cross-targets \
     --mode strict \
     --manifest-path Cargo.toml \
     --target x86_64-unknown-linux-gnu \
     --target x86_64-pc-windows-msvc
   ```

   Choose targets from the project’s supported platform contract.

5. **Confirm CI runs verify mode**, not `--fix`, and that the docs and MSRV gates are
   present and actually executed rather than skipped on a missing toolchain.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->

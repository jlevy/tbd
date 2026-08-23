---
title: Rust Lint and Format Rules
description: The lint and auto-formatting floor for every Rust project—the `[lints]` block, the clippy.toml, rustfmt and toolchain pinning, hooks and CI gates, and how to prove the floor is live. Includes measured adoption cost for the lints beyond the floor, taken from a real 35k-line codebase, so a project can decide with evidence rather than taste.
author: Joshua Levy (github.com/jlevy) with LLM assistance
globs: "*.rs"
alwaysApply: true
category: rust
---
# Rust Lint and Format Rules

Every Rust project enforces the same quality floor.
Rust makes this simpler than most ecosystems: there is one formatter and one linter, so
there are no toolchain profiles to choose between—only one configuration, stated here.

This document is the Rust counterpart of `typescript-lint-format-rules`.
`ci-and-gates-rules` owns gate wiring in general (fix versus verify mode,
config-contract checks, suppression ratchets, generated-file ownership); this document
says which Rust rules the gate enforces.

**Related**:

- `rust-rules` (language and API design the linter does not cover)
- `rust-project-setup` (Cargo layout, features, workspace shape)
- `ci-and-gates-rules` (how the gate is wired and how you prove it is live)
- `supply-chain-hardening` (pin the toolchain and every lint tool; the cool-off applies)

## The Floor

A project may add rules; it may not drop these.

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
    Add a cross-target lint pass; see `ci-and-gates-rules`, “Single-platform blindness”,
    for the shape that skips uninstalled targets instead of failing.

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

Two settings carry most of the value.

```toml
# Unit tests live inside the source file under #[cfg(test)], so a path-based
# "production versus test" split does not work in Rust the way it does elsewhere.
# These options are how that distinction is expressed.
allow-unwrap-in-tests = true
allow-expect-in-tests = true

# The atomic-write rule from `filesystem-rules`, made executable.
[[disallowed-methods]]
path = "std::fs::write"
reason = "write via an atomic replace (tempfile::NamedTempFile::persist)"

[[disallowed-methods]]
path = "std::fs::File::create"
reason = "write via an atomic replace (tempfile::NamedTempFile::persist)"
```

`disallowed-methods` is the Rust analogue of `no-restricted-imports`: it converts a rule
that otherwise lives only in prose into something the gate enforces.

Two limits worth knowing before you turn these on:

- `allow-*-in-tests` covers inline `#[cfg(test)]` items.
  It does **not** cover integration tests under `tests/`, examples, or build scripts,
  which need a crate-level `#![allow(...)]` of their own.
- `disallowed-methods` has no test-scoping option at all.
  Test code that legitimately writes fixture files will trip it, so pair it with a
  crate-level allow in test targets or accept the exceptions.

## Beyond the Floor: Measured Adoption Cost

The lints below are all defensible, and all commonly proposed as floor rules.
Whether they belong in *your* floor depends on what they cost to adopt, which is a
measurement, not an opinion.

The numbers are from [fdu](https://github.com/jlevy/fdu) at `d42d970`—about 35k lines of
Rust across three crates, already at the floor above (`pedantic` denied, `unwrap_used`
denied), measured with `allow-*-in-tests` enabled:

| Candidate lint | Production sites | Test/build sites | Verdict |
| --- | ---: | ---: | --- |
| `clippy::let_underscore_future` | 0 | 0 | **Adopt.** Free unless the crate has no async at all, in which case it is free and inert. |
| `clippy::panic` | 2 | 4 | **Adopt** in library code. Build scripts panic legitimately and need their own allow. |
| `clippy::wildcard_enum_match_arm` | 7 | 11 | **Adopt.** Small, and it is the rule that makes adding an enum variant a compile error rather than a silent `_ =>`. |
| `clippy::disallowed_methods` (fs writes) | 1 | 82 | **Adopt.** Production cost is nil; the entire cost is test fixtures, handled with one crate-level allow. |
| `clippy::expect_used` | 25 | 45 | **Defer or ratchet.** Denying it on top of `unwrap_used` means every fallible call in library code returns a `Result`. That is a design commitment, not a lint tweak. |
| `clippy::indexing_slicing` | 62 | 136 | **Do not deny outright.** This is the analogue of `noUncheckedIndexedAccess`, and it is the most expensive rule here—62 production sites in a codebase already at this floor. Adopt per-module with a tracked ratchet, or not at all. |

The two most-proposed additions are the two that do not survive contact with a real
codebase unmodified.
`indexing_slicing` in particular is often recommended by analogy to
`noUncheckedIndexedAccess`, but the analogy is inexact: TypeScript’s flag changes an
inferred *type* and is usually satisfied by a `!` or a bounds check the code already
has, whereas `indexing_slicing` demands `.get()` plus real error handling at every site.

Measure before adopting.
The command:

```bash
cargo clippy --locked --workspace --all-targets --all-features --message-format=json \
  -- -W clippy::indexing_slicing -W clippy::expect_used
```

Count distinct `file:line` primary spans per lint, and split them at each file’s
`#[cfg(test)]` boundary—`--all-targets` compiles the library twice, so raw diagnostic
counts roughly double, and inline test modules otherwise read as production code.

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
   like success, so check for the `[lints]` table itself:

   ```bash
   for m in crates/*/Cargo.toml; do
     grep -qE '^\[lints(\.|\])' "$m" || echo "NO LINT POLICY: $m"
   done
   ```

   Do not check with `grep -L 'workspace = true'`: that string also appears in inherited
   package fields (`edition.workspace = true`) and inherited dependencies, so it matches
   in manifests that declare no lints at all and reports a clean result for an unlinted
   crate—a false pass of exactly the kind `ci-and-gates-rules` describes.

2. **Confirm the effective lint level**, not the config text:
   ```bash
   cargo clippy --workspace --all-targets -- -W clippy::pedantic 2>&1 | head
   ```
   Then add a deliberate violation—an `unwrap()` in library code, an undocumented public
   item—and confirm the gate fails on it.
   Commit that probe as a config-contract check if the project has anywhere to put one
   (`ci-and-gates-rules`).

3. **Confirm `--all-targets` is present** in the CI command.
   Without it a passing clippy run says nothing about test code.

4. **Confirm platform-gated modules are linted.** Run the cross-target lint pass; if the
   project has `cfg(target_os)` code and no such pass, that code is unlinted.

5. **Confirm CI runs verify mode**, not `--fix`, and that the docs and MSRV gates are
   present and actually executed rather than skipped on a missing toolchain.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->

---
title: CI and Quality Gate Rules
description: How to wire a quality gate that actually holds—one entry point in two modes, config-contract checks that prove the floor is live, the traps that keep a gate green while it checks nothing (pipeline exit status, self-recorded evidence, single-platform blindness, scope holes), suppression ratchets, generated-file ownership, and least-privilege workflow authority. Language-neutral; load it with the language floor document whenever wiring, debugging, or reviewing a gate.
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: general
---
# CI and Quality Gate Rules

A quality gate is a claim: *if this passes, the change is safe to hand off.* These rules
are about keeping that claim true.
They are language-neutral; the language floor document (`typescript-lint-format-rules`,
`rust-lint-format-rules`) says which rules the gate enforces, and this document says how
the gate is wired and how you prove it is live.

Most gate defects are not a missing check.
They are a check that runs, reports success, and establishes nothing.
That failure is silent by construction, so the sections below name the specific
mechanisms rather than advising vigilance.

**Related**:

- `typescript-lint-format-rules`, `rust-lint-format-rules` (the per-language floors this
  gate enforces)
- `supply-chain-hardening` (pinning, cool-off, and install-script policy for the tools
  the gate runs)
- `general-testing-rules` (what the tests inside the gate should assert)
- `release-engineering-rules` (the pre-release gate and publishing authority)

## One Entry Point, Two Modes

A contributor and CI run the same named command.
If they differ, CI failures are discoveries rather than confirmations.

- **One named entry point.** `pnpm ci:quality`, `make check`, `just check`—the name is a
  project convention, the singularity is not.
  It is the handoff gate: if it passes, CI should.
- **Fix mode and verify mode are separate commands.** `lint` fixes; `lint:check`
  verifies. CI runs only the verify one and never commits.
  A project with only fix-mode commands has no way to detect drift: the formatter
  rewrites the file, the command exits zero, and nobody learns the file was wrong.
- **Order the gate so it fails fastest.** Cheap, high-signal checks (version floors,
  formatting, lint) precede expensive ones (multi-platform tests, wheel builds).
  The ordering is a real property to maintain, not incidental.
- **Fail when a required check did not run.** A gate that skips a job on a missing tool,
  an unset variable, or an empty file list reports success for work it never did.

Keep complex gate logic in checked-in scripts that accept explicit inputs and return
non-zero on partial failure, not in long inline YAML or shell blocks.
Scripts can be unit-tested; a shell block in a workflow cannot be run except by pushing.

## Prove the Gate Is Live

A gate that is not itself tested is not a gate.
Two mechanisms, both cheap:

**Config-contract checks.** Assert the *effective* configuration, not the config file’s
text.
Compute the resolved severity for a probe file and require the floor rules to be at
error:

```javascript
// scripts/check-eslint-contract.mjs — asserts the floor is live for one TS and one JS probe.
const TS_CONTRACT = {
  curly: { options: ['all'] },                          // survived eslint-config-prettier
  '@typescript-eslint/no-floating-promises': {},        // promise safety
  // A rule that is in the strict preset and configured nowhere explicitly, so its
  // presence proves the preset itself is still applied.
  '@typescript-eslint/use-unknown-in-catch-callback-variable': {},
};
```

This catches the regression class where the lint command stays green while the floor is
off—an entry added after the config that disables it, a preset that silently stopped
applying, a glob that stopped matching.
Layered configs make this the normal failure, not an exotic one.

**Probe fixtures.** Commit a file the gate must reject, and assert that it does.
A lint floor that cannot demonstrate a rejection is indistinguishable from a lint floor
that is off.

Run both in CI. Verifying by hand after a config edit works exactly until the one time
somebody forgets.

**A check nobody has watched fail is not a gate.** This applies with particular force to
the shell fragment written inline in a workflow or a Makefile, because that is where
exit status is easiest to lose: a loop that prints complaints and reaches its last
statement exits zero; a pipeline reports only its final command; a `grep` guard
disappears when the command feeding it errors.
Before a check is allowed to be required, run it against an input it must reject and
watch the nonzero status.
Then keep that input.
Checks that matter belong in a file with a positive and a negative test beside them, the
same as any other code; the guideline or workflow calls the script rather than restating
it, so there is one copy to fix when it is wrong.

## Traps That Keep a Gate Green

Each of these has shipped a green build that checked nothing.

**A pipeline’s exit status is its last command’s.** `cmd | grep -q pattern` reports on
`grep`, not on `cmd`. When `cmd` fails—renamed package, manifest error, resolver
failure—`grep` gets empty input and returns 1, a leading `!` inverts that to 0, and the
check that proves an invariant reports success having read nothing.
Capture first, then test the captured value:

```bash
# Bad: a failing `cargo tree` makes this check pass.
! cargo tree -p core --prefix none | grep -qE '^(clap|anyhow) '

# Good: the command's own failure is fatal, and grep reads real input.
tree="$(cargo tree -p core --prefix none)" || exit 1
! printf '%s\n' "$tree" | grep -qE '^(clap|anyhow) ' \
  || { echo 'core must not depend on clap or anyhow'; exit 1; }
```

`set -o pipefail` addresses the same class where the shell supports it, but capturing is
explicit and portable across runners.

**Evidence a machine records about itself proves nothing.** When a check compares output
to a committed recording, and the same machine can regenerate the recording, it compares
its own output to its own output and agrees by construction.
This passes forever on the recording machine and nowhere else.
Give the recording one authority: have CI re-record and fail on any difference, so the
authoritative platform decides and the fix is a download rather than a guess.
The same reasoning applies to committed data that encodes machine-specific values—a
snapshot that is 797 bytes on macOS and 745 on Linux, an absolute path, a username.
Test committed fixtures for machine-specific content explicitly; an update flag writes
what it saw, which quietly converts a portable pattern into a local literal.

**A check that can pass while doing nothing.** If the expected result of a check is
“empty”, an unrun check and a passing check are the same observation.
Where the correct output is non-empty by construction, assert non-emptiness too, so a
harness that never executed fails instead of passing.

**Single-platform blindness.** Code behind `cfg(target_os = ...)`, `process.platform`
checks, or equivalent conditionals is invisible to a linter and a type checker running
on one platform.
If CI lints only on Linux, platform-gated modules have never been linted
anywhere. Lint-check the other targets explicitly—checking, not building, so no
cross-linker is needed.

This needs **two** targets, and collapsing them into one is how the check quietly stops
checking. Locally, a missing target should be a skip: developers should not have to
install every cross target to run `make lint`. In CI, a missing target must be a
failure, because a runner with none of them installed skips every target, lints none of
the platform-gated code, and reports the same green as a full pass:

```bash
# Local discovery: lint installed targets and name every skip.
node .tbd/docs/guidelines/scripts/check-rust-gate.mjs cross-targets \
  --mode local \
  --target x86_64-apple-darwin \
  --target x86_64-pc-windows-msvc

# Required CI gate: fail before linting if any declared target is unavailable.
node .tbd/docs/guidelines/scripts/check-rust-gate.mjs cross-targets \
  --mode strict \
  --target x86_64-apple-darwin \
  --target x86_64-pc-windows-msvc
```

The expected targets come from the project’s support contract, not from what happens to
be installed on the current runner.
The checked-in script is distributed with this guideline and has negative tests for an
empty workspace and a missing strict target.
It also leaves `rustup target list` errors visible; silencing that command can turn
“rustup is not on this runner” into a successful local no-op.
It uses Cargo’s default feature set unless passed `--all-features`,
`--no-default-features`, or `--features`. Repeat the strict invocation for each
supported feature combination; do not substitute `--all-features` when features are
mutually exclusive or that combination is not part of the project’s contract.

Tests have the mirror-image version: where platform behavior differs (filesystem event
backends, path semantics, line endings), a matrix across the supported platforms is the
only thing that catches per-platform semantics before a user does.

**Scope holes.** A floor scoped to `*.ts` exempts every `.js` file in the project.
Config globs must cover every extension the project actually contains.
Two scope exclusions are legitimate and both need stating:

- Nested working copies—agent worktrees, vendored checkouts, `attic/` reference
  clones—hold a mid-edit copy of the repo outside the type-checker project.
  Linting them reports someone else’s work as your failures.
- Generated files whose generator already emits formatted output (see below).

## Split Jobs So Failures Answer Different Questions

Separate jobs for formatting, lint, unit tests, platform compatibility, minimum
supported toolchain, docs, and dependency policy.
A single job that does all of them answers only “something is wrong.”

Two job-design rules that are routinely missed:

- **A compatibility job must run tests, not only compile.** `cargo check` on the minimum
  supported Rust version, or a typecheck against the minimum TypeScript version, proves
  the code parses. It misses behavioral and test-only regressions.
  Compile *and* test on the floor version.
- **Feature and entry-point combinations users actually build need their own job.** The
  path a library consumer takes (`--no-default-features`, a subpath export, the
  published package rather than the source tree) is otherwise compiled only by them.
  Pair it with a guard that asserts the boundary held—a dependency that reappears in a
  minimal build is the split silently coming undone.

Make caches performance-only.
A gate whose correctness depends on cache state is not reproducible, and a poisoned
cache turns into a mystery rather than a failure.

## Keep Out What the Gate Cannot Measure

Adding a check that fails for reasons the change did not cause teaches everyone to
re-run the gate until it is green, which is the same as not having it.
Two checks need evidence beyond an ordinary pass/fail command:

- **Uncontrolled timing.** An absolute wall-clock threshold on a heterogeneous shared
  runner often measures runner contention rather than the change.
  Gate performance only when the environment and noise budget are controlled—for
  example, on a dedicated runner or with a repeated within-run comparison against a
  fixed baseline whose regression margin exceeds observed variance.
  Otherwise keep the benchmark in a documented workflow, record the evidence, and do not
  make a noisy threshold block unrelated changes.
- **Anything racing on shared mutable state.** A check that compares against a branch
  other working copies push to independently will fail a change for something the change
  did not do.

Same principle inside a gate’s output: suppress warnings a project has deliberately
accepted. A dependency audit that warns about allowed-but-unused license entries trains
readers to skim its output, and the next real advisory scrolls past with it.
Noise is not free strictness; it is a slow repeal.

## Suppressions Are Debt or Decay

Every off-switch—a disabled lint rule, a relaxed type flag, an ignored advisory, a
skipped test—carries a tracker ID and the condition under which it comes back:

```javascript
// === Ratchet (tracked debt, tbd-s9vn): existing violations predate the
// strictTypeChecked floor; re-enable when the backlog is cleared.
'@typescript-eslint/no-unnecessary-condition': 'off',
```

A suppression with a tracker ID is debt.
One without is decay, and it is permanent, because nothing will ever remind anyone it is
there.

- **Ratchet toward strict; never loosen the default.** Keep the project config strict
  and give the legacy files their own relaxed config over an explicit file list.
  New files land under the strict config; files move out of the legacy list, never into
  it.
- **Narrow the scope before lowering the severity.** A file-scoped override that names
  the exact rule is a bounded exception; a global downgrade is a new floor.
- **Prefer a mechanism that expires on its own** where the toolchain offers one (Rust’s
  `#[expect(lint, reason = "...")]` warns once the suppression is unnecessary).
  Where the tooling cannot expire suppressions, the written rule to remove obsolete ones
  is the only thing that does.
- **Distinguish a deliberate exception from debt in the comment itself.** “Deliberate
  exception, not debt: with `noUncheckedIndexedAccess` on, a postfix `!` after a
  bounds-checked index is the sanctioned idiom” is a decision.
  It should not read like a ratchet, or someone will eventually “fix” it.

## Generated Files Have Exactly One Owner

A formatter and a generator must never both own a file: each run of one makes work for
the other, and the diff never settles.

- Exclude generated files from the formatter, and have the generator emit output in the
  formatter’s normal form.
- Drift-test them: regenerate in CI and fail on any difference.
  A generated file that is only ever written by hand-run tooling is out of date the
  first time someone forgets.
- The same applies to committed derived artifacts—reports, schemas, ledgers rendered
  from source data. A committed page that keeps asserting numbers its source no longer
  supports is worse than no page, because it carries the record’s authority.

## Hooks

Hooks are the fast local pass, not the gate.
Pre-commit auto-fixes staged files; pre-push runs the full verify gate; CI repeats it so
a `--no-verify` commit cannot land unchecked.

- **Run auto-fixing hooks sequentially.** Jobs that stage their fixes each run
  `git add`, and concurrent adds contend on `.git/index.lock`. In lefthook, `priority`
  is honored only when `parallel: false` (or `piped: true`), so a parallel hook block
  with priorities is *not* serialized—it just looks like it is.
- **Call a pinned local binary, never a download-capable runner.** `pnpm exec`,
  `bun run`, or a package script resolves the pinned binary and fails if it is missing;
  `npx`, `pnpm dlx`, and `bunx` will fetch and execute an unreviewed latest version when
  the dependency is absent—inside the gate, with the repository checked out.
- **Match the run target to the exclusion mechanism.** A tool that resolves its ignore
  file relative to its target argument does not apply that ignore list when handed a
  staged subset. Pick one mechanism—hook-level `exclude:` with staged files, or the
  tool’s own ignore file with a whole-tree run—and do not mix them, or the ignore list
  silently stops protecting fixtures and generated docs.

## Gates Run in Hostile Environments

A gate’s subprocesses inherit an environment nobody chose.

Git exports `GIT_DIR` and friends into hook environments—always when pushing from a
linked worktree—which redirects any git subprocess the suite spawns onto the *real*
repository. Test fixtures then rewrite real refs.
Scrub the inherited environment in both the hook wrapper and the test setup; neither
layer alone is sufficient, because tests also run outside hooks and hooks also run
things that are not tests.

```yaml
pre-push:
  commands:
    check:
      run: node scripts/scrub-git-env.mjs pnpm run ci:quality
```

Generalize the rule: any ambient variable that redirects a tool’s target—`GIT_DIR`,
`HOME`, registry and cache overrides, `NODE_OPTIONS`—is an input the gate must control
rather than inherit.

## Timeouts Record a Measurement

Raise a timeout only where it is genuinely tight, scope the raise to where it applies,
and record the measurement that forced it.
A global raise masks hangs everywhere else, which is the failure mode timeouts exist to
catch. `general-testing-rules` carries the rule and a worked example.

## Workflow Authority and Pinning

- Start with read-only permissions at the workflow level and grant additional
  permissions per job.
  A test job never needs `contents: write`.
- Check out without persisting credentials (`persist-credentials: false`) so later steps
  cannot use the checkout token.
- Pin third-party actions to reviewed immutable commit SHAs, with the release tag in a
  trailing comment for readability: `uses: owner/action@<40-hex> # v6`. There is no tag
  exception. An exact tag is not more immutable than a floating one—a tag is a mutable
  reference either way, and `v8.3.2` can be repointed at different code without any diff
  in your repository. The SHA is what fixes the code you reviewed.
  Let an update bot propose SHA bumps so pinning does not mean freezing.
- Parse workflow YAML when enforcing pins.
  A line regex misses valid flow-style maps, quoted or spaced keys, and can mistake
  `uses:` inside a block-scalar script for an action reference.
- Disable install scripts in CI (`--ignore-scripts`, `NPM_CONFIG_IGNORE_SCRIPTS`), and
  run the dependency audit inside the gate.
- Treat a changed runner image or label as an input change, not as infrastructure.

Full cross-ecosystem installation policy is `supply-chain-hardening`; release-only
authority is `release-engineering-rules`.

## Name the True Cause of a Known Bad Failure

When a dependency’s failure mode is misleading, add a precondition check that says the
real cause. A tool version below the floor that fails with
`failed to parse year in date "14 days"` reads like a corrupt config file rather than a
stale tool, and it takes out every target that uses the tool at once.
A five-line version check at the front of the gate converts a confusing multi-target
failure into one sentence and an install command.

This is worth doing exactly once per known trap, when the failure has already cost
someone an hour. It is not a reason to precheck every tool.

## Verifying the Gate

After wiring or reordering any gate, prove it holds:

1. Introduce a violation of a floor rule; the gate fails on it.
2. The config-contract check reports the floor rules at error severity.
3. CI logs show verify-mode commands (`--check`, `--max-warnings 0`, `-D warnings`), not
   fix-mode commands.
4. A file of every extension the project contains is covered—run the checks on one of
   each, not only the primary language.
5. Break a generated file by hand; the drift test fails.
6. Each check that can pass vacuously (empty input, skipped job, missing tool) fails
   loudly when its input disappears.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->

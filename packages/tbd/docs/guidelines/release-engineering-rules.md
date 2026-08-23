---
title: Release Engineering Rules
description: Language-neutral rules for turning a reviewed commit into artifacts users execute—one release identity, a pre-release gate that runs where publishing happens, least-privilege publishing authority, build-once-and-promote, packaging and checksums, smoke-testing the packaged artifact rather than the build output, multi-channel coordination, testable release logic, and incident preparation. Load for any release, alongside release-notes-guidelines and the language-specific release document.
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: general
---
# Release Engineering Rules

A release is a supply-chain operation.
It converts a reviewed commit into artifacts users will execute, and it grants
automation permission to publish them.
These rules are language-neutral; `rust-release-rules` and the packaging sections of the
language documents own registry-specific mechanics.

The characteristic release bug is not a broken build.
It is a green pipeline that published something other than what was tested—a different
commit, a rebuilt binary, an archive missing a file, a wheel whose console script does
not exist.

**Related**:

- `release-notes-guidelines` (what goes in the notes)
- `supply-chain-hardening` (cool-off and pinning for release tooling)
- `ci-and-gates-rules` (the gate this reuses, and workflow authority in general)
- `rust-release-rules` (crates.io trusted publishing, maturin wheels)

## Define One Release Identity

- A reviewed git commit is the source of every artifact.
- One version and one tag cover all channels in the same release.
- State whether the tag or a manifest field is authoritative, and derive the rest from
  it.
- Refuse to publish when tag, package metadata, and the built program’s own `--version`
  disagree. Check this in the pipeline; the three drift independently and nothing else
  notices.
- Decide up front how prereleases, yanked releases, rebuilds, and minimum-supported-
  version changes are versioned.
- Never rebuild different bytes under an existing immutable version.

A tag-triggered workflow is the common design.
Manual dispatch may offer a dry run, but publishing still needs an immutable commit and
an explicit release identity.

## Run the Pre-Release Gate Where Publishing Happens

Before creating or accepting a release tag, verify formatting, lint, tests, docs, and
project-specific checks; supported feature combinations and platforms; the declared
minimum toolchain; dependency and license policy; package contents and exclusions;
release notes for the exact commit range; version consistency; and that nothing is
uncommitted or unpushed.

The release workflow repeats the checks that protect publishing.
A local run is convenience, not proof that the remote tag still names the same state.

Give release-support code an interpreter or toolchain the project pins, not the host’s.
A release script that runs under “whatever `python3` is on the runner” is one image
update away from failing at the least recoverable moment.

## Minimize Publishing Authority

- Grant write, package, or OIDC token permissions only to the job that needs them.
- Keep build jobs unable to publish.
  Build jobs produce artifacts; separate publish jobs consume them.
- Prefer registry trusted publishing over stored long-lived tokens.
- Use protected environments where publication warrants an approval boundary.
- Never run untrusted pull-request code in a context holding release credentials.

If a channel cannot use short-lived credentials, scope its token to one project, store
it in the narrowest environment, rotate it, and confirm forked code cannot reach it.

Release tooling—generators, actions, cross-compilers, packagers, upload tools—is an
executable dependency.
Apply the project’s cool-off period, pin exact versions and action commit SHAs, review
source diffs on upgrade, and treat a changed build image or runner label as a
release-input change.

## Build Once, Promote the Same Bytes

Each matrix entry has one declared target, toolchain, runner, and packaging rule.
Build the artifact once, and promote those exact bytes through validation and
publishing.
Rebuilding between validation and publish means you shipped something you did
not test.

- Use the committed dependency resolution (`--locked`, `--frozen`, `npm ci`).
- Build from the tagged commit, never a floating branch.
- Record compiler, target, features, and relevant environment alongside the artifact.
- Use native runners where cross-compilation would prevent a meaningful smoke test.
- Fail an all-or-nothing release if a required target fails; never silently publish a
  partial platform set.

## Package Predictably

Artifact names carry project, version, and target.
Archives contain only what users expect: the executable or library, license files, a
concise readme or install note, and completions or man pages where supported.

- Generate SHA-256 checksums for downloadable artifacts, and a manifest that names what
  was produced.
- Use deterministic file ordering and normalized timestamps where reproducible archives
  are a goal.
- Emit an SBOM or embedded dependency metadata where project policy requires it.
- Sign or attest provenance where consumers have a verification path—a signature nobody
  verifies does not substitute for the other controls.
- Test archive extraction on every supported host format.

## Smoke-Test the Packaged Artifact, Not the Build Output

This is the rule most often skipped and most often responsible for a broken release.
`target/release/tool` working proves nothing about the archive, wheel, installer, or
package that users actually receive: packaging metadata decides which files ship, what
the console script is called, and whether the entry point resolves at all.

For each natively runnable artifact:

1. install or extract it into an empty temporary environment;
2. run `--version` and one representative real command;
3. verify the expected executable names and files exist;
4. check dynamic-library and runtime assumptions;
5. discard the environment.

Two refinements that catch what a naive smoke test misses:

- **Import or invoke through the installed package, never the source tree.** A test
  harness that reaches into the working directory passes while the built package is
  broken—which is the exact failure the smoke test exists to prevent.
  Install into a fresh environment and run against that, with the source tree off the
  search path.
- **Run the entry point the way a user gets it.** An isolated run from the built
  artifact (`uv tool run --isolated --no-index --from <wheel> tool --version`,
  `npx --no-install`, extracting the archive to a scratch dir) exercises the console
  script and its metadata, not just the library.

Where a cross-compiled artifact cannot run on its builder, use a native validation job
or explicitly record the evidence gap.
Do not let “it compiled” stand in for it.

## Rehearse the Release Without Publishing

A release path that has only ever run during a real release is untested.
Provide a rehearsal target that builds and inspects every artifact without contacting
any registry, and run it before tagging.

Two details make a rehearsal honest:

- **Set the release identity explicitly**, even on a branch, so the rehearsal exercises
  exact-version behavior instead of a placeholder.
- **Package interdependent components in one invocation.** A package that depends on an
  unpublished sibling cannot resolve it from the registry; packaging the sibling first
  in a separate run does not help, because that produces a build artifact rather than a
  registry entry. Naming both in a single invocation is what lets the tooling verify each
  against the just-packaged sibling.

## Choose Channels by Audience

No channel is universally primary.
Pick the smallest set that serves the actual users; each added channel is a permanent
compatibility and incident-response obligation.
Publishing everywhere to maximize the number of install commands in a README is not a
reason.

| Channel | Best fit | Key considerations |
| --- | --- | --- |
| Language registry (crates.io, npm, PyPI) | developers and library consumers | source build, API/feature contract, trusted publishing |
| GitHub Releases | direct binary downloads and automation | checksums, platform naming, installer trust |
| OS package manager | users of that platform | independent review cadence, manifest updates |
| Container registry | services and deployment tooling | base image digest, SBOM, runtime user and capabilities |

## Coordinate Channels Without Rebuilding

A multi-channel release has one plan job that validates identity and intended channels,
build jobs that produce artifacts, validation jobs that consume them, channel jobs that
publish the validated bytes, and an announcement job that runs only after the required
channels succeed.

- Make each channel independently retryable.
- Detect prior publication, and distinguish an identical existing version from a
  conflict. A rerun that finds its own successful upload should succeed; one that finds
  different bytes under the same version must fail.
- Prevent concurrent releases of the same version.
- Report exactly which channels completed when orchestration fails, and never print a
  global success message while a required channel is skipped or failed.

## Make Release Logic Testable Outside the Workflow

Complex release logic must be runnable without creating a tag or holding publish
credentials. Move it into checked-in programs the test suite can call: tag and version
parsing, release-plan resolution, archive naming and construction, package-content
validation, registry existence checks, target-to-runner mapping, checksum and manifest
generation, and installed-artifact smoke tests.

Test success, malformed input, partial state, registry errors, and reruns.
The workflow orchestrates these programs and passes structured outputs between jobs; it
should not itself contain the logic.
Anything expressed only as inline shell in a release workflow is tested exclusively in
production.

## Prepare for Release Incidents

Document who can revoke or rotate publishing credentials, quarantine compromised
workflow access, yank or remove a published version where the registry permits it,
publish a fixed version and security notice, and determine which commits and artifacts
are affected.

Retain provenance, checksums, logs, and the exact release commit long enough to answer
those questions. Do not overwrite that evidence during a rerun—a rerun that clobbers the
failed run’s logs removes the only record of what went wrong.

## Release Checklist

- [ ] One immutable commit and version identify the release.
- [ ] Local and remote pre-release gates pass.
- [ ] Release tools and actions are reviewed and immutably pinned.
- [ ] Build jobs have no publishing authority.
- [ ] Publishing uses least privilege and short-lived credentials where possible.
- [ ] Every required target produces a named, checksummed artifact.
- [ ] Packaged artifacts—not build outputs—pass smoke tests in a clean environment.
- [ ] Channel selection matches documented audiences.
- [ ] Multi-channel reruns are idempotent, and conflicts fail.
- [ ] Release notes describe the exact commit range.
- [ ] Incident and recovery actions are documented.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->

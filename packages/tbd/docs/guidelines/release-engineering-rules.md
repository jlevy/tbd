---
title: Release Engineering Rules
description: >-
  Language-neutral release orchestration: immutable identity, rehearsable state
  transitions, build-once artifact promotion, least-privilege publishing, independent
  channel recovery, and separate artifact and publication evidence
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: general
---
# Release Engineering Rules

A release is a supply-chain operation that turns one reviewed commit into artifacts
users execute. This document owns the language-neutral contract: identity, state,
authority, artifact promotion, channel coordination, evidence, and recovery.
Language-specific release guides own registry commands and package formats.

The characteristic release bug is a green workflow that publishes something other than
what was validated: a different commit, rebuilt bytes, an incomplete archive, or a
channel silently skipped after another channel became public.

**Related**:

- `release-notes-guidelines` (the user-visible delta)
- `ci-and-gates-rules` (gate integrity, thin workflows, and permission boundaries)
- `supply-chain-hardening` (pinning and review of release dependencies)
- `rust-release-rules` (Cargo, crates.io, native archives, and Rust binary wheels)

## Model the Release as a State Machine

Use explicit transitions with machine-readable inputs and outputs:

1. **Plan:** resolve the commit, version, tag, required channels, target matrix, and
   prior publication state.
2. **Gate:** run the repository’s complete verify-only quality entry point on that
   commit.
3. **Package:** build each channel artifact once from locked inputs.
4. **Validate:** inspect and smoke-test the packaged artifacts on supported hosts.
5. **Assemble:** produce checksums, the artifact manifest, notes, and provenance inputs.
6. **Approve:** enter the protected publication environment only after required evidence
   passes.
7. **Stage:** create private or draft publication state when the channel supports it.
8. **Publish:** promote the validated bytes through independently retryable channel
   jobs.
9. **Verify and announce:** query every required channel, run registry-backed install
   probes, record final evidence, and only then announce global success.

Prevent concurrent runs for the same release identity.
A retry resumes from observed external state; it does not assume the previous workflow
stopped where its logs ended.
If any required channel is missing, conflicting, or unverified, the release is not
globally complete.

## Rehearse the Same Path Without Publication

A release path first exercised by a real tag is an untested production change.
Provide a rehearsal that accepts an explicit immutable commit and version, then performs
plan, gate, package, validate, and assemble without publication credentials or registry
writes.

Rehearsal must use the same tested programs, target mapping, package rules, and artifact
inspection as publication.
Only the authority-bearing transitions are disabled.
A `dry-run` branch that skips packaging or uses placeholder identity does not exercise
the failures that matter.

Run the rehearsal before the first release, after release-tooling changes, and before a
new platform or channel becomes required.

## Resolve One Immutable Release Identity

Define the release unit before building.
A product shipped through several channels normally has one version, tag, and commit;
independently versioned packages are different release units.

- Name one version source and derive or validate every other occurrence.
- Refuse a release when the tag, package metadata, archive names, manifest, and
  executable `--version` disagree.
- Record the exact commit, target matrix, features, toolchains, release-tool versions,
  and selected channels in the plan.
- Use the committed dependency resolution and refuse dirty or unpushed release inputs.
- Never replace bytes under a version already accepted by a public channel.

A tag-triggered workflow is a common publication authority.
Manual dispatch can be a useful rehearsal interface, but it must still resolve one
immutable commit and must not turn an arbitrary branch tip into a release.

## Keep Artifact Identity Separate From Channel Evidence

Use separate records for facts that become immutable at different times.

The **artifact manifest** identifies what was built.
Freeze it after validation.
For each artifact it normally records:

- release version, tag, and source commit;
- artifact filename, size, and cryptographic digest;
- target, platform or compatibility tag, enabled features, and toolchain;
- the producing workflow run and relevant pinned build inputs; and
- the relationship between an archive, package, checksum file, and attestation.

The **release evidence** records what happened after artifacts existed.
It names each required channel, observed filename and registry digest, publication
result, verification time, clean-install probe, and final channel state.

Do not mutate the artifact manifest to record workflow progress.
“PyPI pending” is not an artifact property, and changing the manifest after attesting it
invalidates its identity.
Keep transient orchestration state separately; publish a final evidence record only
after all required channels and probes complete.

## Run the Full Gate Where Publishing Happens

Before publication, repeat the repository’s handoff gate on the resolved commit.
The selected gate should cover formatting, lint, docs, default and supported feature
sets, tests and stable goldens, minimum supported toolchain, dependency and license
policy, package contents, installed-artifact behavior, version consistency, and
release-script tests according to the project’s actual risks.

A local pass is useful feedback, not proof about the remote tag.
Release-support code must run under a pinned project toolchain, not an ambient runner
interpreter. Keep workflow YAML thin: put identity parsing, target mapping, archive
construction, registry state comparison, checksum generation, and pass/fail decisions in
checked-in programs with positive and negative tests.

## Isolate Publication Authority

Build and validation jobs are read-only.
They must not receive registry tokens, `id-token: write`, `contents: write`, or
`attestations: write` merely because a later job needs them.

- Start with `contents: read` and grant additional permissions per job.
- Use a protected release environment with tag restrictions and an approval boundary
  when publication risk warrants it.
- Prefer OIDC trusted publishing over stored long-lived tokens.
- Keep a required bootstrap credential expiring, as narrowly restricted as the registry
  permits, and available only to the protected publish job; remove it immediately after
  the permanent trust path works.
- Never expose publication authority to untrusted pull-request code.
- Pin actions to reviewed commit SHAs and release tools to exact reviewed versions.

GitHub documents both
[job-scoped token permissions](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token)
and
[environment approval, tag, and secret boundaries](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments).
Registry-specific trusted-publisher bootstrap belongs in the language release guide.

## Build Once and Promote the Same Bytes Within Each Channel

Each channel artifact has one build, one validation path, and one digest.
Publish those exact bytes; rebuilding between validation and upload means the release
shipped something it did not test.

Build-once is a per-artifact rule, not a claim that every channel shares a binary.
A static Linux archive and a glibc-compatible wheel may be intentionally different
products. Each gets its own manifest entry and must be built once, validated in packaged
form, and promoted without a second build.

When a registry’s supported client creates and uploads the package in one operation,
that operation must validate and upload the same generated package.
The credential-free rehearsal proves the same packaging rules but is not falsely
described as promotion of the rehearsal bytes.
The language release guide must document this channel constraint.

Use native runners when cross-compilation prevents meaningful execution.
A cross-compiler, linker, sysroot, and SDK are release inputs; pin and review them.
A required target that cannot be validated is a blocked release, not a silent matrix
reduction.

## Make Artifacts Deterministic and Verifiable

Artifact names carry the product, version, and target.
Archives contain only the files users expect: the executable or library, licenses,
concise install information, and any documented completions or man pages.

- Generate SHA-256 checksums and a manifest over the complete artifact set.
- Normalize ordering and timestamps when reproducible archives are a project goal.
- Record dynamic-library, runtime, CPU, and operating-system floors as artifact
  contracts.
- Produce an SBOM when policy or consumers require one.
- Attest binaries, packages, and manifests only when consumers have a verification path.

GitHub’s
[artifact attestation guidance](https://docs.github.com/en/actions/concepts/security/artifact-attestations)
states that attestations identify the workflow, repository, environment, commit, and
event, and that the benefit depends on verification.
An attestation is provenance evidence, not proof that the artifact is defect-free.

## Smoke-Test the Packaged Artifact From an Empty Environment

`target/release/tool` working does not prove that an archive, wheel, installer, or
source package works.
Packaging metadata controls what ships and which command users receive.

For every natively runnable artifact:

1. create an empty temporary install or extraction root;
2. remove the source checkout and any preinstalled copy of the command from search
   paths;
3. inspect archive or package contents and entry-point, script, or installer metadata as
   applicable;
4. run `--version` and at least one representative real command;
5. verify stdout, stderr, and exit behavior where automation relies on them;
6. check dynamic-library and declared runtime floors; and
7. discard the environment.

Invoke the installed entry point exactly as a user does.
A test importing from the working tree or executing the adjacent build output can pass
while the package is broken.
For a cross-built artifact, use a native validation job or keep the target out of the
supported matrix until one exists.

## Publish Only Through Supported User Channels

Choose the smallest channel set that serves named users.
Every extra channel creates a compatibility, credential, monitoring, and
incident-response obligation.

| Channel | Typical audience | Contract to name |
| --- | --- | --- |
| Language registry | developers and language-native installers | source, API, features, registry auth |
| GitHub Releases | direct binary users and automation | targets, checksums, provenance |
| Convenience tool registry | users of an existing tool manager | exact command, packaged executable, platform tags |
| OS package manager | users of that platform | maintainer and update cadence |
| Container registry | service operators | base digest, runtime user, capabilities, SBOM |

An optional channel is not a second-class implementation.
Once documented as supported, its artifact and recovery path need the same evidence as
every other required channel.

## Stage, Publish, and Retry Channels Independently

A multi-channel release should use separate channel jobs that consume the artifact
manifest and validated files.
Before publishing, query each channel and classify every expected file or package as
absent, identical, conflicting, or unknown.

- Publish absent items.
- Treat identical existing items as successful prior work.
- Fail on a matching version with a different filename set or digest.
- Treat an ambiguous timeout as unknown and query the registry before retrying.
- Report completed, missing, and conflicting channels explicitly.

Use a draft GitHub release when it helps stage validated assets and delay the public
announcement until registries verify.
Existing assets may be skipped only after exact filename and digest comparison.
Do not print a global success message while a required channel or post-publication probe
remains incomplete.

## Test Release Logic Outside the Workflow

Checked-in release programs should be callable without tags, registry credentials, or
external mutation. Test at least:

- valid and malformed identity inputs;
- version, tag, and executable-version drift;
- target-to-runner and feature mapping;
- package and archive content violations;
- missing, identical, conflicting, partial, and unknown registry state;
- checksum and manifest determinism;
- installed-artifact smoke-test failure; and
- resumed runs after a partial publish.

Keep committed known-failure probes for release gates whose accidental removal would
otherwise look green.
`ci-and-gates-rules` owns that integrity pattern.

## Write Recovery Before the First Release

Document the operator and exact action for these states:

- **Nothing published:** fix the candidate or machinery, create a reviewed commit, and
  rerun rehearsal. Move a tag only when it has never named public artifacts or been
  consumed.
- **Partial channel publication:** preserve the failed run, manifest, and logs; query
  every channel; retry only missing identical artifacts; leave any staged announcement
  private; fail on conflicts.
- **Defective immutable artifact:** yank where the registry supports it, add a prominent
  notice, preserve the original bytes and evidence, and publish a corrected patch
  version. Never replace bytes under the old version.
- **Credential or workflow compromise:** disable the release environment, revoke tokens
  and trusted-publisher grants, preserve audit evidence, identify affected runs and
  artifacts from manifests and attestations, rotate recovery credentials, and notify
  users when exposure is plausible.
- **Unsupported target failure:** a required target blocks the release.
  Changing the supported matrix is a separate reviewed compatibility decision, never an
  in-run way to turn red into green.

Retain manifests, checksums, attestations, registry responses, and workflow logs long
enough to scope an incident.
A retry must not erase the only evidence of a failed or partially successful run.

## Release Checklist

- [ ] One immutable commit, version, and tag identify the release unit.
- [ ] Rehearsal runs the real non-publishing path with explicit identity and no publish
  credentials.
- [ ] The remote pre-release gate and known-failure probes pass.
- [ ] Release tools, actions, build images, and dependency resolution are pinned.
- [ ] Build and validation jobs are read-only; publish permissions are job-scoped and
  environment-protected.
- [ ] Every required artifact has a frozen filename, digest, compatibility contract, and
  packaged-artifact smoke test.
- [ ] The artifact manifest is immutable and channel progress is recorded separately.
- [ ] Channel reruns compare filenames and hashes, skip only identical state, and fail
  conflicts.
- [ ] Final evidence and announcement wait for every required channel and install probe.
- [ ] Partial publication, defective artifacts, credential compromise, and target
  failure have documented recovery paths.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->

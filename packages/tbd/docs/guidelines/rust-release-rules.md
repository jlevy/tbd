---
title: Rust Release Rules
description: Rust-specific release mechanics for Cargo and crates.io, native binary targets, optional Maturin bin wheels for uv users, compatibility floors, trusted-publisher bootstrap, and packaged-artifact tests
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: rust
---
# Rust Release Rules

`release-engineering-rules` owns the release state machine, immutable identity,
build-once promotion, permissions, channel coordination, evidence, and recovery.
Read it first. This document owns the Rust-specific implementation: Cargo and crates.io,
native binary archives, and the optional PyPI/uv convenience channel.

None of these channels is universally required.
Choose channels from named users and support risks, then apply the complete build,
validation, and recovery contract to each channel you document as supported.

**Related**:

- `release-engineering-rules` (the release contract this implements)
- `rust-project-setup` (package shape, toolchains, features, and the quality entry
  point)
- `rust-cli-rules` (the executable behavior the packaged program must preserve)
- `ci-and-gates-rules` (gate integrity and job permissions)
- `supply-chain-hardening` (release-tool and action pinning)
- `cli-agent-skill-patterns` (local-first agent acquisition)

## Match the Channel to the User

- **GitHub native archives** serve users and automation that want a prebuilt executable
  without a language toolchain.
- **crates.io** serves Rust library consumers and users willing to compile the CLI.
  [`cargo install`](https://doc.rust-lang.org/cargo/commands/cargo-install.html) builds
  from source and requires a Rust toolchain; it is not a zero-install binary runner.
- **PyPI binary wheels** are an optional convenience for an audience that already has uv
  or Python packaging infrastructure.
  A Maturin `bin` wheel can carry the real Rust executable so `uvx` feels like a
  zero-install command without claiming the program is implemented in Python.
- **`cargo-binstall`** may use prebuilt release assets, but it is an additional tool and
  trust relationship, not a first-party Cargo capability.

Rust has no first-party runner with uvx ergonomics.
Do not make users infer whether an install command compiles locally, downloads a native
archive, or installs a wheel; state the channel and prerequisite beside every command.

## Make Cargo the Release-Version Authority

Use the package or workspace Cargo version as the single release source when practical.
Derive tags, archive names, wheel metadata, and `--version` from it.
If a backend or channel requires another literal version, fail the release gate unless
it matches exactly.

For every publishable crate, declare `version`, edition, `rust-version`, license,
repository, README, description, and allowed registries.
Mark build helpers, fixtures, and private workspace members `publish = false`.

Run semver checks for a library that promises Rust API compatibility.
An MSRV increase is also a compatibility decision and must follow the project’s
documented versioning policy.

## Package and Publish Interdependent Crates Together

Cargo rewrites a published manifest.
A path dependency must also declare a version; Cargo ignores its `path` in the published
package, and normalized packages omit `[patch]`, `[replace]`, and `[workspace]`. Review
the current
[`cargo package` behavior](https://doc.rust-lang.org/cargo/commands/cargo-package.html)
before changing a workspace release script.

Pin Cargo 1.90 or newer and prefer its native workspace path for an interdependent
release set:

```bash
cargo package --locked --workspace
cargo publish --locked --workspace
```

Cargo 1.90 added `cargo publish --workspace` with automatic dependency ordering and
full-set publish verification, including during dry runs.
The [Rust 1.90 release notes](https://blog.rust-lang.org/2025/09/18/Rust-1.90.0/) also
warn that the uploads are not atomic, so retain the partial-publication recovery path.

Current Cargo also accepts repeated `-p`/`--package` selectors for both package and
publish. Use them for a partial release only when the selected set is validated in
rehearsal; the command reference does not make left-to-right selector order a sequencing
contract. Do not replace Cargo’s workspace support with a hand-written publish loop.

Pass `--registry` when a non-default registry changes the dependency-resolution
assumption. See the official
[`cargo publish` documentation](https://doc.rust-lang.org/cargo/commands/cargo-publish.html)
for current selection and upload behavior.

Before publication:

- inspect `cargo package --list` for every selected crate;
- create the `.crate` files with `--locked` and do not use `--no-verify`;
- inspect the normalized manifest and archive contents;
- extract each package into a clean directory and build or test it outside the
  workspace; and
- run `cargo publish --dry-run` as additional evidence, not as a substitute for the
  consumer-like test.

`cargo publish` creates, verifies, and uploads its `.crate` in one supported operation.
The credential-free package rehearsal proves the same rules, but the publication
operation is the channel build-and-upload boundary; do not claim that Cargo promotes a
previous rehearsal tarball when its supported client does not accept one.

### Validate an Unpublished Sibling Like a Consumer

Before a sibling crate exists in the registry, an extracted downstream package cannot
resolve its normalized registry dependency by itself.
Test the package without weakening the published manifest:

1. extract both `.crate` files into separate scratch directories;
2. build or test the extracted library directly;
3. install or build the extracted downstream package with a temporary external Cargo
   config or harness whose `[patch.crates-io]` maps the exact sibling name and version
   to the extracted sibling path; and
4. run the installed executable’s version and representative command from a temporary
   root.

The patch belongs to the test harness or command configuration, not to the artifact.
Cargo removes a package-local `[patch]` during normalization, so embedding one does not
prove the published package works.
After the first publication, add a registry-backed install probe with no patch; that is
the final consumer path.

Treat a `cargo publish` polling timeout as unknown state.
Cargo documents that the upload may have succeeded even when waiting for the index times
out. Query the registry before retrying, and accept an existing version only when its
registry checksum matches the planned package.

## Declare the Native Artifact Matrix as a Contract

Do not say only “Linux, macOS, and Windows.”
Before the first release, record for every artifact:

- Rust target triple and CPU architecture;
- Linux libc family and minimum version or static-link claim;
- macOS deployment target as well as `x86_64` or `aarch64`;
- Windows ABI and architecture, normally an explicit MSVC target;
- enabled features and release profile; and
- the native host that extracts, installs, and smoke-tests it.

A common initial matrix for a broadly used CLI considers Linux and macOS on x86_64 and
arm64, plus Windows x86_64 MSVC. Adopt only targets backed by named users and native
validation. Defer Windows arm64, musllinux wheels, or another CPU/OS combination until a
supported user need and a reliable validation path justify the permanent matrix entry.

Use native runners by default.
Cross-compilation is acceptable when required, but the linker, SDK, sysroot, cross tool,
and emulation strategy become pinned release inputs.
Compilation alone is not a smoke test.

## Keep Static Linux Archives Distinct From manylinux Wheels

A `*-unknown-linux-musl` executable in a GitHub archive is a static-musl distribution
choice. A `manylinux_*` wheel is a glibc compatibility claim.
They may come from the same source commit and version while remaining different build
products and different bytes.

- Never put a musl executable in a wheel and relabel it `manylinux`.
- Build a manylinux wheel in a compliant environment or with a supported tool that
  enforces the chosen glibc symbol floor.
- Audit the final wheel and record its actual platform tag and linked-library floor.
- Publish a musllinux wheel only when that separate target is built, tagged, installed,
  and tested on a compatible environment.
- State the macOS deployment target in the build environment and verify the final
  binary; the runner’s current OS version is not the compatibility policy.

Maturin’s [distribution guide](https://www.maturin.rs/distribution.html) describes its
manylinux and musllinux auditing and tagging behavior.
A plain `linux` wheel is not a portable substitute and is rejected by PyPI unless
separately repaired and validated.

For GitHub archives, package only documented files, commonly the executable, licenses,
README or install note, and supported completions or man pages.
Generate checksums and attestations over the final archives, not adjacent build outputs.

## Use a Maturin `bin` Wheel Only as a Real Binary Channel

Maturin `bindings = "bin"` packages a Rust executable in the wheel’s scripts location;
installation places the executable on `PATH`. The official
[Maturin bindings guide](https://www.maturin.rs/bindings.html#bin) defines this mode.
The wheel remains platform-specific, but the executable does not import the Python ABI;
do not invent an interpreter-version matrix for a binary-only product.

A Rust-only CLI wheel must contain the real compiled executable.
It must not contain:

- a Python downloader;
- a runtime Python wrapper around the command;
- an empty importable module used only to reserve a name; or
- a first-run network fetch for the platform binary.

Keep release packaging metadata beside the binary crate when that makes the boundary
clear:

```text
project/
├── pyproject.toml          # optional root Python development environment
└── crates/
    └── mytool/
        ├── Cargo.toml      # release version source
        └── pyproject.toml  # Maturin binary-wheel metadata
```

The root Python environment may pin documentation, test, or release tools; it is not the
wheel’s product metadata.
A crate-local `pyproject.toml` prevents those concerns from being mistaken for runtime
dependencies.

A minimal release boundary looks like this; replace the placeholder with one exact,
reviewed Maturin version in the repository:

```toml
[build-system]
requires = ["maturin==<reviewed-version>"]
build-backend = "maturin"

[project]
name = "mytool"
dynamic = ["version"]

[tool.maturin]
bindings = "bin"
manifest-path = "Cargo.toml"
```

Derive the wheel version from Cargo or gate exact synchronization.
Do not let a root development-project version become a second editable release
authority.

Do not publish an sdist by default.
Add one only after its isolated source build works from the sdist contents on every
documented build path and is supported as a user installation route.
Otherwise an installer may choose a fallback that requires Rust or fails after download
even though the project intended to promise prebuilt wheels only.

## Document Exact uv Execution and Installation

For a project that intentionally supports the PyPI binary-wheel channel:

```bash
# Ephemeral, isolated execution; ignores an already installed copy.
uvx --isolated mytool@X.Y.Z --version

# Persistent installation; places the compiled command on PATH.
uv tool install mytool==X.Y.Z
```

`uvx` is an alias for `uv tool run`; `--isolated` prevents an already-installed tool
from taking precedence.
The exact `@X.Y.Z` or `==X.Y.Z` constraint is required by the no-unpinned-runner policy.
See the official [uv tool documentation](https://docs.astral.sh/uv/concepts/tools/).

Smoke-test each wheel from a fresh uv environment with the source tree and any existing
`mytool` command off `PATH`. Inspect the wheel’s script payload and `RECORD`, install
it, confirm that the intended command appears on `PATH` and resolves to the binary from
that wheel, run `--version` and a representative real command, verify stream and exit
behavior, and audit native-library floors.
Build each wheel once, validate that file, and upload the same file without a rebuild.

## Treat PyO3 Bindings as a Different Product Surface

An importable PyO3 extension is not a binary wheel with a more elaborate installer.
It adds a Python API, interpreter and ABI compatibility, import behavior, type
information, and often a console wrapper.
Prefer a separate crate, distribution name, or release lifecycle when those dependencies
and users differ from the standalone CLI.

- Choose `abi3`, free-threaded support, or interpreter-specific wheels from the Python
  APIs and interpreters the binding actually supports; test that matrix.
- Keep PyO3 extension features out of ordinary Rust library and CLI tests unless they
  are truly part of those builds.
- Test imports and the installed Python console entry point in addition to the native
  library.
- Do not reserve a possible future binding name with an empty package.
- Do not make the standalone Rust CLI depend on Python merely to keep a future binding
  option open.

Use PyO3’s current
[building and distribution guide](https://pyo3.rs/main/building-and-distribution) when
that product exists.
Until then, keep the Rust-only wheel in Maturin `bin` mode.

## Bootstrap Trusted Publishing Per Registry

Use a protected publish environment, grant credentials only to its publish job, and
prefer OIDC trusted publishing after bootstrap.

The first-publication paths differ:

- **PyPI:** configure a pending trusted publisher before the project exists.
  The first successful OIDC upload creates the project and converts the publisher to a
  normal one. A pending publisher does not reserve the name.
  See PyPI’s
  [pending-publisher documentation](https://docs.pypi.org/trusted-publishers/creating-a-project-through-oidc/).
- **crates.io:** a trusted publisher can be configured only after the crate’s initial
  manual publication. Use one expiring bootstrap token in the protected publish job.
  Choose the shortest expiry, only the `publish-new` endpoint scope, and exact
  crate-name scopes for the planned new crates; crate scopes can match future crates, so
  first publication does not require an unrestricted token.
  Publish the initial version; configure the exact repository, workflow, and environment
  publisher for every crate; enable trusted-publishing-only mode; then revoke and remove
  the bootstrap token.
  See the current
  [crates.io trusted-publishing documentation](https://crates.io/docs/trusted-publishing)
  together with the accepted
  [token-scopes RFC](https://rust-lang.github.io/rfcs/2947-crates-io-token-scopes.html)
  and
  [trusted-publishing RFC](https://github.com/rust-lang/rfcs/blob/master/text/3691-trusted-publishing-cratesio.md).

Never give a bootstrap token to build, test, pull-request, or rehearsal jobs.
A first release that needs the token still follows the same artifact and channel
validation; the credential exception changes only the authentication transition.

## Rust Release Checklist

- [ ] Cargo is the version authority, or every duplicated version is gated for exact
  equality.
- [ ] Publishable crates declare complete metadata; internal members use
  `publish = false`.
- [ ] Interdependent crates use pinned Cargo 1.90 or newer workspace packaging and
  dependency-ordered workspace publishing; partial selections are rehearsed.
- [ ] `.crate` contents and normalized manifests are inspected, extracted, and tested
  outside the workspace.
- [ ] An unpublished sibling is tested through a temporary external patch, followed by a
  registry-backed probe after first publication.
- [ ] Every archive and wheel names its target, CPU, libc or deployment floor, features,
  and native validation host.
- [ ] Static musl archives are not relabeled as manylinux wheels.
- [ ] Maturin `bin` wheels contain the real executable and no downloader, runtime
  wrapper, placeholder module, or first-run fetch.
- [ ] uv examples are isolated where ephemeral and exact-version everywhere.
- [ ] No sdist or extra target is published without a supported, tested user path.
- [ ] PyO3 bindings, if any, are treated as a separate Python API and ABI surface.
- [ ] PyPI pending publishing and crates.io token bootstrap follow their distinct trust
  models; the bootstrap token is revoked after trusted-publishing-only mode is enabled.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->

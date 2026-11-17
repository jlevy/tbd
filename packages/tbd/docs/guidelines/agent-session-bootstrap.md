---
title: Agent Session Bootstrap
description: When and how to make a repository install its own pinned toolchain at agent session start, for repos whose agents run in containers they do not control. Covers the fit test, the alternatives that are usually better, the install rules a bootstrap must follow, and the PATH and pin-drift traps that make one fail silently. Use when an agent session starts without the tools the repo requires, when writing or reviewing a SessionStart hook, or when deciding between a session hook and a provisioned image.
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: general
---
# Agent Session Bootstrap

A repository that pins its toolchain and an agent that starts in a container someone
else built are in direct conflict.
Until the toolchain is installed, every build target, test command, and package install
fails, so each session opens with the same manual setup before any real work begins.

A session bootstrap resolves that: a script the agent runs at session start, which
installs the repository’s own pinned versions when what is present does not satisfy
them, and otherwise exits immediately.

This is a repair mechanism for environments you cannot provision.
It is not a substitute for an image that ships the right tools, and it is a supply-chain
surface, so it follows the install rules in `tbd guidelines supply-chain-hardening`
rather than sitting outside them.

## When the Pattern Fits

Reach for a session bootstrap only when all three hold:

- **The toolchain is pinned and enforced.** Reproducibility already depends on exact
  versions, so installing “whatever is newest” is a defect rather than a convenience.
- **You do not control the base image.** Hosted agent sandboxes and cloud development
  environments hand you a container you did not build.
- **The failure mode is total.** A missing interpreter or package manager blocks every
  command, so a cold-start download costs less than a blocked session.

## When Something Else Is Better

| Situation | Prefer |
| --- | --- |
| You build the image | Bake the toolchain into the Dockerfile or devcontainer; a session hook then finds it and exits immediately |
| The platform runs a setup step | Use the native lifecycle hook (`postCreateCommand` and equivalents) rather than duplicating it per agent |
| The team already uses a version manager | Have the hook invoke `mise`, `asdf`, or Nix, so one source of truth stays authoritative |
| The repository does not pin versions | Pin first. A bootstrap that installs an unpinned toolchain makes drift automatic instead of visible |

## The Rules

1. **Install the repository’s pins, never the newest release.** Resolve each version
   from the file that already owns it—`.node-version`, a `required-version` floor, a
   toolchain file—so the bootstrap adds no second copy to keep in step.
   Newest is not a safe default: a newer language major ships a newer bundled package
   manager, which an `engines` range plus strict engine checking turns into a hard
   install failure. Runtime “fetch latest” also bypasses the release cool-off.

2. **Verify every download against a pinned checksum.** A bootstrap runs unattended and
   installs executables.
   Record the per-platform checksums in the script, refuse a mismatch, and delete the
   file.

3. **Separate tamper from unreachable.** A checksum mismatch is an attack signature and
   should exit nonzero.
   An unreachable network is an offline sandbox: warn, exit zero, and let the session
   open.

4. **Refuse an unknown platform rather than installing unverified.** If there is no
   pinned checksum for the detected platform, say so and stop.

5. **Install user-local, and make the result resolvable.** A hook runs in its own shell,
   so later commands see its work only through a directory that is already on `PATH`.
   Install into such a directory, and say so plainly when it is not on `PATH` instead of
   appearing to succeed.

6. **One script, registered per agent.** Keep the logic at a single agent-neutral path
   and let each agent’s configuration only point at it.
   Per-agent copies drift, and the drift stays silent until one agent’s sessions break.

7. **Order the hook before anything that needs the toolchain.** Other session hooks
   commonly need a package runner.
   The bootstrap has to run first.

8. **Guard the pins in CI.** Assert that the bootstrap’s versions match their canonical
   files and that every supported agent still runs it.
   Without this a version bump half-lands, and a session installs the wrong toolchain.

9. **Stay idempotent and quiet.** Most sessions start with a satisfying toolchain.
   Those should report one line and exit without downloading.

## Traps

**A global install that resolves nowhere.** The most common silent failure.
When a bootstrap unpacks a language runtime into its own tree, that tree’s `bin/`
becomes the package manager’s global prefix—and it is usually not on `PATH`. A later
`npm install -g <tool>` then exits 0, prints a normal install summary, and the tool
still does not resolve, which reads as “the tool is broken” rather than “`PATH` is
wrong”. Point the global prefix at a directory already on `PATH` when the bootstrap
installs the runtime itself, and leave an existing runtime’s prefix alone.
`tbd doctor` reports this directly, under `npm global bin`.

**A version comparison that is lexical.** Comparing version strings as text accepts
`24.9.0` against a `24.18.0` pin.
Compare numerically.

**A pin bump that lands in one place.** Every bump has to update the matching checksums,
which is exactly why rule 8 exists.

**An assumed `PATH`.** A user-local bin directory being on `PATH` is conventional but
not universal, so the script has to check rather than assume.

## Reference Implementation

tbd’s generated `ensure-gh-cli.sh` is this pattern applied to a single tool: a pinned
release at least as old as the cool-off, per-platform checksums recorded in the script,
verification before extraction, a user-local install, and an idempotent no-op when the
tool is already present.
It is a useful shape to copy for a repository’s own toolchain.

A repository’s own bootstrap can be registered alongside it.
`tbd setup --auto` merges session hooks rather than replacing them, and appends its own
entries after those already configured, so a repository’s bootstrap keeps both its place
and its position ahead of tbd’s launcher across regeneration.

## Related Guidelines

- Install rules, the cool-off, and the exception process:
  `tbd guidelines supply-chain-hardening`
- Repository-level enforcement for Node projects:
  `tbd guidelines pnpm-monorepo-patterns` and `tbd guidelines bun-monorepo-patterns`
- Diagnosing a session that cannot reach GitHub: `tbd shortcut setup-github-cli`

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->

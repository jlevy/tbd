---
title: Agent Skill Distribution
description: Distribution scope, reproducible installer, discovery-directory, CLI execution, and permission guidance for skills
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: general
---
# Agent Skill Distribution

Load this reference when selecting project or user scope, using the
[`skills` CLI](https://github.com/vercel-labs/skills), publishing a discovery directory,
writing reproducible install automation, or declaring `allowed-tools`.

## Separate the Skill from the Executable

A skill installer materializes the skill directory: `SKILL.md` plus its references,
scripts, and assets.
It does not install a separately packaged CLI or guarantee an entrypoint on `PATH`.

Choose execution independently:

- L0 skills need no executable
- L1 skills call a project/local executable first, with an optional reviewed pinned
  zero-install fallback
- L2 and L2b CLIs may install their own agent surfaces in addition to normal package
  distribution

A registry-installed skill does not need to lead with a one-time CLI setup when common
work can execute safely through the pinned L1 route.
Reserve self-installation for the workflows that need durable surfaces.

## Current `skills` CLI Model

The current [`vercel-labs/skills` documentation](https://github.com/vercel-labs/skills)
describes these distinct operations:

- `skills add`: discover and install selected skill directories
- `skills use`: temporarily materialize and use a whole skill bundle without durable
  installation
- project and global/user scope
- copy and symlink installation modes where supported

Treat the upstream documentation as authoritative for current flags and supported
agents.
Do not copy changing agent counts, skill counts, stars, or marketplace statistics
into durable guidance.

Project scope is the default for reproducible team behavior.
User/global scope is appropriate for personal workflows across repositories.
If both exist, document:

- scan locations
- name-collision behavior
- precedence or duplicate presentation
- whether updates copy content or follow a symlink
- how uninstall and stale-file cleanup work

Copy mode creates an independent installed snapshot.
Symlink mode improves local iteration but couples availability and content to the source
path. Do not assume a symlink is portable across machines, containers, or remote agents.

## Human Convenience vs. Reproducible Automation

Repository shorthand is useful for interactive discovery:

```bash
npx skills add owner/repo
```

It intentionally follows the package runner and repository defaults.
It is not a reproducible automation form.

Automation must pin two independently reviewed inputs:

```bash
npx --yes skills@<reviewed-version> add \
  https://github.com/owner/repo/tree/<reviewed-tag-or-sha>/skills/my-skill \
  --skill my-skill --yes
```

- Review the installer package version under the project supply-chain policy.
- Apply the required release cool-off before adopting a new version.
- Pin the source tag or commit that contains the reviewed skill content.
- Audit the resulting dependency and installed bundle.
- Never substitute “the current newest version” without a separate review.

The source pin and runner pin solve different problems.
A pinned repository with an unpinned installer still executes moving package code; a
pinned installer with a moving repository still installs unreviewed instructions or
scripts.

## Discovery Directories

If a repository publishes `skills/<name>/` for installers to discover:

- commit the complete directory, not just `SKILL.md`
- generate it from the same source as any project-installed copies
- compare every logical file in drift tests
- validate every relative link from the discovery copy
- keep CLI binaries in their normal package distribution

An authored directory and installed mirror may live at different paths while remaining
the same logical bundle.
Normalize only intentionally variable metadata in drift tests.

## Narrow Tool Permissions

The [Agent Skills specification](https://agentskills.io/specification) defines
`allowed-tools` as optional and experimental.
It is a space-separated string, and support depends on the consuming agent:

```yaml
allowed-tools: Bash(mycli:*) Read Write
```

Avoid comma-separated pseudo-lists.
More importantly, do not pre-approve general package runners:

```yaml
# Unsafe: each wildcard can fetch and execute arbitrary packages.
allowed-tools: Bash(npx:*)
allowed-tools: Bash(uvx:*)
allowed-tools: Bash(pnpm:*)
```

A pin in the skill body does not narrow a wildcard permission in frontmatter.
Prefer one of these policies:

1. Approve only the installed tool entrypoint, such as `Bash(flowmark:*)`.
2. Omit `allowed-tools` and let the agent request permission for the exact pinned
   fallback command.
3. Provide a narrow project wrapper whose reviewed implementation fixes the package and
   arguments.

Do not add vendor-specific permission metadata merely because a vendor supports it.
`name` and `description` remain the portable baseline.

## Local-First, Published-Pin Fallback

A generated CLI-backed skill should prefer the local entrypoint and fall back to a
published release:

```bash
if command -v mycli >/dev/null 2>&1; then
  mycli check
else
  uvx --from mycli==1.4.2 mycli check
fi
```

The generator must not bake its development version into committed instructions unless
that version is actually resolvable.
Select the last reviewed published release or fail generation with an actionable
message.

Keep the runtime pin and the install-source pin visible enough for reviewers to audit.
Do not hide network execution inside an opaque setup hook.

## Distribution Checklist

- [ ] The installed unit is the complete skill directory
- [ ] CLI installation and skill installation are described separately
- [ ] Project/user scope and name collisions are explicit
- [ ] Copy/symlink behavior matches supported environments
- [ ] Automation pins both installer code and source content
- [ ] Pins satisfy the supply-chain review and cool-off policy
- [ ] Discovery copies include all resources and pass drift tests
- [ ] `allowed-tools`, if present, is space-separated and narrowly scoped
- [ ] No package-runner wildcard is pre-approved
- [ ] Durable docs link to changing upstream tables rather than freezing counts

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->

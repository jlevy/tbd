---
title: Agent Skills and CLI Integration Patterns
description: A concise decision guide for portable skills, CLI-backed skills, safe bundle installation, and agent integration
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: general
---
# Agent Skills and CLI Integration Patterns

Use this guideline when a capability should be discoverable and usable by coding agents.
It covers the portable baseline and the decisions that determine how far to go.
Most capabilities need one small skill, not an integration platform.

The [Agent Skills specification](https://agentskills.io/specification) defines a skill
as a directory containing `SKILL.md` and optional `scripts/`, `references/`, and
`assets/`. The same basic bundle can work across agents that implement the standard.

## Front-Load Orientation; Retrieve Procedures on Demand

The always-loaded layer should be an **orientation map**, not a manual.
Keep enough stable information resident for the agent to recognize the capability,
decide when it applies, and locate authoritative instructions.
Retrieve commands, examples, and edge cases only when the current action needs them.

This design maximizes the **relevance density** of the working context.
It matters even when context space is plentiful: irrelevant procedure competes with the
information the agent is using to make the current decision.

Two failures bound the design:

- **Awareness debt**: the map omits a relevant capability, so the agent acts without
  knowing that better instructions or tooling exist
- **Context dilution**: the map embeds procedures that are irrelevant to the current
  action, weakening the signal the agent needs

For each line, ask:

1. Does the agent need this to recognize the capability or choose the next route?
   Keep it in the resident layer.
2. Does the agent need it only while performing a particular action?
   Put it behind a direct route and load it at that action.

This is why a skill points while the CLI documents, and why a concise `AGENTS.md` block
routes to a skill or command instead of restating it.
Maintenance and reduced duplication are useful consequences, but better decisions are
the primary goal.

## Choose the Lowest Useful Rung

Start at L0 and add a rung only when a concrete requirement demands it.

| Rung | Capability | Add it when |
| --- | --- | --- |
| L0 | Prompt-only skill | Instructions and bundled resources are the complete capability |
| L1 | CLI-backed skill | Deterministic execution needs an existing or pinned CLI |
| L2 | Self-installing CLI | The CLI must install or update its own skill bundle |
| L2b | L2 plus managed project instructions | The tool also needs a compact, durable `AGENTS.md` route |
| L3 | Agent integration platform | Many workflows require setup, migrations, hooks, and on-demand knowledge injection |

Examples:

- L0: a review method, writing standard, artifact template, or domain knowledge pack
- L1: a formatter invoked locally or through a pinned zero-install runner
- L2: a CLI that installs the same complete skill bundle at project or user scope
- L2b: [Flowmark](https://github.com/jlevy/flowmark) and
  [Practical Prose](https://github.com/jlevy/practical-prose)
- L3: [tbd](https://github.com/jlevy/tbd)

Do not add separate skills for each operation of one coherent tool.
Prefer one focused skill with direct routes to operation-specific help or references.

## Write the Portable Skill First

### Directory Shape

A minimal skill is one folder and one file:

```text
my-skill/
└── SKILL.md
```

Add resources only when they improve the workflow:

```text
my-skill/
├── SKILL.md
├── references/
│   └── project-setup.md
├── scripts/
│   └── validate.sh
└── assets/
    └── report-template.md
```

Keep referenced material one level from `SKILL.md`. Every resource should say when it
must be loaded. Avoid reference-to-reference chains that make the agent hunt for the
actual procedure. Knowledge-heavy skills should add an explicit reading protocol: which
reference answers which question, what order a deep pass reads them in, and when the
resident instructions are enough on their own.

### Frontmatter

Portable skills universally depend on `name` and `description`:

```markdown
---
name: spreadsheet-analysis
description: >-
  Analyze spreadsheet files, build summaries, and export validated workbooks.
  Use for .xlsx, .xls, .csv, and .tsv analysis or workbook generation.
---

Inspect the input workbook, preserve its existing structure, and validate the rendered
result before delivery.
```

Write the description in two parts:

- **Capability**: what the skill does and what result it produces
- **Activation**: the requests, artifacts, or terms that should cause it to load

Front-load distinctive trigger terms because agents may shorten descriptions when many
skills are available.
Test both positive and negative prompts: the skill should load when relevant and stay
out of unrelated tasks.

The specification also defines optional `license`, `compatibility`, and `metadata`
fields. Use them when distribution terms or environment requirements matter; do not
invent vendor-specific keys for a portable skill.

`allowed-tools` is optional, experimental, and implementation-dependent.
When a target supports it, the Agent Skills specification defines it as a
space-separated string:

```yaml
allowed-tools: Bash(mycli:*) Read Write
```

Do not assume the field works across agents.
Where it is honored, it is a pre-approval, not a sandbox: tools outside the list stay
available under the agent’s normal permission rules.
Never grant wildcard access to a general package runner such as `Bash(npx:*)`,
`Bash(uvx:*)`, or `Bash(pnpm:*)`; those permissions can execute arbitrary fetched
packages. Prefer a narrow installed entrypoint, or omit pre-approval and let the agent
request permission for a pinned fallback.

### Body

Use direct, imperative instructions.
State:

- what inputs to inspect before acting
- the shortest correct workflow
- the observable completion and validation criteria
- the important failure or safety boundaries
- when the skill should not be used or must escalate to a larger change
- direct routes to deeper help needed by particular actions

Prefer instructions over scripts.
Add a script only when deterministic behavior, repeatability, or external tooling
justifies executable code.
Treat every imported skill and bundled script as code: review its provenance, commands,
network behavior, and data access before installation.

## Use `AGENTS.md` for Durable Project Orientation

`AGENTS.md` is appropriate for repository-wide conventions and routes that should be
available in every task.
Keep it compact:

```markdown
## mycli

Use `mycli` for repository formatting and validation.
Run `mycli --help` for current commands and `.agents/skills/mycli/SKILL.md` for the
agent workflow.
```

Do not paste the skill or CLI manual into `AGENTS.md`. The project file should identify
the capability, establish the durable rule, and point to the current procedure.

If a CLI owns the block, L2b publication rules apply: use stable markers, preserve
user-owned content, carry a format stamp when future compatibility requires it, reject
newer unknown formats, and collapse duplicate managed blocks.
Load `tbd docs show agent-platform-integration` before implementing those mechanics.

## Build an L1 CLI-Backed Skill

An L1 skill adds deterministic execution without making the CLI an integration platform.

### Prefer Local-First Execution

Use the project-installed command first.
If zero-install execution is useful, give an exact reviewed fallback:

```bash
if command -v mycli >/dev/null 2>&1; then
  mycli check README.md
else
  npx --yes mycli@1.4.2 check README.md
fi
```

The package and version are part of the workflow contract.
Do not use `@latest`, a moving branch, or an unversioned `npx`, `uvx`, `pnpm dlx`, or
`bunx` command in agent instructions.
Follow the project supply-chain policy before selecting or changing the pin.

When generated artifacts need a fallback pin, derive it from a known published release,
not the running development build.
A local version such as `1.5.0-dev.<sha>` may not be resolvable from the registry.

### Make Failures Actionable

The CLI should:

- return nonzero when any requested operation fails
- identify the exact failing input or artifact
- preserve the original error context
- distinguish a missing local entrypoint from a failed pinned fallback
- state the recovery action without claiming success after partial failure
- operate within agent sandboxes or explain the narrow permission it needs

Add structured output only when output is naturally structured or automation benefits
from it. A formatter or stream transformer does not need JSON merely because it is
agent-facing.

## Publish Multi-File Bundles as One Logical Unit

Once a skill has references, scripts, or assets, independent file writes can expose a
mixed or broken version.
Validate and stage the complete bundle before publication.
Prefer atomic same-filesystem directory replacement when the directory is wholly owned
and platform semantics allow it.

Publishing resources first and link-bearing `SKILL.md` last is a useful fallback for a
new install, but it is not a transaction.
During upgrades, old `SKILL.md` may observe new resources.
Use versioned or backward-compatible resources, or a stronger atomic strategy, when
mixed versions are unsafe.

A command that prints `SKILL.md` is not equivalent to installing the directory.
If the printed text has relative links, it must materialize the complete bundle, inline
the needed content, or give the exact materialization command before asking the agent to
follow those links.

Before implementing a publisher, installer, discovery copy, or printed skill route, load
`tbd docs show agent-skill-bundle-publication` for the publication algorithm, ownership
rules, and failure tests.

## Choose Distribution Separately from Execution

A skill installer materializes the skill directory.
It does not install the separate CLI distribution or guarantee that its entrypoint is on
`PATH`.

Valid combinations include:

- L0: the installed skill directory is the complete capability
- L1: the installed skill calls a local command or reviewed pinned runner
- L2/L2b: the CLI can also install and update its own agent surfaces

Project and user/global scope are different policy decisions.
Default to project scope for reproducible team behavior.
Offer user scope when the skill is a personal tool and document precedence and collision
behavior.

For current `skills add`/`skills use` behavior, reproducible installer examples,
copy-versus-symlink tradeoffs, discovery directories, and permission guidance, load
`tbd docs show agent-skill-distribution`.

## Add Platform Machinery Only at L3

L3 is justified when a tool must coordinate many on-demand workflows and evolving
integration surfaces.
Features such as these are L3 concerns, not universal skill requirements:

- `setup`, migration orchestration, and multi-surface refresh
- `prime` or session-start context restoration
- lifecycle hooks
- brief and full instruction tiers
- a document cache, registries, or knowledge-injection commands
- format migrations across several generated artifacts

Load `tbd docs show agent-platform-integration` before implementing L2b managed blocks,
L3 lifecycle machinery, hooks, MCP integration, or Claude Code or Codex plugin
packaging.

## Rung-Specific Checklist

### Every Skill

- [ ] One focused capability with explicit inputs and outputs
- [ ] Description states capability and activation conditions
- [ ] Body is imperative, concise, and validated with realistic prompts
- [ ] Positive and negative activation checks pass
- [ ] Direct, one-level resource routes say when to load each resource
- [ ] Bundled scripts and third-party content are reviewed as code
- [ ] Review finds neither awareness debt nor context dilution

### L1 CLI-Backed Skill

- [ ] Project/local entrypoint is tried first
- [ ] Network fallback pins a reviewed package version
- [ ] Generated pins identify a published release, not a development build
- [ ] Failures are actionable and return accurate exit codes
- [ ] Sandbox and permission behavior is documented
- [ ] JSON exists only when the command’s output or automation warrants it

### L2 Self-Installer

- [ ] Installation publishes the complete logical bundle deterministically
- [ ] Repeated installation is idempotent
- [ ] Project and user scopes, precedence, and collisions are explicit
- [ ] Every managed artifact has an ownership and forward-compatibility policy
- [ ] Discovery and installed copies have drift tests
- [ ] Failure tests prove that no broken entrypoint becomes visible

### L2b Managed Project Instructions

- [ ] Managed `AGENTS.md` content is compact and marker-bounded
- [ ] User-owned content outside markers is byte-preserved
- [ ] A format stamp and newer-format guard exist when evolution requires them
- [ ] Repeated setup collapses duplicate stale managed blocks
- [ ] Surface location identifies the artifact; do not add redundant marker metadata

### L3 Integration Platform

- [ ] Setup previews and diagnostics are read-only until apply is explicit
- [ ] Setup and migrations are idempotent and failure-tested
- [ ] Session context routes to on-demand knowledge instead of embedding it
- [ ] Hooks are minimal, observable, and non-destructive by default
- [ ] Brief/full tiers and document registries have a demonstrated context need
- [ ] Generated surfaces share one source and have drift tests

## Direct References

Each reference is optional and one level from this core:

- `tbd docs show agent-skill-bundle-publication`: load when a skill contains multiple
  files, an installer publishes generated skills, or a command prints a skill with
  relative links
- `tbd docs show agent-skill-distribution`: load when choosing install scope,
  `skills add`/`skills use`, a pinned automation form, discovery copies, or
  `allowed-tools`
- `tbd docs show agent-platform-integration`: load when building L2b managed
  `AGENTS.md`, L3 setup/hooks/knowledge injection, MCP integration, or Claude/Codex
  plugin distribution

Primary standards and current platform documentation:

- [Agent Skills specification](https://agentskills.io/specification)
- [AGENTS.md](https://agents.md)
- [Codex skills](https://learn.chatgpt.com/docs/build-skills)
- [Codex plugins](https://learn.chatgpt.com/docs/plugins)
- [Claude Code skills](https://code.claude.com/docs/en/skills)
- [Claude Code plugins](https://code.claude.com/docs/en/plugins)
- [Anthropic skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
- [`anthropics/skills`](https://github.com/anthropics/skills) (official examples and
  plugin packaging)
- [`vercel-labs/skills`](https://github.com/vercel-labs/skills)

Related tbd guidance:

- `tbd guidelines typescript-cli-tool-rules`
- `tbd guidelines general-testing-rules`
- `tbd guidelines supply-chain-hardening`

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->

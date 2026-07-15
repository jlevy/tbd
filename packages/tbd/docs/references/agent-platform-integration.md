---
title: Agent Platform Integration
description: Managed AGENTS.md, L3 setup and lifecycle, hooks, MCP, and Codex-specific skill and plugin guidance
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: general
---
# Agent Platform Integration

Load this reference when implementing an L2b managed `AGENTS.md` block, an L3 setup or
migration system, lifecycle hooks, MCP integration, or Codex-specific plugin packaging.

## L2b: Managed Project Orientation

An L2b tool adds one compact managed `AGENTS.md` block to its L2 skill installer.
The block should name the capability, state the durable project rule, and route to the
installed skill or current CLI help.

Use stable begin/end markers and replace the owned block in place:

```markdown
<!-- BEGIN MYCLI INTEGRATION format=f02 -->
## mycli

Use `mycli` for repository formatting. Read `.agents/skills/mycli/SKILL.md` before
changing formatter configuration.

<!-- END MYCLI INTEGRATION -->
```

Requirements:

- preserve all user-owned bytes outside the markers
- find and collapse every stale duplicate block
- validate the existing format before any write
- refuse to overwrite a newer unknown format
- make repeated installation byte-identical
- report whether the block is current, stale, missing, user-owned, or too new
- keep dry-run and ordinary diagnostics read-only

Add a format stamp only when the managed syntax or semantics can evolve incompatibly.
The artifact location already identifies its surface, so do not repeat a `surface=`
attribute in the marker.

[Flowmark](https://github.com/jlevy/flowmark) and
[Practical Prose](https://github.com/jlevy/practical-prose) are L2b references.
Their specific pins, languages, and generated text are examples, not universal
requirements.

## L3: Integration Platform

L3 tools coordinate enough workflows that on-demand knowledge becomes a product surface.
A typical architecture has:

1. A compact always-loaded project block.
2. A portable skill that describes capabilities and activation.
3. CLI readers such as `guidelines`, `shortcut`, or `reference`, each with discovery and
   exact lookup.
4. Deterministic setup that installs generated surfaces.
5. Optional session restoration and lifecycle hooks.

The orientation rule still applies: list what exists and when it matters, then load the
procedure at the action.
Avoid composing an entire knowledge library into the main skill.

L3 may justify:

- setup and format migrations
- a path-ordered document registry with shadowing
- brief and full instruction tiers
- session-start context restoration
- hook installation and cleanup
- per-surface generation and forward guards

Each feature needs a demonstrated workflow requirement.
Do not copy L3 machinery into a small formatter or single-purpose skill.

## Setup: Preview, Plan, Apply

Treat setup as a state transition with three phases:

1. **Inspect and validate** every relevant artifact, including shared state outside the
   worktree.
2. **Plan** the complete set of creates, updates, migrations, removals, and blockers.
3. **Apply** only after validation succeeds and mutation is explicitly requested.

Dry-run executes inspection and planning but never apply.
Its invariant is stronger than a clean `git status`: tracked, untracked, ignored,
symlink, mode, and shared git-common-dir state must remain byte-for-byte unchanged.

Ordinary diagnostics should reuse the same comparison model and remain read-only.
They may report the exact setup command that would refresh stale surfaces; they should
not silently rewrite committed instructions during session startup.

## Agent-Facing CLI Contracts

Add agent-specific CLI modes only when a workflow needs them.
Useful patterns include:

- **Structured diagnostics:** `doctor --json` reports one record per check with status,
  evidence, and an exact remedy.
  Human output and machine output should describe the same findings.
- **Sandbox boundaries:** identify when results are provisional in a sandbox, warn once,
  and require an explicit host rerun before claiming success that depends on host state.
- **Handoff plus verification:** return a dashboard or deployment link when a human must
  complete an interactive step, then provide a separate command that verifies the
  resulting state.
- **Large-output materialization:** save bulky output to a named file and tell the agent
  how to query the relevant portion instead of flooding context.
- **Structured input:** add `--input-json` only when callers need to express data that
  is awkward or unsafe as a growing set of shell flags.

These are conditional contracts, not a universal checklist for every CLI. A small local
formatter may need none of them.
When they exist, test text and JSON parity, exit codes, remedies, sandbox messaging, and
the verification path.

Skill validation may use checked-in evaluation prompts and scaffold fixtures when
activation or generated-project behavior is complex enough to regress.
Keep the format tool-agnostic unless a specific evaluation runner is part of the
supported workflow.

## Hooks and Lifecycle

Use a hook only when work must occur at a lifecycle boundary and cannot reliably wait
for explicit invocation.
Hooks should be:

- minimal and fast
- local-first with reviewed published fallbacks
- visible in setup plans and diagnostics
- non-destructive by default
- idempotently installed and removable
- tested for missing commands, noninteractive execution, and failure exit codes

Do not use hooks to inject a full manual every session.
A session hook may restore a small orientation map and route the agent to current
instructions.

Keep hook event names and configuration in platform-specific references because they
change independently.
Link to the current vendor documentation instead of preserving a durable event matrix
here.

## Choose CLI, Skill, MCP, or Plugin by Responsibility

| Surface | Best fit |
| --- | --- |
| Skill | Reusable instructions, references, templates, and deterministic local scripts |
| CLI | Local files, composable commands, deterministic transformations, and shell workflows |
| MCP server | Live remote data/actions, OAuth, service-managed authorization, or multi-tenant tools |
| Plugin | Installable distribution of skills with connectors, MCP configuration, hooks, or assets |

A skill can route to a CLI or MCP tool; these surfaces are complementary.
Do not add an MCP server merely to wrap a local deterministic command, and do not force
remote service work through a shell CLI when authorization and live data belong in a
connector.

## Codex Guidance

Current [Codex skill documentation](https://developers.openai.com/codex/skills) says:

- a skill directory contains `SKILL.md` plus optional scripts and references
- `name` and `description` are required
- repository skills live under `.agents/skills` from the current directory through the
  repository root; user and administrator locations are also available
- Codex follows symlinked skill directories
- `agents/openai.yaml` is optional metadata for UI, invocation policy, and tool
  dependencies

Codex includes an initial skill list in context so it can choose a skill.
The documented budget is at most 2% of the model context window, or 8,000 characters
when the context window is unknown.
Codex shortens descriptions first and may omit skills when the list is too large.
Keep descriptions concise and front-load activation terms; do not treat another agent’s
budget as the portable standard.

Direct skill folders are appropriate for local authoring and repository workflows.
Current [Codex plugin documentation](https://developers.openai.com/codex/plugins)
recommends plugins for reusable distribution beyond one repository, including a single
reusable skill, multiple skills, connectors, MCP configuration, hooks, or presentation
assets. This is a Codex distribution recommendation, not a reason to abandon a simple
cross-agent `skills/<name>/` directory.

Use the smallest combination that serves the audience:

- one repo-local cross-agent workflow: `.agents/skills/<name>/`
- simple cross-agent source distribution: a complete `skills/<name>/` directory
- installable Codex distribution beyond one repo: a plugin
- connector-backed or multi-skill Codex bundle: a plugin

Do not require `agents/openai.yaml`, a Codex plugin, a Claude plugin, or per-agent
copies for every portable skill.
Add each surface only for a concrete consumer or distribution need.

## Platform Validation

- [ ] Dry-run changes no project, ignored, or shared state
- [ ] Planning validates every artifact before apply
- [ ] Managed blocks preserve user content and collapse duplicates
- [ ] Newer formats fail before partial writes
- [ ] Setup is idempotent after migration
- [ ] Diagnostics and session startup are read-only
- [ ] Agent-facing JSON, remedies, handoffs, and sandbox rules exist only where needed
- [ ] Structured and human output agree on findings and exit status
- [ ] Hooks are observable, minimal, and failure-tested
- [ ] Resident context contains orientation, not procedure dumps
- [ ] Platform-specific details link to current official docs
- [ ] Codex metadata and plugins are added only for a real Codex need

Primary references:

- [Codex skills](https://developers.openai.com/codex/skills)
- [Codex plugins](https://developers.openai.com/codex/plugins)
- [Codex AGENTS.md](https://developers.openai.com/codex/guides/agents-md)
- [Codex MCP](https://developers.openai.com/codex/mcp)
- [Claude Code skills](https://code.claude.com/docs/en/skills)
- [Claude Code hooks](https://code.claude.com/docs/en/hooks)
- [AGENTS.md](https://agents.md)

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->

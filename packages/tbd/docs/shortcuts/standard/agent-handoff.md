---
title: Agent Handoff
description: Generate a concise handoff prompt for another coding agent to continue work
category: session
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
Generate a high-signal handoff prompt for the next agent.
Focus on what’s specific and non-obvious.
The next agent has access to tbd and will orient themselves.

## Before Handoff

Re-read the beads and record their current state before generating the handoff.
Run `tbd sync` when the recipient uses a separate clone exchanging bead state or project
policy requires publication.
Explicit project requirements remain authoritative.
Linked worktrees in one clone already share accepted updates; local-only or offline
handoffs need no remote exchange unless project policy requires it.

If the outgoing and incoming agents may overlap instead of transferring work in
sequence, also follow `tbd shortcut coordinate-collaborators`. A visible claim remains
owned by its current delegate until the coordinator explicitly reassigns it.

## What to Include

- **Task**: One line on what we’re doing
- **Spec**: Path to active spec + relevant sections
- **Beads**: tbd issue ID(s), status, dependencies, outgoing and incoming resolved
  acting names, acknowledged reassignment if any, and remote publication status when
  applicable
- **Branch**: Current branch, base branch (if not main), pushed to remote?
- **PR**: Filed/not filed, URL, CI status, up to date with branch?
- **Git**: Uncommitted changes, files modified
- **Context**: Current work state, challenges encountered, approaches being taken
- **References**: Similar code or patterns in the codebase
- **Setup**: Only non-obvious setup the next agent wouldn’t already know

## What to Skip

- Generic instructions the agent would figure out
- tbd usage (it self-documents)
- Obvious next steps derivable from the spec
- Boilerplate sections with no content

## Example

```
Task: Implement standalone CLI distribution for dxterm-cli.

Spec: plan-2026-01-26-dxterm-local-research-tools.md - "Phase 4: Standalone CLI" section.

Beads: ar-hzhw (in progress), ar-j3k9 (blocked by ar-hzhw) - synced

Branch: feature/standalone-cli-42Xk (from main), pushed to origin

PR: #127 https://github.com/org/repo/pull/127 - CI failing, 2 commits behind branch

Git: Uncommitted changes in packages/dxterm-cli/src/

Context: @arena/reports exports FORMS_DIR (filesystem path), preventing standalone npm
publishing. Adding codegen to embed form strings at build time, following the
@arena/llm-pricing pattern. Codegen script is done; now updating form-registry.ts
to use getFormContent() instead of readFile().

References: packages/llm-pricing/ - see scripts/generate-llms-data.ts and src/_generated/

Setup: Run `pnpm install` after pulling (new dependencies added).
```

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->

---
title: README Restructure Review and Implementation Plan
description: Review and implementation plan for a current, concise README that explains tbd's core value, gradual adoption, and customizable workflows
author: Joshua Levy with LLM assistance
---
# README Restructure Review and Implementation Plan

**Updated:** 2026-09-30\
**PR:** [#313](https://github.com/jlevy/tbd/pull/313)\
**Implementation bead:** `tbd-athj`

## Decision and Scope

Restructure the merged README while preserving the product positioning: tbd is a skill
and CLI for coding quality, task tracking, and workflows for coding agents.
Its three adoption principles are **gradual**, **customizable**, and **batteries
included**. The README should make a useful first session easy and point to maintained
references for advanced work.

The user requested a deep review, an updated plan, and end-to-end implementation on
2026-09-30, after merging #309 and #310. This supersedes the September 19 decision to
make only a light framing edit (`tbd-eti9`, completed).
That framing remains the starting point; the earlier proposal to position tbd primarily
as an issue tracker is not adopted.

The baseline is `origin/main` at `f08eeee9`, with a 677-line README. Root `README.md` is
the source for GitHub, the npm package, and `tbd readme`; package and distribution
copies are generated.
No CLI behavior, policy values, or model defaults change here.

## Review Findings

### 1. Preserve the Broader Product Value

The old proposal’s issue-tracker-first opening narrows the product beyond the user’s
stated pitch. Keep coding quality, task tracking, and workflows together.
Explain what beads, guidelines, and shortcuts do with concrete examples, without
promising that instructions guarantee good code or prevent every loss of work.

Keep the four capability names shared with the skill and design: Beads, Spec-Driven
Workflows, Knowledge Injection, and Shortcuts.
Their descriptions should be count-free, accurate, and consistent across those surfaces.

### 2. Distinguish Minimal Use from Default Setup

The proposed adoption ladder calls `tbd setup --auto` the minimal core, but that command
installs six agent surfaces by default.
Use the supported `tbd init --prefix=<name>` path to explain CLI-only beads.
Keep agent-assisted setup as the main quick start.
Do not imply that npm installation alone initializes a repository.

`--surfaces` selects what a setup run installs or refreshes; it does not remove surfaces
installed by an earlier run.
Initialization, migrations, and documentation refresh still happen.
Replace the proposal’s misleading “keeps only” wording.

### 3. Explain Choice Without Inventing Prerequisites

Web viewing and watching are useful with beads alone.
They do not require adopting workflow shortcuts, standing GitHub grants, or Linear.
Keep local viewing distinct from remote observation and explicit synchronization.

Setup offers policy questions; users may defer them.
Most unanswered action policies require authorization when needed, while review
requirements default to `standard` and merge authorization defaults to `confirm-every`.
A sentence saying that every unanswered policy is simply “ask-first” hides those
distinctions.
Policies describe agent instructions and consent; they are not a sandbox or
enforcement mechanism.
Link the full policy definitions rather than reproducing their schema.

### 4. Remove Reference Duplication, Not Useful Discovery

The README currently repeats the operator manual in its request table, commands, policy
block, merge checklist, and FAQ. Keep representative requests and the distinction
between reviewing, fixing, preparing to merge, and actually merging.
Link the full lifecycle rather than copying its process.

Keep the generated catalogs as a collapsible appendix after the main guide.
Their markers, generator, counts, and drift tests already prevent stale names; retain
that mechanism. Do not replace it with a second hand-maintained roster.

### 5. Make Customization Practical

Explain the three choices: load bundled docs when needed, fork and edit them in the
repository, or add the team’s own docs.
Show the supported commands and link to the manual for configuration and update
conflicts. Keep project files visible and reviewable; do not recommend editing the
disposable `.tbd/docs/` cache.

### 6. Keep Claims Current and Qualified

Remove authored catalog counts, old PR-relative implementation instructions, opaque chat
links, and unsupported promises such as conflict-free collaboration or almost automatic
implementation.
Describe tbd’s own storage and compatibility scope without asserting what
another project’s latest architecture is.

Model names, hook implementation details, credential permissions, policy grammar, and
merge gates belong in their maintained references.
Keep requirements, setup effects, upgrade guidance, and migration verification visible
where a new user needs them.

## Information Architecture

1. **Opening and capabilities:** retain the product pitch and explain the four shared
   capabilities without stale counts.
2. **Quick Start:** install, ask the agent to set up the project, choose a prefix,
   understand the files and optional policy questions, and give a first task.
3. **Adopt Only What You Want:** CLI-only beads, selected agent integrations,
   customizable docs, and optional workflows.
   These are choices, not mandatory stages.
4. **Talking to Your Agent:** a short example table; retain precise review/merge request
   routing and link the full request vocabulary.
5. **Optional Capabilities:** web/watch, project policies and delegation, and Linear,
   each with the relevant boundary and a maintained reference.
6. **Installation and Setup:** prerequisites, existing projects and upgrades, selected
   surfaces, team setup, GitHub tooling, and Beads import.
   Avoid copying hook scripts or credential setup procedures.
7. **Guidelines and Shortcuts:** on-demand loading, forking, adding team docs, and links
   to the complete manual and generated appendix.
8. **Commands and Background:** a small task/doc/status reference and a brief
   explanation of durable task memory and repeatable engineering practices.
9. **Contributing, License, and Bundled Library:** preserve contributor links and
   license; put the generated catalogs last so they do not interrupt orientation.

Aim for roughly 350 authored lines plus the generated appendix.
Length is a check on duplication, not a reason to omit installation effects or important
boundaries. Use the common documentation guidelines: progressive disclosure,
present-state prose, concrete examples, stable links, consistent headings, and one
footer at the end.

## Implementation Checklist

- [x] Rebase #313 onto merged main and inspect the current README, CLI, manual, design,
  installed skill sources, and generator contracts.
- [x] Replace the stale proposal and historical implementation stop with this current
  decision and plan; track new work separately from completed `tbd-eti9`.
- [x] Restructure root README and preserve all generated catalog regions.
- [x] Align the shared capability descriptions in skill-baseline and design §1.1;
  regenerate committed skill copies rather than editing generated content by hand.
- [x] Verify minimal initialization and selected-surface setup in isolated fixtures,
  including the fact that surface selection does not uninstall existing files.
- [x] Clarify both user-run and agent-run CLI installation, then prime, prefix
  selection, repository initialization, and the setup shortcut; verify that shortcut
  lookup requires initialization before policy review.
- [x] Check Markdown links and anchors, generated catalogs, request routing, installed
  skill drift, and the packaged `tbd readme` copy.
- [x] Format with the repository’s pinned formatter, review the complete diff, and run
  the required checks.
- [x] Prepare the PR title and description for the implemented scope and track final
  publication, final-head CI, and closure in `tbd-athj`.

## Validation Record

The README is 486 lines, including 114 lines of generated catalogs, down from 677. The
three catalog regions remain generated and unchanged in content.
The final read-only workflow audit found no blocking issues; its minor correction to the
setup link description was applied.

- **Documentation contracts:** 72 tests passed across `readme-reference-tables`,
  `review-lifecycle-contract`, and `integration-files`. The full suite also caught a
  missing template example; `tbd template plan-spec` was restored alongside the shortcut
  and guideline examples.
  Both doc-reference tests pass after that fix, and all 27 prime CLI golden checks pass.
- **Links:** all 135 relative links and fragments in the README and this plan resolve.
- **Setup examples:** in a fresh temporary Git repository with an initial commit,
  `tbd init --prefix=myapp` created configuration without agent integrations, and a
  created bug appeared in `tbd ready`. Setup with
  `--surfaces=portable,agents-md --no-gh-cli` created only those surfaces.
  After installing Claude separately, repeating that selection retained Claude;
  unrestricted setup then installed the remaining surfaces.
  This confirms both the selection boundary and its per-invocation scope.
- **Packaging and final checks:** the implementation bead and PR review record the full
  suite, packaged README verification, and final-head CI results.

## Source and Maintenance Map

| Topic | Maintained source |
| --- | --- |
| Product capabilities and principles | [Design §1](../../../packages/tbd/docs/tbd-design.md#1-introduction), [skill-baseline](../../../packages/tbd/docs/shortcuts/system/skill-baseline.md) |
| Setup behavior and choices | [setup-tbd](../../../packages/tbd/docs/shortcuts/standard/setup-tbd.md), `src/cli/commands/init.ts`, `src/cli/commands/setup.ts` |
| Policy definitions and defaults | [agent-policy-grants](../../../packages/tbd/docs/guidelines/agent-policy-grants.md), `src/lib/policy-grants.ts` |
| Review request vocabulary | [pr-review-workflows](../../../packages/tbd/docs/shortcuts/standard/pr-review-workflows.md) |
| Commands, docs, viewing, watching, and Linear | [CLI manual](../../../packages/tbd/docs/tbd-docs.md) |
| Catalog generation | `packages/tbd/scripts/generate-readme-tables.ts`, `tests/readme-reference-tables.test.ts` |
| README and skill packaging | `packages/tbd/scripts/copy-docs.mjs`, `tests/integration-files.test.ts` |
| Writing conventions | [common-doc-guidelines](../../../packages/tbd/docs/guidelines/common-doc-guidelines.md) |

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->

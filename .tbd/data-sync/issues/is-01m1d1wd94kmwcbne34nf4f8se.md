---
type: is
id: is-01m1d1wd94kmwcbne34nf4f8se
title: "New shortcut: stacked-prs (tbd policy layer over the official skill)"
kind: feature
status: open
priority: 1
version: 2
labels: []
dependencies:
  - type: blocks
    target: is-01m1d1x86a96ak3rzd8w6ft7ej
parent_id: is-01m1d1tam7230zrcj70ecmkt8b
created_at: 2026-08-31T23:18:44.259Z
updated_at: 2026-08-31T23:19:22.669Z
---
Add packages/tbd/docs/shortcuts/standard/stacked-prs.md.

SCOPE BOUNDARY (important): the official github/gh-stack skill already documents the mechanics,
including per-subcommand TTY behavior that we would otherwise have to reverse-engineer:
  - 'gh stack view' opens a TUI and blocks forever; agents must use --json
  - 'gh stack submit' prompts per PR; use --auto
  - 'gh stack merge <target> --yes'; plain 'gh pr merge' cannot merge a stack
  - 'gh stack modify' has NO non-interactive path
  - --remote is required when the repo has multiple remotes
Do not duplicate any of that. Point to the installed skill and keep this shortcut about POLICY.

WHAT THIS SHORTCUT OWNS
1. When to stack. Stacking is opt-in, never forced:
   - If the user says 'stacked PR' (or stack/layer/dependent PRs), actually produce a stack and
     verify it registered on GitHub. Do not quietly create one flat PR.
   - Offer stacking when a change plainly decomposes into dependent layers that each stand on
     their own (a refactor beneath a feature; a schema change beneath the code using it).
   - Do not push stacking for small or single-concern changes, and drop the suggestion once the
     user declines.
2. Layer discipline: one dependent concern per layer, foundational work at the bottom, each
   layer independently reviewable and independently revertible.
3. How stacks interact with beads: one bead per layer under a shared parent, so a stack and a
   bead tree line up.
4. Handoff to the existing lifecycle: which of the PR/review shortcuts still apply per layer.

Depends on the extension/skill provisioning bead, since the shortcut should assume the skill is
present and say what to do when it is not.
